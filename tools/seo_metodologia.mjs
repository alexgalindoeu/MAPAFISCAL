// =============================================================================
// Página «Metodología» (/metodologia/): cómo se calcula el IRPF en Mapafiscal, de dónde
// salen los parámetros y qué no cubre el motor (resumen de docs/02_cobertura.md).
// La cifra de casos sale de tools/casos.json, como en /validacion/.
// =============================================================================
import { layout, jsonLdMigas, jsonLdArticulo, migasHtml, numeroCasos } from "./seo_comun.mjs";

export function paginaMetodologia(generado) {
  const n = numeroCasos();
  const titulo = "Metodología: cómo calcula Mapafiscal el IRPF";
  const descripcion = `Cómo calcula Mapafiscal el IRPF: un motor de referencia en R, su versión web en JavaScript con paridad al céntimo en ${n} casos, parámetros con norma y fuente oficial y lo que todavía no cubre.`;
  const ruta = "/metodologia/";
  const migas = [["Inicio", "/"], ["Metodología", ruta]];
  const main = `
  <h1>Metodología: cómo calculamos el IRPF</h1>
  <p class="entradilla">Cada cifra de Mapafiscal sale de un motor de cálculo que aplica la normativa del IRPF paso a paso, con parámetros tomados de las normas oficiales. Aquí explicamos cómo está hecho, cómo lo comprobamos y qué no cubre.</p>
  <div class="prosa">
  <div class="tarjeta">
    <h2 class="rotulo">Un motor de referencia y su versión web</h2>
    <p>El cálculo de referencia está escrito en R: liquida la declaración completa como lo hace la normativa, desde los rendimientos y las reducciones hasta la base liquidable, el mínimo personal y familiar, las escalas estatal, autonómica o foral, las deducciones y la cuota diferencial, en individual y en conjunta.</p>
    <p>La calculadora de la web usa una traducción de ese motor a JavaScript que corre en tu navegador: tus datos no salen de tu dispositivo. Las dos versiones se escriben por separado y tienen que dar el mismo resultado al céntimo.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Paridad al céntimo</h2>
    <p>Un validador liquida ${n} casos de prueba con los dos motores y exige que coincidan (±0,02 €) en las bases, los mínimos, las cuotas, la modalidad de tributación y la obligación de declarar. Además, varios casos reproducen ejemplos resueltos por la Agencia Tributaria y por las haciendas forales. Un cambio en las reglas no se publica si el validador no da todo en verde.</p>
    <p><a href="/validacion/">Ver los casos y el resultado del validador</a></p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Parámetros con norma, fuente y estado</h2>
    <p>El motor no lleva cifras escritas en el código: escalas, mínimos, límites y deducciones están en ficheros de parámetros por ejercicio. Cada parámetro indica la <b>norma</b> de la que sale (artículo y ley), la <b>fuente</b> donde se ha leído (BOE, boletines autonómicos y forales o el Manual Práctico de Renta de la AEAT) y su <b>estado</b>: si está cotejado con la fuente primaria o si todavía falta comprobarlo. Cada liquidación avisa de los parámetros que use y aún no estén comprobados.</p>
    <p>Las páginas de deducciones solo publican las que están confirmadas con fuente primaria. Si un parámetro no se puede verificar, no se inventa.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Qué cubre</h2>
    <p>Los 19 territorios fiscales: el régimen común (Estado y 15 comunidades autónomas), los tres territorios históricos del País Vasco y Navarra, en el ejercicio 2025 y, donde ya hay normativa publicada, 2026. Rendimientos del trabajo, del capital y de actividades en estimación directa, ganancias patrimoniales, reducciones por planes de pensiones, tributación individual y conjunta, mínimos personales y familiares, deducciones estatales y una selección de las autonómicas y forales de mayor incidencia.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Qué no cubre (todavía)</h2>
    <ul>
      <li>Deducciones autonómicas: cada comunidad tiene cargadas las de mayor incidencia, no el catálogo completo (faltan sobre todo las de inversión y donativos y algunas ligadas al municipio). Si te aplica una que falta, la cuota real puede ser algo menor.</li>
      <li>Actividades en estimación objetiva (módulos): el rendimiento se introduce ya calculado.</li>
      <li>Navarra: faltan los donativos y la tributación conjunta foral completa.</li>
      <li>La obligación de declarar se calcula con las reglas estatales; en los territorios forales es orientativa.</li>
      <li>Fuera de alcance: Ceuta y Melilla, el régimen de impatriados, el IRPF de no residentes, la doble imposición internacional y algunas rentas irregulares.</li>
    </ul>
    <p class="ayuda">Los resultados son estimaciones informativas, no una liquidación oficial ni asesoramiento fiscal.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">El mismo cálculo, en tu web</h2>
    <p>La calculadora de sueldo neto se puede incrustar gratis en otras webs: usa este mismo motor y los mismos parámetros, y se actualiza sola cuando cambia la normativa.</p>
    <p><a href="/widget/">Calculadora de sueldo neto para tu web</a></p>
  </div>
  </div>`;
  return layout({
    title: titulo, description: descripcion, canonical: ruta, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo, descripcion, ruta, generado })]
  });
}
