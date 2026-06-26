(function () {
  const STORAGE_KEY = "forest-blog-board-settings";
  const LOCAL_POSTS_KEY = "forest-blog-board-local-posts";
  const LOCAL_USER_KEY = "forest-blog-board-local-user";
  const TABLE_NAME = "forest_posts";
  const SETTINGS_TABLE = "forest_site_settings";
  const DEFAULT_BACKGROUND = "./assets/shooting-star-forest.png";

  const runtimeConfig = normalizeSettings(window.FOREST_BLOG_CONFIG || {});
  const localUserId = getLocalUserId();

  const fallbackPosts = [
    {
      id: "sample-board-1",
      post_type: "board",
      title: "첫 별똥별을 본 밤",
      content: "숲 가장자리에서 하늘을 올려다봤는데, 아주 짧은 금빛 선이 지나갔어요. 오늘 게시판의 첫 기록으로 남깁니다.",
      author_name: "별숲지기",
      category: "공지",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      updated_at: null,
      user_id: "sample",
    },
    {
      id: "sample-board-2",
      post_type: "board",
      title: "함께 읽기 좋은 주제",
      content: "오늘 들은 음악, 숲 산책 사진, 작은 질문, 읽고 있는 책 이야기를 편하게 남겨보세요.",
      author_name: "새벽손님",
      category: "공유",
      created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      updated_at: null,
      user_id: "sample",
    },
    {
      id: "sample-blog-1",
      post_type: "blog",
      title: "별숲 블로그를 열며",
      content: "블로그 모드에서는 주인만 글을 쓰고, 방문자는 조용히 읽을 수 있게 구성했습니다. 게시판 모드에서는 모두가 글을 남길 수 있어요.",
      author_name: "관리자",
      category: "공지",
      created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      updated_at: null,
      user_id: "sample",
    },
  ];

  const state = {
    supabase: null,
    user: null,
    posts: [],
    selectedPost: null,
    editMode: false,
    loading: false,
    subscription: null,
    sharedSettings: {},
    settings: loadSettings(),
    activeMode: "board",
    localUserId,
  };

  const els = {
    connectionBadge: document.getElementById("connectionBadge"),
    refreshButton: document.getElementById("refreshButton"),
    settingsButton: document.getElementById("settingsButton"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    setupPanel: document.getElementById("setupPanel"),
    supabaseUrl: document.getElementById("supabaseUrl"),
    supabaseKey: document.getElementById("supabaseKey"),
    displayName: document.getElementById("displayName"),
    defaultModeSelect: document.getElementById("defaultModeSelect"),
    ownerUserId: document.getElementById("ownerUserId"),
    useCurrentUserButton: document.getElementById("useCurrentUserButton"),
    currentUserLabel: document.getElementById("currentUserLabel"),
    backgroundUrl: document.getElementById("backgroundUrl"),
    themeSelect: document.getElementById("themeSelect"),
    siteTitleInput: document.getElementById("siteTitleInput"),
    siteTitle: document.getElementById("siteTitle"),
    saveSettingsButton: document.getElementById("saveSettingsButton"),
    saveSharedSettingsButton: document.getElementById("saveSharedSettingsButton"),
    clearSettingsButton: document.getElementById("clearSettingsButton"),
    composerPanel: document.getElementById("composerPanel"),
    composerTitle: document.getElementById("composerTitle"),
    postForm: document.getElementById("postForm"),
    postTitle: document.getElementById("postTitle"),
    postCategory: document.getElementById("postCategory"),
    postContent: document.getElementById("postContent"),
    submitPostButton: document.getElementById("submitPostButton"),
    draftState: document.getElementById("draftState"),
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    sortSelect: document.getElementById("sortSelect"),
    postCount: document.getElementById("postCount"),
    memberTag: document.getElementById("memberTag"),
    modeTag: document.getElementById("modeTag"),
    notice: document.getElementById("notice"),
    postList: document.getElementById("postList"),
    postDialog: document.getElementById("postDialog"),
    dialogCategory: document.getElementById("dialogCategory"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogMeta: document.getElementById("dialogMeta"),
    dialogContent: document.getElementById("dialogContent"),
    editArea: document.getElementById("editArea"),
    editTitle: document.getElementById("editTitle"),
    editCategory: document.getElementById("editCategory"),
    editContent: document.getElementById("editContent"),
    editButton: document.getElementById("editButton"),
    saveEditButton: document.getElementById("saveEditButton"),
    deleteButton: document.getElementById("deleteButton"),
    modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
  };

  init();

  async function init() {
    state.activeMode = sanitizeMode(state.settings.defaultMode);
    hydrateSettings();
    bindEvents();
    applyVisualSettings();
    renderIcons();
    await connectIfConfigured();
    await loadPosts();
  }

  function hydrateSettings() {
    els.supabaseUrl.value = state.settings.supabaseUrl;
    els.supabaseKey.value = state.settings.supabaseKey;
    els.displayName.value = state.settings.displayName || createGuestName();
    els.defaultModeSelect.value = sanitizeMode(state.settings.defaultMode);
    els.ownerUserId.value = state.settings.ownerUserId;
    els.backgroundUrl.value = state.settings.backgroundUrl;
    els.themeSelect.value = state.settings.theme;
    els.siteTitleInput.value = state.settings.siteTitle;
    updateCurrentUserLabel();
    updateModeUi();
  }

  function bindEvents() {
    els.settingsButton.addEventListener("click", () => {
      els.setupPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      els.supabaseUrl.focus();
    });

    els.closeSettingsButton.addEventListener("click", () => {
      els.postTitle.focus();
    });

    els.refreshButton.addEventListener("click", () => loadPosts());

    els.useCurrentUserButton.addEventListener("click", () => {
      if (!state.user?.id) {
        setNotice("Supabase에 연결되면 현재 User ID를 관리자 ID로 지정할 수 있습니다.");
        return;
      }
      els.ownerUserId.value = state.user.id;
      setNotice("현재 User ID를 관리자 ID 입력칸에 넣었습니다.");
    });

    els.saveSettingsButton.addEventListener("click", async () => {
      state.settings = readSettingsForm();
      state.activeMode = sanitizeMode(state.settings.defaultMode);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
      applyVisualSettings();
      updateModeUi();
      await connectIfConfigured(true);
      await loadPosts();
    });

    els.saveSharedSettingsButton.addEventListener("click", async () => {
      state.settings = readSettingsForm();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
      applyVisualSettings();
      await saveSharedSettings();
    });

    els.clearSettingsButton.addEventListener("click", async () => {
      localStorage.removeItem(STORAGE_KEY);
      state.settings = loadSettings();
      state.sharedSettings = {};
      state.supabase = null;
      state.user = null;
      state.activeMode = sanitizeMode(state.settings.defaultMode);
      hydrateSettings();
      applyVisualSettings();
      await loadPosts();
    });

    [els.themeSelect, els.backgroundUrl, els.siteTitleInput].forEach((input) => {
      input.addEventListener("change", () => {
        const preview = readSettingsForm();
        applyVisualSettings(preview);
      });
    });

    els.postForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await createPost();
    });

    els.modeTabs.forEach((button) => {
      button.addEventListener("click", async () => {
        state.activeMode = sanitizeMode(button.dataset.mode);
        updateModeUi();
        await loadPosts();
      });
    });

    [els.searchInput, els.categoryFilter, els.sortSelect].forEach((input) => {
      input.addEventListener("input", renderPosts);
      input.addEventListener("change", renderPosts);
    });

    els.editButton.addEventListener("click", () => setDialogEditMode(true));
    els.saveEditButton.addEventListener("click", () => saveSelectedPost());
    els.deleteButton.addEventListener("click", () => deleteSelectedPost());
    els.postDialog.addEventListener("close", () => {
      state.editMode = false;
      state.selectedPost = null;
    });
  }

  async function connectIfConfigured(forceNotice) {
    const { supabaseUrl, supabaseKey } = state.settings;
    if (!supabaseUrl || !supabaseKey) {
      state.supabase = null;
      state.user = null;
      setStatus("로컬 미리보기", "local");
      setNotice("Supabase URL과 publishable/anon key를 넣으면 공유 게시판으로 전환됩니다.");
      updateCurrentUserLabel();
      updateModeUi();
      return;
    }

    if (!window.supabase?.createClient) {
      setStatus("SDK 로드 실패", "error");
      setNotice("Supabase SDK를 불러오지 못했습니다. 인터넷 연결 또는 CDN 차단을 확인하세요.");
      return;
    }

    try {
      state.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
      const { data: sessionData } = await state.supabase.auth.getSession();
      if (!sessionData.session) {
        const { error } = await state.supabase.auth.signInAnonymously();
        if (error) throw error;
      }

      const { data: userData, error: userError } = await state.supabase.auth.getUser();
      if (userError) throw userError;
      state.user = userData.user;
      await loadSharedSettings();
      setStatus("Supabase 연결됨", "connected");
      setNotice(forceNotice ? "연결 설정을 저장했습니다." : "");
      updateCurrentUserLabel();
      updateModeUi();
      subscribeToChanges();
    } catch (error) {
      state.supabase = null;
      state.user = null;
      setStatus("연결 실패", "error");
      setNotice(readableError(error));
      updateCurrentUserLabel();
      updateModeUi();
    }
  }

  async function loadSharedSettings() {
    if (!state.supabase) return;

    const { data, error } = await state.supabase
      .from(SETTINGS_TABLE)
      .select("id,site_title,owner_user_id,default_mode,background_url")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      if (String(error.message || "").includes(SETTINGS_TABLE)) return;
      throw error;
    }

    if (!data) return;

    state.sharedSettings = {
      siteTitle: data.site_title || "",
      ownerUserId: data.owner_user_id || "",
      defaultMode: sanitizeMode(data.default_mode || state.settings.defaultMode),
      backgroundUrl: data.background_url || "",
    };

    const localOverrides = getLocalOverrides();
    state.settings = normalizeSettings({
      ...state.settings,
      siteTitle: localOverrides.siteTitle ? state.settings.siteTitle : state.sharedSettings.siteTitle,
      ownerUserId: localOverrides.ownerUserId ? state.settings.ownerUserId : state.sharedSettings.ownerUserId,
      defaultMode: localOverrides.defaultMode ? state.settings.defaultMode : state.sharedSettings.defaultMode,
      backgroundUrl: localOverrides.backgroundUrl ? state.settings.backgroundUrl : state.sharedSettings.backgroundUrl,
    });
    state.activeMode = sanitizeMode(state.settings.defaultMode);
    hydrateSettings();
    applyVisualSettings();
  }

  async function saveSharedSettings() {
    if (!state.supabase) {
      setNotice("Supabase 연결 후 공유 설정을 저장할 수 있습니다.");
      return;
    }

    setLoading(true, "저장 중");
    try {
      const settings = readSettingsForm();
      const { error } = await state.supabase.from(SETTINGS_TABLE).upsert(
        {
          id: "main",
          site_title: settings.siteTitle,
          owner_user_id: settings.ownerUserId || null,
          default_mode: sanitizeMode(settings.defaultMode),
          background_url: settings.backgroundUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      state.sharedSettings = {
        siteTitle: settings.siteTitle,
        ownerUserId: settings.ownerUserId,
        defaultMode: settings.defaultMode,
        backgroundUrl: settings.backgroundUrl,
      };
      setNotice("공유 설정을 저장했습니다.");
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  function subscribeToChanges() {
    if (!state.supabase || state.subscription) return;

    state.subscription = state.supabase
      .channel("forest-blog-board-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME },
        () => loadPosts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SETTINGS_TABLE },
        async () => {
          await loadSharedSettings();
          await loadPosts();
        }
      )
      .subscribe();
  }

  async function loadPosts() {
    setLoading(true);
    try {
      if (state.supabase) {
        const { data, error } = await state.supabase
          .from(TABLE_NAME)
          .select("id,post_type,title,content,author_name,category,created_at,updated_at,user_id")
          .eq("post_type", state.activeMode)
          .order("created_at", { ascending: false });

        if (error) throw error;
        state.posts = data || [];
      } else {
        state.posts = loadLocalPosts().filter((post) => post.post_type === state.activeMode);
      }
      renderPosts();
      updateSummary();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function createPost() {
    if (!canCreateActiveMode()) {
      setNotice("블로그 모드는 관리자만 작성할 수 있습니다.");
      return;
    }

    const title = sanitizeText(els.postTitle.value, 80);
    const content = sanitizeText(els.postContent.value, 4000);
    const category = els.postCategory.value;
    const author_name = sanitizeText(els.displayName.value, 24) || createGuestName();

    if (!title || !content) return;

    setLoading(true, "게시 중");
    try {
      if (state.supabase) {
        const payload = {
          post_type: state.activeMode,
          title,
          content,
          category,
          author_name,
          user_id: state.user?.id,
        };
        const { error } = await state.supabase.from(TABLE_NAME).insert(payload);
        if (error) throw error;
      } else {
        const posts = loadLocalPosts();
        posts.unshift({
          id: crypto.randomUUID(),
          post_type: state.activeMode,
          title,
          content,
          category,
          author_name,
          created_at: new Date().toISOString(),
          updated_at: null,
          user_id: state.localUserId,
        });
        saveLocalPosts(posts);
      }

      els.postForm.reset();
      els.postCategory.value = category;
      await loadPosts();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveSelectedPost() {
    if (!state.selectedPost || !canEditPost(state.selectedPost)) return;

    const title = sanitizeText(els.editTitle.value, 80);
    const content = sanitizeText(els.editContent.value, 4000);
    const category = els.editCategory.value;
    if (!title || !content) return;

    setLoading(true, "저장 중");
    try {
      if (state.supabase) {
        const { error } = await state.supabase
          .from(TABLE_NAME)
          .update({ title, content, category, updated_at: new Date().toISOString() })
          .eq("id", state.selectedPost.id);
        if (error) throw error;
      } else {
        const posts = loadLocalPosts().map((post) =>
          post.id === state.selectedPost.id
            ? { ...post, title, content, category, updated_at: new Date().toISOString() }
            : post
        );
        saveLocalPosts(posts);
      }
      await loadPosts();
      const updated = state.posts.find((post) => post.id === state.selectedPost.id);
      if (updated) openPost(updated);
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedPost() {
    if (!state.selectedPost || !canEditPost(state.selectedPost)) return;
    const ok = window.confirm("이 글을 삭제할까요?");
    if (!ok) return;

    setLoading(true, "삭제 중");
    try {
      if (state.supabase) {
        const { error } = await state.supabase.from(TABLE_NAME).delete().eq("id", state.selectedPost.id);
        if (error) throw error;
      } else {
        saveLocalPosts(loadLocalPosts().filter((post) => post.id !== state.selectedPost.id));
      }
      els.postDialog.close();
      await loadPosts();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  function renderPosts() {
    const query = els.searchInput.value.trim().toLowerCase();
    const category = els.categoryFilter.value;
    const sort = els.sortSelect.value;

    const filtered = state.posts
      .filter((post) => category === "all" || post.category === category)
      .filter((post) => {
        if (!query) return true;
        return [post.title, post.content, post.author_name, post.category]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const left = new Date(a.created_at).getTime();
        const right = new Date(b.created_at).getTime();
        return sort === "oldest" ? left - right : right - left;
      });

    els.postList.innerHTML = "";
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = state.activeMode === "blog" ? "아직 블로그 글이 없습니다." : "아직 게시글이 없습니다.";
      els.postList.append(empty);
    } else {
      filtered.forEach((post) => els.postList.append(createPostCard(post)));
    }

    els.postCount.textContent = String(filtered.length);
    renderIcons();
  }

  function createPostCard(post) {
    const card = document.createElement("button");
    card.className = "post-card";
    card.type = "button";
    card.addEventListener("click", () => openPost(post));

    const category = document.createElement("span");
    category.className = "category-chip";
    category.textContent = post.category || "일상";

    const title = document.createElement("h3");
    title.textContent = post.title;

    const body = document.createElement("p");
    body.textContent = post.content;

    const meta = document.createElement("div");
    meta.className = "post-meta";
    meta.innerHTML = `<span>${escapeHtml(post.author_name || "익명")}</span><span>${formatDate(post.created_at)}</span>`;

    card.append(category, title, body, meta);
    return card;
  }

  function openPost(post) {
    state.selectedPost = post;
    state.editMode = false;

    els.dialogCategory.textContent = post.category || "일상";
    els.dialogTitle.textContent = post.title;
    els.dialogMeta.textContent = `${post.author_name || "익명"} · ${formatDate(post.created_at)}${
      post.updated_at ? " · 수정됨" : ""
    }`;
    els.dialogContent.textContent = post.content;
    els.editTitle.value = post.title;
    els.editCategory.value = post.category || "일상";
    els.editContent.value = post.content;
    setDialogEditMode(false);
    els.postDialog.showModal();
    renderIcons();
  }

  function setDialogEditMode(isEditing) {
    state.editMode = isEditing;
    const canEdit = canEditPost(state.selectedPost);
    els.editButton.hidden = isEditing || !canEdit;
    els.saveEditButton.hidden = !isEditing || !canEdit;
    els.deleteButton.hidden = !canEdit;
    els.editArea.hidden = !isEditing;
    els.dialogContent.hidden = isEditing;
  }

  function updateModeUi() {
    els.modeTabs.forEach((button) => {
      const active = button.dataset.mode === state.activeMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    els.composerTitle.textContent = state.activeMode === "blog" ? "새 블로그 글" : "새 게시글";
    syncFormState();
  }

  function updateSummary() {
    const name = sanitizeText(els.displayName.value, 24) || "익명";
    els.memberTag.textContent = name;
    els.modeTag.textContent = state.supabase ? "Supabase" : "로컬";
  }

  function updateCurrentUserLabel() {
    const id = state.user?.id;
    els.currentUserLabel.textContent = id ? `${id.slice(0, 8)}...` : "ID 대기";
  }

  function canCreateActiveMode() {
    if (state.activeMode === "board") return true;
    return isOwner();
  }

  function canEditPost(post) {
    if (!post) return false;
    if (!state.supabase) return post.user_id === state.localUserId;
    if (post.post_type === "blog") return isOwner();
    return Boolean(state.user?.id && post.user_id === state.user.id);
  }

  function isOwner() {
    if (!state.supabase) return true;
    const ownerId = state.settings.ownerUserId || state.sharedSettings.ownerUserId;
    return Boolean(ownerId && state.user?.id === ownerId);
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

  function setLoading(isLoading, label) {
    state.loading = isLoading;
    const buttons = [
      els.refreshButton,
      els.saveSettingsButton,
      els.saveSharedSettingsButton,
      els.clearSettingsButton,
      els.useCurrentUserButton,
      els.editButton,
      els.saveEditButton,
      els.deleteButton,
    ];
    buttons.forEach((button) => {
      if (button) button.disabled = isLoading;
    });
    syncFormState(label);
  }

  function syncFormState(label) {
    const allowed = canCreateActiveMode();
    Array.from(els.postForm.elements).forEach((control) => {
      control.disabled = state.loading || !allowed;
    });
    els.composerPanel.classList.toggle("readonly", !allowed);
    els.draftState.textContent = state.loading ? label || "처리 중" : allowed ? "대기" : "읽기 전용";
  }

  function readSettingsForm() {
    return normalizeSettings({
      supabaseUrl: els.supabaseUrl.value,
      supabaseKey: els.supabaseKey.value,
      displayName: els.displayName.value,
      defaultMode: els.defaultModeSelect.value,
      ownerUserId: els.ownerUserId.value,
      backgroundUrl: els.backgroundUrl.value,
      theme: els.themeSelect.value,
      siteTitle: els.siteTitleInput.value,
    });
  }

  function loadSettings() {
    return normalizeSettings({
      ...runtimeConfig,
      ...getLocalOverrides(),
    });
  }

  function getLocalOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function normalizeSettings(value) {
    return {
      supabaseUrl: String(value.supabaseUrl || "").trim(),
      supabaseKey: String(value.supabaseKey || "").trim(),
      displayName: sanitizeText(value.displayName || "", 24),
      defaultMode: sanitizeMode(value.defaultMode || "board"),
      ownerUserId: String(value.ownerUserId || "").trim(),
      backgroundUrl: String(value.backgroundUrl || "").trim(),
      theme: value.theme === "dawn" ? "dawn" : "night",
      siteTitle: sanitizeText(value.siteTitle || "별숲 블로그 보드", 32),
    };
  }

  function applyVisualSettings(settings = state.settings) {
    const background = settings.backgroundUrl || DEFAULT_BACKGROUND;
    document.body.dataset.theme = settings.theme;
    document.documentElement.style.setProperty("--background-image", `url("${escapeCssUrl(background)}")`);
    els.siteTitle.textContent = settings.siteTitle || "별숲 블로그 보드";
    document.title = settings.siteTitle || "별숲 블로그 보드";
  }

  function loadLocalPosts() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      return fallbackPosts;
    }
    return fallbackPosts;
  }

  function saveLocalPosts(posts) {
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
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

  function sanitizeMode(value) {
    return value === "blog" ? "blog" : "board";
  }

  function sanitizeText(value, maxLength) {
    return String(value || "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, maxLength);
  }

  function escapeHtml(value) {
    return String(value)
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
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function readableError(error) {
    const message = error?.message || String(error);
    if (message.includes("relation") && message.includes(TABLE_NAME)) {
      return "Supabase 테이블이 아직 없습니다. supabase-schema.sql을 SQL Editor에서 실행하세요.";
    }
    if (message.includes("post_type")) {
      return "post_type 컬럼이 필요합니다. 최신 supabase-schema.sql을 다시 확인하세요.";
    }
    if (message.includes(SETTINGS_TABLE)) {
      return "공유 설정 테이블이 없습니다. supabase-schema.sql의 forest_site_settings를 확인하세요.";
    }
    if (message.toLowerCase().includes("anonymous")) {
      return "Supabase Auth에서 Anonymous sign-ins를 켜야 합니다.";
    }
    if (message.includes("violates row-level security")) {
      return "RLS 정책이 요청을 막았습니다. Supabase에서 게시판/블로그 권한 정책을 확인하세요.";
    }
    return message;
  }

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
})();
