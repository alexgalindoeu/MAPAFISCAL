// =============================================================================
// Páginas de sueldo neto por importe y territorio (web/sueldo-neto/), a partir de
// web/datos/seo_sueldo_neto.json (sueldo_neto() del motor R, R/15_sueldo_neto.R; la
// paridad con irpfsim.sueldoNeto está en test/sueldo_neto_seo.test.mjs).
//
//   /sueldo-neto/                         índice
//   /sueldo-neto/{importe}/               nacional: el neto en los 19 territorios
//   /sueldo-neto/{importe}/{territorio}/  detalle de un territorio
//   /sueldo-neto/mensual/{importe-mes}/   «X brutos al mes», en 12 y en 14 pagas
//
// Aquí no se calcula ningún impuesto: solo se maquetan las cifras del motor.
// =============================================================================
import { SLUG, ORDEN_TERRITORIOS, HERRAMIENTA, esc, euros, pct, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml } from "./seo_comun.mjs";

const FORAL = new Set(["ES-PV-BI", "ES-PV-SS", "ES-PV-VI", "ES-NC"]);
const pct2 = n => (100 * n).toFixed(2).replace(".", ",") + " %";

export function paginasSueldoNeto(d) {
  const EJ = d.ejercicio, gen = d.generado;
  const conTerritorio = new Set(d.importes_territorio);
  const importes = Object.keys(d.sueldos).map(Number).sort((a, b) => a - b);
  const nombre = c => d.nombres[c];
  const fila = (b, c) => d.sueldos[String(b)].territorios[c];
  const ss = b => d.sueldos[String(b)].ss;
  const ranking = b => ORDEN_TERRITORIOS.map(c => ({ c, ...fila(b, c) })).sort((x, y) => y.neto - x.neto || x.c.localeCompare(y.c));
  const rutaNac = b => `/sueldo-neto/${b}/`;
  const rutaTer = (b, c) => `/sueldo-neto/${b}/${SLUG[c]}/`;
  const rutaMes = m => `/sueldo-neto/mensual/${m}/`;
  const enlaceTer = (b, c, txt) => conTerritorio.has(b) ? `<a href="${rutaTer(b, c)}">${esc(txt)}</a>` : esc(txt);
  // Si el importe anual es un sueldo mensual típico en 12 o 14 pagas.
  const equivalencia = b => {
    const r = [];
    for (const m of d.mensuales) { if (m * 12 === b) r.push(`${euros(m)} brutos al mes en 12 pagas`); if (m * 14 === b) r.push(`${euros(m)} brutos al mes en 14 pagas`); }
    return r;
  };
  const supuesto = `Persona soltera, sin hijos, de ${d.supuesto.edad} años (menor de 65), con contrato indefinido y sin otras rentas, en el ejercicio ${EJ}. El neto es el que queda tras la declaración de la renta, no la retención de la nómina.`;
  const notaSs = `Seguridad Social del trabajador: ${esc(d.cotizaciones.norma.split(":")[0])}.`;
  const botones = c => `<p><a class="btn btn-pri" href="${HERRAMIENTA.sueldoNeto}">Calcula tu sueldo neto con hijos, edad o contrato temporal</a> <a class="btn btn-sec" href="${HERRAMIENTA.calculadora}">Calculadora completa del IRPF${c ? " en " + esc(nombre(c)) : ""}</a></p>`;
  const vecinos = (lista, b, ruta, txt) => {
    const i = lista.indexOf(b), out = [];
    for (const j of [i - 2, i - 1, i + 1, i + 2]) if (j >= 0 && j < lista.length) out.push(`<a href="${ruta(lista[j])}">${esc(txt(lista[j]))}</a>`);
    return out.join(" · ");
  };
  const paginas = [];

  // ---- detalle por territorio -------------------------------------------------------
  function paginaTerritorio(b, c, iTer) {
    const f = fila(b, c), s = ss(b), r = ranking(b), puesto = r.findIndex(x => x.c === c) + 1;
    const n = nombre(c), mejor = r[0], peor = r[r.length - 1];
    const media = r.reduce((a, x) => a + x.neto, 0) / r.length;
    const tipoIrpf = f.irpf / b, tipoTotal = (f.irpf + s.total) / b;
    const v = (iTer + importes.indexOf(b)) % 3;
    const intro = [
      `Con un sueldo de ${euros(b)} brutos al año en ${n}, te quedan <b>${euros(f.neto)} netos</b>: ${euros(f.neto / 12)} al mes en 12 pagas o ${euros(f.neto / 14)} en 14 pagas.`,
      `${euros(b)} brutos anuales se quedan en <b>${euros(f.neto)} netos</b> en ${n} en ${EJ}. Al mes son ${euros(f.neto / 14)} si cobras 14 pagas y ${euros(f.neto / 12)} si cobras 12.`,
      `En ${n}, de ${euros(b)} brutos al año la Seguridad Social se lleva ${euros(s.total)} y el IRPF ${euros(f.irpf)}: quedan <b>${euros(f.neto)} netos</b>, es decir, ${euros(f.neto / 12)} al mes en 12 pagas o ${euros(f.neto / 14)} en 14.`
    ][v];
    const eq = equivalencia(b);
    const filasSs = [["Contingencias comunes", s.contingencias_comunes, d.cotizaciones.tipos.contingencias_comunes],
      ["Desempleo", s.desempleo, d.cotizaciones.tipos.desempleo_indefinido],
      ["Formación profesional", s.formacion_profesional, d.cotizaciones.tipos.formacion_profesional],
      ["Mecanismo de equidad intergeneracional", s.mei, d.cotizaciones.tipos.mei]]
      .map(([t, x, tp]) => `<tr><td>${esc(t)} (${esc(pct2(tp))})</td><td class="num">−${esc(euros(x))}</td></tr>`).join("")
      + (s.solidaridad > 0 ? `<tr><td>Cotización adicional de solidaridad</td><td class="num">−${esc(euros(s.solidaridad))}</td></tr>` : "");
    const topeSs = s.base_mensual < b / 12 - 0.005
      ? ` Tu sueldo mensual prorrateado (${euros(b / 12)}) supera la base máxima de cotización (${euros(d.cotizaciones.base_maxima_mensual)} al mes): por encima de ella solo se paga la cotización de solidaridad.` : "";
    const comparacion = puesto === 1
      ? `${n} es el territorio donde más neto queda con este sueldo: ${euros(f.neto - r[1].neto)} al año más que en ${nombre(r[1].c)}, el segundo.`
      : puesto === r.length
        ? `${n} es, con este sueldo, el territorio donde menos neto queda: ${euros(mejor.neto - f.neto)} al año menos que en ${nombre(mejor.c)}.`
        : `${n} queda en el puesto ${puesto} de 19 (de más a menos neto). Frente a ${nombre(mejor.c)}, el primero, son ${euros(mejor.neto - f.neto)} menos al año; frente a ${nombre(peor.c)}, el último, ${euros(f.neto - peor.neto)} más.`;
    const frenteMedia = Math.abs(f.neto - media) < 50 ? "prácticamente lo mismo que la media de los 19 territorios"
      : f.neto > media ? `${euros(f.neto - media)} más que la media de los 19 territorios` : `${euros(media - f.neto)} menos que la media de los 19 territorios`;
    const regimen = FORAL.has(c)
      ? `${n} tiene régimen foral: aplica su propia tarifa del IRPF y sus propias reducciones, no la escala estatal.`
      : `En ${n} el IRPF suma la escala estatal y la autonómica, que es la que cambia de una comunidad a otra.`;
    const filas19 = r.map((x, i) => `<tr${x.c === c ? ' class="destacada"' : ""}><td class="num">${i + 1}</td><td>${x.c === c ? `<b>${esc(nombre(x.c))}</b>` : `<a href="${rutaTer(b, x.c)}">${esc(nombre(x.c))}</a>`}</td><td class="num">${esc(euros(x.neto))}</td><td class="num">${esc(euros(x.neto / 14))}</td><td class="num">${esc(pct(x.irpf / b))}</td></tr>`).join("");
    const lista = d.importes_territorio;
    const faq = [
      [`¿Cuánto es ${euros(b)} brutos en netos al mes en ${n}?`, `En ${EJ}, unos ${euros(f.neto / 12)} al mes en 12 pagas o ${euros(f.neto / 14)} en 14 pagas (${euros(f.neto)} netos al año), para una persona soltera, sin hijos y con contrato indefinido.`],
      [`¿Cuánto IRPF se paga con ${euros(b)} en ${n}?`, `${euros(f.irpf)} al año, un tipo medio del ${pct(tipoIrpf)} sobre el bruto. Con la Seguridad Social (${euros(s.total)}), el total es el ${pct(tipoTotal)}.`],
      [`¿Coincide con lo que veré en la nómina?`, `No exactamente: la nómina aplica una retención a cuenta, que puede ser algo mayor o menor. La diferencia se regulariza en la declaración de la renta; este neto es el que queda tras ella.`],
      [`¿Y si tengo hijos o un contrato temporal?`, `El neto cambia: los hijos elevan el mínimo familiar y el contrato temporal cotiza un poco más por desempleo. La calculadora de sueldo neto de Mapafiscal lo calcula con tu situación.`]
    ];
    const titulo = `Sueldo neto de ${euros(b)} brutos en ${n} (${EJ})`;
    const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"], [`${euros(b)} brutos`, rutaNac(b)], [n, rutaTer(b, c)]];
    const main = `
  <h1>${esc(titulo)}</h1>
  <p class="entradilla">${intro}${eq.length ? ` Es lo que cobra quien gana ${esc(eq.join(" o "))}.` : ""}</p>
  <div class="prosa">
  <div class="tarjeta">
    <dl class="kpis"><div><dt>Neto anual</dt><dd>${esc(euros(f.neto))}</dd></div><div><dt>Al mes, 12 pagas</dt><dd>${esc(euros(f.neto / 12))}</dd></div><div><dt>Al mes, 14 pagas</dt><dd>${esc(euros(f.neto / 14))}</dd></div></dl>
    <p class="ayuda">${esc(supuesto)}</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Del bruto al neto</h2>
    <div class="envoltorio"><table class="cobertura"><tbody>
      <tr><td>Sueldo bruto anual</td><td class="num">${esc(euros(b))}</td></tr>
      ${filasSs}
      <tr><td><b>Seguridad Social</b> (${esc(pct(s.total / b))})</td><td class="num"><b>−${esc(euros(s.total))}</b></td></tr>
      <tr><td><b>IRPF del año</b> (tipo medio ${esc(pct(tipoIrpf))})</td><td class="num"><b>−${esc(euros(f.irpf))}</b></td></tr>
      <tr><td><b>Sueldo neto anual</b></td><td class="num"><b>${esc(euros(f.neto))}</b></td></tr>
    </tbody></table></div>
    <p>Entre IRPF y Seguridad Social se va el ${esc(pct(tipoTotal))} del bruto. De cada 100 € más de sueldo, ${esc(euros(100 * f.marginal))} se irían en impuestos y cotizaciones (${esc(euros(100 * f.marginal_irpf))} de IRPF): es tu tipo marginal.${esc(topeSs)}</p>
    <p class="ayuda">${notaSs}</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">${esc(n)} frente a los otros 18 territorios</h2>
    <p>${esc(comparacion)} Son ${esc(frenteMedia)}. ${esc(regimen)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Puesto</th><th>Territorio</th><th class="num">Neto anual</th><th class="num">Al mes (14 pagas)</th><th class="num">Tipo medio IRPF</th></tr></thead><tbody>${filas19}</tbody></table></div>
  </div>
  ${bloqueFaq(faq)}
  ${botones(c)}
  <p class="ayuda">Otros sueldos en ${esc(n)}: ${vecinos(lista, b, x => rutaTer(x, c), x => euros(x))} · <a href="${rutaNac(b)}">${esc(euros(b))} en los 19 territorios</a> · <a href="/irpf/${SLUG[c]}/">IRPF en ${esc(n)}</a></p>
  </div>`;
    return layout({
      jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
      title: `${titulo}: ${euros(f.neto / 14)} al mes | Mapafiscal`,
      description: `${euros(b)} brutos en ${n} son ${euros(f.neto)} netos al año en ${EJ}: ${euros(f.neto / 12)} al mes en 12 pagas o ${euros(f.neto / 14)} en 14. Desglose de IRPF y Seguridad Social y comparación con los 19 territorios.`,
      canonical: rutaTer(b, c), breadcrumb: migasHtml(migas), main, generado: gen
    });
  }

  // ---- nacional por importe ------------------------------------------------------------
  function tabla19(b, mensualDe) {
    return `<div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Puesto</th><th>Territorio</th><th class="num">Neto anual</th><th class="num">12 pagas</th><th class="num">14 pagas</th><th class="num">IRPF</th><th class="num">Tipo medio</th></tr></thead><tbody>${ranking(b).map((x, i) =>
      `<tr><td class="num">${i + 1}</td><td>${enlaceTer(b, x.c, nombre(x.c))}</td><td class="num">${esc(euros(x.neto))}</td><td class="num"${mensualDe === 12 ? ' style="font-weight:700"' : ""}>${esc(euros(x.neto / 12))}</td><td class="num"${mensualDe === 14 ? ' style="font-weight:700"' : ""}>${esc(euros(x.neto / 14))}</td><td class="num">${esc(euros(x.irpf))}</td><td class="num">${esc(pct((x.irpf + ss(b).total) / b))}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function paginaNacional(b, i) {
    const r = ranking(b), s = ss(b), mejor = r[0], peor = r[r.length - 1];
    const md = fila(b, "ES-MD"), eq = equivalencia(b);
    const v = i % 3;
    const intro = [
      `${euros(b)} brutos al año son entre <b>${euros(peor.neto)}</b> y <b>${euros(mejor.neto)}</b> netos en ${EJ}, según dónde tributes. En 14 pagas, de ${euros(peor.neto / 14)} a ${euros(mejor.neto / 14)} al mes.`,
      `¿Cuánto se queda en neto un sueldo de ${euros(b)} brutos? Depende del territorio: en ${nombre(mejor.c)}, ${euros(mejor.neto)} al año; en ${nombre(peor.c)}, ${euros(peor.neto)}. La Seguridad Social (${euros(s.total)}) es igual en todas partes; lo que cambia es el IRPF.`,
      `Con ${euros(b)} brutos anuales, el neto en ${EJ} va de ${euros(peor.neto / 12)} a ${euros(mejor.neto / 12)} al mes en 12 pagas (de ${euros(peor.neto / 14)} a ${euros(mejor.neto / 14)} en 14). La tabla compara los 19 territorios fiscales.`
    ][v];
    const faq = [
      [`¿Cuánto es ${euros(b)} brutos en netos al mes?`, `En ${EJ}, en la Comunidad de Madrid, unos ${euros(md.neto / 12)} al mes en 12 pagas o ${euros(md.neto / 14)} en 14 pagas. En el resto de territorios va de ${euros(peor.neto / 14)} a ${euros(mejor.neto / 14)} en 14 pagas.`],
      [`¿Dónde queda más neto con ${euros(b)}?`, `En ${nombre(mejor.c)}: ${euros(mejor.neto)} netos al año, ${euros(mejor.neto - peor.neto)} más que en ${nombre(peor.c)}, donde menos queda.`],
      [`¿Cuánto se paga de Seguridad Social con ${euros(b)}?`, `${euros(s.total)} al año, el ${pct(s.total / b)} del bruto, igual en los 19 territorios (contrato indefinido).`]
    ];
    const titulo = `${euros(b)} brutos a netos (${EJ}): sueldo neto en 12 y 14 pagas`;
    const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"], [`${euros(b)} brutos`, rutaNac(b)]];
    const main = `
  <h1>${esc(titulo)}</h1>
  <p class="entradilla">${intro}${eq.length ? ` Equivale a ${esc(eq.join(" o a "))}.` : ""}</p>
  <div class="prosa">
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Neto de ${esc(euros(b))} brutos en los 19 territorios</h2>
    ${tabla19(b)}
    <p class="ayuda">${esc(supuesto)} ${notaSs}</p>
  </div>
  <div class="tarjeta"><h2 class="rotulo">De dónde sale la diferencia</h2>
    <p>La cotización a la Seguridad Social es la misma en toda España: ${esc(euros(s.total))} al año con ${esc(euros(b))} brutos. El IRPF, en cambio, va de ${esc(euros(Math.min(...r.map(x => x.irpf))))} a ${esc(euros(Math.max(...r.map(x => x.irpf))))}, porque cada comunidad fija su escala autonómica y el País Vasco y Navarra tienen su propio impuesto foral.</p></div>
  ${bloqueFaq(faq)}
  ${botones()}
  <p class="ayuda">Otros importes: ${vecinos(importes, b, rutaNac, x => euros(x))} · <a href="/sueldo-neto/">todos los sueldos</a>${[20000, 30000, 40000, 60000, 100000].includes(b) ? ` · <a href="/comparar-sueldo/${b}/">dónde se paga menos IRPF con ${esc(euros(b))}</a>` : ""}</p>
  </div>`;
    return layout({
      jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
      title: `${titulo} | Mapafiscal`,
      description: `${euros(b)} brutos al año son ${euros(md.neto / 14)} netos al mes en 14 pagas en Madrid en ${EJ}, y de ${euros(peor.neto / 14)} a ${euros(mejor.neto / 14)} según el territorio. Tabla de los 19 territorios con IRPF y Seguridad Social.`,
      canonical: rutaNac(b), breadcrumb: migasHtml(migas), main, generado: gen
    });
  }

  // ---- mensual (12 y 14 pagas en la misma página) ----------------------------------------
  function paginaMensual(m) {
    const b12 = m * 12, b14 = m * 14;
    const md12 = fila(b12, "ES-MD"), md14 = fila(b14, "ES-MD");
    const faq = [
      [`¿Cuánto es ${euros(m)} brutos al mes en neto?`, `En la Comunidad de Madrid en ${EJ}: ${euros(md12.neto / 12)} netos al mes si son 12 pagas (${euros(b12)} al año) y ${euros(md14.neto / 14)} si son 14 pagas (${euros(b14)} al año).`],
      [`¿Es mejor cobrar ${euros(m)} en 12 o en 14 pagas?`, `${euros(m)} en 14 pagas son ${euros(b14 - b12)} más de bruto al año. Si lo que se fija es el sueldo anual, da igual cómo se reparta: el neto anual es el mismo.`],
      [`¿Por qué cambia según la comunidad?`, `La Seguridad Social es igual en toda España, pero el IRPF tiene una parte autonómica (o foral, en el País Vasco y Navarra) que cambia de un territorio a otro.`]
    ];
    const titulo = `${euros(m)} brutos al mes a netos (${EJ}): 12 y 14 pagas`;
    const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"], [`${euros(m)} al mes`, rutaMes(m)]];
    const main = `
  <h1>${esc(titulo)}</h1>
  <p class="entradilla">${esc(euros(m))} brutos al mes en 12 pagas son ${esc(euros(b12))} al año y quedan en unos <b>${esc(euros(md12.neto / 12))} netos al mes</b> en Madrid; en 14 pagas son ${esc(euros(b14))} al año y unos <b>${esc(euros(md14.neto / 14))} netos por paga</b>. Así queda en cada territorio.</p>
  <div class="prosa">
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En 12 pagas (${esc(euros(b12))} brutos al año)</h2>${tabla19(b12, 12)}
    <p class="ayuda"><a href="${rutaNac(b12)}">Ver ${esc(euros(b12))} brutos a netos</a></p></div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En 14 pagas (${esc(euros(b14))} brutos al año)</h2>${tabla19(b14, 14)}
    <p class="ayuda"><a href="${rutaNac(b14)}">Ver ${esc(euros(b14))} brutos a netos</a></p></div>
  <p class="ayuda">${esc(supuesto)} ${notaSs}</p>
  ${bloqueFaq(faq)}
  ${botones()}
  <p class="ayuda">Otros sueldos al mes: ${d.mensuales.filter(x => x !== m).map(x => `<a href="${rutaMes(x)}">${esc(euros(x))}</a>`).join(" · ")}</p>
  </div>`;
    return layout({
      jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
      title: `${titulo} | Mapafiscal`,
      description: `${euros(m)} brutos al mes son ${euros(md12.neto / 12)} netos en 12 pagas y ${euros(md14.neto / 14)} en 14 pagas en Madrid en ${EJ}. Tabla con los 19 territorios fiscales de España.`,
      canonical: rutaMes(m), breadcrumb: migasHtml(migas), main, generado: gen
    });
  }

  function paginaIndice() {
    const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"]];
    const main = `
  <h1>Sueldo neto en ${EJ}: de bruto a neto en los 19 territorios</h1>
  <p class="entradilla">Cuánto queda en neto de cada sueldo bruto, en 12 y en 14 pagas, tras el IRPF y la Seguridad Social del ejercicio ${EJ}, en las 15 comunidades de régimen común, las tres diputaciones forales vascas y Navarra. ${esc(supuesto)}</p>
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Sueldos al mes</h2><ul class="lista-enlaces">${d.mensuales.map(m => `<li><a href="${rutaMes(m)}">${esc(euros(m))} brutos al mes a netos</a></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Sueldos al año</h2><ul class="lista-enlaces">${importes.map(b => `<li><a href="${rutaNac(b)}">${esc(euros(b))} brutos a netos</a></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Por territorio</h2><p>Cada importe enlaza el detalle de los 19 territorios para ${d.importes_territorio.length} sueldos, de ${esc(euros(d.importes_territorio[0]))} a ${esc(euros(d.importes_territorio[d.importes_territorio.length - 1]))}. Por ejemplo, 30.000 € en ${ORDEN_TERRITORIOS.map(c => `<a href="${rutaTer(30000, c)}">${esc(nombre(c))}</a>`).join(", ")}.</p></div>
  ${botones()}
  <p class="ayuda"><a href="/comparar-sueldo/">Dónde se paga menos IRPF</a> · <a href="/irpf/">IRPF por territorio</a></p>
  </div>`;
    return layout({
      jsonld: [jsonLdMigas(migas)],
      title: `Sueldo neto ${EJ}: de bruto a neto en 12 y 14 pagas por territorio | Mapafiscal`,
      description: `Tablas de sueldo neto ${EJ} de 15.000 a 100.000 € brutos y de los sueldos mensuales más buscados, en 12 y 14 pagas, en los 19 territorios fiscales de España.`,
      canonical: "/sueldo-neto/", breadcrumb: migasHtml(migas), main, generado: gen
    });
  }

  paginas.push({ ruta: "/sueldo-neto/", html: paginaIndice() });
  for (const m of d.mensuales) paginas.push({ ruta: rutaMes(m), html: paginaMensual(m) });
  importes.forEach((b, i) => {
    paginas.push({ ruta: rutaNac(b), html: paginaNacional(b, i) });
    if (conTerritorio.has(b)) ORDEN_TERRITORIOS.forEach((c, j) => paginas.push({ ruta: rutaTer(b, c), html: paginaTerritorio(b, c, j) }));
  });
  return paginas;
}
