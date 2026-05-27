const STEALTH_TITLE = "System Debugger - Node.js (Active)";
const STEALTH_FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%222%22%20fill%3D%22%23007acc%22%2F%3E%3Ctext%20x%3D%221%22%20y%3D%2213%22%20font-size%3D%2211%22%20font-family%3D%22monospace%22%20fill%3D%22%23fff%22%3E%3E_%3C%2Ftext%3E%3C%2Fsvg%3E";
const LOG_STORAGE_KEY = "stealthLogs";
const LOG_MAX_ENTRIES = 400;

const STEALTH_STORAGE_KEY = "stealthSettings";

const DEFAULT_SETTINGS = {
  stealthEnabled: true,
  stealthTheme: true,
  stealthFavicon: true,
  stealthTitle: true,
  stealthVideo: true,
  stealthList: true,
  stealthPipBar: true,
  popupTheme: 'system'
};

let stealthSettings = { ...DEFAULT_SETTINGS };

async function loadStealthSettings() {
  try {
    const result = await chrome.storage.local.get(STEALTH_STORAGE_KEY);
    const saved = result[STEALTH_STORAGE_KEY];
    if (saved && typeof saved === "object") {
      stealthSettings = { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch (error) {
    console.error("[DevTube Stealth] Error loading settings:", error);
    stealthSettings = { ...DEFAULT_SETTINGS };
  }
}

const state = {
  scheduled: false,
  logQueue: [],
  flushScheduled: false,
  pipBarUpdateTimer: null,
  lastListSignature: null,
  captchaSuspended: false,
  lastRouteKey: "",
  entryOrder: [],
  entryByHref: new Map(),
  scrollSyncRaf: 0,
  lastApplyAt: 0,
  applyTimer: 0,
  minApplyGapMs: 2000
};

function nowIso() {
  return new Date().toISOString();
}

function enqueueLog(level, message, meta = {}) {
  const entry = {
    ts: nowIso(),
    level,
    message,
    url: location.href,
    meta
  };

  state.logQueue.push(entry);
  if (!state.flushScheduled) {
    state.flushScheduled = true;
    setTimeout(flushLogs, 800);
  }

  const logFn = console[level] || console.log;
  logFn("[DevTube Stealth]", message, meta);
}

async function flushLogs() {
  state.flushScheduled = false;
  if (!state.logQueue.length) return;

  const toStore = state.logQueue.splice(0, state.logQueue.length);

  try {
    const stored = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const current = Array.isArray(stored[LOG_STORAGE_KEY])
      ? stored[LOG_STORAGE_KEY]
      : [];

    const merged = current.concat(toStore);
    const trimmed = merged.slice(-LOG_MAX_ENTRIES);

    await chrome.storage.local.set({
      [LOG_STORAGE_KEY]: trimmed
    });
  } catch (error) {
    console.error("[DevTube Stealth] No se pudieron guardar logs", error);
  }
}

function applyStealthFavicon() {
  const existing = document.getElementById("stealth-favicon");

  document
    .querySelectorAll("link[rel~='icon'], link[rel~='shortcut']")
    .forEach((el) => {
      if (el.id !== "stealth-favicon") el.remove();
    });

  if (existing) return;

  const link = document.createElement("link");
  link.id = "stealth-favicon";
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = STEALTH_FAVICON;
  (document.head || document.documentElement).appendChild(link);
}

function applyStealthTitle() {
  if (document.title !== STEALTH_TITLE) {
    document.title = STEALTH_TITLE;
  }
}

function applyStealthTheme() {
  const html = document.documentElement;

  if (html.hasAttribute("darker-dark-theme")) {
    html.removeAttribute("darker-dark-theme");
  }
  if (html.hasAttribute("darker-dark-theme-deprecate")) {
    html.removeAttribute("darker-dark-theme-deprecate");
  }
  if (html.hasAttribute("dark")) {
    html.removeAttribute("dark");
  }
  if (!html.hasAttribute("stealth-light")) {
    html.setAttribute("stealth-light", "");
  }
  if (html.style.colorScheme !== "light") {
    html.style.colorScheme = "light";
  }
}

function setStealthEnabled(enabled) {
  const html = document.documentElement;
  const body = document.body;
  const shell = document.getElementById("stealth-list-shell");

  if (enabled) {
    html.classList.add("stealth-active");
    if (body) body.classList.add("stealth-active");
    if (shell) shell.style.display = "block";
    return;
  }

  html.classList.remove("stealth-active");
  html.classList.remove("stealth-watch");
  if (body) body.classList.remove("stealth-active");
  if (shell) shell.style.display = "none";
}

function restoreVideoVisibility() {
  document.querySelectorAll("video").forEach((video) => {
    video.style.removeProperty("opacity");
    video.style.removeProperty("pointer-events");
    video.style.removeProperty("position");
    video.style.removeProperty("width");
    video.style.removeProperty("height");
    video.style.removeProperty("left");
    video.style.removeProperty("top");
  });
}

function hasCaptchaChallenge() {
  const path = location.pathname.toLowerCase();
  const search = location.search.toLowerCase();
  if (path.includes("/sorry") || search.includes("g-recaptcha")) {
    return true;
  }

  return Boolean(
    document.querySelector(
      "iframe[src*='recaptcha'], iframe[src*='google.com/recaptcha'], div.g-recaptcha, #recaptcha, #captcha-form, form[action*='sorry/index'], input[name='g-recaptcha-response'], .recaptcha-checkbox-border, #recaptcha-anchor"
    )
  );
}

function applyStealthVideo() {
  document.querySelectorAll("video").forEach((video) => {
    // Keep the element alive for audio and PiP while hiding visual playback.
    video.style.setProperty("opacity", "0", "important");
    video.style.setProperty("pointer-events", "none", "important");
    video.style.setProperty("position", "fixed", "important");
    video.style.setProperty("width", "1px", "important");
    video.style.setProperty("height", "1px", "important");
    video.style.setProperty("left", "0", "important");
    video.style.setProperty("top", "0", "important");
  });
}

function getRouteKey() {
  try {
    const parsed = new URL(location.href);
    if (parsed.pathname === "/watch") {
      return `/watch?v=${parsed.searchParams.get("v") || ""}&list=${parsed.searchParams.get("list") || ""}`;
    }
    if (parsed.pathname === "/results") {
      return `/results?search_query=${parsed.searchParams.get("search_query") || ""}`;
    }
    return parsed.pathname;
  } catch {
    return location.pathname;
  }
}

function resetStableEntriesByRoute() {
  const routeKey = getRouteKey();
  if (routeKey === state.lastRouteKey) return;

  state.lastRouteKey = routeKey;
  state.entryOrder = [];
  state.entryByHref = new Map();
  state.lastListSignature = null;
}

function canonicalWatchHref(rawHref) {
  try {
    const parsed = new URL(rawHref, location.origin);
    const path = parsed.pathname.replace(/\/+$/, "");
    const canonical = new URL("/watch", location.origin);
    let videoId = "";

    if (path === "/watch") {
      videoId = parsed.searchParams.get("v") || "";
    } else if (path.startsWith("/shorts/")) {
      videoId = path.split("/")[2] || "";
    } else if (path.startsWith("/live/")) {
      videoId = path.split("/")[2] || "";
    } else if (parsed.hostname.includes("youtu.be")) {
      videoId = path.split("/").filter(Boolean)[0] || "";
    }

    if (!videoId) return null;
    canonical.searchParams.set("v", videoId);

    const listId = parsed.searchParams.get("list");
    if (listId) canonical.searchParams.set("list", listId);

    return `${canonical.pathname}${canonical.search}`;
  } catch {
    return null;
  }
}

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function getCurrentSearchQuery() {
  try {
    const parsed = new URL(location.href);
    return normalizeText(parsed.searchParams.get("search_query") || "");
  } catch {
    return "";
  }
}

function navigateToSearch(query) {
  const normalized = normalizeText(query);
  if (!normalized) return;

  const target = new URL("/results", location.origin);
  target.searchParams.set("search_query", normalized);
  location.assign(target.toString());
}

function navigateToHome() {
  const target = new URL("/", location.origin);
  location.assign(target.toString());
}

function looksLikeDuration(value) {
  return /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(value || "");
}

function titleQuality(title) {
  const t = normalizeText(title);
  if (!t) return 0;
  if (looksLikeDuration(t)) return 5;
  if (isFallbackTitle(t)) return 10;

  let score = 20;
  if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(t)) score += 30;
  if (/\s/.test(t)) score += 20;
  if (t.length >= 18) score += 20;
  if (/[#@]/.test(t)) score += 5;

  if (/(views|visualizaciones|reproducciones|suscriptores|hace\s|ago\b)/i.test(t)) {
    score -= 15;
  }

  return Math.max(1, Math.min(100, score));
}

function isFallbackTitle(title) {
  return /^Video\s+[A-Za-z0-9_-]{6,}$/.test(title || "");
}

function fallbackTitleFromHref(href) {
  try {
    const parsed = new URL(href, location.origin);
    const videoId = parsed.searchParams.get("v") || "";
    return videoId ? `Video ${videoId}` : "Video";
  } catch {
    return "Video";
  }
}

function getTextPayload(textNode) {
  if (!textNode || typeof textNode !== "object") return "";
  if (typeof textNode.simpleText === "string") return normalizeText(textNode.simpleText);
  if (typeof textNode.content === "string") return normalizeText(textNode.content);
  if (Array.isArray(textNode.runs)) {
    return normalizeText(textNode.runs.map((run) => run.text || "").join(""));
  }
  return "";
}

function mergeStableEntries(entries) {
  entries.forEach((entry) => {
    if (!entry || !entry.href) return;
    const href = entry.href;
    const title = normalizeText(entry.title) || fallbackTitleFromHref(href);

    if (!state.entryByHref.has(href)) {
      state.entryByHref.set(href, title);
      state.entryOrder.push(href);
      return;
    }

    const previous = state.entryByHref.get(href) || "";
    if (titleQuality(title) > titleQuality(previous)) {
      state.entryByHref.set(href, title);
    }
  });
}

function getStableEntries() {
  return state.entryOrder
    .map((href) => {
      const title = state.entryByHref.get(href);
      if (!title) return null;
      return { href, title };
    })
    .filter(Boolean);
}

function getAnchorTitle(anchor) {
  const dedicatedInAnchor = normalizeText(
    anchor.querySelector("yt-formatted-string#video-title, #video-title, #video-title-link")
      ?.textContent || ""
  );
  if (dedicatedInAnchor) return dedicatedInAnchor;

  const dedicatedGlobal = normalizeText(
    anchor.closest(
      "ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer"
    )?.querySelector("#video-title, #video-title-link, yt-formatted-string#video-title")
      ?.textContent || ""
  );
  if (dedicatedGlobal) return dedicatedGlobal;

  const directTitle = normalizeText(anchor.getAttribute("title"));
  if (directTitle) return directTitle;

  const ariaTitle = normalizeText(anchor.getAttribute("aria-label"));
  if (ariaTitle && !looksLikeDuration(ariaTitle)) return ariaTitle;

  const textTitle = normalizeText(anchor.textContent);
  if (textTitle && !looksLikeDuration(textTitle)) return textTitle;

  const card = anchor.closest(
    "ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer"
  );
  if (card) {
    const nested = card.querySelector(
      "#video-title, #video-title-link, yt-formatted-string#video-title, h3 a, h3"
    );
    const nestedText = normalizeText(nested ? nested.textContent : "");
    if (nestedText) return nestedText;
  }

  return "";
}

function getRendererTitle(renderer) {
  if (!renderer || typeof renderer !== "object") return "";

  return (
    getTextPayload(renderer.title) ||
    getTextPayload(renderer.headline) ||
    getTextPayload(renderer.videoTitle) ||
    getTextPayload(renderer.primaryText)
  );
}

function collectVideoEntriesFromInitialData(limit = 250) {
  const root = window.ytInitialData;
  if (!root || typeof root !== "object") return [];

  const byHref = new Map();
  const stack = [root];

  const offerCandidate = (href, title) => {
    const normalized = normalizeText(title);
    if (!href || !normalized) return;

    const previous = byHref.get(href);
    if (!previous || titleQuality(normalized) > titleQuality(previous)) {
      byHref.set(href, normalized);
    }
  };

  while (stack.length && byHref.size < limit) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i -= 1) {
        stack.push(node[i]);
      }
      continue;
    }

    const candidates = [
      node.videoRenderer,
      node.gridVideoRenderer,
      node.compactVideoRenderer,
      node.playlistVideoRenderer,
      node.reelItemRenderer
    ];

    candidates.forEach((renderer) => {
      if (!renderer || typeof renderer !== "object") return;
      let videoId = renderer.videoId || "";

      if (!videoId && renderer.navigationEndpoint?.watchEndpoint?.videoId) {
        videoId = renderer.navigationEndpoint.watchEndpoint.videoId;
      }

      if (!videoId && renderer.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId) {
        videoId = renderer.onTap.innertubeCommand.reelWatchEndpoint.videoId;
      }

      if (!videoId) return;

      const href = canonicalWatchHref(`/watch?v=${videoId}`);
      const title = getRendererTitle(renderer) || fallbackTitleFromHref(`/watch?v=${videoId}`);
      offerCandidate(href, title);
    });

    if (node.shortsLockupViewModel && typeof node.shortsLockupViewModel === "object") {
      const shortsModel = node.shortsLockupViewModel;
      const shortsVideoId =
        shortsModel.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
        shortsModel.entityId ||
        "";

      const href = shortsVideoId
        ? canonicalWatchHref(`/watch?v=${shortsVideoId.replace(/^shorts-shelf-item-/, "")}`)
        : null;
      const title =
        getTextPayload(shortsModel.overlayMetadata?.primaryText) ||
        getTextPayload(shortsModel.accessibilityText) ||
        (href ? fallbackTitleFromHref(href) : "");

      offerCandidate(href, title);
    }

    Object.values(node).forEach((value) => {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    });
  }

  return Array.from(byHref.entries()).map(([href, title]) => ({ href, title }));
}

function collectVideoEntries() {
  const byHref = new Map();

  const offerCandidate = (href, title) => {
    const normalized = normalizeText(title);
    if (!href || !normalized) return;

    const previous = byHref.get(href);
    if (!previous || titleQuality(normalized) > titleQuality(previous)) {
      byHref.set(href, normalized);
    }
  };

  const strictSelectors = [
    "a#video-title-link[href*='/watch']",
    "a#video-title[href*='/watch']",
    "yt-lockup-metadata-view-model h3 a[href*='/watch']",
    "a.yt-lockup-metadata-view-model__title[href*='/watch']",
    "h3 a[href*='/watch']",
    "a[href*='/shorts/']",
    "a[href*='/live/']"
  ];

  const broadSelectors = [
    "ytd-rich-item-renderer a[href*='/watch?v=']",
    "ytd-video-renderer a[href*='/watch?v=']",
    "ytd-compact-video-renderer a[href*='/watch?v=']",
    "ytd-rich-grid-media a[href*='/watch?v=']",
    "a[href*='/shorts/']",
    "a[href*='/live/']",
    "a[href*='/watch?v=']",
    "a[href*='youtu.be/']"
  ];

  document.querySelectorAll(strictSelectors.join(",")).forEach((anchor) => {
    const href = canonicalWatchHref(anchor.getAttribute("href") || anchor.href || "");
    const title = getAnchorTitle(anchor) || fallbackTitleFromHref(href);
    offerCandidate(href, title);
  });

  document.querySelectorAll(broadSelectors.join(",")).forEach((anchor) => {
    const href = canonicalWatchHref(anchor.getAttribute("href") || anchor.href || "");
    const title = getAnchorTitle(anchor);
    offerCandidate(href, title);
  });

  const watchTitle = document.querySelector(
    "ytd-watch-metadata h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string"
  );

  if (location.pathname === "/watch" && watchTitle) {
    const watchHref = canonicalWatchHref(location.href);
    const title = watchTitle.textContent.trim();
    offerCandidate(watchHref, title);
  }

  if (location.pathname === "/watch" && !byHref.size) {
    const watchHref = canonicalWatchHref(location.href);
    const metaTitle = normalizeText(
      (document.querySelector("meta[name='title']") ||
        document.querySelector("meta[property='og:title']"))?.content || ""
    );

    offerCandidate(watchHref, metaTitle || fallbackTitleFromHref(watchHref));
  }

  return Array.from(byHref.entries()).map(([href, title]) => ({ href, title }));
}

function ensureListShell() {
  let shell = document.getElementById("stealth-list-shell");
  if (shell) return shell;

  shell = document.createElement("main");
  shell.id = "stealth-list-shell";

  const toolbar = document.createElement("div");
  toolbar.id = "stealth-toolbar";

  const form = document.createElement("form");
  form.id = "stealth-search-form";

  const homeButton = document.createElement("button");
  homeButton.id = "stealth-home-button";
  homeButton.type = "button";
  homeButton.textContent = "Inicio";
  homeButton.title = "Ir al inicio";

  const input = document.createElement("input");
  input.id = "stealth-search-input";
  input.type = "search";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "Buscar";

  const button = document.createElement("button");
  button.id = "stealth-search-button";
  button.type = "submit";
  button.textContent = "Ir";

  form.appendChild(homeButton);
  form.appendChild(input);
  form.appendChild(button);
  toolbar.appendChild(form);

  const status = document.createElement("div");
  status.id = "stealth-list-status";
  status.textContent = "Cargando titulos...";

  const list = document.createElement("div");
  list.id = "stealth-list-items";

  shell.appendChild(toolbar);
  shell.appendChild(status);
  shell.appendChild(list);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    navigateToSearch(value);
  });

  homeButton.addEventListener("click", () => {
    navigateToHome();
  });

  shell.addEventListener(
    "scroll",
    () => {
      if (state.scrollSyncRaf) {
        cancelAnimationFrame(state.scrollSyncRaf);
      }

      state.scrollSyncRaf = requestAnimationFrame(() => {
        state.scrollSyncRaf = 0;
        window.scrollTo({ top: shell.scrollTop, left: 0, behavior: "auto" });
      });
    },
    { passive: true }
  );

  document.documentElement.appendChild(shell);
  return shell;
}

function renderStealthList() {
  ensureListShell();
  resetStableEntriesByRoute();

  const searchInput = document.getElementById("stealth-search-input");
  if (searchInput && document.activeElement !== searchInput) {
    const currentQuery = getCurrentSearchQuery();
    if (searchInput.value !== currentQuery) {
      searchInput.value = currentQuery;
    }
  }

  let entries = collectVideoEntries();
  if (!entries.length) {
    entries = collectVideoEntriesFromInitialData();
  }

  mergeStableEntries(entries);
  const stableEntries = getStableEntries();

  const signature = stableEntries.map((entry) => `${entry.href}|${entry.title}`).join("\n");
  if (signature === state.lastListSignature) return stableEntries.length;
  state.lastListSignature = signature;

  const statusEl = document.getElementById("stealth-list-status");
  const listEl = document.getElementById("stealth-list-items");
  if (!statusEl || !listEl) return;

  listEl.textContent = "";

  if (!stableEntries.length) {
    statusEl.textContent = "Cargando titulos...";
    return 0;
  }

  statusEl.textContent = `Titulos: ${stableEntries.length}`;

  stableEntries.forEach((entry) => {
    const link = document.createElement("a");
    link.className = "stealth-title-link";
    link.href = entry.href;
    link.textContent = entry.title;
    listEl.appendChild(link);
  });

  return stableEntries.length;
}

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function getVideo() {
  return document.querySelector("video");
}

function injectPipBar() {
  if (document.getElementById("stealth-pip-bar")) return;

  const bar = document.createElement("div");
  bar.id = "stealth-pip-bar";
  bar.innerHTML = `
    <span id="sth-title">Cargando...</span>
    <div id="sth-controls">
      <button id="sth-rw" title="Retroceder 10s">-10s</button>
      <button id="sth-pp" title="Play/Pausa">Pausa</button>
      <button id="sth-fw" title="Avanzar 10s">+10s</button>
      <button id="sth-pip" title="Picture in Picture">PiP</button>
      <span id="sth-time">0:00 / 0:00</span>
    </div>
  `;
  document.documentElement.appendChild(bar);

  document.getElementById("sth-pp").addEventListener("click", () => {
    const video = getVideo();
    if (!video) return;
    video.paused ? video.play() : video.pause();
    syncPipBar();
  });

  document.getElementById("sth-rw").addEventListener("click", () => {
    const video = getVideo();
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  });

  document.getElementById("sth-fw").addEventListener("click", () => {
    const video = getVideo();
    if (video) video.currentTime += 10;
  });

  document.getElementById("sth-pip").addEventListener("click", async () => {
    const video = getVideo();
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        video.style.setProperty("width", "4px", "important");
        video.style.setProperty("height", "4px", "important");
        video.style.setProperty("opacity", "0.01", "important");
        await video.requestPictureInPicture();
        video.style.setProperty("width", "1px", "important");
        video.style.setProperty("height", "1px", "important");
        video.style.setProperty("opacity", "0", "important");
      }
      syncPipBar();
    } catch (error) {
      enqueueLog("warn", "PiP no disponible", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  if (!state.pipBarUpdateTimer) {
    state.pipBarUpdateTimer = setInterval(syncPipBar, 1000);
  }
}

function syncPipBar() {
  const bar = document.getElementById("stealth-pip-bar");
  if (!bar) return;

  const video = getVideo();
  const titleEl = document.querySelector(
    "ytd-watch-metadata h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string"
  );

  const titleNode = document.getElementById("sth-title");
  const ppBtn = document.getElementById("sth-pp");
  const pipBtn = document.getElementById("sth-pip");
  const timeNode = document.getElementById("sth-time");

  if (titleNode) {
    titleNode.textContent = titleEl ? titleEl.textContent.trim() : "Audio en segundo plano";
  }

  if (ppBtn && video) {
    ppBtn.textContent = video.paused ? "Play" : "Pausa";
  }

  if (pipBtn) {
    pipBtn.textContent = document.pictureInPictureElement ? "Cerrar PiP" : "PiP";
  }

  if (timeNode && video) {
    timeNode.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }
}

function removePipBar() {
  const bar = document.getElementById("stealth-pip-bar");
  if (bar) bar.remove();

  if (state.pipBarUpdateTimer) {
    clearInterval(state.pipBarUpdateTimer);
    state.pipBarUpdateTimer = null;
  }
}

function managePipBar() {
  const html = document.documentElement;
  if (location.pathname.startsWith("/watch")) {
    html.classList.add("stealth-watch");
    injectPipBar();
    syncPipBar();
  } else {
    html.classList.remove("stealth-watch");
    removePipBar();
  }
}

function revertStealthTheme() {
  const html = document.documentElement;
  html.removeAttribute("stealth-light");
  html.style.colorScheme = "";
}

let _stealthPageThemeQuery = null;

function resolvePageTheme(theme) {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyStealthPageTheme() {
  const theme = stealthSettings.popupTheme || 'system';
  const resolved = resolvePageTheme(theme);
  const html = document.documentElement;

  if (resolved === 'dark') {
    html.classList.add('stealth-dark');
  } else {
    html.classList.remove('stealth-dark');
  }

  // React to OS changes when mode is 'system'
  if (_stealthPageThemeQuery) {
    _stealthPageThemeQuery.removeEventListener('change', _onSystemPageThemeChange);
    _stealthPageThemeQuery = null;
  }
  if (theme === 'system') {
    _stealthPageThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    _stealthPageThemeQuery.addEventListener('change', _onSystemPageThemeChange);
  }
}

function _onSystemPageThemeChange() {
  applyStealthPageTheme();
}

function restoreFavicon() {
  const stealthFavicon = document.getElementById("stealth-favicon");
  if (stealthFavicon) stealthFavicon.remove();
}

function revertStealthTitle() {
  // Allow the original title to restore naturally
}

function removeStealthList() {
  const shell = document.getElementById("stealth-list-shell");
  if (shell) shell.remove();
  state.lastListSignature = null;
}

function applyStealth(reason = "tick") {
  if (hasCaptchaChallenge()) {
    if (!state.captchaSuspended) {
      enqueueLog("warn", "CAPTCHA detectado. Modo stealth suspendido.");
    }
    state.captchaSuspended = true;
    setStealthEnabled(false);
    removePipBar();
    restoreVideoVisibility();
    return;
  }

  if (state.captchaSuspended) {
    state.captchaSuspended = false;
    enqueueLog("info", "CAPTCHA ya no detectado. Modo stealth reactivado.");
  }

  if (!stealthSettings.stealthEnabled) {
    // Full disable: revert everything
    setStealthEnabled(false);
    removePipBar();
    restoreVideoVisibility();
    revertStealthTheme();
    restoreFavicon();
    removeStealthList();
    if (reason === "init") {
      enqueueLog("info", "Stealth desactivado por configuracion");
    }
    return;
  }

  setStealthEnabled(true);

  if (stealthSettings.stealthTheme) {
    applyStealthTheme();
  } else {
    revertStealthTheme();
  }

  if (stealthSettings.stealthFavicon) {
    applyStealthFavicon();
  } else {
    restoreFavicon();
  }

  if (stealthSettings.stealthTitle) {
    applyStealthTitle();
  }

  if (stealthSettings.stealthVideo) {
    applyStealthVideo();
  } else {
    restoreVideoVisibility();
  }

  if (stealthSettings.stealthList) {
    renderStealthList();
  } else {
    removeStealthList();
  }

  if (stealthSettings.stealthPipBar) {
    managePipBar();
  } else {
    removePipBar();
  }

  applyStealthPageTheme();

  if (reason === "init") {
    enqueueLog("info", "Stealth aplicado", { reason, settings: stealthSettings });
  }
}

function scheduleApply(reason) {
  if (state.scheduled) return;

  const now = Date.now();
  const elapsed = now - state.lastApplyAt;

  if (elapsed < state.minApplyGapMs) {
    if (!state.applyTimer) {
      state.applyTimer = window.setTimeout(() => {
        state.applyTimer = 0;
        scheduleApply(`throttle:${reason}`);
      }, state.minApplyGapMs - elapsed);
    }
    return;
  }

  state.scheduled = true;
  requestAnimationFrame(() => {
    state.scheduled = false;
    state.lastApplyAt = Date.now();
    applyStealth(reason);
  });
}

async function exportLogs() {
  try {
    await flushLogs();
    const stored = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs = Array.isArray(stored[LOG_STORAGE_KEY]) ? stored[LOG_STORAGE_KEY] : [];

    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `devtube-stealth-logs-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    enqueueLog("error", "Error al exportar logs", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function clearLogs() {
  try {
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: [] });
    enqueueLog("info", "Logs limpiados por usuario");
  } catch (error) {
    enqueueLog("error", "Error al limpiar logs", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function setupLogHotkeys() {
  window.addEventListener("keydown", (event) => {
    if (!event.shiftKey || !event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "l") {
      event.preventDefault();
      exportLogs();
    }

    if (key === "c") {
      event.preventDefault();
      clearLogs();
    }
  });
}

function setupSearchHotkeys() {
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (event.key !== "/") return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target;
    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    if (isInput) return;

    const input = document.getElementById("stealth-search-input");
    if (!input) return;

    event.preventDefault();
    input.focus();
    input.select();
  });
}

function setupTitleObserver() {
  const titleElement = document.querySelector("title");
  if (!titleElement) return;

  const titleObserver = new MutationObserver(() => {
    if (stealthSettings.stealthEnabled && stealthSettings.stealthTitle) {
      if (document.title !== STEALTH_TITLE) {
        document.title = STEALTH_TITLE;
      }
    }
  });

  titleObserver.observe(titleElement, {
    subtree: true,
    characterData: true,
    childList: true
  });
}

const observer = new MutationObserver((records) => {
  const shell = document.getElementById("stealth-list-shell");
  const pip = document.getElementById("stealth-pip-bar");

  if (shell || pip) {
    const relevant = records.some((record) => {
      const target = record.target;
      if (!(target instanceof Node)) return true;
      if (shell && shell.contains(target)) return false;
      if (pip && pip.contains(target)) return false;
      return true;
    });

    if (!relevant) {
      return;
    }
  }

  scheduleApply("mutation");
});

if (document.documentElement) {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

window.addEventListener("yt-navigate-finish", () => scheduleApply("yt-navigate-finish"));
window.addEventListener("yt-page-data-updated", () => scheduleApply("yt-page-data-updated"));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    scheduleApply("visibilitychange");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ventoUpdateSettings" && message.settings) {
    stealthSettings = { ...DEFAULT_SETTINGS, ...message.settings };
    scheduleApply("popup");
  }
});

setupLogHotkeys();
setupSearchHotkeys();

(async function initContent() {
  await loadStealthSettings();
  setupTitleObserver();
  applyStealth("init");
})();
