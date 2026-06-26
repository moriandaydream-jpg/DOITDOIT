(function () {
  const STORAGE_KEY = "forest-cms-settings";
  const LOCAL_POSTS_KEY = "forest-cms-local-posts";
  const LOCAL_COMMENTS_KEY = "forest-cms-local-comments";
  const LOCAL_BOARDS_KEY = "forest-cms-local-boards";
  const LOCAL_USER_KEY = "forest-cms-local-user";
  const DEFAULT_BACKGROUND = "./assets/shooting-star-forest.png";

  const TABLES = {
    settings: "forest_site_settings",
    boards: "forest_boards",
    posts: "forest_posts",
    comments: "forest_comments",
  };

  const localUserId = getLocalUserId();
  const runtimeConfig = normalizeSettings(window.FOREST_BLOG_CONFIG || {});

  const defaultBoards = [
    {
      id: "notice",
      slug: "notice",
      name: "공지사항",
      description: "운영자가 올리는 안내 게시판",
      board_type: "board",
      write_role: "owner",
      allow_comments: true,
      skin: "table",
      sort_order: 10,
    },
    {
      id: "free",
      slug: "free",
      name: "자유게시판",
      description: "방문자들이 함께 쓰는 열린 게시판",
      board_type: "board",
      write_role: "all",
      allow_comments: true,
      skin: "table",
      sort_order: 20,
    },
    {
      id: "qna",
      slug: "qna",
      name: "질문답변",
      description: "질문과 답변을 남기는 게시판",
      board_type: "board",
      write_role: "all",
      allow_comments: true,
      skin: "table",
      sort_order: 30,
    },
    {
      id: "blog",
      slug: "blog",
      name: "블로그",
      description: "운영자만 작성하는 블로그",
      board_type: "blog",
      write_role: "owner",
      allow_comments: true,
      skin: "blog",
      sort_order: 40,
    },
  ];

  const samplePosts = [
    {
      id: "sample-1",
      board_id: "notice",
      user_id: "sample-owner",
      title: "별숲 커뮤니티를 열었어",
      content: "공지사항은 관리자만 작성하는 게시판이야. 운영 안내나 업데이트를 여기에 올리면 돼.",
      author_name: "관리자",
      category: "공지",
      is_notice: true,
      view_count: 12,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      updated_at: null,
    },
    {
      id: "sample-2",
      board_id: "free",
      user_id: "sample-guest",
      title: "첫 별똥별 본 사람?",
      content: "오늘 숲 배경이랑 너무 잘 어울려서 남겨봄. 여기 자유게시판은 방문자도 같이 쓰는 공간이야.",
      author_name: "별숲손님",
      category: "잡담",
      is_notice: false,
      view_count: 27,
      created_at: new Date(Date.now() - 1000 * 60 * 105).toISOString(),
      updated_at: null,
    },
    {
      id: "sample-3",
      board_id: "blog",
      user_id: "sample-owner",
      title: "블로그 모드는 이렇게 써",
      content: "블로그 게시판은 write_role이 owner라서 관리자 User ID와 같은 사람만 작성할 수 있어. 댓글은 게시판 설정에서 켜고 끌 수 있어.",
      author_name: "관리자",
      category: "정보",
      is_notice: false,
      view_count: 8,
      created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      updated_at: null,
    },
  ];

  const sampleComments = [
    {
      id: "comment-1",
      post_id: "sample-2",
      user_id: "sample-guest-2",
      author_name: "새벽손님",
      content: "그누보드 느낌 나서 좋다.",
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updated_at: null,
    },
  ];

  const state = {
    supabase: null,
    user: null,
    settings: loadSettings(),
    sharedSettings: {},
    authSession: null,
    boards: [],
    posts: [],
    commentCounts: new Map(),
    selectedBoardId: null,
    selectedPost: null,
    editingPost: null,
    editingBoardId: null,
    subscription: null,
    loading: false,
  };

  const els = {
    siteTitle: document.getElementById("siteTitle"),
    connectionBadge: document.getElementById("connectionBadge"),
    refreshButton: document.getElementById("refreshButton"),
    adminToggleButton: document.getElementById("adminToggleButton"),
    adminToggleLabel: document.getElementById("adminToggleLabel"),
    adminPanel: document.getElementById("adminPanel"),
    closeAdminButton: document.getElementById("closeAdminButton"),
    roleBadge: document.getElementById("roleBadge"),
    displayName: document.getElementById("displayName"),
    saveNameButton: document.getElementById("saveNameButton"),
    oauthButtons: Array.from(document.querySelectorAll("[data-oauth-provider]")),
    signOutButton: document.getElementById("signOutButton"),
    currentUserLabel: document.getElementById("currentUserLabel"),
    boardCountLabel: document.getElementById("boardCountLabel"),
    boardNav: document.getElementById("boardNav"),
    supabaseUrl: document.getElementById("supabaseUrl"),
    supabaseKey: document.getElementById("supabaseKey"),
    apiBaseUrl: document.getElementById("apiBaseUrl"),
    oauthRedirectUrl: document.getElementById("oauthRedirectUrl"),
    adminToken: document.getElementById("adminToken"),
    ownerUserId: document.getElementById("ownerUserId"),
    useCurrentUserButton: document.getElementById("useCurrentUserButton"),
    saveSettingsButton: document.getElementById("saveSettingsButton"),
    siteTitleInput: document.getElementById("siteTitleInput"),
    defaultBoardSelect: document.getElementById("defaultBoardSelect"),
    themeSelect: document.getElementById("themeSelect"),
    skinSelect: document.getElementById("skinSelect"),
    backgroundUrl: document.getElementById("backgroundUrl"),
    saveSharedSettingsButton: document.getElementById("saveSharedSettingsButton"),
    clearSettingsButton: document.getElementById("clearSettingsButton"),
    boardAdminList: document.getElementById("boardAdminList"),
    newBoardButton: document.getElementById("newBoardButton"),
    boardForm: document.getElementById("boardForm"),
    boardSlug: document.getElementById("boardSlug"),
    boardName: document.getElementById("boardName"),
    boardDescription: document.getElementById("boardDescription"),
    boardType: document.getElementById("boardType"),
    boardWriteRole: document.getElementById("boardWriteRole"),
    boardSkin: document.getElementById("boardSkin"),
    boardSortOrder: document.getElementById("boardSortOrder"),
    boardAllowComments: document.getElementById("boardAllowComments"),
    boardPath: document.getElementById("boardPath"),
    activeBoardName: document.getElementById("activeBoardName"),
    activeBoardDescription: document.getElementById("activeBoardDescription"),
    writePolicyBadge: document.getElementById("writePolicyBadge"),
    writePostButton: document.getElementById("writePostButton"),
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    sortSelect: document.getElementById("sortSelect"),
    postCount: document.getElementById("postCount"),
    commentCount: document.getElementById("commentCount"),
    storageMode: document.getElementById("storageMode"),
    notice: document.getElementById("notice"),
    postList: document.getElementById("postList"),
    postEditorDialog: document.getElementById("postEditorDialog"),
    editorBoardLabel: document.getElementById("editorBoardLabel"),
    editorTitle: document.getElementById("editorTitle"),
    closeEditorButton: document.getElementById("closeEditorButton"),
    postForm: document.getElementById("postForm"),
    postTitle: document.getElementById("postTitle"),
    postCategory: document.getElementById("postCategory"),
    postContent: document.getElementById("postContent"),
    postIsNotice: document.getElementById("postIsNotice"),
    submitPostButton: document.getElementById("submitPostButton"),
    postDialog: document.getElementById("postDialog"),
    closePostButton: document.getElementById("closePostButton"),
    dialogCategory: document.getElementById("dialogCategory"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogMeta: document.getElementById("dialogMeta"),
    dialogContent: document.getElementById("dialogContent"),
    editPostButton: document.getElementById("editPostButton"),
    deletePostButton: document.getElementById("deletePostButton"),
    dialogCommentCount: document.getElementById("dialogCommentCount"),
    commentList: document.getElementById("commentList"),
    commentForm: document.getElementById("commentForm"),
    commentContent: document.getElementById("commentContent"),
    submitCommentButton: document.getElementById("submitCommentButton"),
  };

  init();

  async function init() {
    hydrateSettingsForm();
    applyVisualSettings();
    applyOauthProviderVisibility();
    bindEvents();
    renderIcons();
    await connectIfConfigured();
    await loadBoards();
    selectInitialBoard();
    await loadPosts();
  }

  function bindEvents() {
    els.refreshButton.addEventListener("click", async () => {
      await loadBoards();
      await loadPosts();
    });

    els.adminToggleButton.addEventListener("click", () => {
      setAdminMode(!document.body.classList.contains("admin-mode"));
    });

    els.closeAdminButton.addEventListener("click", () => {
      setAdminMode(false);
    });

    els.saveNameButton.addEventListener("click", () => {
      state.settings.displayName = sanitizeText(els.displayName.value, 24) || createGuestName();
      persistSettings();
      updateIdentityUi();
    });

    els.oauthButtons.forEach((button) => {
      button.addEventListener("click", () => signInWithProvider(button.dataset.oauthProvider));
    });

    els.signOutButton.addEventListener("click", signOut);

    els.useCurrentUserButton.addEventListener("click", () => {
      if (!state.user?.id) {
        setNotice("Supabase 연결 뒤에 현재 User ID를 가져올 수 있어.");
        return;
      }
      els.ownerUserId.value = state.user.id;
      setNotice("현재 User ID를 관리자 ID 칸에 넣었어.");
    });

    els.saveSettingsButton.addEventListener("click", async () => {
      state.settings = readSettingsForm();
      persistSettings();
      applyVisualSettings();
      await connectIfConfigured(true);
      await loadBoards();
      selectInitialBoard();
      await loadPosts();
    });

    els.saveSharedSettingsButton.addEventListener("click", saveSharedSettings);

    els.clearSettingsButton.addEventListener("click", async () => {
      localStorage.removeItem(STORAGE_KEY);
      state.settings = loadSettings();
      hydrateSettingsForm();
      applyVisualSettings();
      await connectIfConfigured();
      await loadBoards();
      selectInitialBoard();
      await loadPosts();
    });

    [els.siteTitleInput, els.themeSelect, els.skinSelect, els.backgroundUrl].forEach((input) => {
      input.addEventListener("change", () => applyVisualSettings(readSettingsForm()));
    });

    [els.searchInput, els.categoryFilter, els.sortSelect].forEach((input) => {
      input.addEventListener("input", renderPosts);
      input.addEventListener("change", renderPosts);
    });

    els.writePostButton.addEventListener("click", () => openEditor());
    els.closeEditorButton.addEventListener("click", () => els.postEditorDialog.close());
    els.postForm.addEventListener("submit", savePost);

    els.closePostButton.addEventListener("click", () => els.postDialog.close());
    els.editPostButton.addEventListener("click", () => {
      if (state.selectedPost) openEditor(state.selectedPost);
    });
    els.deletePostButton.addEventListener("click", deleteSelectedPost);
    els.commentForm.addEventListener("submit", saveComment);

    els.newBoardButton.addEventListener("click", () => fillBoardForm(null));
    els.boardForm.addEventListener("submit", saveBoard);
  }

  function useProxy() {
    return Boolean(state.settings.apiBaseUrl);
  }

  async function signInWithProvider(provider) {
    if (!state.supabase) {
      setNotice("먼저 Supabase URL과 publishable/anon key를 저장해줘. 프록시 모드에서는 이 값이 Auth 로그인 전용으로만 쓰여.");
      return;
    }

    const { data, error } = await state.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getRedirectUrl(),
      },
    });
    if (error) {
      setNotice(readableError(error));
      return;
    }
    if (data?.url) window.location.assign(data.url);
  }

  async function signOut() {
    if (useProxy() && !state.supabase) {
      state.settings.adminToken = "";
      els.adminToken.value = "";
      persistSettings();
      updateIdentityUi();
      renderBoardHeader();
      setNotice("관리자 토큰을 지웠어.");
      return;
    }
    if (!state.supabase) return;
    const { error } = await state.supabase.auth.signOut();
    if (error) {
      setNotice(readableError(error));
      return;
    }
    state.user = null;
    state.authSession = null;
    await connectIfConfigured();
    await loadBoards();
    selectInitialBoard();
    await loadPosts();
  }

  function getRedirectUrl() {
    const configured = state.settings.oauthRedirectUrl;
    if (configured) {
      try {
        return new URL(configured, window.location.href).href;
      } catch {
        setNotice("로그인 후 돌아올 주소가 올바른 URL이 아니야.");
      }
    }

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    if (url.pathname.endsWith("/index.html")) url.pathname = url.pathname.slice(0, -"index.html".length);
    return url.href;
  }

  async function apiFetch(path, options = {}) {
    const baseUrl = state.settings.apiBaseUrl.replace(/\/+$/, "");
    const headers = {
      "content-type": "application/json",
      "x-forest-client-id": localUserId,
      ...(options.headers || {}),
    };
    if (state.authSession?.access_token) {
      headers.authorization = `Bearer ${state.authSession.access_token}`;
    } else if (state.settings.adminToken) {
      headers.authorization = `Bearer ${state.settings.adminToken}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(data?.error || data?.message || response.statusText);
    }
    return data;
  }

  async function connectIfConfigured(forceNotice) {
    if (useProxy()) {
      const { supabaseUrl, supabaseKey } = state.settings;
      state.supabase = supabaseUrl && supabaseKey && window.supabase?.createClient
        ? window.supabase.createClient(supabaseUrl, supabaseKey)
        : null;
      state.user = null;
      state.authSession = null;
      if (state.supabase) {
        const { data: sessionData } = await state.supabase.auth.getSession();
        state.authSession = sessionData.session || null;
        if (state.authSession) {
          const { data: userData } = await state.supabase.auth.getUser();
          state.user = userData.user || null;
        }
        state.supabase.auth.onAuthStateChange((_event, session) => {
          state.authSession = session || null;
          state.user = session?.user || null;
          updateIdentityUi();
          renderBoardHeader();
        });
      }
      try {
        await loadSharedSettings();
        await enforceOwnerOnlyLogin();
        setStatus(isOwner() ? "관리자 로그인" : "프록시 연결", "connected");
        updateIdentityUi();
        if (forceNotice) setNotice("프록시 설정 저장했어.");
      } catch (error) {
        setStatus("프록시 실패", "error");
        setNotice(readableError(error));
      }
      return;
    }

    const { supabaseUrl, supabaseKey } = state.settings;
    if (!supabaseUrl || !supabaseKey) {
      state.supabase = null;
      state.user = null;
      setStatus("로컬 미리보기", "local");
      updateIdentityUi();
      setNotice("Supabase URL과 publishable/anon key를 저장하면 공유 게시판으로 바뀌어.");
      return;
    }

    if (!window.supabase?.createClient) {
      setStatus("SDK 실패", "error");
      setNotice("Supabase SDK를 불러오지 못했어. CDN 접근을 확인해줘.");
      return;
    }

    try {
      state.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
      const { data: sessionData } = await state.supabase.auth.getSession();
      if (!sessionData.session) {
        const { error } = await state.supabase.auth.signInAnonymously();
        if (error) throw error;
      }

      const { data, error } = await state.supabase.auth.getUser();
      if (error) throw error;
      state.user = data.user;
      await loadSharedSettings();
      await enforceOwnerOnlyLogin();
      setStatus(isOwner() ? "관리자 로그인" : "Supabase 연결", "connected");
      updateIdentityUi();
      if (forceNotice) setNotice("연결 설정 저장했어.");
      subscribeRealtime();
    } catch (error) {
      state.supabase = null;
      state.user = null;
      setStatus("연결 실패", "error");
      updateIdentityUi();
      setNotice(readableError(error));
    }
  }

  async function loadSharedSettings() {
    if (useProxy()) {
      const data = await apiFetch("/api/settings");
      if (!data?.settings) return;
      const settings = data.settings;
      state.sharedSettings = {
        siteTitle: settings.site_title || "",
        ownerUserId: settings.owner_user_id || "",
        defaultBoardSlug: settings.default_board_slug || "",
        backgroundUrl: settings.background_url || "",
        theme: settings.theme || "",
        skin: settings.skin || "",
      };
      const local = loadLocalSettings();
      state.settings = normalizeSettings({
        ...state.settings,
        siteTitle: local.siteTitle ? state.settings.siteTitle : state.sharedSettings.siteTitle,
        ownerUserId: local.ownerUserId ? state.settings.ownerUserId : state.sharedSettings.ownerUserId,
        defaultBoardSlug: local.defaultBoardSlug ? state.settings.defaultBoardSlug : state.sharedSettings.defaultBoardSlug,
        backgroundUrl: local.backgroundUrl ? state.settings.backgroundUrl : state.sharedSettings.backgroundUrl,
        theme: local.theme ? state.settings.theme : state.sharedSettings.theme,
        skin: local.skin ? state.settings.skin : state.sharedSettings.skin,
      });
      hydrateSettingsForm();
      applyVisualSettings();
      return;
    }

    if (!state.supabase) return;

    const { data, error } = await state.supabase
      .from(TABLES.settings)
      .select("site_title,owner_user_id,default_board_slug,background_url,theme,skin")
      .eq("id", "main")
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    state.sharedSettings = {
      siteTitle: data.site_title || "",
      ownerUserId: data.owner_user_id || "",
      defaultBoardSlug: data.default_board_slug || "",
      backgroundUrl: data.background_url || "",
      theme: data.theme || "",
      skin: data.skin || "",
    };

    const local = loadLocalSettings();
    state.settings = normalizeSettings({
      ...state.settings,
      siteTitle: local.siteTitle ? state.settings.siteTitle : state.sharedSettings.siteTitle,
      ownerUserId: local.ownerUserId ? state.settings.ownerUserId : state.sharedSettings.ownerUserId,
      defaultBoardSlug: local.defaultBoardSlug ? state.settings.defaultBoardSlug : state.sharedSettings.defaultBoardSlug,
      backgroundUrl: local.backgroundUrl ? state.settings.backgroundUrl : state.sharedSettings.backgroundUrl,
      theme: local.theme ? state.settings.theme : state.sharedSettings.theme,
      skin: local.skin ? state.settings.skin : state.sharedSettings.skin,
    });
    hydrateSettingsForm();
    applyVisualSettings();
  }

  async function saveSharedSettings() {
    if (useProxy()) {
      setLoading(true);
      try {
        state.settings = readSettingsForm();
        persistSettings();
        await apiFetch("/api/settings", {
          method: "PUT",
          body: {
            site_title: state.settings.siteTitle,
            owner_user_id: state.settings.ownerUserId || null,
            default_board_slug: state.settings.defaultBoardSlug || activeBoard()?.slug || "free",
            background_url: state.settings.backgroundUrl || null,
            theme: state.settings.theme,
            skin: state.settings.skin,
          },
        });
        await loadSharedSettings();
        updateIdentityUi();
        setNotice("프록시 공유 설정 저장했어.");
      } catch (error) {
        setNotice(readableError(error));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!state.supabase) {
      setNotice("Supabase 연결 후 공유 설정을 저장할 수 있어.");
      return;
    }

    setLoading(true);
    try {
      state.settings = readSettingsForm();
      persistSettings();
      const { error } = await state.supabase.from(TABLES.settings).upsert(
        {
          id: "main",
          site_title: state.settings.siteTitle,
          owner_user_id: state.settings.ownerUserId || null,
          default_board_slug: state.settings.defaultBoardSlug || activeBoard()?.slug || "free",
          background_url: state.settings.backgroundUrl || null,
          theme: state.settings.theme,
          skin: state.settings.skin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      setNotice("공유 설정 저장했어.");
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  function subscribeRealtime() {
    if (!state.supabase || state.subscription) return;

    state.subscription = state.supabase
      .channel("forest-cms")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.boards }, async () => {
        await loadBoards();
        await loadPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.posts }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.comments }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.settings }, async () => {
        await loadSharedSettings();
        await loadBoards();
        await loadPosts();
      })
      .subscribe();
  }

  async function loadBoards() {
    try {
      if (useProxy()) {
        const data = await apiFetch("/api/boards");
        state.boards = data?.boards || [];
      } else if (state.supabase) {
        const { data, error } = await state.supabase
          .from(TABLES.boards)
          .select("id,slug,name,description,board_type,write_role,allow_comments,skin,sort_order")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });
        if (error) throw error;
        state.boards = data || [];
      } else {
        state.boards = loadLocalBoards();
      }

      if (!state.boards.length) state.boards = defaultBoards.slice();
      renderBoards();
      hydrateBoardSelect();
    } catch (error) {
      setNotice(readableError(error));
      state.boards = defaultBoards.slice();
      renderBoards();
    }
  }

  function selectInitialBoard() {
    const current = state.boards.find((board) => board.id === state.selectedBoardId);
    if (current) return;

    const desired = state.settings.defaultBoardSlug || "free";
    const bySlug = state.boards.find((board) => board.slug === desired);
    state.selectedBoardId = (bySlug || state.boards[0])?.id || null;
    renderBoards();
  }

  async function loadPosts() {
    const board = activeBoard();
    if (!board) {
      renderPosts();
      return;
    }

    setLoading(true);
    try {
      if (useProxy()) {
        const data = await apiFetch(`/api/posts?boardId=${encodeURIComponent(board.id)}`);
        state.posts = data?.posts || [];
        state.commentCounts = new Map();
        state.posts.forEach((post) => {
          state.commentCounts.set(post.id, post.comment_count || 0);
        });
      } else if (state.supabase) {
        const { data, error } = await state.supabase
          .from(TABLES.posts)
          .select("id,board_id,user_id,title,content,author_name,category,is_notice,view_count,created_at,updated_at")
          .eq("board_id", board.id)
          .order("is_notice", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        state.posts = data || [];
        await loadCommentCounts();
      } else {
        state.posts = loadLocalPosts().filter((post) => post.board_id === board.id);
        loadLocalCommentCounts();
      }

      renderBoardHeader();
      renderPosts();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadCommentCounts() {
    state.commentCounts = new Map();
    const ids = state.posts.map((post) => post.id);
    if (!ids.length) return;

    const { data, error } = await state.supabase
      .from(TABLES.comments)
      .select("id,post_id")
      .in("post_id", ids);
    if (error) throw error;
    (data || []).forEach((comment) => {
      state.commentCounts.set(comment.post_id, (state.commentCounts.get(comment.post_id) || 0) + 1);
    });
  }

  function loadLocalCommentCounts() {
    state.commentCounts = new Map();
    const comments = loadLocalComments();
    comments.forEach((comment) => {
      state.commentCounts.set(comment.post_id, (state.commentCounts.get(comment.post_id) || 0) + 1);
    });
  }

  function renderBoards() {
    els.boardNav.innerHTML = "";
    state.boards.forEach((board) => {
      const button = document.createElement("button");
      button.className = "nav-button";
      button.type = "button";
      button.classList.toggle("active", board.id === state.selectedBoardId);
      button.innerHTML = `<i data-lucide="${board.board_type === "blog" ? "book-open-text" : "messages-square"}"></i><span>${escapeHtml(board.name)}</span>`;
      button.addEventListener("click", async () => {
        state.selectedBoardId = board.id;
        state.settings.defaultBoardSlug = board.slug;
        persistSettings();
        renderBoards();
        await loadPosts();
      });
      els.boardNav.append(button);
    });
    els.boardCountLabel.textContent = String(state.boards.length);
    renderBoardAdminList();
    renderIcons();
  }

  function renderBoardAdminList() {
    els.boardAdminList.innerHTML = "";
    state.boards.forEach((board) => {
      const item = document.createElement("button");
      item.className = "admin-board-item";
      item.type = "button";
      item.classList.toggle("active", board.id === state.editingBoardId);
      item.innerHTML = `<span>${escapeHtml(board.name)}</span><small>${escapeHtml(board.slug)}</small>`;
      item.addEventListener("click", () => fillBoardForm(board));
      els.boardAdminList.append(item);
    });
  }

  function hydrateBoardSelect() {
    els.defaultBoardSelect.innerHTML = "";
    state.boards.forEach((board) => {
      const option = document.createElement("option");
      option.value = board.slug;
      option.textContent = board.name;
      els.defaultBoardSelect.append(option);
    });
    els.defaultBoardSelect.value = state.settings.defaultBoardSlug || activeBoard()?.slug || "free";
  }

  function renderBoardHeader() {
    const board = activeBoard();
    if (!board) return;

    els.boardPath.textContent = `홈 / ${board.name}`;
    els.activeBoardName.textContent = board.name;
    els.activeBoardDescription.textContent = board.description || "설명이 없는 게시판";
    const canWrite = canWriteBoard(board);
    els.writePolicyBadge.textContent = canWrite ? "쓰기 가능" : "읽기 전용";
    els.writePolicyBadge.classList.toggle("connected", canWrite);
    els.writePostButton.disabled = !canWrite;
    els.editorBoardLabel.textContent = board.name;
    els.storageMode.textContent = state.supabase ? "Supabase" : "로컬";
  }

  function renderPosts() {
    const board = activeBoard();
    renderBoardHeader();
    if (!board) {
      els.postList.innerHTML = `<div class="empty-state">게시판이 아직 없어.</div>`;
      return;
    }

    const query = els.searchInput.value.trim().toLowerCase();
    const category = els.categoryFilter.value;
    const sort = els.sortSelect.value;
    const posts = state.posts
      .filter((post) => category === "all" || post.category === category)
      .filter((post) => {
        if (!query) return true;
        return [post.title, post.content, post.author_name, post.category].join(" ").toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (a.is_notice !== b.is_notice) return a.is_notice ? -1 : 1;
        if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
        if (sort === "views") return (b.view_count || 0) - (a.view_count || 0);
        return new Date(b.created_at) - new Date(a.created_at);
      });

    const totalComments = posts.reduce((sum, post) => sum + (state.commentCounts.get(post.id) || 0), 0);
    els.postCount.textContent = String(posts.length);
    els.commentCount.textContent = String(totalComments);

    if (!posts.length) {
      els.postList.innerHTML = `<div class="empty-state">아직 글이 없어.</div>`;
      return;
    }

    if (board.skin === "blog" || board.board_type === "blog") {
      renderBlogCards(posts);
    } else {
      renderPostTable(posts);
    }
    renderIcons();
  }

  function renderPostTable(posts) {
    const rows = posts
      .map((post, index) => {
        const numberLabel = post.is_notice ? "공지" : String(posts.length - index);
        const comments = state.commentCounts.get(post.id) || 0;
        return `
          <tr>
            <td>${numberLabel}</td>
            <td>
              <button class="post-title-cell" type="button" data-post-id="${post.id}">
                ${post.is_notice ? '<span class="notice-mark">공지</span>' : ""}
                <strong>${escapeHtml(post.title)}</strong>
                ${comments ? `<span class="comment-badge">[${comments}]</span>` : ""}
              </button>
            </td>
            <td>${escapeHtml(post.category)}</td>
            <td>${renderAuthor(post)}</td>
            <td>${formatDate(post.created_at)}</td>
            <td>${post.view_count || 0}</td>
          </tr>
        `;
      })
      .join("");

    els.postList.innerHTML = `
      <div class="post-table-wrap">
        <table class="post-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>제목</th>
              <th>분류</th>
              <th>글쓴이</th>
              <th>날짜</th>
              <th>조회</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    els.postList.querySelectorAll("[data-post-id]").forEach((button) => {
      button.addEventListener("click", () => openPost(button.dataset.postId));
    });
  }

  function renderBlogCards(posts) {
    els.postList.innerHTML = `<div class="blog-list"></div>`;
    const wrap = els.postList.querySelector(".blog-list");
    posts.forEach((post) => {
      const comments = state.commentCounts.get(post.id) || 0;
      const card = document.createElement("button");
      card.className = "blog-card";
      card.type = "button";
      card.innerHTML = `
        <span class="category-chip">${escapeHtml(post.category)}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.content)}</p>
        <div class="post-meta">
          <span class="author-meta">${renderAuthor(post)}<span>· ${formatDate(post.created_at)}</span></span>
          <span>조회 ${post.view_count || 0} · 댓글 ${comments}</span>
        </div>
      `;
      card.addEventListener("click", () => openPost(post.id));
      wrap.append(card);
    });
  }

  async function openPost(postId) {
    const post = state.posts.find((item) => item.id === postId);
    if (!post) return;
    state.selectedPost = post;
    els.dialogCategory.textContent = post.category || "일반";
    els.dialogTitle.textContent = post.title;
    els.dialogMeta.innerHTML = `${renderAuthor(post)}<span>· ${formatDate(post.created_at)} · 조회 ${
      post.view_count || 0
    }${post.updated_at ? " · 수정됨" : ""}</span>`;
    els.dialogContent.textContent = post.content;
    els.editPostButton.hidden = !canEditPost(post);
    els.deletePostButton.hidden = !canEditPost(post);
    await incrementView(post);
    await loadComments(post.id);
    els.postDialog.showModal();
  }

  async function incrementView(post) {
    post.view_count = (post.view_count || 0) + 1;
    if (useProxy()) {
      await apiFetch(`/api/posts/${encodeURIComponent(post.id)}/view`, { method: "POST" });
    } else if (state.supabase) {
      await state.supabase.rpc("increment_forest_post_view", { post_uuid: post.id });
    } else {
      const posts = loadLocalPosts().map((item) =>
        item.id === post.id ? { ...item, view_count: (item.view_count || 0) + 1 } : item
      );
      saveLocalPosts(posts);
    }
    renderPosts();
  }

  async function loadComments(postId) {
    let comments = [];
    const board = activeBoard();
    if (useProxy()) {
      const data = await apiFetch(`/api/comments?postId=${encodeURIComponent(postId)}`);
      comments = data?.comments || [];
    } else if (state.supabase) {
      const { data, error } = await state.supabase
        .from(TABLES.comments)
        .select("id,post_id,user_id,author_name,content,created_at,updated_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) {
        setNotice(readableError(error));
      } else {
        comments = data || [];
      }
    } else {
      comments = loadLocalComments().filter((comment) => comment.post_id === postId);
    }
    renderComments(comments);
    const allowed = Boolean(board?.allow_comments);
    els.commentForm.hidden = !allowed;
    els.dialogCommentCount.textContent = String(comments.length);
  }

  function renderComments(comments) {
    els.commentList.innerHTML = "";
    if (!comments.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "댓글이 아직 없어.";
      els.commentList.append(empty);
      return;
    }

    comments.forEach((comment) => {
      const item = document.createElement("div");
      item.className = "comment-item";
      const canDelete = canEditComment(comment);
      item.innerHTML = `
        <div class="comment-meta">
          <span class="author-meta">${renderAuthor(comment)}<span>· ${formatDate(comment.created_at)}</span></span>
          ${canDelete ? `<button class="ghost-icon" type="button" data-comment-id="${comment.id}" title="댓글 삭제"><i data-lucide="trash-2"></i></button>` : ""}
        </div>
        <p>${escapeHtml(comment.content)}</p>
      `;
      els.commentList.append(item);
    });

    els.commentList.querySelectorAll("[data-comment-id]").forEach((button) => {
      button.addEventListener("click", () => deleteComment(button.dataset.commentId));
    });
    renderIcons();
  }

  function openEditor(post) {
    const board = activeBoard();
    if (!board || (!post && !canWriteBoard(board))) {
      setNotice("이 게시판은 지금 글쓰기가 막혀 있어.");
      return;
    }

    state.editingPost = post || null;
    els.editorTitle.textContent = post ? "글 수정" : "글쓰기";
    els.editorBoardLabel.textContent = board.name;
    els.postTitle.value = post?.title || "";
    els.postCategory.value = post?.category || "일반";
    els.postContent.value = post?.content || "";
    els.postIsNotice.checked = Boolean(post?.is_notice);
    els.postIsNotice.disabled = !isOwner();
    els.postEditorDialog.showModal();
  }

  async function savePost(event) {
    event.preventDefault();
    const board = activeBoard();
    if (!board) return;

    const payload = {
      board_id: board.id,
      title: sanitizeText(els.postTitle.value, 100),
      content: sanitizeText(els.postContent.value, 8000),
      category: sanitizeText(els.postCategory.value, 20) || "일반",
      author_name: sanitizeText(els.displayName.value, 24) || createGuestName(),
      is_notice: isOwner() && els.postIsNotice.checked,
    };

    if (!payload.title || !payload.content) return;

    setLoading(true);
    try {
      if (useProxy()) {
        if (state.editingPost) {
          await apiFetch(`/api/posts/${encodeURIComponent(state.editingPost.id)}`, {
            method: "PUT",
            body: payload,
          });
        } else {
          await apiFetch("/api/posts", {
            method: "POST",
            body: payload,
          });
        }
      } else if (state.supabase) {
        if (state.editingPost) {
          const { error } = await state.supabase.from(TABLES.posts).update(payload).eq("id", state.editingPost.id);
          if (error) throw error;
        } else {
          const { error } = await state.supabase.from(TABLES.posts).insert({ ...payload, user_id: state.user?.id });
          if (error) throw error;
        }
      } else {
        const posts = loadLocalPosts();
        if (state.editingPost) {
          saveLocalPosts(
            posts.map((post) =>
              post.id === state.editingPost.id ? { ...post, ...payload, updated_at: new Date().toISOString() } : post
            )
          );
        } else {
          posts.unshift({
            id: crypto.randomUUID(),
            ...payload,
            user_id: localUserId,
            view_count: 0,
            created_at: new Date().toISOString(),
            updated_at: null,
          });
          saveLocalPosts(posts);
        }
      }
      els.postEditorDialog.close();
      await loadPosts();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedPost() {
    if (!state.selectedPost || !canEditPost(state.selectedPost)) return;
    if (!window.confirm("이 글을 삭제할까?")) return;

    setLoading(true);
    try {
      if (useProxy()) {
        await apiFetch(`/api/posts/${encodeURIComponent(state.selectedPost.id)}`, { method: "DELETE" });
      } else if (state.supabase) {
        const { error } = await state.supabase.from(TABLES.posts).delete().eq("id", state.selectedPost.id);
        if (error) throw error;
      } else {
        saveLocalPosts(loadLocalPosts().filter((post) => post.id !== state.selectedPost.id));
        saveLocalComments(loadLocalComments().filter((comment) => comment.post_id !== state.selectedPost.id));
      }
      els.postDialog.close();
      await loadPosts();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveComment(event) {
    event.preventDefault();
    if (!state.selectedPost) return;
    const board = activeBoard();
    if (!board?.allow_comments) return;

    const content = sanitizeText(els.commentContent.value, 1200);
    if (!content) return;

    const payload = {
      post_id: state.selectedPost.id,
      author_name: sanitizeText(els.displayName.value, 24) || createGuestName(),
      content,
    };

    setLoading(true);
    try {
      if (useProxy()) {
        await apiFetch("/api/comments", {
          method: "POST",
          body: payload,
        });
      } else if (state.supabase) {
        const { error } = await state.supabase.from(TABLES.comments).insert({ ...payload, user_id: state.user?.id });
        if (error) throw error;
      } else {
        const comments = loadLocalComments();
        comments.push({
          id: crypto.randomUUID(),
          ...payload,
          user_id: localUserId,
          created_at: new Date().toISOString(),
          updated_at: null,
        });
        saveLocalComments(comments);
      }
      els.commentContent.value = "";
      await loadPosts();
      await loadComments(state.selectedPost.id);
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("댓글을 삭제할까?")) return;
    try {
      if (useProxy()) {
        await apiFetch(`/api/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
      } else if (state.supabase) {
        const { error } = await state.supabase.from(TABLES.comments).delete().eq("id", commentId);
        if (error) throw error;
      } else {
        saveLocalComments(loadLocalComments().filter((comment) => comment.id !== commentId));
      }
      await loadPosts();
      if (state.selectedPost) await loadComments(state.selectedPost.id);
    } catch (error) {
      setNotice(readableError(error));
    }
  }

  function fillBoardForm(board) {
    state.editingBoardId = board?.id || null;
    els.boardSlug.value = board?.slug || "";
    els.boardSlug.disabled = Boolean(board && state.supabase);
    els.boardName.value = board?.name || "";
    els.boardDescription.value = board?.description || "";
    els.boardType.value = board?.board_type || "board";
    els.boardWriteRole.value = board?.write_role || "all";
    els.boardSkin.value = board?.skin || "table";
    els.boardSortOrder.value = board?.sort_order ?? 100;
    els.boardAllowComments.checked = board?.allow_comments ?? true;
    renderBoardAdminList();
  }

  async function saveBoard(event) {
    event.preventDefault();
    if ((state.supabase || useProxy()) && !isOwner()) {
      setNotice("게시판 관리는 관리자만 가능해.");
      return;
    }

    const board = {
      slug: slugify(els.boardSlug.value),
      name: sanitizeText(els.boardName.value, 40),
      description: sanitizeText(els.boardDescription.value, 140),
      board_type: els.boardType.value === "blog" ? "blog" : "board",
      write_role: els.boardWriteRole.value === "owner" ? "owner" : "all",
      skin: els.boardSkin.value === "blog" ? "blog" : "table",
      allow_comments: els.boardAllowComments.checked,
      sort_order: Number(els.boardSortOrder.value || 100),
    };
    if (!board.slug || !board.name) return;

    setLoading(true);
    try {
      if (useProxy()) {
        await apiFetch("/api/boards", {
          method: "POST",
          body: state.editingBoardId ? { id: state.editingBoardId, ...board } : board,
        });
      } else if (state.supabase) {
        const payload = state.editingBoardId ? { id: state.editingBoardId, ...board } : board;
        const { error } = await state.supabase.from(TABLES.boards).upsert(payload, { onConflict: "slug" });
        if (error) throw error;
      } else {
        const boards = loadLocalBoards();
        if (state.editingBoardId) {
          saveLocalBoards(boards.map((item) => (item.id === state.editingBoardId ? { ...item, ...board } : item)));
        } else {
          saveLocalBoards([...boards, { id: board.slug, ...board }]);
        }
      }
      fillBoardForm(null);
      await loadBoards();
      selectInitialBoard();
      await loadPosts();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  function hydrateSettingsForm() {
    els.supabaseUrl.value = state.settings.supabaseUrl;
    els.supabaseKey.value = state.settings.supabaseKey;
    els.apiBaseUrl.value = state.settings.apiBaseUrl;
    els.oauthRedirectUrl.value = state.settings.oauthRedirectUrl || getDefaultRedirectUrl();
    els.adminToken.value = state.settings.adminToken;
    els.ownerUserId.value = state.settings.ownerUserId;
    els.displayName.value = state.settings.displayName || createGuestName();
    els.siteTitleInput.value = state.settings.siteTitle;
    els.themeSelect.value = state.settings.theme;
    els.skinSelect.value = state.settings.skin;
    els.backgroundUrl.value = state.settings.backgroundUrl;
  }

  function readSettingsForm() {
    return normalizeSettings({
      apiBaseUrl: els.apiBaseUrl.value,
      oauthRedirectUrl: els.oauthRedirectUrl.value,
      adminToken: els.adminToken.value,
      supabaseUrl: els.supabaseUrl.value,
      supabaseKey: els.supabaseKey.value,
      ownerUserId: els.ownerUserId.value,
      oauthProviders: state.settings.oauthProviders,
      displayName: els.displayName.value,
      siteTitle: els.siteTitleInput.value,
      defaultBoardSlug: els.defaultBoardSelect.value || activeBoard()?.slug,
      backgroundUrl: els.backgroundUrl.value,
      theme: els.themeSelect.value,
      skin: els.skinSelect.value,
    });
  }

  function applyVisualSettings(settings = state.settings) {
    const background = settings.backgroundUrl || DEFAULT_BACKGROUND;
    document.documentElement.style.setProperty("--background-image", `url("${escapeCssUrl(background)}")`);
    document.body.dataset.theme = settings.theme || "night";
    document.body.dataset.skin = settings.skin || "forest";
    els.siteTitle.textContent = settings.siteTitle || "별숲 커뮤니티";
    document.title = settings.siteTitle || "별숲 커뮤니티";
  }

  function applyOauthProviderVisibility() {
    const enabled = new Set(state.settings.oauthProviders);
    const signedIn = Boolean(state.user?.id && !state.user.is_anonymous);
    els.oauthButtons.forEach((button) => {
      button.hidden = signedIn || !enabled.has(button.dataset.oauthProvider);
    });
  }

  function updateIdentityUi() {
    const owner = isOwner();
    els.roleBadge.textContent = owner ? "관리자" : "손님";
    els.roleBadge.classList.toggle("role-owner", owner);
    els.roleBadge.classList.toggle("role-guest", !owner);
    els.adminToggleButton.hidden = !owner;
    if (!owner && document.body.classList.contains("admin-mode")) setAdminMode(false);
    applyOauthProviderVisibility();
    els.signOutButton.hidden = (!state.user?.id || state.user.is_anonymous) && !state.settings.adminToken;
    if (useProxy()) {
      if (state.user?.id) {
        const email = state.user.email || state.user.user_metadata?.email || "";
        const name = state.user.user_metadata?.name || state.user.user_metadata?.full_name || "";
        els.currentUserLabel.textContent = `${owner ? "관리자" : "손님"} 로그인 · ${email || name || state.user.id}`;
        return;
      }
      els.currentUserLabel.textContent = state.settings.adminToken
        ? "관리자 토큰으로 로그인됨"
        : "손님 · 로그인하지 않음";
      return;
    }
    if (state.user?.id) {
      const email = state.user.email || state.user.user_metadata?.email || "";
      const name = state.user.user_metadata?.name || state.user.user_metadata?.full_name || "";
      els.currentUserLabel.textContent = state.user.is_anonymous
        ? "손님 · 익명 방문"
        : `${owner ? "관리자" : "손님"} 로그인 · ${email || name || state.user.id}`;
      return;
    }
    els.currentUserLabel.textContent = state.supabase ? "손님 · 로그인하지 않음" : "로컬 관리자 모드";
  }

  async function enforceOwnerOnlyLogin() {
    if (!state.supabase || !state.user?.id || state.user.is_anonymous) return;
    const ownerUserId = state.sharedSettings.ownerUserId || state.settings.ownerUserId;
    if (!ownerUserId || state.user.id === ownerUserId) return;

    const rejectedUserId = state.user.id;
    await state.supabase.auth.signOut();
    state.user = null;
    state.authSession = null;

    if (!useProxy()) {
      const { error: anonymousError } = await state.supabase.auth.signInAnonymously();
      if (anonymousError) throw anonymousError;
      const { data, error: userError } = await state.supabase.auth.getUser();
      if (userError) throw userError;
      state.user = data.user;
    }
    setNotice(`관리자 계정이 아니라서 손님 상태로 돌아왔어. 로그인한 User ID: ${rejectedUserId}`);
  }

  function getDefaultRedirectUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    if (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/install.html")) {
      url.pathname = url.pathname.replace(/(?:index|install)\.html$/, "");
    }
    return url.href;
  }

  function setAdminMode(enabled) {
    if (enabled && !isOwner()) {
      setNotice("관리자만 관리 페이지에 들어갈 수 있어.");
      return;
    }
    document.body.classList.toggle("admin-mode", enabled);
    els.adminPanel.hidden = !enabled;
    els.adminToggleButton.setAttribute("aria-pressed", String(enabled));
    els.adminToggleButton.title = enabled ? "게시판으로 돌아가기" : "관리 페이지";
    els.adminToggleLabel.textContent = enabled ? "게시판" : "관리";
    els.adminToggleButton
      .querySelector("[data-lucide]")
      ?.setAttribute("data-lucide", enabled ? "layout-list" : "settings");
    if (enabled) hydrateSettingsForm();
    renderIcons();
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    [
      els.refreshButton,
      els.saveSettingsButton,
      els.saveSharedSettingsButton,
      els.submitPostButton,
      els.submitCommentButton,
    ].forEach((button) => {
      if (button) button.disabled = isLoading;
    });
    if (els.writePostButton) els.writePostButton.disabled = isLoading || !canWriteBoard(activeBoard());
  }

  function setStatus(text, mode) {
    els.connectionBadge.textContent = text;
    els.connectionBadge.className = "status-pill";
    if (mode === "connected") els.connectionBadge.classList.add("connected");
    if (mode === "error") els.connectionBadge.classList.add("error");
  }

  function setNotice(message) {
    els.notice.hidden = !message;
    els.notice.textContent = message || "";
  }

  function activeBoard() {
    return state.boards.find((board) => board.id === state.selectedBoardId) || state.boards[0] || null;
  }

  function canWriteBoard(board) {
    if (!board) return false;
    if (useProxy()) return board.write_role === "all" || isOwner();
    if (!state.supabase) return true;
    return board.write_role === "all" || isOwner();
  }

  function canEditPost(post) {
    if (!post) return false;
    if (useProxy()) return Boolean(post.can_edit || isOwner());
    if (!state.supabase) return post.user_id === localUserId || isOwner();
    return post.user_id === state.user?.id || isOwner();
  }

  function canEditComment(comment) {
    if (!comment) return false;
    if (useProxy()) return Boolean(comment.can_edit || isOwner());
    if (!state.supabase) return comment.user_id === localUserId || isOwner();
    return comment.user_id === state.user?.id || isOwner();
  }

  function isOwner() {
    if (useProxy()) {
      return Boolean(
        state.settings.adminToken ||
          (state.settings.ownerUserId && state.user?.id === state.settings.ownerUserId)
      );
    }
    if (!state.supabase) return true;
    return Boolean(state.settings.ownerUserId && state.user?.id === state.settings.ownerUserId);
  }

  function isOwnerRecord(record) {
    if (!record) return false;
    if (!state.supabase && !useProxy()) {
      return record.user_id === localUserId || record.user_id === "sample-owner";
    }
    const ownerUserId = state.sharedSettings.ownerUserId || state.settings.ownerUserId;
    return Boolean(ownerUserId && record.user_id === ownerUserId);
  }

  function renderAuthor(record) {
    const owner = isOwnerRecord(record);
    const name = escapeHtml(record?.author_name || "익명");
    return `<span class="author-line"><span class="author-name">${name}</span><span class="author-role ${
      owner ? "author-owner" : "author-guest"
    }">${owner ? "관리자" : "손님"}</span></span>`;
  }

  function loadSettings() {
    return normalizeSettings({
      ...runtimeConfig,
      ...loadLocalSettings(),
    });
  }

  function loadLocalSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function persistSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function normalizeSettings(value) {
    return {
      apiBaseUrl: String(value.apiBaseUrl || "").trim(),
      oauthRedirectUrl: String(value.oauthRedirectUrl || "").trim(),
      adminToken: String(value.adminToken || "").trim(),
      supabaseUrl: String(value.supabaseUrl || "").trim(),
      supabaseKey: String(value.supabaseKey || "").trim(),
      ownerUserId: String(value.ownerUserId || "").trim(),
      displayName: sanitizeText(value.displayName || "", 24),
      defaultBoardSlug: String(value.defaultBoardSlug || value.defaultMode || "free").trim() || "free",
      backgroundUrl: String(value.backgroundUrl || "").trim(),
      siteTitle: sanitizeText(value.siteTitle || "별숲 커뮤니티", 32),
      theme: ["night", "dawn", "classic"].includes(value.theme) ? value.theme : "night",
      skin: value.skin === "classic" ? "classic" : "forest",
      oauthProviders: normalizeOauthProviders(value.oauthProviders),
    };
  }

  function normalizeOauthProviders(value) {
    const allowed = new Set(["kakao"]);
    const providers = Array.isArray(value) ? value : ["kakao"];
    const normalized = providers
      .map((provider) => String(provider || "").trim().toLowerCase())
      .filter((provider) => allowed.has(provider));
    return Array.from(new Set(normalized.length ? normalized : ["kakao"]));
  }

  function loadLocalBoards() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_BOARDS_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {
      return defaultBoards.slice();
    }
    return defaultBoards.slice();
  }

  function saveLocalBoards(boards) {
    localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
  }

  function loadLocalPosts() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      return samplePosts.slice();
    }
    return samplePosts.slice();
  }

  function saveLocalPosts(posts) {
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
  }

  function loadLocalComments() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_COMMENTS_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      return sampleComments.slice();
    }
    return sampleComments.slice();
  }

  function saveLocalComments(comments) {
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
  }

  function getLocalUserId() {
    let id = localStorage.getItem(LOCAL_USER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LOCAL_USER_KEY, id);
    }
    return id;
  }

  function createGuestName() {
    return `별숲손님${localUserId.slice(0, 4)}`;
  }

  function sanitizeText(value, maxLength) {
    return String(value || "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, maxLength);
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeCssUrl(value) {
    return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function readableError(error) {
    const message = error?.message || String(error);
    if (message.includes("relation") || message.includes("does not exist")) {
      return "Supabase 테이블이 아직 맞지 않아. install.html의 SQL을 다시 실행해줘.";
    }
    if (message.toLowerCase().includes("anonymous")) {
      return "Supabase Auth에서 Anonymous sign-ins를 켜야 해.";
    }
    if (message.includes("row-level security")) {
      const currentId = state.user?.id || "확인 안 됨";
      const ownerId = state.settings.ownerUserId || state.sharedSettings.ownerUserId || "DB에 없음";
      return `RLS가 막았어. 지금 로그인 ID는 ${currentId}, DB 관리자 ID는 ${ownerId}야. 둘이 다르면 Supabase SQL Editor에서 forest_site_settings.owner_user_id를 지금 로그인 ID로 바꿔줘.`;
    }
    return message;
  }

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
})();
