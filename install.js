(function () {
  const STORAGE_KEY = "forest-cms-settings";
  const DEFAULT_BACKGROUND = "./assets/shooting-star-forest.png";
  const SQL_FALLBACK = "supabase-schema.sql 파일을 열어서 복사해줘. 로컬 파일로 직접 열면 브라우저 보안 때문에 SQL 자동 불러오기가 막힐 수 있어.";

  const els = {
    status: document.getElementById("installStatus"),
    supabaseUrl: document.getElementById("installSupabaseUrl"),
    supabaseKey: document.getElementById("installSupabaseKey"),
    apiBaseUrl: document.getElementById("installApiBaseUrl"),
    oauthRedirectUrl: document.getElementById("installOauthRedirectUrl"),
    adminToken: document.getElementById("installAdminToken"),
    ownerUserId: document.getElementById("installOwnerUserId"),
    siteTitle: document.getElementById("installSiteTitle"),
    defaultBoardSlug: document.getElementById("installDefaultBoardSlug"),
    theme: document.getElementById("installTheme"),
    skin: document.getElementById("installSkin"),
    backgroundUrl: document.getElementById("installBackgroundUrl"),
    testConnectionButton: document.getElementById("testConnectionButton"),
    saveSharedButton: document.getElementById("saveSharedButton"),
    applyLocalButton: document.getElementById("applyLocalButton"),
    reloadSqlButton: document.getElementById("reloadSqlButton"),
    copySqlButton: document.getElementById("copySqlButton"),
    schemaSql: document.getElementById("schemaSql"),
    generateConfigButton: document.getElementById("generateConfigButton"),
    downloadConfigButton: document.getElementById("downloadConfigButton"),
    configOutput: document.getElementById("configOutput"),
  };

  init();

  async function init() {
    const settings = {
      ...(window.FOREST_BLOG_CONFIG || {}),
      ...loadLocalSettings(),
    };
    els.supabaseUrl.value = settings.supabaseUrl || "";
    els.supabaseKey.value = settings.supabaseKey || "";
    els.apiBaseUrl.value = settings.apiBaseUrl || "";
    els.oauthRedirectUrl.value = settings.oauthRedirectUrl || getDefaultRedirectUrl();
    els.adminToken.value = "";
    els.ownerUserId.value = settings.ownerUserId || "";
    els.siteTitle.value = settings.siteTitle || "별숲 커뮤니티";
    els.defaultBoardSlug.value = settings.defaultBoardSlug || "free";
    els.theme.value = ["night", "dawn", "classic"].includes(settings.theme) ? settings.theme : "night";
    els.skin.value = settings.skin === "classic" ? "classic" : "forest";
    els.backgroundUrl.value = settings.backgroundUrl || "";
    bindEvents();
    await loadSchema();
    generateConfig();
    renderIcons();
  }

  function bindEvents() {
    els.testConnectionButton.addEventListener("click", testConnection);
    els.saveSharedButton.addEventListener("click", saveSharedSettings);
    els.applyLocalButton.addEventListener("click", applyLocalSettings);
    els.reloadSqlButton.addEventListener("click", loadSchema);
    els.copySqlButton.addEventListener("click", () => copyText(els.schemaSql.value, "SQL 복사됨"));
    els.generateConfigButton.addEventListener("click", generateConfig);
    els.downloadConfigButton.addEventListener("click", downloadConfig);
    [
      els.supabaseUrl,
      els.supabaseKey,
      els.apiBaseUrl,
      els.oauthRedirectUrl,
      els.adminToken,
      els.ownerUserId,
      els.siteTitle,
      els.defaultBoardSlug,
      els.theme,
      els.skin,
      els.backgroundUrl,
    ].forEach((input) => input.addEventListener("input", generateConfig));
  }

  async function loadSchema() {
    try {
      const response = await fetch("./supabase-schema.sql", { cache: "no-store" });
      if (!response.ok) throw new Error("schema load failed");
      els.schemaSql.value = await response.text();
      setStatus("SQL 로드됨", "connected");
    } catch {
      els.schemaSql.value = SQL_FALLBACK;
      setStatus("SQL 직접 복사", "error");
    }
  }

  async function testConnection() {
    if (els.apiBaseUrl.value.trim()) {
      setStatus("프록시 확인 중", "");
      try {
        const response = await fetch(`${els.apiBaseUrl.value.trim().replace(/\/+$/, "")}/api/settings`, {
          headers: {
            "x-forest-client-id": "installer",
            authorization: els.adminToken.value.trim() ? `Bearer ${els.adminToken.value.trim()}` : "",
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || response.statusText);
        if (data.settings?.owner_user_id) els.ownerUserId.value = data.settings.owner_user_id;
        generateConfig();
        setStatus("프록시 연결됨", "connected");
      } catch (error) {
        setStatus("프록시 실패", "error");
        alert(readableError(error));
      }
      return;
    }

    if (!window.supabase?.createClient) {
      setStatus("SDK 실패", "error");
      return;
    }

    setStatus("연결 중", "");
    try {
      const client = window.supabase.createClient(els.supabaseUrl.value.trim(), els.supabaseKey.value.trim());
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      els.ownerUserId.value = data.user.id;
      generateConfig();
      setStatus("연결됨", "connected");
    } catch (error) {
      setStatus("실패", "error");
      alert(readableError(error));
    }
  }

  async function saveSharedSettings() {
    if (els.apiBaseUrl.value.trim()) {
      setStatus("프록시 저장 중", "");
      try {
        const settings = readSettings(true);
        const response = await fetch(`${els.apiBaseUrl.value.trim().replace(/\/+$/, "")}/api/settings`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${els.adminToken.value.trim()}`,
          },
          body: JSON.stringify({
            site_title: settings.siteTitle,
            owner_user_id: settings.ownerUserId || null,
            default_board_slug: settings.defaultBoardSlug,
            background_url: settings.backgroundUrl || null,
            theme: settings.theme,
            skin: settings.skin,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || response.statusText);
        applyLocalSettings();
        generateConfig();
        setStatus("프록시 저장됨", "connected");
      } catch (error) {
        setStatus("저장 실패", "error");
        alert(readableError(error));
      }
      return;
    }

    if (!window.supabase?.createClient) {
      setStatus("SDK 실패", "error");
      return;
    }

    setStatus("저장 중", "");
    try {
      const client = window.supabase.createClient(els.supabaseUrl.value.trim(), els.supabaseKey.value.trim());
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!els.ownerUserId.value.trim()) els.ownerUserId.value = userData.user.id;

      const settings = readSettings();
      const { error } = await client.from("forest_site_settings").upsert(
        {
          id: "main",
          site_title: settings.siteTitle,
          owner_user_id: settings.ownerUserId || userData.user.id,
          default_board_slug: settings.defaultBoardSlug,
          background_url: settings.backgroundUrl || null,
          theme: settings.theme,
          skin: settings.skin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      applyLocalSettings();
      generateConfig();
      setStatus("공유 저장됨", "connected");
    } catch (error) {
      setStatus("저장 실패", "error");
      alert(readableError(error));
    }
  }

  function applyLocalSettings() {
    const settings = readSettings(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setStatus("적용됨", "connected");
  }

  function generateConfig() {
    const settings = readSettings(false);
    els.configOutput.value = `window.FOREST_BLOG_CONFIG = ${JSON.stringify(settings, null, 2)};\n`;
  }

  function downloadConfig() {
    generateConfig();
    const blob = new Blob([els.configOutput.value], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.js";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("config 생성됨", "connected");
  }

  function readSettings(includePrivate) {
    const settings = {
      apiBaseUrl: els.apiBaseUrl.value.trim(),
      oauthRedirectUrl: els.oauthRedirectUrl.value.trim() || getDefaultRedirectUrl(),
      supabaseUrl: els.supabaseUrl.value.trim(),
      supabaseKey: els.supabaseKey.value.trim(),
      ownerUserId: els.ownerUserId.value.trim(),
      defaultBoardSlug: els.defaultBoardSlug.value || "free",
      backgroundUrl: els.backgroundUrl.value.trim() || DEFAULT_BACKGROUND,
      siteTitle: els.siteTitle.value.trim() || "별숲 커뮤니티",
      theme: ["night", "dawn", "classic"].includes(els.theme.value) ? els.theme.value : "night",
      skin: els.skin.value === "classic" ? "classic" : "forest",
      oauthProviders: ["kakao"],
    };
    if (includePrivate) settings.adminToken = els.adminToken.value.trim();
    return settings;
  }

  function loadLocalSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function getDefaultRedirectUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/(?:index|install)\.html$/, "");
    return url.href;
  }

  async function copyText(value, message) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message, "connected");
    } catch {
      setStatus("복사 실패", "error");
    }
  }

  function setStatus(text, mode) {
    els.status.textContent = text;
    els.status.className = "status-pill";
    if (mode === "connected") els.status.classList.add("connected");
    if (mode === "error") els.status.classList.add("error");
  }

  function readableError(error) {
    const message = error?.message || String(error);
    if (message.toLowerCase().includes("anonymous")) {
      return "Supabase Auth에서 Anonymous sign-ins를 켜야 연결 테스트가 돼.";
    }
    return message;
  }

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
})();
