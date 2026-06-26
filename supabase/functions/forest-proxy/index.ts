const TABLES = {
  settings: "forest_site_settings",
  boards: "forest_boards",
  posts: "forest_posts",
  comments: "forest_comments",
};

Deno.serve(async (request) => {
  const origin = Deno.env.get("CORS_ORIGIN") || "*";
  if (request.method === "OPTIONS") return cors(null, origin, 204);

  try {
    const env = readEnv();
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const admin = isAdmin(request, env);
    const clientKey = getClientKey(request);

    if (path === "/api/settings" && request.method === "GET") {
      const settings = await getSettings(env);
      return cors({ settings }, origin);
    }

    if (path === "/api/settings" && request.method === "PUT") {
      requireAdmin(admin);
      const body = await request.json();
      const settings = await rest(env, TABLES.settings, {
        method: "POST",
        search: "on_conflict=id",
        body: {
          id: "main",
          site_title: body.site_title || "별숲 커뮤니티",
          owner_user_id: body.owner_user_id || null,
          default_board_slug: body.default_board_slug || "free",
          background_url: body.background_url || null,
          theme: ["night", "dawn", "classic"].includes(body.theme) ? body.theme : "night",
          skin: body.skin === "classic" ? "classic" : "forest",
          updated_at: new Date().toISOString(),
        },
        prefer: "resolution=merge-duplicates,return=representation",
      });
      return cors({ settings: settings[0] || null }, origin);
    }

    if (path === "/api/boards" && request.method === "GET") {
      return cors({ boards: await listBoards(env) }, origin);
    }

    if (path === "/api/boards" && request.method === "POST") {
      requireAdmin(admin);
      const board = await rest(env, TABLES.boards, {
        method: "POST",
        search: "on_conflict=slug",
        body: sanitizeBoard(await request.json()),
        prefer: "resolution=merge-duplicates,return=representation",
      });
      return cors({ board: board[0] || null }, origin);
    }

    if (path === "/api/posts" && request.method === "GET") {
      const boardId = url.searchParams.get("boardId");
      return cors({ posts: await listPosts(env, boardId, clientKey, admin) }, origin);
    }

    if (path === "/api/posts" && request.method === "POST") {
      const body = await request.json();
      const board = await getBoard(env, body.board_id);
      if (!board) return cors({ error: "게시판이 없어." }, origin, 404);
      if (board.write_role === "owner" && !admin) return cors({ error: "관리자 로그인이 필요해." }, origin, 403);
      if (body.is_notice && !admin) return cors({ error: "공지글은 관리자만 가능해." }, origin, 403);

      const rows = await rest(env, TABLES.posts, {
        method: "POST",
        body: sanitizePost(body, clientKey, admin),
        prefer: "return=representation",
      });
      return cors({ post: scrubPost(rows[0], clientKey, admin) }, origin, 201);
    }

    const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch && request.method === "PUT") {
      const post = await getPost(env, postMatch[1]);
      if (!post) return cors({ error: "글이 없어." }, origin, 404);
      if (!admin && post.client_key !== clientKey) return cors({ error: "수정 권한이 없어." }, origin, 403);

      const body = await request.json();
      if (body.is_notice && !admin) return cors({ error: "공지글은 관리자만 가능해." }, origin, 403);
      const rows = await rest(env, TABLES.posts, {
        method: "PATCH",
        search: `id=eq.${encodeURIComponent(post.id)}`,
        body: sanitizePostUpdate(body, admin),
        prefer: "return=representation",
      });
      return cors({ post: scrubPost(rows[0], clientKey, admin) }, origin);
    }

    if (postMatch && request.method === "DELETE") {
      const post = await getPost(env, postMatch[1]);
      if (!post) return cors({ ok: true }, origin);
      if (!admin && post.client_key !== clientKey) return cors({ error: "삭제 권한이 없어." }, origin, 403);
      await rest(env, TABLES.posts, {
        method: "DELETE",
        search: `id=eq.${encodeURIComponent(post.id)}`,
      });
      return cors({ ok: true }, origin);
    }

    const viewMatch = path.match(/^\/api\/posts\/([^/]+)\/view$/);
    if (viewMatch && request.method === "POST") {
      await rpc(env, "increment_forest_post_view", { post_uuid: viewMatch[1] });
      return cors({ ok: true }, origin);
    }

    if (path === "/api/comments" && request.method === "GET") {
      const postId = url.searchParams.get("postId");
      return cors({ comments: await listComments(env, postId, clientKey, admin) }, origin);
    }

    if (path === "/api/comments" && request.method === "POST") {
      const body = await request.json();
      const post = await getPost(env, body.post_id);
      if (!post) return cors({ error: "글이 없어." }, origin, 404);
      const board = await getBoard(env, post.board_id);
      if (!board?.allow_comments) return cors({ error: "댓글이 닫혀 있어." }, origin, 403);
      const rows = await rest(env, TABLES.comments, {
        method: "POST",
        body: sanitizeComment(body, clientKey),
        prefer: "return=representation",
      });
      return cors({ comment: scrubComment(rows[0], clientKey, admin) }, origin, 201);
    }

    const commentMatch = path.match(/^\/api\/comments\/([^/]+)$/);
    if (commentMatch && request.method === "DELETE") {
      const comment = await getComment(env, commentMatch[1]);
      if (!comment) return cors({ ok: true }, origin);
      if (!admin && comment.client_key !== clientKey) return cors({ error: "삭제 권한이 없어." }, origin, 403);
      await rest(env, TABLES.comments, {
        method: "DELETE",
        search: `id=eq.${encodeURIComponent(comment.id)}`,
      });
      return cors({ ok: true }, origin);
    }

    return cors({ error: "없는 API야." }, origin, 404);
  } catch (error) {
    return cors({ error: error.message || "edge function error" }, origin, error.status || 500);
  }
});

function readEnv() {
  const secretKeys = parseJson(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.default || "";
  const env = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    ADMIN_TOKEN: Deno.env.get("ADMIN_TOKEN") || "",
  };
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL secret이 필요해.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SECRET_KEYS가 필요해.");
  if (!env.ADMIN_TOKEN) throw new Error("ADMIN_TOKEN secret이 필요해.");
  return env;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizePath(pathname) {
  return pathname.replace(/^\/forest-proxy/, "").replace(/\/+$/, "") || "/";
}

function isAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

function requireAdmin(admin) {
  if (!admin) {
    const error = new Error("관리자 로그인이 필요해.");
    error.status = 403;
    throw error;
  }
}

function getClientKey(request) {
  const raw = request.headers.get("x-forest-client-id") || "guest";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "guest";
}

async function getSettings(env) {
  const rows = await rest(env, TABLES.settings, {
    search: "id=eq.main&select=site_title,owner_user_id,default_board_slug,background_url,theme,skin",
  });
  return rows[0] || null;
}

async function listBoards(env) {
  return rest(env, TABLES.boards, {
    search: "select=id,slug,name,description,board_type,write_role,allow_comments,skin,sort_order&order=sort_order.asc,name.asc",
  });
}

async function getBoard(env, id) {
  const rows = await rest(env, TABLES.boards, {
    search: `id=eq.${encodeURIComponent(id)}&select=id,slug,name,description,board_type,write_role,allow_comments,skin,sort_order`,
  });
  return rows[0] || null;
}

async function listPosts(env, boardId, clientKey, admin) {
  if (!boardId) return [];
  const posts = await rest(env, TABLES.posts, {
    search: `board_id=eq.${encodeURIComponent(boardId)}&select=id,board_id,user_id,client_key,title,content,author_name,category,is_notice,view_count,created_at,updated_at&order=is_notice.desc,created_at.desc`,
  });
  const counts = await commentCounts(env, posts.map((post) => post.id));
  return posts.map((post) => ({
    ...scrubPost(post, clientKey, admin),
    comment_count: counts.get(post.id) || 0,
  }));
}

async function getPost(env, id) {
  const rows = await rest(env, TABLES.posts, {
    search: `id=eq.${encodeURIComponent(id)}&select=id,board_id,user_id,client_key,title,content,author_name,category,is_notice,view_count,created_at,updated_at`,
  });
  return rows[0] || null;
}

async function listComments(env, postId, clientKey, admin) {
  if (!postId) return [];
  const comments = await rest(env, TABLES.comments, {
    search: `post_id=eq.${encodeURIComponent(postId)}&select=id,post_id,user_id,client_key,author_name,content,created_at,updated_at&order=created_at.asc`,
  });
  return comments.map((comment) => scrubComment(comment, clientKey, admin));
}

async function getComment(env, id) {
  const rows = await rest(env, TABLES.comments, {
    search: `id=eq.${encodeURIComponent(id)}&select=id,post_id,user_id,client_key,author_name,content,created_at,updated_at`,
  });
  return rows[0] || null;
}

async function commentCounts(env, postIds) {
  const counts = new Map();
  if (!postIds.length) return counts;
  const inList = postIds.map((id) => `"${id}"`).join(",");
  const comments = await rest(env, TABLES.comments, {
    search: `post_id=in.(${encodeURIComponent(inList)})&select=post_id`,
  });
  comments.forEach((comment) => counts.set(comment.post_id, (counts.get(comment.post_id) || 0) + 1));
  return counts;
}

function sanitizeBoard(body) {
  return {
    ...(body.id ? { id: body.id } : {}),
    slug: String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32),
    name: String(body.name || "새 게시판").trim().slice(0, 40),
    description: String(body.description || "").trim().slice(0, 140),
    board_type: body.board_type === "blog" ? "blog" : "board",
    write_role: body.write_role === "owner" ? "owner" : "all",
    allow_comments: body.allow_comments !== false,
    skin: body.skin === "blog" ? "blog" : "table",
    sort_order: Number(body.sort_order || 100),
    updated_at: new Date().toISOString(),
  };
}

function sanitizePost(body, clientKey, admin) {
  return {
    board_id: body.board_id,
    user_id: null,
    client_key: clientKey,
    title: String(body.title || "").trim().slice(0, 100),
    content: String(body.content || "").trim().slice(0, 8000),
    author_name: String(body.author_name || "익명").trim().slice(0, 24),
    category: String(body.category || "일반").trim().slice(0, 20),
    is_notice: Boolean(admin && body.is_notice),
  };
}

function sanitizePostUpdate(body, admin) {
  return {
    title: String(body.title || "").trim().slice(0, 100),
    content: String(body.content || "").trim().slice(0, 8000),
    author_name: String(body.author_name || "익명").trim().slice(0, 24),
    category: String(body.category || "일반").trim().slice(0, 20),
    is_notice: Boolean(admin && body.is_notice),
    updated_at: new Date().toISOString(),
  };
}

function sanitizeComment(body, clientKey) {
  return {
    post_id: body.post_id,
    user_id: null,
    client_key: clientKey,
    author_name: String(body.author_name || "익명").trim().slice(0, 24),
    content: String(body.content || "").trim().slice(0, 1200),
  };
}

function scrubPost(post, clientKey, admin) {
  if (!post) return null;
  const { client_key, ...safePost } = post;
  return { ...safePost, can_edit: Boolean(admin || client_key === clientKey) };
}

function scrubComment(comment, clientKey, admin) {
  if (!comment) return null;
  const { client_key, ...safeComment } = comment;
  return { ...safeComment, can_edit: Boolean(admin || client_key === clientKey) };
}

async function rest(env, table, options = {}) {
  const search = options.search ? `?${options.search}` : "";
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${search}`, {
    method: options.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return readSupabaseResponse(response);
}

async function rpc(env, name, body) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return readSupabaseResponse(response);
}

async function readSupabaseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || response.statusText);
    error.status = response.status;
    throw error;
  }
  return Array.isArray(data) ? data : data ? [data] : [];
}

function cors(data, origin, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-forest-client-id",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
