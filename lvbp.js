// lvbp.js — Tabla de posiciones, próximo juego y quiniela de Tigres de Aragua
// Se carga en index.html como <script type="module">

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
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

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
onSnapshot(
  doc(db, "lvbp", "tabla"),
  (snap) => {
    if (!tablaBody) return;
    if (!snap.exists()) {
      tablaBody.innerHTML = `<tr><td colspan="5" class="lvbp-cargando">La tabla estará disponible cuando inicie la temporada.</td></tr>`;
      return;
    }
    const { equipos = [], actualizado } = snap.data();

    tablaBody.innerHTML = equipos
      .map(
        (e) => `
      <tr class="${e.team.includes("Aragua") ? "is-tigres-row" : ""}">
        <td>${esc(e.team)}</td>
        <td>${esc(e.wins)}</td>
        <td>${esc(e.losses)}</td>
        <td>${esc(e.pct || "-")}</td>
        <td>${esc(e.gb || "-")}</td>
      </tr>`
      )
      .join("");

    if (tablaEstado && actualizado) {
      tablaEstado.textContent = `Actualizado: ${fmtFecha(actualizado)}`;
    }
  },
  (err) => {
    console.error("Error leyendo la tabla:", err);
    if (tablaEstado) tablaEstado.textContent = "No se pudo cargar la tabla.";
  }
);

// ---------- Próximo juego ----------
let gamePkActual = null;
let fechaJuego = null;

onSnapshot(
  doc(db, "lvbp", "proximoJuego"),
  (snap) => {
    if (!proximoJuegoEl) return;
    if (!snap.exists()) {
      proximoJuegoEl.innerHTML = `<p class="lvbp-cargando">El próximo juego se publicará pronto.</p>`;
      return;
    }
    const juego = snap.data();
    gamePkActual = juego.gamePk;
    fechaJuego = juego.date;

    proximoJuegoEl.innerHTML = `
    <p class="lvbp-proximo-rival">${esc(juego.away)} @ ${esc(juego.home)}</p>
    <p class="lvbp-proximo-fecha">${esc(fmtFecha(juego.date))}</p>
    ${juego.venue ? `<p class="lvbp-proximo-venue">${esc(juego.venue)}</p>` : ""}
  `;

    if (juego.gamePk) escucharQuiniela(juego.gamePk);
  },
  (err) => {
    console.error("Error leyendo el próximo juego:", err);
    proximoJuegoEl.innerHTML = `<p class="lvbp-cargando">No se pudo cargar el próximo juego.</p>`;
  }
);

// ---------- Quiniela ----------
let unsubQuiniela = null;

function escucharQuiniela(gamePk) {
  if (unsubQuiniela) unsubQuiniela(); // evita escuchas duplicadas

  unsubQuiniela = onSnapshot(
    doc(db, "quiniela", String(gamePk)),
    (snap) => {
      if (!quinielaCard) return;

      if (!snap.exists()) {
        quinielaPregunta.textContent = "La quiniela de este juego aún no está disponible.";
        quinielaBotones.hidden = true;
        quinielaResultado.hidden = true;
        return;
      }

      const q = snap.data();
      const total = q.votosTigres + q.votosRival;
      const pctTigres = total ? Math.round((q.votosTigres / total) * 100) : 50;
      const pctRival = 100 - pctTigres;

      quinielaPregunta.textContent = `¿Quién gana? Tigres de Aragua vs ${q.rival}`;

      const yaVoto = localStorage.getItem(`quiniela-voto-${gamePk}`);
      const yaEmpezo = fechaJuego && Date.now() >= new Date(fechaJuego).getTime();

      if (yaVoto || q.estado === "cerrada" || yaEmpezo) {
        quinielaBotones.hidden = true;
        quinielaResultado.hidden = false;
        quinielaResultado.innerHTML = `
        <div class="lvbp-barra">
          <div class="lvbp-barra-tigres" style="width:${pctTigres}%">${pctTigres}%</div>
          <div class="lvbp-barra-rival" style="width:${pctRival}%">${pctRival}%</div>
        </div>
        <p class="lvbp-barra-leyenda">
          <span>🐯 Tigres (${q.votosTigres})</span>
          <span>${esc(q.rival)} (${q.votosRival})</span>
        </p>
        ${q.estado === "cerrada" && q.resultado ? `<p class="lvbp-resultado-final">Resultado: ganó ${q.resultado === "tigres" ? "Tigres" : esc(q.rival)}</p>` : ""}
      `;
      } else {
        quinielaBotones.hidden = false;
        quinielaResultado.hidden = true;
      }
    },
    (err) => {
      console.error("Error leyendo la quiniela:", err);
      quinielaPregunta.textContent = "No se pudo cargar la quiniela.";
    }
  );
}

async function votar(campo, gamePk) {
  const key = `quiniela-voto-${gamePk}`;
  if (localStorage.getItem(key)) return;

  localStorage.setItem(key, campo); // primero: así la vista cambia a resultados de inmediato
  try {
    await updateDoc(doc(db, "quiniela", String(gamePk)), { [campo]: increment(1) });
  } catch (err) {
    localStorage.removeItem(key); // si falla, permite reintentar
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
