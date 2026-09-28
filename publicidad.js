// publicidad.js — Cotizador de cuñas publicitarias de Altos FM
// ============================================================
// EDITA AQUÍ LOS PRECIOS Y LA MONEDA
const PRECIOS = { 20: 2.5, 30: 3.5 }; // precio de UNA cuña según su duración en segundos <-- CÁMBIALOS
const MONEDA = "USD";                 // "USD", "VES", etc.
const WHATSAPP = "584141001071";      // número con código de país, sin + ni espacios
const BONIFICA_DOMINGOS = true;       // los domingos se regalan (mismas cuñas por día); no se cobran
// ============================================================

const inCunas = document.getElementById("ads-cunas");
const inDias = document.getElementById("ads-dias");
const outTotal = document.getElementById("ads-total");
const outBonus = document.getElementById("ads-bonus");
const outError = document.getElementById("ads-error");
const btnWA = document.getElementById("ads-whatsapp");
const radios = document.querySelectorAll('input[name="ads-duracion"]');

const fmtMoneda = (n) =>
  new Intl.NumberFormat("es-VE", { style: "currency", currency: MONEDA, currencyDisplay: "narrowSymbol" }).format(n);
const fmtNum = (n) => new Intl.NumberFormat("es-VE").format(n);

const duracionElegida = () =>
  Number(document.querySelector('input[name="ads-duracion"]:checked')?.value) || 30;

function leerEntero(input) {
  const v = Number(input.value);
  return Number.isInteger(v) && v >= 1 ? v : null;
}

function calcular() {
  const cunas = leerEntero(inCunas);
  const dias = leerEntero(inDias);
  const segundos = duracionElegida();
  const precioCuna = PRECIOS[segundos];

  if (!cunas || !dias) {
    outTotal.textContent = "—";
    outBonus.textContent = "—";
    outError.textContent = "Ingresa números enteros mayores a cero.";
    outError.hidden = false;
    btnWA.hidden = true;
    return;
  }

  // Se cobran solo los días de lunes a viernes. Cada 5 días hábiles = 1 semana = 1 domingo de regalo.
  const totalCunas = cunas * dias;
  const total = totalCunas * precioCuna;
  const domingos = BONIFICA_DOMINGOS ? Math.floor(dias / 5) : 0;
  const cunasBonus = domingos * cunas;

  outError.hidden = true;
  outTotal.textContent = fmtMoneda(total);
  outBonus.textContent = domingos
    ? `${domingos} ${domingos === 1 ? "domingo" : "domingos"} · +${fmtNum(cunasBonus)} cuñas gratis`
    : "—";

  const mensaje =
    `Hola Altos FM, quiero contratar publicidad 📻\n` +
    `• Duración de la cuña: ${segundos} segundos\n` +
    `• Cuñas por día: ${cunas}\n` +
    `• Días (lunes a viernes): ${dias}\n` +
    `• Cuñas facturadas: ${fmtNum(totalCunas)}\n` +
    (domingos ? `• Domingos bonificados: ${domingos} (+${fmtNum(cunasBonus)} cuñas de cortesía)\n` : "") +
    `• Total a pagar: ${fmtMoneda(total)}\n` +
    `¿Me pueden confirmar disponibilidad y forma de pago?`;
  btnWA.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  btnWA.hidden = false;
}

if (inCunas && inDias) {
  inCunas.addEventListener("input", calcular);
  inDias.addEventListener("input", calcular);
  radios.forEach((r) => r.addEventListener("change", calcular));
  calcular();
}
