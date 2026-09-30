// publicidad.js — Cotizador de cuñas publicitarias de Altos FM
// ============================================================
// EDITA AQUÍ LOS PRECIOS Y LAS MODALIDADES
const PRECIOS = { 20: 2.5, 30: 3.5 }; // precio de UNA cuña según su duración en segundos <-- CÁMBIALOS
const MONEDA = "USD";                 // "USD", "VES", etc.
const WHATSAPP = "584141001071";      // número con código de país, sin + ni espacios

// Días de pauta por mes según la modalidad. Los domingos siempre se bonifican.
const PLANES = {
  lv: { nombre: "Lunes a viernes", dias: 22, bonifica: true },
  ls: { nombre: "Lunes a sábado", dias: 26, bonifica: true },
};
const DOMINGOS_BONIFICADOS_POR_MES = 4; // mismas cuñas por día que el resto de la semana
// ============================================================

const inCunas = document.getElementById("ads-cunas");
const inMeses = document.getElementById("ads-meses");
const selPlan = document.getElementById("ads-plan");
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
  const meses = leerEntero(inMeses);
  const segundos = duracionElegida();
  const plan = PLANES[selPlan.value] ?? PLANES.lv;
  const precioCuna = PRECIOS[segundos];

  if (!cunas || !meses) {
    outTotal.textContent = "—";
    outBonus.textContent = "—";
    outError.textContent = "Ingresa números enteros mayores a cero.";
    outError.hidden = false;
    btnWA.hidden = true;
    return;
  }

  // cuñas por día × días del plan × meses × precio de la cuña
  const totalCunas = cunas * plan.dias * meses;
  const total = totalCunas * precioCuna;
  const domingos = plan.bonifica ? DOMINGOS_BONIFICADOS_POR_MES * meses : 0;
  const cunasBonus = domingos * cunas;

  outError.hidden = true;
  outTotal.textContent = fmtMoneda(total);
  outBonus.textContent = domingos
    ? `${domingos} domingos · +${fmtNum(cunasBonus)} cuñas gratis`
    : "—";

  const mensaje =
    `Hola Altos FM, quiero contratar publicidad 📻\n` +
    `• Duración de la cuña: ${segundos} segundos\n` +
    `• Cuñas por día: ${cunas}\n` +
    `• Pauta: ${plan.nombre} (${plan.dias} días por mes)\n` +
    `• Meses de contratación: ${meses}\n` +
    `• Cuñas facturadas: ${fmtNum(totalCunas)}\n` +
    (domingos ? `• Domingos bonificados: ${domingos} (+${fmtNum(cunasBonus)} cuñas de cortesía)\n` : "") +
    `• Total a pagar: ${fmtMoneda(total)}\n` +
    `¿Me pueden confirmar disponibilidad y forma de pago?`;
  btnWA.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  btnWA.hidden = false;
}

if (inCunas && inMeses && selPlan) {
  inCunas.addEventListener("input", calcular);
  inMeses.addEventListener("input", calcular);
  selPlan.addEventListener("change", calcular);
  radios.forEach((r) => r.addEventListener("change", calcular));
  calcular();
}
