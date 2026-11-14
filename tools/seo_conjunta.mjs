// =============================================================================
// Páginas SEO de «¿declaración conjunta o individual?» (/declaracion-conjunta/ y sus
// variantes) y de «dos pagadores» (/dos-pagadores/ y una por importe total, con un reparto
// 70/30). Las cifras salen del motor JS (web/js/conjunta.js sobre irpfsim.liquidar) y de
// los parámetros exportados del ejercicio más reciente: aquí no se escribe ninguna cifra
// a mano. Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LIRPF_BOE, esc, euros, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml } from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const C = require(join(WEB, "js", "conjunta.js"));
const HUB_CJ = "/declaracion-conjunta/", HUB_DP = "/dos-pagadores/";
const APP_CJ = "/index.html#conjunta", APP_DP = "/index.html#dos-pagadores";
export const IMPORTES_DP = [16000, 18000, 20000, 22000, 24000, 26000, 28000, 30000, 35000, 40000];
const TERR = "ES-MD";   // territorio de los ejemplos (las tablas por territorio, los 19)

function paramsRecientes() {
  return readdirSync(join(WEB, "datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))
    .map(n => JSON.parse(readFileSync(join(WEB, "datos", n), "utf8"))).sort((a, b) => b.ejercicio - a.ejercicio)[0];
}
const nombre = (P, t) => P.territorios[t].nombre;
const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;
const tabla = (cab, filas) => `<div class="envoltorio"><table class="cobertura"><thead><tr>${cab.map((c, i) => `<th${i ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const signo = v => v > 0.5 ? "A pagar " + euros(v) : v < -0.5 ? "A devolver " + euros(-v) : "0 €";

function pagina({ ruta, migas, h1, entradilla, cuerpo, faq, title, description, generado }) {
  const main = `
  <h1>${esc(h1)}</h1>
  <p class="entradilla">${entradilla}</p>
  <div class="prosa">
  ${cuerpo}
  ${bloqueFaq(faq)}
  </div>`;
  return { ruta, html: layout({ title, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)] }) };
}

// ---- conjunta o individual -------------------------------------------------------------
const pareja = (a, b, o = {}) => Object.assign({ territorio: TERR, tipo: "matrimonio", a: { bruto: a, edad: 40 }, b: { bruto: b, edad: 40 }, hijos: [] }, o);
const fmtMejor = r => !r.conj ? "Individual" : r.ahorro < 1 ? "Igual" : (r.mejor === "conjunta" ? "Conjunta" : "Individual") + ` (${euros(r.ahorro)} menos)`;

function reglasCj(P) {
  const rc = P.estatal.reduccion_tributacion_conjunta, m = P.estatal.minimo_contribuyente;
  return `<div class="tarjeta"><h2 class="rotulo">Cómo funciona</h2>
    <p>En la declaración conjunta la unidad familiar (el matrimonio con los hijos menores, o el padre o la madre con ellos) suma todas sus rentas en una sola declaración. A cambio resta una reducción de la base imponible de <b>${esc(euros(rc.biparental))}</b> si es un matrimonio y de <b>${esc(euros(rc.monoparental))}</b> si es una familia monoparental (art. 84 de la Ley del IRPF).</p>
    <p>Pero el mínimo del contribuyente (${esc(euros(m.general))}) se aplica una sola vez por declaración, y los ingresos de los dos tributan juntos con la escala progresiva. Por eso la conjunta solo compensa cuando uno de los dos gana poco o nada; con dos sueldos parecidos sale mejor que cada uno haga la suya.</p>
    <p class="cita">Norma: <a href="${LIRPF_BOE}">Ley 35/2006 del IRPF</a>, arts. 82 a 84.</p></div>`;
}
function faqCj(P) {
  const rc = P.estatal.reduccion_tributacion_conjunta;
  return [
    ["¿Cuándo conviene la declaración conjunta?", `Cuando uno de los dos no tiene ingresos o gana poco. La conjunta resta ${euros(rc.biparental)} de la base, pero solo hay un mínimo personal y los sueldos se suman en la escala, así que con dos sueldos parecidos sale mejor la individual.`],
    ["¿Se puede cambiar de modalidad cada año?", "Sí. La opción vale solo para ese ejercicio y se puede cambiar dentro del plazo de la campaña. Pasado el plazo ya no se puede cambiar."],
    ["Si uno hace la conjunta, ¿el otro también?", "Sí: la conjunta es una única declaración para toda la unidad familiar y la firman los dos. Si uno de los dos presenta la individual, el otro también tiene que hacerla individual."],
    ["¿Pueden hacer la conjunta las parejas de hecho?", "No juntos: la ley solo reconoce como unidad familiar al matrimonio. Uno de los dos puede hacer la conjunta con los hijos, pero al convivir no tiene la reducción de familia monoparental."]
  ];
}
function tablaTramos(P, segundo, hijos) {
  return tabla(["Sueldo bruto del primero", "Individual (los dos)", "Conjunta", "Conviene"],
    [15000, 20000, 25000, 30000, 40000, 50000, 60000].map(a => {
      const r = C.conjunta(P, pareja(a, segundo, { hijos }));
      return [esc(euros(a)), esc(euros(r.cuotaIndividual)), esc(euros(r.cuotaConjunta)), esc(fmtMejor(r))];
    }));
}
function tablaTerritoriosCj(P, o) {
  return tabla(["Territorio", "Individual", "Conjunta", "Conviene"], C.conjuntaPorTerritorio(P, o).map(x =>
    [esc(nombre(P, x.territorio)), esc(euros(x.individual)), x.conjunta == null ? "—" : esc(euros(x.conjunta)),
      esc(x.conjunta == null ? "Individual" : x.ahorro < 1 ? "Igual" : `${x.mejor === "conjunta" ? "Conjunta" : "Individual"} (${euros(x.ahorro)} menos)`)]));
}
const supCj = (P, txt) => `<p class="ayuda">IRPF del año ${P.ejercicio} (cuota resultante) en ${esc(nombre(P, TERR))}, ${txt}. Cotizaciones del trabajador calculadas; sin otras rentas ni deducciones por gastos.</p>`;

function paginasConjunta(P, generado) {
  const migasHub = [["Inicio", "/"], ["Declaración conjunta o individual", null]];
  const um = C.umbralSegundoSueldo(P, pareja(30000, 0));
  const out = [];
  out.push(pagina({ ruta: HUB_CJ, migas: migasHub, generado,
    h1: `Declaración conjunta o individual ${P.ejercicio}: cuál os conviene`,
    entradilla: `Con un sueldo de 30.000 € y la pareja sin ingresos, la conjunta ahorra ${esc(euros(C.conjunta(P, pareja(30000, 0)).ahorro))} en ${esc(nombre(P, TERR))}. Deja de compensar cuando el segundo sueldo pasa de unos ${esc(euros(um))}.`,
    title: `Declaración conjunta o individual ${P.ejercicio}: cuál conviene y cuánto se ahorra | Mapafiscal`,
    description: `Calcula si os conviene la declaración conjunta o la individual en ${P.ejercicio}: reducción de 3.400 €, mínimos y ejemplos por sueldo en los 19 territorios fiscales.`,
    faq: faqCj(P),
    cuerpo: `${reglasCj(P)}
    <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Un solo sueldo en casa</h2>${supCj(P, "matrimonio sin hijos y la pareja sin ingresos")}${tablaTramos(P, 0, [])}</div>
    <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Con un segundo sueldo de 12.000 €</h2>${supCj(P, "matrimonio sin hijos")}${tablaTramos(P, 12000, [])}</div>
    <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En los 19 territorios: 30.000 € y la pareja sin ingresos</h2>${tablaTerritoriosCj(P, pareja(30000, 0))}</div>
    ${cta("Calcula vuestro caso", APP_CJ, ["Dos pagadores", HUB_DP])}
    <div class="tarjeta"><h2 class="rotulo">Casos</h2><ul class="lista-enlaces">${VARIANTES.map(v => `<li><a href="${HUB_CJ}${v.slug}/">${esc(v.enlace)}</a></li>`).join("")}</ul></div>` }));
  for (const v of VARIANTES) out.push(v.pagina(P, generado));
  return out;
}

const variante = (slug, enlace, h1, fn) => ({ slug, enlace, pagina: (P, generado) => {
  const ruta = `${HUB_CJ}${slug}/`, x = fn(P);
  return pagina(Object.assign({ ruta, generado, h1: h1(P), migas: [["Inicio", "/"], ["Declaración conjunta o individual", HUB_CJ], [enlace, null]], faq: x.faq.concat(faqCj(P).slice(1, 3)) }, x, {
    cuerpo: x.cuerpo + cta("Calcula vuestro caso", APP_CJ, ["Volver a la guía", HUB_CJ]) }));
} });
const VARIANTES = [
  variante("con-hijos", "Con hijos", P => `Declaración conjunta con hijos ${P.ejercicio}: ¿compensa?`, P => {
    const r = C.conjunta(P, pareja(30000, 0, { hijos: [4, 8] }));
    return { title: `Declaración conjunta con hijos ${P.ejercicio}: cuándo compensa | Mapafiscal`,
      description: `¿Conjunta o individual con hijos en ${P.ejercicio}? Cómo se reparten los mínimos por descendientes y ejemplos con uno y dos hijos por sueldo.`,
      entradilla: `Los hijos no inclinan la balanza: su mínimo es el mismo en las dos modalidades (en individual se reparte a medias). Con 30.000 €, la pareja sin ingresos y dos hijos, la conjunta ahorra ${esc(euros(r.ahorro))}.`,
      cuerpo: `<div class="tarjeta"><h2 class="rotulo">Los hijos en cada modalidad</h2><p>El mínimo por descendientes se aplica entero en la conjunta y por mitades en la declaración individual de cada progenitor: en total es el mismo. Lo que decide es, como siempre, cuánto gana cada uno.</p></div>
      <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Dos hijos (4 y 8 años) y un solo sueldo</h2>${supCj(P, "matrimonio con dos hijos")}${tablaTramos(P, 0, [4, 8])}</div>
      <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Dos hijos y un segundo sueldo de 12.000 €</h2>${supCj(P, "matrimonio con dos hijos")}${tablaTramos(P, 12000, [4, 8])}</div>`,
      faq: [["¿Los hijos hacen que convenga la conjunta?", "No por sí solos: su mínimo es el mismo en las dos modalidades. Decide la diferencia entre los sueldos de los dos."]] };
  }),
  variante("un-solo-sueldo", "Un solo sueldo en casa", P => `Declaración conjunta con un solo sueldo ${P.ejercicio}`, P => {
    const r = C.conjunta(P, pareja(25000, 0));
    return { title: `Declaración conjunta con un solo sueldo ${P.ejercicio}: cuánto ahorra | Mapafiscal`,
      description: `Si solo uno de los dos trabaja, la declaración conjunta casi siempre sale mejor. Cuánto se ahorra en ${P.ejercicio} según el sueldo y el territorio.`,
      entradilla: `Si tu pareja no tiene ingresos, su mínimo personal se pierde en la individual. Con 25.000 € la conjunta ahorra ${esc(euros(r.ahorro))} en ${esc(nombre(P, TERR))}.`,
      cuerpo: `<div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Ahorro por sueldo</h2>${supCj(P, "matrimonio sin hijos y la pareja sin ingresos")}${tablaTramos(P, 0, [])}</div>
      <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En los 19 territorios: 25.000 €</h2>${tablaTerritoriosCj(P, pareja(25000, 0))}</div>`,
      faq: [["Si mi pareja no trabaja, ¿tiene que hacer la declaración?", "No si no tiene rentas obligadas a declarar. Pero con la conjunta la incluís en tu declaración y aprovecháis la reducción de 3.400 €."]] };
  }),
  variante("pareja-de-hecho", "Parejas de hecho", P => `Pareja de hecho: ¿declaración conjunta? (${P.ejercicio})`, P => {
    const r = C.conjunta(P, pareja(30000, 10000, { tipo: "pareja-hecho", hijos: [5] }));
    return { title: `Pareja de hecho y declaración conjunta ${P.ejercicio}: qué se puede hacer | Mapafiscal`,
      description: `Las parejas de hecho no pueden hacer juntas la declaración conjunta. Qué opciones hay con hijos en ${P.ejercicio} y cuánto paga cada uno.`,
      entradilla: `La ley del IRPF solo considera unidad familiar al matrimonio: cada miembro de la pareja de hecho hace su declaración. Con 30.000 € y 10.000 € y un hijo pagáis ${esc(euros(r.porPersona[0]))} y ${esc(euros(r.porPersona[1]))}.`,
      cuerpo: `<div class="tarjeta"><h2 class="rotulo">Qué dice la ley</h2><p>El art. 82 de la Ley del IRPF define dos unidades familiares: el matrimonio con los hijos, y el padre o la madre con los hijos cuando no hay matrimonio. Una pareja de hecho no forma unidad familiar entre ellos.</p>
      <p>Uno de los dos puede hacer la conjunta con los hijos, pero si convivís no tiene la reducción de ${esc(euros(P.estatal.reduccion_tributacion_conjunta.monoparental))} de las familias monoparentales, así que solo compensa si los hijos tienen rentas. El mínimo por cada hijo se reparte a medias entre los dos.</p></div>`,
      faq: [["¿Una pareja de hecho registrada puede hacer la conjunta?", "No. Aunque esté inscrita en el registro, para el IRPF solo el matrimonio forma unidad familiar con los dos adultos."]] };
  }),
  variante("separados", "Separados o divorciados con hijos", P => `Separados con hijos: declaración conjunta monoparental ${P.ejercicio}`, P => {
    const o = pareja(25000, 0, { tipo: "monoparental", hijos: [6] }), r = C.conjunta(P, o);
    return { title: `Separados o divorciados con hijos: conjunta monoparental ${P.ejercicio} | Mapafiscal`,
      description: `Si estás separado o divorciado y vives con tus hijos, puedes hacer la conjunta monoparental con una reducción de 2.150 €. Ejemplos ${P.ejercicio}.`,
      entradilla: `Quien vive con los hijos puede hacer la conjunta con ellos y restar ${esc(euros(P.estatal.reduccion_tributacion_conjunta.monoparental))}. Con 25.000 € y un hijo ahorra ${esc(euros(r.ahorro))} en ${esc(nombre(P, TERR))}.`,
      cuerpo: `<div class="tarjeta"><h2 class="rotulo">Quién puede</h2><p>El padre o la madre que convive con los hijos menores (o mayores con discapacidad). Con custodia compartida, cada hijo solo puede estar en una declaración conjunta: la del progenitor con el que conviva más tiempo, o la que acuerden. El otro progenitor hace la individual y conserva su parte del mínimo por descendientes.</p><p>Si conviven con otra pareja, la reducción no se aplica.</p></div>
      <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En los 19 territorios: 25.000 € y un hijo</h2>${tablaTerritoriosCj(P, o)}</div>`,
      faq: [["Con custodia compartida, ¿quién hace la conjunta?", "Solo uno de los dos progenitores puede incluir a cada hijo en su conjunta. El otro hace la individual."]] };
  })
];

// ---- dos pagadores -----------------------------------------------------------------------
const dos = (b1, b2, t = TERR) => ({ territorio: t, edad: 35, hijos: [], p1: { bruto: b1 }, p2: { bruto: b2 } });
const reparto = total => [Math.round(total * 0.7), Math.round(total * 0.3)];
function reglasDp(P) {
  const o = P.estatal.obligacion_declarar;
  return `<div class="tarjeta"><h2 class="rotulo">¿Cuándo hay que declarar con dos pagadores?</h2>
    <p>Con un solo pagador no estás obligado a declarar hasta ${esc(euros(o.trabajo_un_pagador))} de rendimientos del trabajo. Si del segundo y siguientes pagadores cobras, sumados, más de ${esc(euros(o.segundo_pagador_umbral))}, el límite baja a <b>${esc(euros(o.trabajo_varios_pagadores))}</b>. El paro cuenta como un pagador más.</p>
    <p>Por debajo de ese límite no tienes que presentar la declaración, aunque te saliera a pagar; si te sale a devolver, te conviene presentarla.</p>
    <p class="cita">Norma: <a href="${LIRPF_BOE}">Ley 35/2006 del IRPF</a>, art. 96. En el País Vasco y Navarra la obligación la regula su norma foral.</p></div>
    <div class="tarjeta"><h2 class="rotulo">Por qué sale a pagar</h2><p>Cada empresa te retiene como si fuera tu único pagador: aplica entero tu mínimo personal y la reducción por rendimientos del trabajo, y calcula el tipo con su sueldo solo. En la declaración se suman los dos sueldos, el mínimo cuenta una vez y la escala sube: falta lo que no te retuvieron.</p></div>`;
}
const supDp = P => `<p class="ayuda">IRPF ${P.ejercicio}, sin hijos ni otras rentas. Retenciones estimadas: lo que te retendría cada empresa si fuera tu único pagador. Las de tu certificado pueden variar.</p>`;
function faqDp(P) {
  const o = P.estatal.obligacion_declarar;
  return [
    ["¿Con dos pagadores siempre hay que hacer la declaración?", `No. Solo si cobras más de ${euros(o.trabajo_varios_pagadores)} y el segundo y siguientes pagadores te pagan, sumados, más de ${euros(o.segundo_pagador_umbral)}. Si el segundo no pasa de ${euros(o.segundo_pagador_umbral)}, el límite es de ${euros(o.trabajo_un_pagador)}.`],
    ["¿Por qué me sale a pagar si ya me retuvieron?", "Porque cada empresa calculó tu retención como si fuera tu único pagador. Al sumar los sueldos tributas a un tipo mayor y solo tienes un mínimo personal."],
    ["¿Puedo evitar que me salga a pagar?", "Puedes pedir a una de las empresas que te aplique un tipo de retención mayor (modelo 145 y solicitud de un tipo superior). No pagas más impuesto: lo adelantas durante el año."],
    ["¿El paro cuenta como segundo pagador?", "Sí. La prestación por desempleo es rendimiento del trabajo y el SEPE es un pagador más."]
  ];
}
function tablaDpTerritorios(P, total) {
  const [b1, b2] = reparto(total);
  return tabla(["Territorio", "IRPF del año", "Retenido", "Resultado"], C.dosPagadoresPorTerritorio(P, dos(b1, b2)).sort((a, b) => a.resultado - b.resultado)
    .map(x => [esc(nombre(P, x.territorio)), esc(euros(x.irpf)), esc(euros(x.retenciones)), esc(signo(x.resultado))]));
}
function paginasDosPagadores(P, generado) {
  const out = [];
  const filas = IMPORTES_DP.map(t => {
    const [b1, b2] = reparto(t), r = C.dosPagadores(P, dos(b1, b2));
    return [`<a href="${HUB_DP}${t}/">${esc(euros(t))}</a>`, esc(`${euros(b1)} + ${euros(b2)}`), r.obligado ? "Sí" : "No", esc(signo(r.resultado))];
  });
  const ej = C.dosPagadores(P, dos(...reparto(24000)));
  out.push(pagina({ ruta: HUB_DP, generado, migas: [["Inicio", "/"], ["Dos pagadores", null]],
    h1: `Dos pagadores ${P.ejercicio}: ¿tengo que declarar y me sale a pagar?`,
    entradilla: `Con 24.000 € repartidos entre dos empresas (70/30), estás obligado a declarar y te sale ${esc(signo(ej.resultado).toLowerCase())} en ${esc(nombre(P, TERR))}.`,
    title: `Dos pagadores ${P.ejercicio}: obligación de declarar y cuánto sale a pagar | Mapafiscal`,
    description: `Si has tenido dos pagadores en ${P.ejercicio}: el límite de ${euros(P.estatal.obligacion_declarar.trabajo_varios_pagadores)}, por qué sale a pagar y cuánto, con ejemplos de 16.000 a 40.000 €.`,
    faq: faqDp(P),
    cuerpo: `${reglasDp(P)}
    <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Ejemplos en ${esc(nombre(P, TERR))} (70 % el primero y 30 % el segundo)</h2>${supDp(P)}${tabla(["Total bruto", "Reparto", "¿Obligado?", "Resultado"], filas)}</div>
    ${cta("Calcula tu caso", APP_DP, ["¿Conjunta o individual?", HUB_CJ])}` }));
  for (const total of IMPORTES_DP) {
    const [b1, b2] = reparto(total), r = C.dosPagadores(P, dos(b1, b2)), ruta = `${HUB_DP}${total}/`;
    const unPag = C.dosPagadores(P, dos(total, 0));
    const esc2 = C.escenariosSegundo(P, dos(b1, b2), [1000, 1500, 2000, 5000, Math.round(total * 0.3), Math.round(total * 0.5)].filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y));
    out.push(pagina({ ruta, generado, migas: [["Inicio", "/"], ["Dos pagadores", HUB_DP], [euros(total), null]],
      h1: `${euros(total)} con dos pagadores: ¿me sale a pagar? (${P.ejercicio})`,
      entradilla: `Con ${esc(euros(b1))} de una empresa y ${esc(euros(b2))} de otra ${r.obligado ? "estás obligado a declarar" : "no estás obligado a declarar"} y, con las retenciones estimadas, te sale ${esc(signo(r.resultado).toLowerCase())} en ${esc(nombre(P, TERR))}.`,
      title: `${euros(total)} brutos con dos pagadores ${P.ejercicio}: ¿a pagar o a devolver? | Mapafiscal`,
      description: `Cobrando ${euros(total)} de dos pagadores en ${P.ejercicio} (${euros(b1)} y ${euros(b2)}): si tienes que declarar y cuánto te sale a pagar en cada territorio.`,
      faq: faqDp(P).slice(0, 3),
      cuerpo: `<div class="tarjeta"><h2 class="rotulo">Tu caso en ${esc(nombre(P, TERR))}</h2>${supDp(P)}${tabla(["Concepto", "Importe"], [
        ["Sueldo bruto total", esc(euros(total))], ["IRPF del año", esc(euros(r.irpf))],
        ["Retención estimada del primer pagador", esc(euros(r.retenciones[0]))], ["Retención estimada del segundo pagador", esc(euros(r.retenciones[1]))],
        ["Resultado de la declaración", esc(signo(r.resultado))],
        ["Con un solo pagador de " + euros(total), esc(signo(unPag.resultado)) + (unPag.obligado ? "" : " (sin obligación de declarar)")]])}</div>
      <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Según lo que te pague el segundo</h2>${tabla(["El segundo te paga", "¿Obligado?", "Resultado"], esc2.map(x => [esc(euros(x.segundo)), x.obligado ? "Sí" : "No", esc(signo(x.resultado))]))}</div>
      <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En los 19 territorios</h2>${tablaDpTerritorios(P, total)}</div>
      ${reglasDp(P)}
      ${cta("Calcula con tus retenciones", APP_DP, ["Todos los importes", HUB_DP])}` }));
  }
  return out;
}

// [{ ruta, html }]
export function paginasConjuntaPagadores(generado) {
  const P = paramsRecientes();
  return [...paginasConjunta(P, generado), ...paginasDosPagadores(P, generado)];
}
export const CARPETAS_CONJUNTA = ["declaracion-conjunta", "dos-pagadores"];
