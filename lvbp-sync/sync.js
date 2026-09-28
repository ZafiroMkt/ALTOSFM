// sync.js — Llena Firestore con tabla, próximo juego y quiniela de Tigres de Aragua.
// Fuente: MLB Stats API (statsapi.mlb.com), que publica las Ligas Invernales.
// Ejecuta:  FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node sync.js
import admin from "firebase-admin";

const BASE = "https://statsapi.mlb.com/api/v1";
const SPORT_ID = process.env.LVBP_SPORT_ID ?? "17";     // 17 = Winter Leagues (VERIFICAR)
const LEAGUE_ID = process.env.LVBP_LEAGUE_ID ?? "135";  // LVBP (VERIFICAR)
const TEAM = (process.env.LVBP_TEAM ?? "Aragua").toLowerCase();

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

const getJson = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
  return res.json();
};
const ymd = (offsetDays) =>
  new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10);
const esTigres = (name = "") => name.toLowerCase().includes(TEAM);

// ---------- Tabla ----------
async function syncTabla() {
  // La API identifica la LVBP 2026-27 como season "2026" (arranca en octubre,
  // termina en enero/febrero). De agosto a diciembre es el año actual; de enero a julio, el anterior.
  const now = new Date();
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const seasons = process.env.LVBP_SEASON ? [process.env.LVBP_SEASON] : [year, year + 1];

  for (const season of seasons) {
    const data = await getJson(
      `/standings?leagueId=${LEAGUE_ID}&season=${season}&standingsTypes=regularSeason`
    );
    const equipos = (data.records ?? [])
      .flatMap((r) => r.teamRecords ?? [])
      .map((t) => ({
        team: t.team.name,
        wins: t.wins,
        losses: t.losses,
        pct: t.winningPercentage,
        gb: t.gamesBack,
      }));
    if (!equipos.length) continue;

    equipos.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
    await db.doc("lvbp/tabla").set({ equipos, actualizado: new Date().toISOString() });
    console.log(`Tabla actualizada (temporada ${season}, ${equipos.length} equipos)`);
    return;
  }
  console.warn("La API no devolvió tabla; se conserva la anterior.");
}

// ---------- Juegos + quiniela ----------
async function syncJuegos() {
  const data = await getJson(
    `/schedule?sportId=${SPORT_ID}&leagueId=${LEAGUE_ID}` +
      `&startDate=${ymd(-7)}&endDate=${ymd(60)}&hydrate=team,venue`
  );
  const games = (data.dates ?? [])
    .flatMap((d) => d.games ?? [])
    .filter((g) => esTigres(g.teams.away.team.name) || esTigres(g.teams.home.team.name))
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));

  if (!games.length) {
    console.warn("Sin juegos de Tigres en el rango; no se modifica nada.");
    return;
  }

  // 1) Cerrar quinielas de juegos que ya empezaron o terminaron
  for (const g of games) {
    if (g.status.abstractGameState === "Preview") continue;
    const ref = db.doc(`quiniela/${g.gamePk}`);
    const snap = await ref.get();
    if (!snap.exists) continue;

    const q = snap.data();
    const patch = {};
    if (q.estado === "abierta") patch.estado = "cerrada";

    if (g.status.abstractGameState === "Final" && !q.resultado) {
      const tigresEsLocal = esTigres(g.teams.home.team.name);
      const yo = tigresEsLocal ? g.teams.home : g.teams.away;
      const el = tigresEsLocal ? g.teams.away : g.teams.home;
      if (yo.isWinner) patch.resultado = "tigres";
      else if (el.isWinner) patch.resultado = "rival";
    }
    if (Object.keys(patch).length) {
      await ref.update(patch);
      console.log(`Quiniela ${g.gamePk} ->`, patch);
    }
  }

  // 2) Próximo juego = primer juego no terminado ni suspendido
  const proximo = games.find(
    (g) =>
      g.status.abstractGameState !== "Final" &&
      !/postponed|cancel|suspend/i.test(g.status.detailedState ?? "")
  );
  if (!proximo) {
    console.warn("No hay próximo juego programado.");
    return;
  }

  const away = proximo.teams.away.team.name;
  const home = proximo.teams.home.team.name;
  const rival = esTigres(home) ? away : home;

  // La quiniela se crea ANTES que proximoJuego para que la página no la busque en vano
  const qRef = db.doc(`quiniela/${proximo.gamePk}`);
  if (!(await qRef.get()).exists) {
    await qRef.set({
      rival,
      votosTigres: 0,
      votosRival: 0,
      estado: proximo.status.abstractGameState === "Preview" ? "abierta" : "cerrada",
      resultado: null,
    });
    console.log(`Quiniela creada para el juego ${proximo.gamePk}`);
  }

  await db.doc("lvbp/proximoJuego").set({
    gamePk: proximo.gamePk,
    away,
    home,
    date: proximo.gameDate,
    venue: proximo.venue?.name ?? "",
  });
  console.log(`Próximo juego: ${away} @ ${home} (${proximo.gameDate})`);
}

// ---------- Main ----------
let fallo = false;
for (const paso of [syncTabla, syncJuegos]) {
  try {
    await paso();
  } catch (err) {
    fallo = true;
    console.error(`Falló ${paso.name}:`, err.message);
  }
}
process.exit(fallo ? 1 : 0);
