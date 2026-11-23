// =============================================================================
// Página «Calculadora de sueldo neto gratis para tu web» (/widget/): configurador con vista
// previa del widget incrustable (web/widget/sueldo-neto.html, escrito a mano y con noindex),
// el código para copiar, las condiciones de uso y preguntas frecuentes.
// El código del iframe sale de web/js/widget.js (codigoWidget), el mismo que usa el
// configurador en el navegador: lo que se ve escrito en el HTML es lo que se copia.
// =============================================================================
import { createRequire } from "node:module";
import { layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml, esc, SLUG, ORDEN_TERRITORIOS } from "./seo_comun.mjs";

export const WIDGET = createRequire(import.meta.url)("../web/js/widget.js");
export const RUTA_WIDGET = "/widget/";

export function paginaWidget(territorios, generado) {
  const ini = WIDGET.normalizar({});
  const titulo = "Calculadora de sueldo neto gratis para tu web";
  const descripcion = "Incrusta gratis en tu web la calculadora de sueldo neto de Mapafiscal: neto al mes y al año, IRPF y tipo medio en los 19 territorios. Sin anuncios ni cookies.";
  const migas = [["Inicio", "/"], ["Widget de sueldo neto", RUTA_WIDGET]];
  const opciones = ORDEN_TERRITORIOS.filter(c => territorios.territorios[c] && SLUG[c])
    .map(c => `<option value="${c}"${c === ini.territorio ? " selected" : ""}>${esc(territorios.territorios[c].nombre)}</option>`).join("");
  const seg = (nombre, valores) => `<div class="segmentado" role="radiogroup" aria-labelledby="${nombre}-etq">${valores.map(([v, t]) =>
    `<label><input type="radio" name="${nombre}" value="${v}"${v === ini[nombre.replace("widget-", "")] ? " checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>`;
  const faq = [
    ["¿Cuánto cuesta el widget?", "Nada. Es gratis para cualquier web, también las comerciales, y no hace falta registrarse: copia el código y pégalo en tu página."],
    ["¿Qué calcula?", "El sueldo neto al mes (en 12 o 14 pagas) y al año, el IRPF del año y el tipo medio a partir del sueldo bruto anual y del territorio, con el mismo motor que la calculadora de Mapafiscal. Supone una persona soltera de 35 años, sin hijos y con contrato indefinido, una vez hecha la declaración de la renta."],
    ["¿Lleva anuncios, cookies o analítica?", "No. El widget no muestra anuncios, no instala cookies, no guarda nada en el navegador y no carga analítica de terceros. Tampoco lee nada de tu web: solo le comunica su altura, para que el marco se ajuste."],
    ["¿Se actualiza solo cuando cambia la normativa?", "Sí. El widget carga los parámetros vigentes de Mapafiscal cada vez que se abre, así que, cuando se actualizan las escalas o las cuotas, tu web muestra los cálculos nuevos sin que tengas que cambiar el código."],
    ["¿Puedo cambiar el aspecto?", "Puedes elegir el territorio por defecto, el tema (claro, oscuro o el del sistema de cada visitante) y el tamaño normal o compacto. El ancho se adapta al de tu página y el alto, al contenido."],
    ["¿Puedo quitar el enlace a Mapafiscal?", "No. El uso es gratuito a cambio de mantener visibles la línea «Calculado con Mapafiscal» del propio widget y el enlace que va debajo del marco, tal y como salen en el código."],
    ["¿Es una liquidación oficial?", "No. Es una estimación informativa con los datos que se introducen; no sustituye a la declaración de la renta ni al asesoramiento fiscal."]
  ];
  const main = `
  <h1>Calculadora de sueldo neto gratis para tu web</h1>
  <p class="entradilla">Pon en tu web la calculadora de sueldo neto de Mapafiscal: tus visitantes escriben su sueldo bruto, eligen dónde viven y ven su neto al mes y al año, el IRPF y el tipo medio en los 19 territorios fiscales. Gratis, sin anuncios y sin cookies.</p>
  <div class="prosa">
  <div class="tarjeta">
    <h2 class="rotulo">Configura el widget</h2>
    <form id="widget-config" class="widget-config">
      <div class="campo"><label for="widget-territorio">Territorio por defecto</label><select id="widget-territorio">${opciones}</select></div>
      <div class="campo"><span class="etiqueta" id="widget-tema-etq">Tema</span>${seg("widget-tema", [["auto", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]])}</div>
      <div class="campo"><span class="etiqueta" id="widget-ancho-etq">Tamaño</span>${seg("widget-ancho", [["normal", "Normal"], ["compacto", "Compacto"]])}</div>
    </form>
    <h3>Vista previa</h3>
    <div class="widget-previa-marco">
      <iframe id="widget-previa" src="${esc(WIDGET.urlWidget(ini, ""))}" title="Vista previa de la calculadora de sueldo neto de Mapafiscal" width="100%" height="${WIDGET.ANCHOS[ini.ancho].alto}" style="border:0;max-width:${WIDGET.ANCHOS[ini.ancho].ancho}px;display:block"></iframe>
      <p class="widget-atribucion">Calculado con <a href="/">Mapafiscal</a></p>
    </div>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Código para copiar</h2>
    <p>Pega este código en tu página donde quieras que aparezca la calculadora. El enlace de debajo del marco forma parte del código y tiene que quedarse.</p>
    <label class="etiqueta" for="widget-codigo">Código HTML del widget</label>
    <textarea id="widget-codigo" class="widget-codigo" rows="5" readonly spellcheck="false">${esc(WIDGET.codigoWidget(ini))}</textarea>
    <p><button type="button" class="btn btn-pri" id="widget-copiar">Copiar el código</button> <span id="widget-copiado" class="ayuda" role="status"></span></p>
    <details>
      <summary>Opcional: que el marco ajuste su alto solo</summary>
      <p>El widget comunica su altura a la página que lo incrusta (solo ese número). Si añades este script una vez en la página, el marco se ajusta al contenido; sin él, se usa el alto del código.</p>
      <pre class="widget-codigo"><code>${esc(WIDGET.SCRIPT_ALTURA)}</code></pre>
    </details>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Condiciones de uso</h2>
    <ul>
      <li><b>Gratis</b> para cualquier web, personal o comercial, sin registro.</li>
      <li><b>Sin quitar la atribución</b>: la línea «Calculado con Mapafiscal» del widget y el enlace de debajo del marco tienen que verse, sin ocultarlos ni cambiarlos.</li>
      <li><b>Sin páginas puerta</b>: incrusta el widget en páginas con contenido propio para tus lectores, no en páginas creadas solo para alojarlo o para posicionar búsquedas.</li>
      <li>No lo presentes como una herramienta oficial ni como asesoramiento fiscal: es una estimación informativa.</li>
    </ul>
    <p class="ayuda">Mapafiscal puede cambiar el aspecto del widget o dejar de ofrecerlo. Más detalles en las <a href="/legal/condiciones.html">condiciones de uso de la web</a>; el cálculo se explica en la <a href="/metodologia/">metodología</a>.</p>
  </div>
  ${bloqueFaq(faq)}
  </div>`;
  return layout({
    title: titulo, description: descripcion, canonical: RUTA_WIDGET, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)], scripts: ["/js/widget.js"]
  });
}
