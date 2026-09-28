/* ============================================================
   1) PON AQUÍ LA URL DE TU STREAM DE AUDIO
   Ejemplos según tu proveedor:
   - Zeno.fm:      "https://stream.zeno.fm/TU_CLAVE"
   - Icecast:      "https://tu-servidor:puerto/stream"
   - Shoutcast:    "https://tu-servidor:puerto/;"
   ============================================================ */
const STREAM_URL = "https://stream.zeno.fm/lynokabrjqevv";

/* Clave de Zeno.fm extraída automáticamente de STREAM_URL, usada
   para conectarnos a la API de metadata en tiempo real de Zeno.
   Si cambias de proveedor de streaming, reemplaza ZENO_METADATA_URL
   por el endpoint de metadata que te dé tu proveedor, o déjalo en
   null para desactivar la portada de álbum y el nombre de la canción. */
const ZENO_MOUNT_KEY = STREAM_URL.split("/").pop();
const ZENO_METADATA_URL = `https://api.zeno.fm/mounts/metadata/subscribe/${ZENO_MOUNT_KEY}`;

const DEFAULT_COVER = "./icon-512.png";
const DEFAULT_TEXT = "Altos FM";

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
const trackDisplay = document.getElementById("track-name");
const trackHost = document.getElementById("track-host");
const albumCover = document.getElementById("album-cover");

let hasAudioStarted = false;
let isConnecting = false;
let isUserPaused = true;
let deferredPrompt = null;
let currentSong = "";
let activeProgram = null;
let activeProgramKey = "";
let metadataSource = null;

/* ============================================================
   SIRIWAVE (onda de audio animada)
   ============================================================ */
const siriWave = new SiriWave({
  container: document.getElementById("wave-container"),
  width: 260,
  height: 46,
  style: "ios9",
  amplitude: 0.2,
  speed: 0.07,
  color: "#ffffff",
  autostart: true
});

function setWaveForState(state) {
  switch (state) {
    case "playing":
      siriWave.setAmplitude(1);
      siriWave.setSpeed(0.14);
      break;
    case "connecting":
      siriWave.setAmplitude(0.9);
      siriWave.setSpeed(0.12);
      break;
    case "error":
      siriWave.setAmplitude(0.15);
      siriWave.setSpeed(0.05);
      break;
    default:
      siriWave.setAmplitude(0.2);
      siriWave.setSpeed(0.07);
  }
}

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
    setWaveForState("connecting");
    return;
  }
  if (!audio.paused && hasAudioStarted) {
    setPlayUI(true);
    setCardState("is-playing");
    setStatus("reproduciendo en vivo");
    setWaveForState("playing");
    return;
  }
  setPlayUI(false);
  setCardState("is-idle");
  setStatus(isUserPaused ? "pausado" : "listo para reproducir");
  setWaveForState("idle");
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

/* ============================================================
   METADATA EN VIVO (Zeno.fm) + PORTADA DE ÁLBUM (iTunes)
   ============================================================ */
function normalizeTrack(track) {
  return String(track || "").replace(/\s+/g, " ").trim();
}

function splitTrack(track) {
  const normalized = normalizeTrack(track).replace(/[–—]/g, "-");
  const parts = normalized.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", title: normalized };
}

function setCover(src, alt) {
  albumCover.src = src;
  albumCover.alt = alt;
}

/* Si una imagen (de programa o de iTunes) no carga, vuelve a la imagen por defecto */
albumCover.addEventListener("error", () => {
  if (!albumCover.src.endsWith(DEFAULT_COVER.replace("./", ""))) {
    setCover(DEFAULT_COVER, "Imagen referencial de la emisora");
  }
});

async function fetchAlbumCover(track) {
  const { artist, title } = splitTrack(track);
  const query = [artist, title].filter(Boolean).join(" ").trim();

  if (!query || !albumCover) {
    setCover(DEFAULT_COVER, "Imagen referencial de la emisora");
    return;
  }

  let coverUrl = DEFAULT_COVER;
  let coverAlt = "Imagen referencial de la emisora";

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.results?.length && data.results[0].artworkUrl100) {
      coverUrl = data.results[0].artworkUrl100.replace("100x100", "600x600");
      coverAlt = `Portada del álbum de ${track}`;
    }
  } catch (error) {
    console.error("No se pudo obtener la portada:", error);
  }

  // Si mientras tanto empezó un programa o cambió la canción, no pisar la pantalla
  if (activeProgram || track !== currentSong) return;
  setCover(coverUrl, coverAlt);
}

/* ============================================================
   PROGRAMACIÓN DE LA EMISORA
   Edita esta lista para cambiar horarios, nombres o imágenes.
   - days: 0 = domingo, 1 = lunes ... 6 = sábado
   - start / end: hora de Venezuela en formato 24h ("06:30", "14:00")
   - image: nombre del archivo dentro de la carpeta /programas
   ============================================================ */
const SCHEDULE_TZ = "America/Caracas";
const PROGRAM_IMAGE_DIR = "./programas/";
const WEEKDAYS = [1, 2, 3, 4, 5];

const CIRCUITO_X = { name: "Circuito X", host: "", tagline: "Conectados con Circuito X", image: "circuito-x.png" };

const SCHEDULE = [
  { name: "Punto Informativo", host: "José Savogal", days: WEEKDAYS, start: "06:30", end: "08:00", image: "punto-informativo.png" },
  { ...CIRCUITO_X, days: WEEKDAYS, start: "08:00", end: "10:00" },
  { name: "A prueba de error", host: "Nicole Bruzzo", days: WEEKDAYS, start: "10:00", end: "12:00", image: "a-prueba-de-error.png" },
  { ...CIRCUITO_X, days: WEEKDAYS, start: "12:00", end: "14:00" },
  { name: "Cultivando la gaita", host: "Erick Paez", days: WEEKDAYS, start: "14:00", end: "16:00", image: "cultivando-la-gaita.png" },
  { ...CIRCUITO_X, days: WEEKDAYS, start: "16:00", end: "18:00" },
  { name: "Sonidos de Mi Tierra", host: "Irma Gomez Parraga", days: [0], start: "08:00", end: "10:00", image: "sonidos-de-mi-tierra.png" }
];

const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function getVenezuelaNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    day: DAY_INDEX[get("weekday")],
    minutes: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10)
  };
}

function findCurrentProgram(date = new Date()) {
  const { day, minutes } = getVenezuelaNow(date);
  return (
    SCHEDULE.find(
      (p) => p.days.includes(day) && minutes >= toMinutes(p.start) && minutes < toMinutes(p.end)
    ) || null
  );
}

function renderNowPlaying() {
  if (activeProgram) {
    const subtitle = activeProgram.host ? `con ${activeProgram.host}` : activeProgram.tagline || "";
    trackDisplay.textContent = activeProgram.name;
    trackHost.textContent = subtitle;
    trackHost.hidden = !subtitle;
    setCover(
      PROGRAM_IMAGE_DIR + activeProgram.image,
      `${activeProgram.name}${activeProgram.host ? " con " + activeProgram.host : ""}`
    );
    return;
  }

  trackHost.hidden = true;
  trackHost.textContent = "";

  if (currentSong) {
    trackDisplay.textContent = currentSong;
    fetchAlbumCover(currentSong);
  } else {
    trackDisplay.textContent = DEFAULT_TEXT;
    setCover(DEFAULT_COVER, "Imagen referencial de la emisora");
  }
}

function updateSchedule() {
  const program = findCurrentProgram();
  const key = program ? `${program.name}|${program.start}|${program.days.join(",")}` : "";
  if (key === activeProgramKey) return;

  activeProgramKey = key;
  activeProgram = program;
  renderNowPlaying();
}

async function applyNowPlaying(rawTitle) {
  const clean = normalizeTrack(rawTitle);
  if (!clean || clean === currentSong) return;

  currentSong = clean;
  if (activeProgram) return; // mientras hay un programa al aire, manda el programa
  renderNowPlaying();
}

function startMetadataStream() {
  if (!ZENO_METADATA_URL || !("EventSource" in window)) return;
  if (metadataSource) return;

  try {
    metadataSource = new EventSource(ZENO_METADATA_URL);

    metadataSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.streamTitle) applyNowPlaying(data.streamTitle);
      } catch (error) {
        console.error("Error leyendo metadata de Zeno:", error);
      }
    };

    metadataSource.onerror = (error) => {
      console.error("Conexión de metadata interrumpida:", error);
      metadataSource.close();
      metadataSource = null;
      // Reintenta más tarde mientras siga sonando la radio
      setTimeout(() => {
        if (!audio.paused) startMetadataStream();
      }, 8000);
    };
  } catch (error) {
    console.error("No se pudo iniciar la metadata en vivo:", error);
  }
}

function stopMetadataStream() {
  if (metadataSource) {
    metadataSource.close();
    metadataSource = null;
  }
}

/* ============================================================
   REPRODUCCIÓN
   ============================================================ */
async function startPlayback() {
  try {
    isUserPaused = false;
    isConnecting = true;
    syncVisualState();

    await audio.play();

    hasAudioStarted = true;
    isConnecting = false;
    syncVisualState();
    startMetadataStream();
  } catch (error) {
    isConnecting = false;
    hasAudioStarted = false;
    setPlayUI(false);
    setCardState("is-error");
    setStatus("no fue posible reproducir la señal");
    setWaveForState("error");
    console.error("Error reproduciendo stream:", error);
  }
}

function stopPlayback() {
  isUserPaused = true;
  isConnecting = false;
  audio.pause();
  stopMetadataStream();
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
  setWaveForState("error");
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
  stopMetadataStream();
  audio.pause();
});

/* Panel de chat colapsable (esquina inferior izquierda) */
const chatToggleBtn = document.getElementById("chatToggleBtn");
const chatPanel = document.getElementById("chatPanel");
const chatCloseBtn = document.getElementById("chatCloseBtn");

function openChatPanel() {
  chatPanel.hidden = false;
  requestAnimationFrame(() => chatPanel.classList.add("is-open"));
  chatToggleBtn.classList.add("is-active");
  chatToggleBtn.setAttribute("aria-expanded", "true");
}

function closeChatPanel() {
  chatPanel.classList.remove("is-open");
  chatToggleBtn.classList.remove("is-active");
  chatToggleBtn.setAttribute("aria-expanded", "false");
  setTimeout(() => {
    if (!chatPanel.classList.contains("is-open")) chatPanel.hidden = true;
  }, 220);
}

if (chatToggleBtn && chatPanel) {
  chatToggleBtn.addEventListener("click", () => {
    if (chatPanel.classList.contains("is-open")) {
      closeChatPanel();
    } else {
      openChatPanel();
    }
  });
}
if (chatCloseBtn) {
  chatCloseBtn.addEventListener("click", closeChatPanel);
}

/* Despliega el botón de WhatsApp con el mensaje al cargar la página */
window.addEventListener("load", () => {
  const waButton = document.querySelector(".whatsapp-float");
  if (waButton) {
    setTimeout(() => waButton.classList.add("is-expanded"), 1000);
  }
});

/* INIT */
setCardState("is-idle");
setStatus("listo para reproducir");
setPlayUI(false);
setWaveForState("idle");
setupVolumeControl();
updateSchedule();
setInterval(updateSchedule, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateSchedule();
});
