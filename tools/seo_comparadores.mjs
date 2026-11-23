// =============================================================================
// Páginas SEO de tres herramientas de la aplicación:
//   /comparar-ofertas/        «Comparar dos ofertas de trabajo» (index.html#ofertas)
//   /irpf-<año>-vs-<año>/     «El mismo sueldo en dos ejercicios» (index.html#ejercicios)
//   /tipo-marginal-real/      «De cada 100 € más, ¿cuánto te queda?» (index.html#marginal)
// Aquí no se calcula ningún impuesto: los ejemplos salen de las mismas funciones que usa
// cada herramienta (web/js/ofertas.js, ejercicios.js y marginal.js), que llaman a
// irpfsim.sueldoNeto con los parámetros exportados (web/datos/params*.json). Cada página
// lleva una explicación, uno o dos ejemplos, preguntas frecuentes y un botón a la
// herramienta con el ejemplo ya puesto. Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { esc, NOMBRE_CORTO, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml, respuestaDirecta, tituloQueQuepa, MAX_TITULO_DURO } from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const O = require(join(WEB, "js", "ofertas.js"));
const E = require(join(WEB, "js", "ejercicios.js"));
const M = require(join(WEB, "js", "marginal.js"));
const leerP = f => JSON.parse(readFileSync(join(WEB, "datos", f), "utf8"));
// el ejercicio por defecto (params.json) y el anterior publicado que haya exportado
function ejercicios() {
  const Pb = leerP("params.json");
  const otros = readdirSync(join(WEB, "datos")).filter(n => /^params_\d{4}\.json$/.test(n)).map(leerP)
    .filter(p => p.ejercicio < Pb.ejercicio && (!Pb.ejercicios || (Pb.ejercicios.publicados || []).map(Number).includes(p.ejercicio)))
    .sort((a, b) => b.ejercicio - a.ejercicio);
  return { Pa: otros[0] || null, Pb };
}
const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
// cifra corta de una tabla («20.048,45 €»): no se parte por el espacio antes de «€»
const cifra = v => String(v).length <= 14 ? `<span class="sin-corte">${esc(v)}</span>` : esc(v);
const conSigno = n => (n > 0.5 ? "+" : "") + eur0(n);
const pct = n => (100 * (n || 0)).toFixed(1).replace(".", ",") + " %";
const minus = t => t.charAt(0).toLowerCase() + t.slice(1);
const app = h => "/index.html" + h;
const boton = (txt, href, sec) => `<p><a class="btn btn-pri" href="${esc(href)}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${esc(sec[1])}">${esc(sec[0])}</a>` : ""}</p>`;
const titulo = (...v) => { const t = tituloQueQuepa(...v); if (t.length > MAX_TITULO_DURO) throw new Error("título demasiado largo: " + t); return t; };

// ---- /comparar-ofertas/ -------------------------------------------------------------------
export const RUTA_OFERTAS = "/comparar-ofertas/";
export const EJEMPLOS_OFERTAS = [
  { a: { bruto: 40000, territorio: "ES-CT", pagas: 14, plan: 0 }, b: { bruto: 39000, territorio: "ES-MD", pagas: 14, plan: 0 } },
  { a: { bruto: 30000, territorio: "ES-MD", pagas: 14, plan: 0 }, b: { bruto: 30000, territorio: "ES-PV-BI", pagas: 12, plan: 1500 } }
];
function tablaOfertas(P, ej) {
  const r = O.compararOfertas(P, ej.a, ej.b), n = t => P.territorios[t].nombre;
  const filas = [["Bruto anual", "bruto"], ["Seguridad Social", "cotizaciones"], ["IRPF del año", "irpf"]]
    .concat(r.a.plan || r.b.plan ? [["Aportación al plan de empleo", "plan"]] : []).concat([["Neto en mano al año", "neto"], ["Neto al mes (12 pagas)", "netoMes"]]);
  return { r, html: `<div class="envoltorio"><table class="cobertura"><thead><tr><th scope="col">Concepto</th><th scope="col" class="num">A: ${esc(n(ej.a.territorio))}, ${ej.a.pagas} pagas</th><th scope="col" class="num">B: ${esc(n(ej.b.territorio))}, ${ej.b.pagas} pagas</th><th scope="col" class="num">A − B</th></tr></thead><tbody>` +
    filas.map(([t, k]) => `<tr><td>${t}</td><td class="num">${esc(eur0(r.a[k]))}</td><td class="num">${esc(eur0(r.b[k]))}</td><td class="num">${esc(conSigno(r.a[k] - r.b[k]))}</td></tr>`).join("") +
    `<tr><td>Neto de cada paga</td><td class="num">${esc(eur0(r.a.netoPaga))} × ${r.a.pagas}</td><td class="num">${esc(eur0(r.b.netoPaga))} × ${r.b.pagas}</td><td></td></tr>` +
    `<tr><td>Tipo medio del IRPF</td><td class="num">${esc(pct(r.a.tipoMedio))}</td><td class="num">${esc(pct(r.b.tipoMedio))}</td><td></td></tr></tbody></table></div>` };
}
function paginaOfertas(P, generado) {
  const [e1, e2] = EJEMPLOS_OFERTAS.map(ej => ({ ej, ...tablaOfertas(P, ej) }));
  const n = t => P.territorios[t].nombre;
  const qs = [
    ["¿Cómo comparo dos ofertas de trabajo?", "Por el neto, no por el bruto: lo que te queda al año después de la Seguridad Social y el IRPF. El IRPF cambia según el territorio donde vivas (cada comunidad tiene su escala y el País Vasco y Navarra su propio impuesto), así que dos brutos parecidos pueden dejar netos distintos."],
    ["¿Importa cobrar en 12 o en 14 pagas?", "No para el neto anual: el mismo bruto deja el mismo neto, solo cambia cómo se reparte. En 14 pagas cada nómina es más pequeña y en dos meses cobras el doble; para comparar, mira el neto al año o el neto al mes en 12 pagas."],
    ["¿Cuenta el plan de pensiones de empleo?", "Si aportas tú a un plan de empleo, ese dinero sale de tu nómina pero reduce la base del IRPF, con los límites de la ley: pagas menos impuesto y el ahorro sigue siendo tuyo. La herramienta lo descuenta del neto en mano y te dice cuánto IRPF te ahorra."],
    ["¿Por qué una oferta con menos bruto puede dejar más neto?", `Porque el IRPF depende del territorio. En el ejemplo, ${eur0(e1.ej.b.bruto)} en ${n(e1.ej.b.territorio)} frente a ${eur0(e1.ej.a.bruto)} en ${n(e1.ej.a.territorio)}: ${minus(O.frase(e1.r))}`],
    ["¿Puedo compartir la comparación?", "Sí: la herramienta crea un enlace con las dos ofertas. Quien lo abra verá las mismas cifras; no se guarda nada en ningún servidor."]
  ];
  const migas = [["Inicio", "/"], ["Comparar dos ofertas de trabajo", null]];
  const ej = (x, t) => `<div class="tarjeta tarjeta-tabla"><h2 class="rotulo">${esc(t)}</h2>${x.html}<p class="ayuda">${esc(O.frase(x.r))}</p>
    ${boton("Abrir este ejemplo en la herramienta", app(O.enlace(x.ej.a, x.ej.b)))}</div>`;
  const main = `
  <h1>Comparar dos ofertas de trabajo: qué sueldo te deja más neto (${P.ejercicio})</h1>
  <p class="entradilla">Pon el bruto anual, el territorio y las pagas de cada oferta (y, si quieres, tu aportación a un plan de empleo) y compara lado a lado el neto anual y mensual, el IRPF, las cotizaciones y el tipo medio.</p>
  ${respuestaDirecta(esc(`${eur0(e1.ej.a.bruto)} en ${n(e1.ej.a.territorio)} frente a ${eur0(e1.ej.b.bruto)} en ${n(e1.ej.b.territorio)}: ${minus(O.frase(e1.r))}`))}
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Por qué comparar el neto y no el bruto</h2>
    <p>El bruto es lo que paga la empresa; lo que llega a tu cuenta es el bruto menos las cotizaciones a la Seguridad Social (iguales en toda España) y el IRPF, que cambia con el territorio: cada comunidad de régimen común aplica su propia escala autonómica y el País Vasco y Navarra tienen su impuesto. Por eso una oferta con menos bruto puede dejarte más dinero, y el número de pagas solo cambia cómo se reparte el mismo neto.</p>
    ${boton("Comparar tus dos ofertas", app(O.enlace(O.POR_DEFECTO.a, O.POR_DEFECTO.b)))}</div>
  ${ej(e1, `Ejemplo 1: ${eur0(e1.ej.a.bruto)} en ${n(e1.ej.a.territorio)} o ${eur0(e1.ej.b.bruto)} en ${n(e1.ej.b.territorio)}`)}
  ${ej(e2, `Ejemplo 2: ${eur0(e2.ej.a.bruto)} en ${n(e2.ej.a.territorio)} o en ${n(e2.ej.b.territorio)} con plan de empleo`)}
  <p class="ayuda">Persona de ${O.SITUACION.edad} años sin hijos, contrato indefinido, tributación individual y normativa de ${P.ejercicio}: neto tras la Seguridad Social del trabajador y el IRPF del año (después de la declaración). Cifras redondeadas al euro.</p>
  ${bloqueFaq(qs)}
  <p class="ayuda">Más: <a href="/index.html#bruto-necesario">¿qué sueldo bruto pido?</a> · <a href="/tipo-marginal-real/">de cada 100 € más, cuánto te queda</a> · <a href="/sueldo-neto/">sueldo neto por importe</a> · <a href="/comparar-sueldo/">dónde se paga menos IRPF</a></p>
  </div>`;
  return { ruta: RUTA_OFERTAS, html: layout({ title: titulo(`Comparar dos ofertas de trabajo: neto real (${P.ejercicio})`, "Comparar dos ofertas de trabajo"),
    description: `Compara dos sueldos por su neto real, con su territorio, sus pagas y tu plan de empleo: IRPF, cotizaciones y tipo medio lado a lado. Gratis, ${P.ejercicio}.`,
    canonical: RUTA_OFERTAS, breadcrumb: migasHtml(migas), main, generado, ejercicio: P.ejercicio, jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// ---- /irpf-<año>-vs-<año>/ ------------------------------------------------------------------
export const rutaEjercicios = (Pa, Pb) => `/irpf-${Pa.ejercicio}-vs-${Pb.ejercicio}/`;
export const EJEMPLOS_EJERCICIOS = [{ bruto: 18000, territorio: "ES-MD" }, { bruto: 30000, territorio: "ES-VC" }];
function bloqueEjercicio(Pa, Pb, o, t) {
  const r = E.compararEjercicios(Pa, Pb, o);
  const filas = [["Seguridad Social", "cotizaciones"], ["IRPF del año", "irpf"], ["Neto al año", "neto"], ["Neto al mes (12 pagas)", "netoMes"]];
  const cambian = r.conceptos.filter(c => c.cambia);
  return { r, html: `<div class="tarjeta tarjeta-tabla"><h2 class="rotulo">${esc(t)}</h2>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th scope="col">${eur0(o.bruto)} brutos</th><th scope="col" class="num">${r.anterior}</th><th scope="col" class="num">${r.actual}</th><th scope="col" class="num">Diferencia</th></tr></thead><tbody>` +
    filas.map(([n, k]) => `<tr><td>${n}</td><td class="num">${esc(eur0(r.a[k]))}</td><td class="num">${esc(eur0(r.b[k]))}</td><td class="num">${esc(conSigno(r.b[k] - r.a[k]))}</td></tr>`).join("") + `</tbody></table></div>
    <p class="ayuda">${esc(E.frase(r))}</p>
    <div class="envoltorio"><table class="cobertura tabla-cambios"><thead><tr><th scope="col">Qué cambia</th><th scope="col">${r.anterior}</th><th scope="col">${r.actual}</th></tr></thead><tbody>` +
    cambian.map(c => c.filas.filter(f => f.a !== f.b).map((f, i) => `<tr><td>${i ? "" : `<b>${esc(c.titulo)}</b><br>`}${esc(f.etq)}</td><td>${cifra(f.a)}</td><td>${cifra(f.b)}</td></tr>`).join("")).join("") + `</tbody></table></div>
    ${cambian.filter(c => c.nota).map(c => `<p class="ayuda">${esc(c.nota)}</p>`).join("")}
    ${boton("Abrir este ejemplo en la herramienta", app(E.enlace(o)))}</div>` };
}
function paginaEjercicios(Pa, Pb, generado) {
  const ruta = rutaEjercicios(Pa, Pb), A = Pa.ejercicio, B = Pb.ejercicio, n = t => Pb.territorios[t].nombre;
  const [x1, x2] = EJEMPLOS_EJERCICIOS.map((o, i) => bloqueEjercicio(Pa, Pb, o, `Ejemplo ${i + 1}: ${eur0(o.bruto)} brutos en ${n(o.territorio)}`));
  const comunes = x1.r.conceptos.filter(c => c.cambia).map(c => c.titulo.replace(/ \(.*\)$/, "").replace(/^Escala autonómica de .*/, "escala autonómica").toLowerCase());
  const smi = x1.r.conceptos.find(c => /SMI/.test(c.titulo)), ss = x1.r.conceptos.find(c => /Seguridad Social/.test(c.titulo));
  const qs = [
    [`¿Qué cambia en el IRPF de ${B} frente a ${A}?`, `Para un asalariado de régimen común sin hijos: ${comunes.join(", ")}. Además, algunas comunidades y los territorios forales han cambiado su escala o sus mínimos; la herramienta lo muestra para tu territorio.`],
    [`¿Cuánto es la deducción del SMI en ${B}?`, smi ? `${smi.filas[0].b} como máximo (${smi.filas[0].a} en ${A}), con un rendimiento íntegro del trabajo de hasta ${smi.filas[1].b}; se anula en ${smi.filas[2].b}. ${smi.norma || ""}`.trim() : "No hay deducción del SMI en estos ejercicios."],
    [`¿Suben las cotizaciones en ${B}?`, `El tipo ordinario del trabajador con contrato indefinido pasa del ${ss.filas[0].a} al ${ss.filas[0].b} por el mecanismo de equidad intergeneracional (MEI), y la base máxima de cotización de ${ss.filas[2].a} a ${ss.filas[2].b} al mes.`],
    [`¿Pagaré menos IRPF en ${B} que en ${A}?`, `Depende del sueldo y del territorio. En el ejemplo 1 (${eur0(EJEMPLOS_EJERCICIOS[0].bruto)} en ${n(EJEMPLOS_EJERCICIOS[0].territorio)}): ${minus(E.frase(x1.r))}`],
    ["¿Es la declaración que presento este año?", `La renta de ${A} se presenta en la primavera de ${A + 1}; la de ${B}, en ${B + 1}. Hasta que acaba ${B}, sus cifras son una simulación con la normativa aprobada hasta hoy.`]
  ];
  const migas = [["Inicio", "/"], [`IRPF ${A} frente a ${B}`, null]];
  const main = `
  <h1>IRPF ${A} frente a ${B}: el mismo sueldo en los dos ejercicios</h1>
  <p class="entradilla">Cuánto cambian tu IRPF y tu neto de un año a otro con el mismo sueldo, y qué conceptos cambian: mínimos, escalas, la deducción del SMI y las cotizaciones, con la cifra de cada ejercicio sacada de la normativa.</p>
  ${respuestaDirecta(esc(`Con ${eur0(EJEMPLOS_EJERCICIOS[0].bruto)} brutos en ${n(EJEMPLOS_EJERCICIOS[0].territorio)}: ${minus(E.frase(x1.r))}`))}
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Qué se compara</h2>
    <p>El mismo caso (un asalariado de ${E.SITUACION.edad} años sin hijos, con contrato indefinido) liquidado dos veces: con la normativa de ${A} y con la de ${B}. Lo que cambia entre los dos es solo la ley: la escala estatal y la de cada comunidad, los mínimos, la reducción y la deducción por rendimientos del trabajo (la del SMI) y las cotizaciones del trabajador. Si una comunidad no ha aprobado cambios, sigue con los del año anterior.</p>
    ${boton("Compara tu sueldo en los dos años", app(E.enlace({ bruto: 25000, territorio: "ES-MD" })))}</div>
  ${x1.html}
  ${x2.html}
  ${bloqueFaq(qs)}
  <p class="ayuda">Más: <a href="/guias/">guías del IRPF</a> · <a href="/sueldo-neto/">sueldo neto por importe</a> · <a href="/tipo-marginal-real/">de cada 100 € más, cuánto te queda</a></p>
  </div>`;
  return { ruta, html: layout({ title: titulo(`IRPF ${A} vs ${B}: qué cambia con el mismo sueldo`, `IRPF ${A} vs ${B}: qué cambia`),
    description: `El mismo sueldo con el IRPF de ${A} y de ${B}: cuánto cambia tu neto y qué cambia (mínimos, escala, deducción del SMI y cotizaciones), en tu territorio.`,
    canonical: ruta, breadcrumb: migasHtml(migas), main, generado, ejercicio: B, jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// ---- /tipo-marginal-real/ ---------------------------------------------------------------------
export const RUTA_MARGINAL = "/tipo-marginal-real/";
export const EJEMPLOS_MARGINAL = ["ES-MD", "ES-PV-BI"];
function bloqueMarginal(P, t, i) {
  const s = M.serie(P, t), hs = M.saltos(P, t, M.RANGO, s), r = M.resumen(s), nombre = P.territorios[t].nombre;
  const filas = M.filasTabla(s, 4000).map(p => `<tr><td class="num">${esc(eur0(p.bruto))}</td><td class="num">${esc(M.eur2(p.queda))}</td><td class="num">${esc(M.eur2(p.irpf))}</td><td class="num">${esc(M.eur2(p.ss))}</td></tr>`).join("");
  return { r, hs, nombre, html: `<div class="tarjeta">
    <figure class="grafico"><h2 class="rotulo">Ejemplo ${i}: ${esc(nombre)}</h2>
      <div class="mg-ancho">${M.grafico(s, hs)}</div><div class="mg-estrecho">${M.grafico(s, hs, { ancho: 340 })}</div>
      <figcaption class="ayuda">Lo que queda neto de cada 100 € brutos más, de ${esc(eur0(M.RANGO.desde))} a ${esc(eur0(M.RANGO.hasta))}. Lo menos: ${esc(eur0(r.peor.queda))}, con ${esc(eur0(r.peor.bruto))} brutos. Los números marcan los saltos.</figcaption></figure>
    <ol class="mg-saltos">${hs.map(h => `<li><b>Hacia ${esc(eur0(h.bruto))}:</b> ${esc(h.texto)} <span class="mg-antes">De cada 100 € te quedaban <span class="sin-corte">${esc(eur0(h.antes))};</span> después, <span class="sin-corte">${esc(eur0(h.despues))}.</span></span></li>`).join("")}</ol>
    <details class="grafico-datos"><summary>Ver los datos del gráfico</summary>
      <div class="envoltorio"><table class="cobertura"><thead><tr><th scope="col" class="num">Bruto anual</th><th scope="col" class="num">Te quedan</th><th scope="col" class="num">IRPF</th><th scope="col" class="num">Seguridad Social</th></tr></thead><tbody>${filas}</tbody></table></div></details>
    ${boton(`Ver ${nombre} en la herramienta`, app(M.enlace(t)))}</div>` };
}
function paginaMarginal(P, generado) {
  const [m1, m2] = EJEMPLOS_MARGINAL.map((t, i) => bloqueMarginal(P, t, i + 1));
  const a = P.estatal.trabajo_reduccion_art20, d = P.estatal.deduccion_obtencion_rendimientos_trabajo, ct = P.estatal.cotizaciones_trabajador;
  const fin = m1.hs.find(h => h.concepto === "reduccion" && h.a === "0");
  const qs = [
    ["¿Qué es el tipo marginal real?", "Lo que se llevan el IRPF y la Seguridad Social de cada euro más que ganas. No es el tipo de tu tramo de la escala: también cuentan las reducciones y deducciones que se pierden al subir el sueldo y las cotizaciones."],
    ["¿Por qué con un sueldo bajo me quedo con tan poco de una subida?", `Porque en esa zona se pierden a la vez la reducción por rendimientos del trabajo (hasta ${M.eur0(a.importe_maximo)}, que se anula con ${M.eur0(a.umbral_final)} de rendimiento neto) y la deducción del SMI (hasta ${M.eur0(d.importe_maximo)}, que se anula con ${M.eur0(d.umbral_final)} de rendimiento íntegro). En ${m1.nombre} lo menos que queda de 100 € es ${eur0(m1.r.peor.queda)}, con ${eur0(m1.r.peor.bruto)} brutos.`],
    ["¿Cobrar más puede hacer que cobre menos?", "No: en ningún punto se pierde más de lo que se gana, así que el neto siempre sube con el bruto. Lo que pasa es que en algunas zonas sube muy poco."],
    ["¿Por qué por encima de unos 61.000 € me queda más de cada euro?", `Porque se llega a la base máxima de cotización (${M.eur0(ct.base_maxima_mensual * 12)} al año en ${P.ejercicio}): lo que ganes por encima ya no paga cotizaciones ordinarias, solo la cotización adicional de solidaridad.`],
    ["¿Cómo se calcula?", `Con el motor de Mapafiscal: para cada sueldo, el neto con 100 € brutos más menos el neto sin ellos, cada ${M.RANGO.paso} €. Persona de ${M.SITUACION.edad} años sin hijos, contrato indefinido y normativa de ${P.ejercicio}.`]
  ];
  const migas = [["Inicio", "/"], ["Tipo marginal real", null]];
  const main = `
  <h1>Tipo marginal real: de cada 100 € más, ¿cuánto te queda? (${P.ejercicio})</h1>
  <p class="entradilla">Cuánto llega a tu bolsillo de cada 100 € brutos más, con el IRPF y la Seguridad Social juntos, de ${esc(eur0(M.RANGO.desde))} a ${esc(eur0(M.RANGO.hasta))} al año, y dónde están los saltos y por qué.</p>
  ${respuestaDirecta(esc(`En ${m1.nombre}, de cada 100 € brutos más te quedan de media ${eur0(m1.r.media)}, pero con ${eur0(m1.r.peor.bruto)} brutos solo ${eur0(m1.r.peor.queda)}${fin ? `: hasta unos ${eur0(fin.bruto)} se va perdiendo la reducción por rendimientos del trabajo` : ""}.`))}
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Tu tramo no es tu tipo marginal</h2>
    <p>El tramo de la escala del IRPF dice qué porcentaje se paga de la base liquidable, pero al subir el sueldo pasan más cosas: se pierde poco a poco la reducción por rendimientos del trabajo y la deducción del SMI, se cruzan tramos de la escala estatal y de la autonómica y, a partir de la base máxima, dejan de crecer las cotizaciones. El resultado son saltos: zonas donde de 100 € más apenas te quedan 20 o 30 y otras donde te quedan 60.</p>
    ${boton("Mira tu territorio", app(M.enlace("ES-MD")))}</div>
  ${m1.html}
  ${m2.html}
  ${bloqueFaq(qs)}
  <p class="ayuda">Más: <a href="/index.html#sueldo-neto?subida">¿cuánto neto gano con mi subida?</a> · <a href="/comparar-ofertas/">comparar dos ofertas de trabajo</a> · <a href="/sueldo-neto/">sueldo neto por importe</a></p>
  </div>`;
  return { ruta: RUTA_MARGINAL, html: layout({ title: titulo(`Tipo marginal real: de cada 100 € más, cuánto te queda (${P.ejercicio})`, `Tipo marginal real ${P.ejercicio}: de cada 100 € más`, "Tipo marginal real del IRPF"),
    description: `De cada 100 € brutos más, cuánto te queda tras IRPF y Seguridad Social, de 12.000 a 120.000 €. En ${NOMBRE_CORTO[EJEMPLOS_MARGINAL[0]]}, solo ${eur0(m1.r.peor.queda)} con ${eur0(m1.r.peor.bruto)}.`,
    canonical: RUTA_MARGINAL, breadcrumb: migasHtml(migas), main, generado, ejercicio: P.ejercicio, jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// [{ ruta, html }]
export function paginasComparadores(generado) {
  const { Pa, Pb } = ejercicios();
  return [paginaOfertas(Pb, generado), ...(Pa ? [paginaEjercicios(Pa, Pb, generado)] : []), paginaMarginal(Pb, generado)];
}
