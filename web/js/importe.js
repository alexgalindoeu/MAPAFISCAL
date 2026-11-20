/* =============================================================================
 * Mapafiscal — interpretación de importes escritos en formato español.
 *
 * Los campos de dinero son <input type="text" inputmode="decimal" data-importe>: con
 * type="number" el navegador destrozaba los importes españoles sin avisar («30000,50» llegaba
 * como 3000050 y «30.000» como 30). Aquí se interpretan con reglas explícitas y, si un texto no
 * se puede leer con seguridad, se rechaza con un mensaje en vez de adivinar.
 *
 * Reglas de parsearImporte(texto):
 * - Espacios (normales, duros y finos) entre cifras: separadores de miles («30 000»).
 * - Coma y punto a la vez: el último es el decimal y el otro, de miles en grupos de 3
 *   («30.000,50», «30,000.50»). Si los grupos no son de 3, error.
 * - Solo coma: decimal si hay una («30000,5»); varias comas, error.
 * - Solo punto: miles si todos los grupos tras el primero tienen 3 cifras y el primero de 1 a 3
 *   («30.000», «1.234.567»); si hay un único punto con 1, 2 o más de 3 cifras detrás, decimal
 *   («30000.5», el formato con que la propia web escribe los números); si no, error («1.2.3»).
 * - Signo menos al principio; el rango (mínimo/máximo) lo decide cada campo.
 * - Vacío: { vacio: true, valor: null }. Nunca se convierte en 0 sin decirlo.
 *
 * En Node (test/importe.test.mjs) exporta la lógica pura.
 * ========================================================================== */
(function () {
  "use strict";

  const ESPACIOS = /[\s   ]/g;

  function error(mensaje) { return { ok: false, vacio: false, valor: null, error: mensaje }; }

  function parsearImporte(texto, o) {
    o = o || {};
    if (typeof texto === "number") {
      if (!Number.isFinite(texto)) return error("No es un número.");
      return comprobarRango(texto, o);
    }
    let s = String(texto == null ? "" : texto).replace(ESPACIOS, "");
    if (s === "") return { ok: true, vacio: true, valor: null, error: null };
    let signo = 1;
    if (/^[-−]/.test(s)) { signo = -1; s = s.slice(1); }
    s = s.replace(/€$/, "");
    if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return error("Escribe solo cifras, con coma para los decimales (p. ej. 30.000,50).");
    const comas = (s.match(/,/g) || []).length, puntos = (s.match(/\./g) || []).length;
    let entero, decimal = "";
    if (comas && puntos) {
      const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
      const miles = dec === "," ? "." : ",";
      const partes = s.split(dec);
      if (partes.length !== 2) return error("Hay más de un separador decimal.");
      if (!miles3(partes[0], miles)) return error("Los puntos de miles no están bien colocados (p. ej. 30.000,50).");
      entero = partes[0].split(miles).join(""); decimal = partes[1];
    } else if (comas) {
      if (comas > 1) return error("Hay más de una coma. Usa la coma solo para los decimales.");
      [entero, decimal] = s.split(",");
    } else if (puntos) {
      if (miles3(s, ".")) entero = s.split(".").join("");
      else if (puntos === 1) [entero, decimal] = s.split(".");
      else return error("Los puntos de miles no están bien colocados (p. ej. 1.234.567).");
    } else entero = s;
    if (entero === "" && decimal === "") return error("Falta la cifra.");
    if (/[.,]/.test(decimal)) return error("Hay más de un separador decimal.");
    const valor = signo * Number((entero || "0") + (decimal ? "." + decimal : ""));
    if (!Number.isFinite(valor)) return error("No es un número.");
    return comprobarRango(valor, o);
  }

  // «1.234.567» con sep «.»: primer grupo de 1 a 3 cifras y los demás de exactamente 3.
  function miles3(s, sep) {
    const g = s.split(sep);
    return g.length > 1 && /^[0-9]{1,3}$/.test(g[0]) && g.slice(1).every(x => /^[0-9]{3}$/.test(x));
  }

  function comprobarRango(valor, o) {
    if (o.min != null && valor < o.min) return error(o.min === 0 ? "No puede ser negativo." : `Tiene que ser al menos ${o.min}.`);
    if (o.max != null && valor > o.max) return error(`Es demasiado alto (máximo ${o.max.toLocaleString("es-ES")}).`);
    return { ok: true, vacio: false, valor, error: null };
  }

  // Para escribir un importe en un campo data-importe: formato español sin miles y con coma
  // decimal («30000,5»), hasta 2 decimales. Así lo que se repinta se relee con el mismo valor;
  // con punto decimal, «123.456» se releía como 123456 (ver test/importe.test.mjs).
  function formatearImporte(v) {
    if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) return "";
    return Number(v).toLocaleString("es-ES", { useGrouping: false, maximumFractionDigits: 2 });
  }

  const API = { parsearImporte, formatearImporte };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  // ==== navegador ==========================================================================
  // Opciones de cada campo: data-min (por defecto 0) y data-max (por defecto 100 millones).
  const opciones = el => (d => ({
    min: d.min !== undefined ? Number(d.min) : 0,
    max: d.max !== undefined ? Number(d.max) : 1e8
  }))(el.dataset || {});
  function marcar(el, r) {
    if (typeof el.setAttribute !== "function") return;   // elementos simulados de los tests
    let msg = el.parentElement && el.parentElement.querySelector(":scope > .error-importe");
    if (!msg) msg = el.closest(".con-sufijo") && el.closest(".con-sufijo").nextElementSibling;
    if (r.ok) {
      el.removeAttribute("aria-invalid");
      if (msg && msg.classList.contains("error-importe")) msg.remove();
      return;
    }
    el.setAttribute("aria-invalid", "true");
    if (!msg || !msg.classList.contains("error-importe")) {
      msg = document.createElement("p");
      msg.className = "error-importe";
      msg.id = (el.id || "importe") + "-error";
      msg.setAttribute("role", "alert");
      (el.closest(".con-sufijo") || el).insertAdjacentElement("afterend", msg);
      el.setAttribute("aria-errormessage", msg.id);
    }
    msg.textContent = r.error + " No se ha usado para el cálculo.";
  }
  // Valor de un campo para el cálculo: el importe si es válido; si no, el último válido
  // (el campo queda marcado con su error) o 0 si está vacío.
  function valor(el) {
    if (!el) return 0;
    const r = parsearImporte(el.value, opciones(el));
    marcar(el, r);
    if (!el.dataset) el.dataset = {};
    if (r.ok) { el.dataset.ultimoValido = r.vacio ? "" : String(r.valor); return r.vacio ? 0 : r.valor; }
    const u = el.dataset.ultimoValido;
    return u ? Number(u) : 0;
  }
  window.MapafiscalImporte = { parsearImporte, formatearImporte, valor };
})();
