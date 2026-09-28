// lvbp.js — Tabla de posiciones, próximo juego y quiniela de Tigres de Aragua
// Requiere que en index.html se haya cargado este archivo como <script type="module">

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCamxW0SIFdfQjIguszZsv_GOWmf9YRwjw",
  authDomain: "altosfm-lvbp.firebaseapp.com",
  projectId: "altosfm-lvbp",
  storageBucket: "altosfm-lvbp.firebasestorage.app",
  messagingSenderId: "401003883632",
  appId: "1:401003883632:web:81b237cfd031ad5b9d98b5",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tablaBody = document.getElementById("lvbp-tabla-body");
const tablaEstado = document.getElementById("lvbp-tabla-estado");
const proximoJuegoEl = document.getElementById("lvbp-proximo-juego");
const quinielaCard = document.getElementById("lvbp-quiniela");
const quinielaPregunta = document.getElementById("lvbp-quiniela-pregunta");
const quinielaBotones = document.getElementById("lvbp-quiniela-botones");
const quinielaResultado = document.getElementById("lvbp-quiniela-resultado");
const btnTigres = document.getElementById("lvbp-voto-tigres");
const btnRival = document.getElementById("lvbp-voto-rival");

const fmtFecha = (isoString) => {
  try {
    return new Date(isoString).toLocaleString("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

// ---------- Tabla de posiciones ----------
onSnapshot(doc(db, "lvbp", "tabla"), (snap) => {
  if (!snap.exists() || !tablaBody) return;
  const { equipos, actualizado } = snap.data();

  tablaBody.innerHTML = equipos
    .map(
      (e) => `
      <tr class="${e.team.includes("Aragua") ? "is-tigres-row" : ""}">
        <td>${e.team}</td>
        <td>${e.wins}</td>
        <td>${e.losses}</td>
        <td>${e.pct || "-"}</td>
        <td>${e.gb || "-"}</td>
      </tr>`
    )
    .join("");

  if (tablaEstado && actualizado) {
    tablaEstado.textContent = `Actualizado: ${fmtFecha(actualizado)}`;
  }
});

// ---------- Próximo juego ----------
let gamePkActual = null;

onSnapshot(doc(db, "lvbp", "proximoJuego"), (snap) => {
  if (!snap.exists() || !proximoJuegoEl) return;
  const juego = snap.data();
  gamePkActual = juego.gamePk;

  proximoJuegoEl.innerHTML = `
    <p class="lvbp-proximo-rival">${juego.away} @ ${juego.home}</p>
    <p class="lvbp-proximo-fecha">${fmtFecha(juego.date)}</p>
    ${juego.venue ? `<p class="lvbp-proximo-venue">${juego.venue}</p>` : ""}
  `;

  if (juego.gamePk) {
    escucharQuiniela(juego.gamePk);
  }
});

// ---------- Quiniela ----------
function escucharQuiniela(gamePk) {
  onSnapshot(doc(db, "quiniela", String(gamePk)), (snap) => {
    if (!snap.exists() || !quinielaCard) return;
    const q = snap.data();
    const total = q.votosTigres + q.votosRival;
    const pctTigres = total ? Math.round((q.votosTigres / total) * 100) : 50;
    const pctRival = 100 - pctTigres;

    quinielaPregunta.textContent = `¿Quién gana? Tigres de Aragua vs ${q.rival}`;

    const yaVoto = localStorage.getItem(`quiniela-voto-${gamePk}`);

    if (yaVoto || q.estado === "cerrada") {
      quinielaBotones.hidden = true;
      quinielaResultado.hidden = false;
      quinielaResultado.innerHTML = `
        <div class="lvbp-barra">
          <div class="lvbp-barra-tigres" style="width:${pctTigres}%">${pctTigres}%</div>
          <div class="lvbp-barra-rival" style="width:${pctRival}%">${pctRival}%</div>
        </div>
        <p class="lvbp-barra-leyenda">
          <span>🐯 Tigres (${q.votosTigres})</span>
          <span>${q.rival} (${q.votosRival})</span>
        </p>
        ${q.estado === "cerrada" && q.resultado ? `<p class="lvbp-resultado-final">Resultado: ganó ${q.resultado === "tigres" ? "Tigres" : q.rival}</p>` : ""}
      `;
    } else {
      quinielaBotones.hidden = false;
      quinielaResultado.hidden = true;
    }
  });
}

async function votar(campo, gamePk) {
  const yaVoto = localStorage.getItem(`quiniela-voto-${gamePk}`);
  if (yaVoto) return;

  try {
    await updateDoc(doc(db, "quiniela", String(gamePk)), {
      [campo]: increment(1),
    });
    localStorage.setItem(`quiniela-voto-${gamePk}`, campo);
  } catch (err) {
    console.error("No se pudo registrar el voto:", err);
  }
}

if (btnTigres) {
  btnTigres.addEventListener("click", () => {
    if (gamePkActual) votar("votosTigres", gamePkActual);
  });
}
if (btnRival) {
  btnRival.addEventListener("click", () => {
    if (gamePkActual) votar("votosRival", gamePkActual);
  });
}
