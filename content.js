const STEALTH_TITLE = "System Debugger - Node.js (Active)";
const STEALTH_FAVICON = "https://raw.githubusercontent.com/visual-studio-code/vscode-icons/master/icons/dark/folder.svg";
const LOG_STORAGE_KEY = "stealthLogs";
const LOG_MAX_ENTRIES = 400;

const state = {
  scheduled: false,
  lastVideoCount: -1,
  lastThumbnailCount: -1,
  lastTitle: "",
  logQueue: [],
  flushScheduled: false
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

function applyStealthVideo() {
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    video.style.opacity = "0";
    video.style.position = "fixed";
    video.style.top = "-9999px";
    video.style.left = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.pointerEvents = "none";
  });
  return videos.length;
}

function applyStealthThumbnails() {
  const thumbnailSelectors = [
    "ytd-thumbnail",
    "a#thumbnail",
    "#thumbnail-container",
    "ytd-playlist-thumbnail",
    "ytd-moving-thumbnail-renderer",
    // Solo el contenedor de imagen dentro de rich-grid-media, no el elemento completo
    "ytd-rich-grid-media #media-container",
    "ytd-rich-grid-media ytd-thumbnail",
    "ytd-rich-grid-media a#thumbnail",
    "yt-lockup-thumbnail",
    "yt-lockup-image",
    "yt-image",
    "yt-avatar-shape",
    "img.yt-core-image",
    'img[src*="i.ytimg.com"]',
    'img[src*="ytimg.com"]',
    "#avatar",
    ".ytp-videowall-still-image",
    // Logo de YouTube
    "#logo",
    "ytd-logo",
    "#logo-icon",
    "#logo-icon-container",
    "a#logo"
  ];

  const nodes = document.querySelectorAll(thumbnailSelectors.join(","));
  nodes.forEach((node) => {
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("opacity", "0", "important");
  });

  return nodes.length;
}

function applyStealthTitle() {
  if (document.title !== STEALTH_TITLE) {
    document.title = STEALTH_TITLE;
  }
}

function applyStealthTheme() {
  const html = document.documentElement;
  html.removeAttribute("darker-dark-theme");
  html.removeAttribute("darker-dark-theme-deprecate");
  html.removeAttribute("dark");
  html.setAttribute("light", "");
  html.style.colorScheme = "light";
}

function applyStealthFavicon() {
  const head = document.head || document.getElementsByTagName("head")[0];
  if (!head) return;

  const existingIcon = document.querySelector("link[rel*='icon']");
  const iconLink = existingIcon || document.createElement("link");

  iconLink.type = "image/x-icon";
  iconLink.rel = "shortcut icon";
  iconLink.href = STEALTH_FAVICON;

  if (!existingIcon) {
    head.appendChild(iconLink);
  }
}

function applyStealth(reason = "manual") {
  const videoCount = applyStealthVideo();
  const thumbnailCount = applyStealthThumbnails();
  applyStealthTitle();
  applyStealthFavicon();
  applyStealthTheme();

  if (
    videoCount !== state.lastVideoCount ||
    thumbnailCount !== state.lastThumbnailCount ||
    document.title !== state.lastTitle
  ) {
    enqueueLog("info", "Stealth aplicado", {
      reason,
      videoCount,
      thumbnailCount,
      title: document.title
    });
    state.lastVideoCount = videoCount;
    state.lastThumbnailCount = thumbnailCount;
    state.lastTitle = document.title;
  }
}

function scheduleApply(reason) {
  if (state.scheduled) return;
  state.scheduled = true;

  requestAnimationFrame(() => {
    state.scheduled = false;
    applyStealth(reason);
  });
}

async function exportLogs() {
  try {
    await flushLogs();
    const stored = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs = Array.isArray(stored[LOG_STORAGE_KEY]) ? stored[LOG_STORAGE_KEY] : [];

    const content = JSON.stringify(logs, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `devtube-stealth-logs-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    enqueueLog("info", "Logs exportados", { count: logs.length });
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

    if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      exportLogs();
    }

    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      clearLogs();
    }
  });
}

function setupTitleObserver() {
  const titleElement = document.querySelector("title");
  if (!titleElement) {
    enqueueLog("warn", "No se encontro el elemento <title>");
    return;
  }

  const titleObserver = new MutationObserver(() => {
    if (document.title !== STEALTH_TITLE) {
      document.title = STEALTH_TITLE;
      enqueueLog("info", "Titulo restaurado por observer", {
        source: "title-observer"
      });
    }
  });

  titleObserver.observe(titleElement, {
    subtree: true,
    characterData: true,
    childList: true
  });
}

const observer = new MutationObserver(() => {
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

setupLogHotkeys();
setupTitleObserver();
enqueueLog("info", "Capturador de logs activo", {
  exportHotkey: "Alt+Shift+L",
  clearHotkey: "Alt+Shift+C"
});
applyStealth("init");
