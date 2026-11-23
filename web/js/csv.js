/* =============================================================================
 * Mapafiscal — exportar tablas a CSV para Excel en español, sin servidor.
 *
 * - Separador «;» y coma decimal (lo que espera Excel con la configuración regional de
 *   España), sin separador de millares.
 * - UTF-8 con BOM, para que Excel lea bien las tildes y la «ñ».
 * - Fin de línea LF (Excel lo lee igual que CRLF, y así el CSV publicado en web/datos/ no
 *   cambia con la conversión de finales de línea de git) y comillas solo donde hacen falta.
 *
 * La descarga se hace en el navegador con un Blob y un <a download>: nada pasa por el
 * servidor. Lo usan app.js (ranking del comparador), escenarios.js (curvas del deslizador) y
 * tools/seo_ranking.mjs (el CSV de /datos/ranking-irpf-<año>.csv, con el mismo formato).
 * ========================================================================== */
(function () {
  "use strict";
  const BOM = "\uFEFF";
  const SEP = ";";
  // Número con coma decimal y sin millares; `dec` fija los decimales (si no, los que tenga,
  // sin el ruido de coma flotante: 0.1 + 0.2 sale «0,3»).
  function numero(n, dec) {
    if (n == null || !isFinite(n)) return "";
    const s = dec == null ? String(Math.round(n * 1e6) / 1e6) : (Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec)).toFixed(dec);
    return (s === "-0" ? "0" : s.replace(/^-0(\.0*)?$/, "0$1")).replace(".", ",");
  }
  function campo(v) {
    if (v == null) return "";
    const s = typeof v === "number" ? numero(v) : String(v);
    return /[;"\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  // filas: lista de listas (la primera, la cabecera). Los números se escriben con coma decimal;
  // para fijar los decimales, pásalos ya formateados con numero().
  function aCsv(filas) {
    return BOM + filas.map(f => f.map(campo).join(SEP)).join("\n") + "\n";
  }
  // Nombre de fichero seguro: minúsculas, sin tildes ni espacios.
  function nombreFichero(txt) {
    return String(txt).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "datos";
  }
  function descargar(nombre, filas) {
    const texto = aCsv(filas);
    const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreFichero(nombre).replace(/(\.csv)?$/, ".csv");
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    return texto;
  }
  // Botón «Descargar CSV» con el mismo aspecto en toda la app.
  function boton(id, etiqueta) {
    return `<button class="btn btn-sec btn-sm btn-csv" type="button" id="${id}"${etiqueta ? ` aria-label="${etiqueta.replace(/"/g, "&quot;")}"` : ""}>Descargar CSV</button>`;
  }
  const CSV = { BOM, SEP, numero, campo, aCsv, nombreFichero, descargar, boton };
  if (typeof module !== "undefined" && module.exports) module.exports = CSV;
  else window.MapafiscalCSV = CSV;
})();
