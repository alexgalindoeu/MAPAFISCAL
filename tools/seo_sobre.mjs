// =============================================================================
// Páginas institucionales: «Sobre Mapafiscal» (/sobre-mapafiscal/) y «Contacto» (/contacto/).
// Ninguna cifra se escribe a mano: territorios, ejercicios, herramientas, deducciones, guías,
// páginas y casos del validador salen de los datos (params/ejercicios.yaml, web/index.html,
// web/datos/seo_*.json, tools/casos.json y el propio recuento de tools/generar_paginas_seo.mjs).
// Sin nombres de personas (regla del proyecto): firma «El equipo de Mapafiscal».
// =============================================================================
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { layout, jsonLdMigas, migasHtml, numeroCasos, configWeb, esc, miles } from "./seo_comun.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const RUTA_SOBRE = "/sobre-mapafiscal/";
export const RUTA_CONTACTO = "/contacto/";

// Ejercicios que ofrece la web: `publicados` de params/ejercicios.yaml.
export function ejerciciosPublicados() {
  const yaml = readFileSync(join(RAIZ, "params", "ejercicios.yaml"), "utf8");
  const m = yaml.match(/^publicados:\s*\[([^\]]*)\]/m);
  if (!m) throw new Error("params/ejercicios.yaml: falta la lista `publicados`");
  return m[1].split(",").map(s => s.trim()).filter(Boolean).map(Number).sort((a, b) => a - b);
}

// Herramientas de la aplicación: las vistas de web/index.html, salvo la portada y las de cuenta.
const NO_HERRAMIENTA = new Set(["inicio", "clientes", "planes", "perfil", "metodologia"]);
export function herramientasApp() {
  const html = readFileSync(join(RAIZ, "web", "index.html"), "utf8");
  const lista = [];
  for (const m of html.matchAll(/<section class="vista" id="v-([^"]+)" aria-labelledby="([^"]+)"/g)) {
    if (NO_HERRAMIENTA.has(m[1])) continue;
    const t = html.match(new RegExp(`id="${m[2]}"[^>]*>([\\s\\S]*?)</h[12]>`));
    const titulo = t ? t[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").split(" · ")[0].trim() : m[1];
    lista.push({ vista: m[1], titulo });
  }
  return lista;
}

const enumerar = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs.at(-1);

export function paginaSobre({ generado, paginas, territorios, comun, forales, deducciones, territoriosDeducciones, guias, glosario }) {
  const n = numeroCasos();
  const ejercicios = ejerciciosPublicados();
  const herr = herramientasApp();
  const cfg = configWeb();
  const titulo = "Sobre Mapafiscal: qué es y cómo funciona";
  const descripcion = `Qué es Mapafiscal, qué calcula en los ${territorios} territorios fiscales, cómo comprobamos las cifras con ${n} casos al céntimo, cómo se financia y cómo se actualiza.`;
  const migas = [["Inicio", "/"], ["Sobre Mapafiscal", RUTA_SOBRE]];
  const main = `
  <h1>Sobre Mapafiscal</h1>
  <p class="entradilla">Mapafiscal es una calculadora gratuita del IRPF para los ${territorios} territorios fiscales de España. Te dice cuánto pagarás en la renta, cuánto te queda del sueldo y cómo cambia todo según dónde vivas, con la normativa oficial de cada territorio aplicada paso a paso.</p>
  <div class="prosa">
  <div class="tarjeta">
    <h2 class="rotulo">Qué es y para quién es</h2>
    <p>El IRPF no es igual en toda España: el Estado fija la mitad de la escala y cada comunidad autónoma la otra mitad, con sus propios mínimos y deducciones, y el País Vasco y Navarra tienen un impuesto propio. Con el mismo sueldo, la renta puede cambiar cientos de euros de un territorio a otro. Mapafiscal nació para que cualquiera pueda verlo con su caso, sin hojas de cálculo ni jerga.</p>
    <ul>
      <li><b>Trabajadores y pensionistas</b> que quieren saber su sueldo neto, si la renta les saldrá a pagar o a devolver, o qué les conviene antes de fin de año.</li>
      <li><b>Autónomos</b> que estiman el IRPF de su actividad en estimación directa.</li>
      <li><b>Quien piensa mudarse o cambiar de trabajo</b> y quiere comparar territorios u ofertas.</li>
      <li><b>Asesores y gestorías</b>, que pueden guardar los casos de sus clientes con el plan Gestor.</li>
      <li><b>Periodistas e investigadores</b>, que tienen el ranking anual del IRPF por comunidades con sus datos descargables.</li>
    </ul>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Qué calcula</h2>
    <p>Mapafiscal cubre los ${territorios} territorios fiscales: ${comun} de régimen común (cada comunidad autónoma con su tramo de la escala) y ${forales} forales (Álava, Bizkaia, Gipuzkoa y Navarra), en los ejercicios ${enumerar(ejercicios.map(String))}. Liquida la declaración completa, en tributación individual y conjunta: rendimientos del trabajo, del capital y de actividades, ganancias patrimoniales, reducciones por planes de pensiones, mínimos personales y familiares, escalas y deducciones.</p>
    <p>Hoy la web tiene <b>${herr.length} herramientas</b> interactivas:</p>
    <ul>
${herr.map(h => `      <li><a href="/index.html#${esc(h.vista)}">${esc(h.titulo)}</a></li>`).join("\n")}
    </ul>
    <p>En total, la web tiene <b>${miles(String(paginas))} páginas</b>, entre ellas una por territorio, ${guias} guías, ${glosario} términos del glosario y <b>${deducciones} fichas de deducciones autonómicas y forales</b> en ${territoriosDeducciones} territorios, cada una con su norma y solo si está confirmada con la fuente primaria.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cómo sabemos que las cifras son correctas</h2>
    <ul>
      <li><b>Un motor de referencia en R</b> aplica la normativa paso a paso: desde los rendimientos hasta la cuota diferencial.</li>
      <li><b>La calculadora de la web</b> es una versión de ese motor en JavaScript, escrita por separado, que corre en tu navegador.</li>
      <li><b>${n} casos de prueba</b> se liquidan con los dos motores y tienen que coincidir al céntimo en bases, mínimos, cuotas y resultado. Varios reproducen ejemplos resueltos por la Agencia Tributaria y por las haciendas forales. Si el validador no da todo en verde, el cambio no se publica.</li>
      <li><b>Normas citadas:</b> cada escala, mínimo y deducción indica la norma de la que sale (BOE, boletines autonómicos y forales o el Manual Práctico de Renta de la AEAT) y si ya está cotejada con esa fuente primaria. El motor no lleva cifras escritas a mano y no inventamos valores que no podemos verificar.</li>
    </ul>
    <p><a href="/metodologia/">Metodología: cómo calculamos y qué no cubrimos</a> · <a href="/validacion/">Cómo comprobamos los cálculos</a></p>
    <p class="ayuda">Los resultados son estimaciones informativas, no una liquidación oficial ni asesoramiento fiscal.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Privacidad: tus datos no salen de tu navegador</h2>
    <p>El cálculo se hace entero en tu dispositivo. No hace falta registrarse ni darnos tu nombre, tu DNI o tus datos fiscales, y los importes que escribes no se envían a ningún servidor. Solo se guarda algo si, con una cuenta, decides guardar un cálculo o un cliente. Contamos las visitas con una analítica sin cookies que no recibe tus datos ni tus importes. Lo explicamos en la <a href="/legal/privacidad.html">política de privacidad</a> y la <a href="/legal/cookies.html">política de cookies</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cómo se financia</h2>
    <p>La calculadora, los comparadores y las guías son y seguirán siendo gratis. Mapafiscal se mantiene con dos ingresos:</p>
    <ul>
      <li><b>Anuncios</b> de Google, señalados como tales y nunca dentro del formulario de cálculo. Quien tiene un plan de pago no los ve.</li>
      <li><b>El plan Gestor</b>, una suscripción para asesores y gestorías que guardan los casos de sus clientes, con optimización por cliente e informes. Ver <a href="/index.html#planes">planes</a>.</li>
    </ul>
    <p>Ni los anunciantes ni los suscriptores influyen en los cálculos: las cifras salen siempre de la normativa.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cómo lo actualizamos cada año</h2>
    <p>Cada ejercicio tiene sus propios parámetros. Cuando el Estado, las comunidades autónomas o las haciendas forales publican cambios en el IRPF (leyes de presupuestos, leyes de medidas fiscales, normas forales), los incorporamos citando el boletín oficial. Una cifra que aún no hemos podido cotejar con la fuente primaria queda marcada, y la calculadora avisa cuando la usa.</p>
    <p>Antes de publicar, el validador vuelve a liquidar todos los casos con los dos motores y se regeneran las páginas de consulta con las cifras nuevas. Por eso cada página indica la fecha de revisión de la normativa y la de su última actualización.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Contacto</h2>
    <p>Si ves un error en un cálculo, tienes una sugerencia o necesitas datos para un artículo, escríbenos a <a href="mailto:${esc(cfg.contacto)}">${esc(cfg.contacto)}</a>. Más detalles en la página de <a href="${RUTA_CONTACTO}">contacto</a>.</p>
    <p><i>El equipo de Mapafiscal</i></p>
  </div>
  </div>`;
  return layout({
    title: titulo, description: descripcion, canonical: RUTA_SOBRE, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), { "@context": "https://schema.org", "@type": "AboutPage", name: titulo, description: descripcion,
      inLanguage: "es", url: "https://mapafiscal.es" + RUTA_SOBRE, about: { "@id": "https://mapafiscal.es/#organizacion" } }]
  });
}

export function paginaContacto({ generado }) {
  const cfg = configWeb();
  const correo = esc(cfg.contacto);
  const titulo = "Contacto";
  const descripcion = "Cómo escribir a Mapafiscal: errores en un cálculo, sugerencias, prensa y datos, y asesores. Correo de contacto y tiempo de respuesta orientativo.";
  const migas = [["Inicio", "/"], ["Contacto", RUTA_CONTACTO]];
  const asunto = s => `mailto:${correo}?subject=${encodeURIComponent(s)}`;
  const main = `
  <h1>Contacto</h1>
  <p class="entradilla">Puedes escribirnos a <a href="mailto:${correo}">${correo}</a>. Leemos todos los mensajes.</p>
  <div class="prosa">
  <div class="tarjeta">
    <h2 class="rotulo">Para qué escribirnos</h2>
    <ul>
      <li><b>Un error en un cálculo.</b> Dinos el territorio, el ejercicio y los datos que usaste, qué cifra esperabas y de dónde sale (el borrador de la renta, una norma, un ejemplo de la Agencia Tributaria). Debajo de cada resultado, el enlace «Comunicar un error» prepara el correo con los datos del cálculo. <a href="${asunto("Error en un cálculo")}">Escribir sobre un error</a></li>
      <li><b>Sugerencias.</b> Una herramienta que te falta, una deducción que no está o algo que no se entiende. <a href="${asunto("Sugerencia")}">Enviar una sugerencia</a></li>
      <li><b>Prensa y datos.</b> Para usar las cifras del <a href="/ranking-irpf-comunidades/">ranking anual del IRPF por comunidades</a> o pedir un cálculo concreto para un artículo. <a href="${asunto("Prensa y datos")}">Escribir sobre prensa o datos</a></li>
      <li><b>Asesores y gestorías.</b> Dudas sobre el plan Gestor, la suscripción o la factura. <a href="${asunto("Asesores y plan Gestor")}">Escribir sobre el plan Gestor</a></li>
    </ul>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cuándo te responderemos</h2>
    <p>Solemos contestar en unos pocos días laborables. En plena campaña de la renta (de abril a junio) puede tardar algo más. Los avisos de errores en los cálculos los revisamos primero.</p>
    <p class="ayuda">No podemos asesorarte sobre tu caso particular ni presentar tu declaración: Mapafiscal ofrece estimaciones informativas. Para eso, consulta a la Agencia Tributaria, a tu hacienda foral o a un asesor fiscal.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Más información</h2>
    <p><a href="${RUTA_SOBRE}">Sobre Mapafiscal</a> · <a href="/metodologia/">Metodología</a> · <a href="/validacion/">Cómo comprobamos los cálculos</a> · <a href="/legal/aviso-legal.html">Aviso legal</a> · <a href="/legal/privacidad.html">Privacidad</a></p>
    <p><i>El equipo de Mapafiscal</i></p>
  </div>
  </div>`;
  return layout({
    title: titulo, description: descripcion, canonical: RUTA_CONTACTO, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), { "@context": "https://schema.org", "@type": "ContactPage", name: "Contacto de Mapafiscal", description: descripcion,
      inLanguage: "es", url: "https://mapafiscal.es" + RUTA_CONTACTO,
      about: { "@id": "https://mapafiscal.es/#organizacion" } }]
  });
}
