/* ============================================================
   1) PON AQUÍ LA URL DE TU STREAM DE AUDIO
   Ejemplos según tu proveedor:
   - Zeno.fm:      "https://stream.zeno.fm/TU_CLAVE"
   - Icecast:      "https://tu-servidor:puerto/stream"
   - Shoutcast:    "https://tu-servidor:puerto/;"
   ============================================================ */
const STREAM_URL = "https://stream.zeno.fm/TU_CLAVE_AQUI";

const audio = new Audio(STREAM_URL);
audio.preload = "none";
audio.crossOrigin = "anonymous";
audio.volume = 1;

const playBtn = document.getElementById("masterPlay");
const playIcon = document.getElementById("mainIcon");
const playerStatus = document.getElementById("player-status");
const playerCard = document.querySelector(".player-card");
const installBtn = document.getElementById("installBtn");
const volumeSlider = document.getElementById("volumeSlider");

let hasAudioStarted = false;
let isConnecting = false;
let isUserPaused = true;
let deferredPrompt = null;

function setStatus(message) {
  playerStatus.textContent = `Estado: ${message}`;
}

function setCardState(...states) {
  playerCard.classList.remove("is-playing", "is-paused", "is-idle", "is-loading", "is-error");
  playerCard.classList.add(...states);
}

function setPlayUI(isPlaying) {
  playBtn.setAttribute("aria-pressed", String(isPlaying));
  playBtn.setAttribute("aria-label", isPlaying ? "Pausar radio en vivo" : "Reproducir radio en vivo");
  playIcon.classList.remove("fa-play", "fa-pause");
  playIcon.classList.add(isPlaying ? "fa-pause" : "fa-play");
}

function syncVisualState() {
  if (isConnecting) {
    setCardState("is-loading");
    setStatus("conectando a la transmisión");
    return;
  }
  if (!audio.paused && hasAudioStarted) {
    setPlayUI(true);
    setCardState("is-playing");
    setStatus("reproduciendo en vivo");
    return;
  }
  setPlayUI(false);
  setCardState("is-idle");
  setStatus(isUserPaused ? "pausado" : "listo para reproducir");
}

function setupVolumeControl() {
  if (!volumeSlider) return;
  const saved = localStorage.getItem("altosfmVolume");
  const initial = saved !== null && !Number.isNaN(parseFloat(saved))
    ? Math.min(1, Math.max(0, parseFloat(saved)))
    : 1;

  volumeSlider.value = String(initial);
  audio.volume = initial;
  audio.muted = initial === 0;

  const update = () => {
    const v = Math.min(1, Math.max(0, parseFloat(volumeSlider.value)));
    audio.volume = v;
    audio.muted = v === 0;
    localStorage.setItem("altosfmVolume", String(v));
  };
  volumeSlider.addEventListener("input", update);
  volumeSlider.addEventListener("change", update);
}

async function startPlayback() {
  try {
    isUserPaused = false;
    isConnecting = true;
    syncVisualState();

    await audio.play();

    hasAudioStarted = true;
    isConnecting = false;
    syncVisualState();
  } catch (error) {
    isConnecting = false;
    hasAudioStarted = false;
    setPlayUI(false);
    setCardState("is-error");
    setStatus("no fue posible reproducir la señal");
    console.error("Error reproduciendo stream:", error);
  }
}

function stopPlayback() {
  isUserPaused = true;
  isConnecting = false;
  audio.pause();
  syncVisualState();
}

async function togglePlayback() {
  if (audio.paused) {
    await startPlayback();
  } else {
    stopPlayback();
  }
}

playBtn.addEventListener("click", togglePlayback);

audio.addEventListener("playing", () => {
  hasAudioStarted = true;
  isConnecting = false;
  syncVisualState();
});
audio.addEventListener("pause", syncVisualState);
audio.addEventListener("waiting", () => {
  if (!audio.paused) {
    isConnecting = true;
    syncVisualState();
  }
});
audio.addEventListener("canplay", () => {
  if (!audio.paused || hasAudioStarted) {
    isConnecting = false;
    syncVisualState();
  }
});
audio.addEventListener("stalled", () => {
  if (!audio.paused) setStatus("reconectando transmisión");
});
audio.addEventListener("error", () => {
  isConnecting = false;
  setPlayUI(false);
  setCardState("is-error");
  setStatus("no fue posible reproducir la señal");
  console.error("Error en el elemento de audio. Revisa STREAM_URL en app.js");
});

/* PWA INSTALL */
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function showInstallButton(label = "Instalar app") {
  if (!installBtn) return;
  installBtn.hidden = false;
  const span = installBtn.querySelector("span");
  if (span) span.textContent = label;
}
function hideInstallButton() {
  if (installBtn) installBtn.hidden = true;
}
function showIOSInstallHelp() {
  if (!installBtn) return;
  showInstallButton("Cómo instalar en iPhone");
  installBtn.onclick = () => {
    alert(
      "Para instalar la app en iPhone:\n\n1. Abre esta página en Safari\n2. Pulsa el botón Compartir\n3. Elige 'Añadir a pantalla de inicio'"
    );
  };
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      await registration.update();
    } catch (error) {
      console.error("Error registrando Service Worker:", error);
    }
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton("Instalar app");
  if (installBtn) {
    installBtn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallButton();
    };
  }
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  hideInstallButton();
});

window.addEventListener("load", () => {
  if (isInStandaloneMode()) {
    hideInstallButton();
    return;
  }
  if (isIOS()) {
    showIOSInstallHelp();
  }
});

window.addEventListener("beforeunload", () => {
  audio.pause();
});

/* INIT */
setCardState("is-idle");
setStatus("listo para reproducir");
setPlayUI(false);
setupVolumeControl();
