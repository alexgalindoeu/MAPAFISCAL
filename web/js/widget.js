/* =============================================================================
 * Mapafiscal — configurador del widget de sueldo neto (/widget/).
 *
 * codigoWidget() escribe el código para copiar: un <iframe> a /widget/sueldo-neto.html con
 * loading="lazy" y title, y el enlace de atribución en un párrafo aparte, fuera del iframe.
 * Lo usan la página (vista previa y código en vivo), tools/seo_widget.mjs (el código por
 * defecto, ya escrito en el HTML) y test/widget.test.mjs.
 * El widget solo manda su altura ({ tipo: "mapafiscal:altura", altura }); ajustarAltura()
 * la aplica al iframe si el mensaje viene de Mapafiscal y de ese mismo iframe.
 * ========================================================================== */
(function () {
  "use strict";
  const SITIO = "https://mapafiscal.es";
  const RUTA = "/widget/sueldo-neto.html";
  const TEMAS = ["auto", "claro", "oscuro"];
  const ANCHOS = { normal: { ancho: 480, alto: 420 }, compacto: { ancho: 320, alto: 520 } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function normalizar(o) {
    o = o || {};
    return {
      territorio: /^ES-[A-Z]{2}(-[A-Z]{2})?$/.test(o.territorio || "") ? o.territorio : "ES-MD",
      tema: TEMAS.includes(o.tema) ? o.tema : "auto",
      ancho: ANCHOS[o.ancho] ? o.ancho : "normal"
    };
  }
  // Ruta del widget con sus parámetros (origen: "" para la vista previa en la propia web).
  function urlWidget(o, origen) {
    const c = normalizar(o), q = ["t=" + c.territorio];
    if (c.tema !== "auto") q.push("tema=" + c.tema);
    if (c.ancho !== "normal") q.push("ancho=" + c.ancho);
    return (origen == null ? SITIO : origen) + RUTA + "?" + q.join("&");
  }
  function codigoWidget(o) {
    const c = normalizar(o), d = ANCHOS[c.ancho];
    return `<iframe src="${esc(urlWidget(c))}" title="Calculadora de sueldo neto de Mapafiscal" width="100%" height="${d.alto}" style="border:0;max-width:${d.ancho}px;display:block" loading="lazy"></iframe>\n` +
      `<p style="font-size:13px;margin:4px 0 0">Calculado con <a href="${SITIO}/">Mapafiscal</a></p>`;
  }
  // Script opcional para la web anfitriona: ajusta el alto del iframe al del widget.
  const SCRIPT_ALTURA = `<script>
addEventListener("message", function (e) {
  if (e.origin !== "${SITIO}" || !e.data || e.data.tipo !== "mapafiscal:altura") return;
  document.querySelectorAll('iframe[src^="${SITIO}${RUTA}"]').forEach(function (f) {
    if (f.contentWindow === e.source) f.style.height = Math.min(Math.max(+e.data.altura || 0, 200), 1200) + "px";
  });
});
</script>`;

  const API = { SITIO, RUTA, ANCHOS, normalizar, urlWidget, codigoWidget, SCRIPT_ALTURA };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  // ==== navegador: configurador de /widget/ =================================================
  const $ = id => document.getElementById(id);
  const previa = $("widget-previa");
  if (!previa) return;
  const leer = () => ({
    territorio: $("widget-territorio").value,
    tema: (document.querySelector('input[name="widget-tema"]:checked') || {}).value,
    ancho: (document.querySelector('input[name="widget-ancho"]:checked') || {}).value
  });
  function actualizar() {
    const o = normalizar(leer()), d = ANCHOS[o.ancho];
    const src = urlWidget(o, "");
    if (previa.getAttribute("src") !== src) previa.setAttribute("src", src);
    previa.style.maxWidth = d.ancho + "px";
    $("widget-codigo").value = codigoWidget(o);
  }
  window.addEventListener("message", e => {
    if (e.origin !== location.origin || e.source !== previa.contentWindow || !e.data || e.data.tipo !== "mapafiscal:altura") return;
    previa.style.height = Math.min(Math.max(+e.data.altura || 0, 200), 1200) + "px";
  });
  $("widget-config").addEventListener("change", actualizar);
  $("widget-copiar").addEventListener("click", async () => {
    const t = $("widget-codigo"), aviso = $("widget-copiado");
    try { await navigator.clipboard.writeText(t.value); }
    catch (e) { t.focus(); t.select(); try { document.execCommand("copy"); } catch (e2) { /* queda seleccionado */ } }
    aviso.textContent = "Código copiado.";
  });
  actualizar();
})();
