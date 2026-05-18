const STEALTH_TITLE = "System Debugger - Node.js (Active)";
// Favicon ">_" estilo terminal VS Code — data URI, no depende de internet
const STEALTH_FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%222%22%20fill%3D%22%23007acc%22%2F%3E%3Ctext%20x%3D%221%22%20y%3D%2213%22%20font-size%3D%2211%22%20font-family%3D%22monospace%22%20fill%3D%22%23fff%22%3E%3E_%3C%2Ftext%3E%3C%2Fsvg%3E";
const LOG_STORAGE_KEY = "stealthLogs";
const LOG_MAX_ENTRIES = 400;

const state = {
  scheduled: false,
  logQueue: [],
  flushScheduled: false,
  pipBarUpdateTimer: null
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
  // opacity 0 en lugar de display:none → mantiene el elemento elegible para PiP
  document.querySelectorAll("video").forEach(v => {
    v.style.setProperty("opacity", "0", "important");
    v.style.setProperty("pointer-events", "none", "important");
  });
}

// =============================================================
// FAVICON — nuclear: quita TODOS los de YouTube, inyecta data URI
// =============================================================

function applyStealthFavicon() {
  if (document.getElementById("stealth-favicon")) {
    // Solo limpiar los que YouTube re-inyecte después del nuestro
    document.querySelectorAll(
      "link[rel~='icon']:not(#stealth-favicon), link[rel~='shortcut']:not(#stealth-favicon)"
    ).forEach(el => el.remove());
    return;
  }
  document.querySelectorAll("link[rel~='icon'], link[rel~='shortcut']").forEach(el => el.remove());
  const link = document.createElement("link");
  link.id   = "stealth-favicon";
  link.rel  = "icon";
  link.type = "image/svg+xml";
  link.href = STEALTH_FAVICON;
  (document.head || document.documentElement).appendChild(link);
}

function applyStealthTitle() {
  if (document.title !== STEALTH_TITLE) document.title = STEALTH_TITLE;
}

function applyStealthTheme() {
  const h = document.documentElement;
  if (h.hasAttribute("darker-dark-theme"))           h.removeAttribute("darker-dark-theme");
  if (h.hasAttribute("darker-dark-theme-deprecate")) h.removeAttribute("darker-dark-theme-deprecate");
  if (h.hasAttribute("dark"))                        h.removeAttribute("dark");
  if (!h.hasAttribute("stealth-light"))              h.setAttribute("stealth-light", "");
  if (h.style.colorScheme !== "light")               h.style.colorScheme = "light";
}

// =============================================================
// BARRA PiP — solo en páginas /watch
// =============================================================

function formatTime(sec) {
  if (!isFinite(sec)) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 66);
  const h = Math.floor(sec / 3600);
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
    : `${m}:${String(s).padStart(2,"0")}`;
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
      <button id="sth-rw"  title="Retroceder 10s">◀◀ 10s</button>
      <button id="sth-pp"  title="Play / Pausa">⏸</button>
      <button id="sth-fw"  title="Avanzar 10s">10s ▶▶</button>
      <button id="sth-pip" title="Picture in Picture">📺 PiP</button>
      <span   id="sth-time">0:00 / 0:00</span>
    </div>
  `;
  document.documentElement.appendChild(bar);

  document.getElementById("sth-pp").addEventListener("click", () => {
    const v = getVideo();
    if (!v) return;
    v.paused ? v.play() : v.pause();
    syncPipBar();
  });

  document.getElementById("sth-rw").addEventListener("click", () => {
    const v = getVideo();
    if (v) v.currentTime = Math.max(0, v.currentTime - 10);
  });

  document.getElementById("sth-fw").addEventListener("click", () => {
    const v = getVideo();
    if (v) v.currentTime = v.currentTime + 10;
  });

  document.getElementById("sth-pip").addEventListener("click", async () => {
    const v = getVideo();
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        document.getElementById("sth-pip").textContent = "📺 PiP";
      } else {
        // El video necesita dimensiones > 0 para que el API de PiP lo acepte
        v.style.setProperty("width",    "4px",   "important");
        v.style.setProperty("height",   "4px",   "important");
        v.style.setProperty("opacity",  "0.01",  "important");
        v.style.setProperty("position", "fixed", "important");
        v.style.setProperty("top",      "0",     "important");
        v.style.setProperty("left",     "0",     "important");
        await v.requestPictureInPicture();
        v.style.setProperty("opacity", "0",   "important");
        v.style.setProperty("width",   "1px", "important");
        v.style.setProperty("height",  "1px", "important");
        document.getElementById("sth-pip").textContent = "✖ Cerrar PiP";
      }
    } catch (err) {
      enqueueLog("warn", "PiP no disponible", { error: err.message });
    }
  });

  if (!state.pipBarUpdateTimer) {
    state.pipBarUpdateTimer = setInterval(syncPipBar, 1000);
  }
}

function syncPipBar() {
  if (!document.getElementById("stealth-pip-bar")) return;
  const v        = getVideo();
  const titleEl  = document.querySelector(
    "ytd-watch-metadata h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string"
  );
  const titleSpan = document.getElementById("sth-title");
  const ppBtn     = document.getElementById("sth-pp");
  const timeSpan  = document.getElementById("sth-time");

  if (titleSpan && titleEl) titleSpan.textContent = titleEl.textContent.trim();
  if (ppBtn    && v)        ppBtn.textContent     = v.paused ? "▶" : "⏸";
  if (timeSpan && v)        timeSpan.textContent  =
    `${formatTime(v.currentTime)} / ${formatTime(v.duration)}`;
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
  if (location.pathname.startsWith("/watch")) {
    injectPipBar();
    syncPipBar();
  } else {
    removePipBar();
  }
}

function applyStealth(reason = "tick") {
  applyStealthTheme();
  applyStealthFavicon();
  applyStealthTitle();
  applyStealthVideo();
  managePipBar();
  nukeNonTitles(); // <-- fuerza solo títulos visibles
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

window.addEventListener("yt-navigate-finish",   () => scheduleApply("yt-navigate-finish"));
window.addEventListener("yt-page-data-updated", () => scheduleApply("yt-page-data-updated"));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    scheduleApply("visibilitychange");
  }
});

setupLogHotkeys();
setupTitleObserver();
enqueueLog("info", "DevTube Stealth activo", {
  exportHotkey: "Alt+Shift+L",
  clearHotkey:  "Alt+Shift+C"
});
applyStealth("init");

// Eliminar absolutamente todo menos los títulos en el feed principal
function nukeNonTitles() {
  // Oculta todo menos los títulos en cada tarjeta de video
  const selectors = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-rich-grid-media'
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(card => {
      // Oculta todos los hijos
      Array.from(card.children).forEach(child => {
        child.style.display = 'none';
        child.style.visibility = 'hidden';
        child.style.height = '0';
        child.style.margin = '0';
        child.style.padding = '0';
      });
      // Busca el título y lo muestra
      const title = card.querySelector('#video-title, #video-title-link, a#video-title, h3.ytd-rich-grid-media, h3.ytd-video-renderer, yt-formatted-string.title');
      if (title) {
        title.style.display = 'block';
        title.style.visibility = 'visible';
        title.style.opacity = '1';
        title.style.color = '#111';
        title.style.fontSize = '15px';
        title.style.fontWeight = '600';
        title.style.lineHeight = '1.6';
        title.style.textDecoration = 'none';
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.maxWidth = '100%';
        title.style.padding = '8px 0';
        title.style.margin = '0';
        title.style.background = '#fff';
        title.style.border = 'none';
        title.style.boxShadow = 'none';
        title.style.minHeight = '0';
        title.style.minWidth = '0';
        title.style.height = 'auto';
      }
    });
  });
}
