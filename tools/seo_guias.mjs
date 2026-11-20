// =============================================================================
// Guías evergreen: /guias/<slug>/ y su índice /guias/.
//
// Todas las cifras salen de web/datos/seo_guias.json y seo_territorios.json (que genera
// Rscript tools/generar_datos_seo.R desde params/): aquí solo va la redacción. Cada guía
// cita su norma con enlace a la fuente primaria (BOE o Manual práctico de la AEAT).
// =============================================================================
import {
  SLUG, ORDEN_TERRITORIOS, NOMBRE_CORTO, HERRAMIENTA, LIRPF_BOE, esc, euros, eurosExactos as eur, pct, pctCorto,
  fecha, urlBoe, tablaEscala, combinarEscalas, citaFuente, layout, jsonLdMigas, jsonLdArticulo,
  jsonLdFaq, jsonLdDataset, bloqueFaq, migasHtml, respuestaDirecta
} from "./seo_comun.mjs";

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lirpf = art => `<a href="${LIRPF_BOE}" rel="noopener">${esc(art)} de la Ley 35/2006 del IRPF</a>`;
const RIRPF_BOE = "https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820";
// Última modificación del art. 63.1 LIRPF según el texto consolidado del BOE (nota de
// versiones del artículo): con efectos desde el 1-1-2021, por el art. 58 de la Ley 11/2020.
const ULTIMA_REFORMA_ART63 = `art. 58 de la Ley 11/2020, de 30 de diciembre, de Presupuestos Generales del Estado para 2021, <a href="${urlBoe("BOE-A-2020-17339")}" rel="noopener">BOE-A-2020-17339</a>`;
const enlaceTerritorio = c => `/irpf/${SLUG[c]}/`;
const fechaSinAnio = iso => fecha(iso).replace(/ de \d{4}$/, "");

function pagina(g, { slug, titulo, h1, description, cuerpo, faq, generado, resumen, dataset }) {
  const ruta = `/guias/${slug}/`;
  const migas = [["Inicio", "/"], ["Guías del IRPF", "/guias/"], [h1, ruta]];
  const relacionadas = GUIAS.filter(x => x.slug !== slug)
    .map(x => `<li><a href="/guias/${x.slug}/">${esc(x.enlace)}</a></li>`).join("");
  const main = `
  <h1>${esc(h1)}</h1>
  ${resumen ? respuestaDirecta(resumen) : ""}
  <div class="prosa">
  ${cuerpo}
  ${faq.length ? bloqueFaq(faq) : ""}
  <div class="tarjeta"><h2 class="rotulo">Otras guías</h2><ul class="lista-enlaces">${relacionadas}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Tablas del IRPF por territorio</h2><p>${ORDEN_TERRITORIOS.map(c => `<a href="${enlaceTerritorio(c)}">${esc(NOMBRE_CORTO[c])}</a>`).join(" · ")}</p><p><a href="/irpf/">IRPF por territorio</a></p></div>
  </div>`;
  return {
    ruta,
    html: layout({
      title: titulo, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado, css: ["/css/guias.css"],
      jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo: h1, descripcion: description, ruta, generado }), ...(faq.length ? [jsonLdFaq(faq)] : []),
        ...(dataset ? [jsonLdDataset(Object.assign({ ruta, generado }, dataset))] : [])]
    })
  };
}

const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;

// Cuota de una escala marginal para una base dada.
function cuota(tramos, base) {
  let c = 0, prev = 0;
  for (const t of tramos) {
    const tope = t.hasta == null ? Infinity : t.hasta;
    if (base > prev) c += (Math.min(base, tope) - prev) * t.tipo;
    prev = tope;
  }
  return c;
}

// ---- 1. Tramos ----------------------------------------------------------------------
function guiaTramos(g, T) {
  const e = g.escalas;
  const igual26 = iguales(e.estatal_2025.tramos, e.estatal_2026.tramos);
  const ahorro25 = combinarEscalas(e.ahorro_estatal_2025.tramos, e.ahorro_autonomica_2025.tramos);
  const ahorro26 = combinarEscalas(e.ahorro_estatal_2026.tramos, e.ahorro_autonomica_2026.tramos);
  const filas = ORDEN_TERRITORIOS.map(c => {
    const tr = T.territorios[c].escala_combinada.tramos, ult = tr[tr.length - 1];
    return { c, nombre: T.territorios[c].nombre, min: tr[0].tipo, max: ult.tipo, desde: tr[tr.length - 2]?.hasta, n: tr.length };
  });
  const comunes = filas.filter(f => T.territorios[f.c].regimen === "comun");
  const maxT = comunes.reduce((a, b) => b.max > a.max ? b : a), minT = comunes.reduce((a, b) => b.max < a.max ? b : a);
  const ej = 30000;
  const cuotaEj = cuota(e.estatal_2025.tramos, ej);
  const pv26 = !iguales(e.pais_vasco_2025.tramos, e.pais_vasco_2026.tramos);
  const nv26 = iguales(e.navarra_2025.tramos, e.navarra_2026.tramos);
  const est = e.estatal_2025.tramos, aho = ahorro25;
  const ejAhorro = 10000, cuotaAhorro = cuota(ahorro25, ejAhorro);
  // Reparto estatal/autonómico con la misma base de ejemplo en dos comunidades.
  const reparto = ["ES-MD", "ES-CT"].map(c => {
    const total = cuota(T.territorios[c].escala_combinada.tramos, ej);
    return { nombre: T.territorios[c].nombre, total, auto: total - cuotaEj };
  });
  const r2 = x => Math.round(x * 100) / 100;

  const cuerpo = `
  <p class="entradilla">El IRPF se calcula aplicando a la base liquidable una escala por tramos: cada tramo de renta paga su propio tipo y solo el exceso sobre el tramo anterior tributa al tipo siguiente. En el régimen común la escala tiene dos mitades, la del Estado y la de tu comunidad autónoma; el País Vasco y Navarra aplican su propia tarifa foral completa.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Escala estatal del IRPF ${igual26 ? "2025 y 2026" : "2025"}</h2>
    ${tablaEscala(e.estatal_2025.tramos)}
    ${igual26 ? `<p>En 2026 la escala estatal no cambia: los tramos y los tipos son los mismos que en 2025.</p>` : `<h3>Escala estatal 2026</h3>${tablaEscala(e.estatal_2026.tramos)}`}
    ${igual26 ? `<p><b>¿Y la escala del IRPF de 2024?</b> La escala estatal general es la misma: el ${lirpf("art. 63.1.1.º")} se modificó por última vez con efectos desde el 1 de enero de 2021 (${ULTIMA_REFORMA_ART63}). Los tramos estatales de 2024, 2025 y 2026 coinciden; lo que puede cambiar de un año a otro es la parte autonómica de cada comunidad.</p>` : ""}
    ${citaFuente(e.estatal_2025)}
    <p>Ejemplo: con una base liquidable general de ${euros(ej)}, la parte estatal de la cuota es de ${eur(Math.round(cuotaEj * 100) / 100)} antes de restar el mínimo personal y las deducciones. A esa cifra se le suma la parte autonómica, que depende de dónde vivas.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Tipos del IRPF por territorio en 2025 (estatal + autonómico)</h2>
    <p class="ayuda">Escala general combinada de cada territorio: el tipo del primer tramo, el tipo máximo y a partir de qué base se aplica. Cada territorio enlaza su tabla completa.</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Territorio</th><th class="num">Primer tramo</th><th class="num">Tipo máximo</th><th class="num">Desde</th><th class="num">Tramos</th></tr></thead><tbody>
    ${filas.map(f => `<tr><td><a href="${enlaceTerritorio(f.c)}">${esc(f.nombre)}</a></td><td class="num">${pct(f.min)}</td><td class="num">${pct(f.max)}</td><td class="num">${f.desde ? euros(f.desde) : "—"}</td><td class="num">${f.n}</td></tr>`).join("")}
    </tbody></table></div>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Tramos de las ganancias patrimoniales: escala del ahorro ${iguales(ahorro25, ahorro26) ? "2025 y 2026" : "2025"}</h2>
    <p>Los intereses, los dividendos y las ganancias patrimoniales por vender acciones, fondos o un inmueble tributan aparte, en la base del ahorro, con una escala igual en todas las comunidades de régimen común. Ya sumadas las partes estatal y autonómica:</p>
    ${tablaEscala(ahorro25, "Tramo de la base liquidable del ahorro")}
    ${iguales(ahorro25, ahorro26) ? "<p>En 2026 no cambia.</p>" : `<h3>2026</h3>${tablaEscala(ahorro26, "Tramo de la base liquidable del ahorro")}`}
    <p>Ejemplo: una ganancia patrimonial de ${euros(ejAhorro)} paga ${eur(r2(cuotaAhorro))} (los primeros ${euros(aho[0].hasta)} al ${pctCorto(aho[0].tipo)} y el resto al ${pctCorto(aho[1].tipo)}), sin sumarse al sueldo ni subir su tipo.</p>
    ${citaFuente(e.ahorro_estatal_2025)}${citaFuente(e.ahorro_autonomica_2025)}
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">IRPF estatal y autonómico: cómo se reparte</h2>
    <p>En las 15 comunidades de régimen común la cuota del IRPF tiene dos partes que se calculan por separado sobre la misma base liquidable y se suman:</p>
    <ul>
      <li><b>Parte estatal:</b> la escala del ${lirpf("art. 63")}, igual en toda España salvo en el País Vasco y Navarra.</li>
      <li><b>Parte autonómica:</b> la escala que aprueba cada comunidad (${lirpf("art. 74")}). Por eso el tipo máximo va del ${pctCorto(minT.max)} de ${esc(minT.nombre)} al ${pctCorto(maxT.max)} de ${esc(maxT.nombre)}.</li>
      <li>El mínimo personal y familiar se resta en las dos partes, y las comunidades pueden fijar su propio importe para la autonómica.</li>
      <li>Las deducciones autonómicas solo rebajan la parte autonómica de la cuota; las estatales, la estatal.</li>
      <li>En la base del ahorro, la parte estatal (${lirpf("art. 66")}) y la autonómica (${lirpf("art. 76")}) son iguales.</li>
    </ul>
    <p>Ejemplo con una base liquidable general de ${euros(ej)}, antes del mínimo y de las deducciones: la parte estatal es de ${eur(r2(cuotaEj))} en todas las comunidades; la autonómica, de ${reparto.map(x => `${eur(r2(x.auto))} en ${esc(x.nombre)} (total ${eur(r2(x.total))})`).join(" y de ")}.</p>
    <p>El País Vasco y Navarra no tienen parte estatal: aplican una sola tarifa foral completa.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">País Vasco: tarifa foral ${pv26 ? "2025 y 2026" : "2025"}</h2>
    <p>Bizkaia, Gipuzkoa y Araba/Álava tienen una tarifa armonizada.${pv26 ? " Para 2026 sus normas forales actualizan los tramos:" : ""}</p>
    <div class="dos-col"><div><h3>2025</h3>${tablaEscala(e.pais_vasco_2025.tramos)}${citaFuente(e.pais_vasco_2025)}</div>
    ${pv26 ? `<div><h3>2026</h3>${tablaEscala(e.pais_vasco_2026.tramos)}${citaFuente(e.pais_vasco_2026)}</div>` : ""}</div>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Navarra: tarifa foral ${nv26 ? "2025 y 2026" : "2025"}</h2>
    ${tablaEscala(e.navarra_2025.tramos)}
    ${nv26 ? "<p>En 2026 Navarra mantiene la misma tarifa.</p>" : `<h3>2026</h3>${tablaEscala(e.navarra_2026.tramos)}`}
    ${citaFuente(e.navarra_2025)}
  </div>
  ${cta("Calcula tu IRPF con tu sueldo", HERRAMIENTA.calculadora, ["Calcula tu sueldo neto", HERRAMIENTA.sueldoNeto])}`;

  const faq = [
    ["¿Los tramos del IRPF se aplican a todo el sueldo?", "No. Cada tipo se aplica solo a la parte de la base que cae dentro de su tramo. Pasar a un tramo superior no encarece lo que ya tributaba en los anteriores."],
    ["¿Cuál es el tipo máximo del IRPF en 2025?", `Depende del territorio. En el régimen común, sumando Estado y comunidad, el más alto es el de ${maxT.nombre} (${pct(maxT.max)}) y el más bajo, el de ${minT.nombre} (${pct(minT.max)}).`],
    ["¿Cambian los tramos del IRPF en 2026?", `${igual26 ? "La escala estatal es la misma en 2026." : "La escala estatal cambia en 2026."}${pv26 ? " En el País Vasco las normas forales de 2026 actualizan los tramos." : ""}${nv26 ? " Navarra mantiene su tarifa." : ""} Cada comunidad de régimen común puede modificar su parte autonómica en sus propias leyes.`],
    ["¿Qué es la base liquidable?", "Es lo que queda de tus ingresos después de restar los gastos deducibles (como la Seguridad Social), la reducción por rendimientos del trabajo y otras reducciones, como las aportaciones a planes de pensiones."],
    ...(igual26 ? [["¿Cuál era la escala estatal del IRPF en 2024?", `La misma que en 2025 y 2026: ${est.length} tramos, del ${pctCorto(est[0].tipo)} al ${pctCorto(est[est.length - 1].tipo)}. El art. 63.1.1.º de la Ley del IRPF no ha cambiado desde el 1 de enero de 2021 (art. 58 de la Ley 11/2020, BOE-A-2020-17339).`]] : []),
    ["¿Cómo tributan las ganancias patrimoniales en 2025?", `En la base del ahorro, con tramos del ${pctCorto(aho[0].tipo)} al ${pctCorto(aho[aho.length - 1].tipo)} (partes estatal y autonómica sumadas): ${aho.map((t, i) => i === 0 ? `${pctCorto(t.tipo)} hasta ${euros(t.hasta)}` : t.hasta == null ? `${pctCorto(t.tipo)} desde ${euros(aho[i - 1].hasta)}` : `${pctCorto(t.tipo)} hasta ${euros(t.hasta)}`).join(", ")}.`],
    ["¿Qué parte del IRPF es estatal y qué parte autonómica?", `En régimen común la cuota se calcula dos veces sobre la misma base, con la escala estatal y con la de tu comunidad, y se suman. Con ${euros(ej)} de base liquidable, la parte estatal es de ${eur(r2(cuotaEj))} antes del mínimo y de las deducciones.`]
  ];
  return pagina(g, { slug: "tramos-irpf-2025-2026", h1: "Tramos y escala del IRPF 2025 y 2026",
    titulo: "Tramos IRPF 2024, 2025 y 2026: escala estatal y del ahorro",
    description: `Escala estatal del IRPF (${pctCorto(est[0].tipo)} a ${pctCorto(est[est.length - 1].tipo)}, igual desde 2021), tramos del ahorro para ganancias patrimoniales (${pctCorto(aho[0].tipo)} a ${pctCorto(aho[aho.length - 1].tipo)}) y tabla de los 19 territorios.`,
    resumen: `la escala estatal del IRPF de 2025 y 2026 tiene ${est.length} tramos, del <b>${pctCorto(est[0].tipo)}</b> al <b>${pctCorto(est[est.length - 1].tipo)}</b>${igual26 ? " (la misma que en 2024)" : ""}. Sumada a la autonómica, el tipo máximo va del ${pctCorto(minT.max)} de ${esc(minT.nombre)} al ${pctCorto(maxT.max)} de ${esc(maxT.nombre)}. Las ganancias patrimoniales tributan aparte, del ${pctCorto(aho[0].tipo)} al ${pctCorto(aho[aho.length - 1].tipo)}.`,
    dataset: { nombre: "Escalas del IRPF 2025 y 2026: estatal, del ahorro, autonómicas y forales", descripcion: "Tramos y tipos marginales de la escala estatal general, la escala del ahorro y las escalas combinadas de los 19 territorios fiscales de España.",
      fuentes: [e.estatal_2025.norma, e.estatal_2025.fuente, e.ahorro_estatal_2025.norma, e.ahorro_estatal_2025.fuente, e.pais_vasco_2026.norma, e.pais_vasco_2026.fuente, e.navarra_2025.norma, "Ley 11/2020, art. 58 (BOE-A-2020-17339)"] },
    cuerpo, faq, generado: g.generado });
}

// ---- 2. Mínimo personal y familiar ---------------------------------------------------
function guiaMinimo(g) {
  const m = g.minimos, c = m.contribuyente, d = m.descendientes, a = m.ascendientes, di = m.discapacidad;
  const tipo1 = g.escalas.estatal_2025.tramos[0];
  const ahorro = c.general * tipo1.tipo;
  const igual26 = iguales(c, m.contribuyente_2026) && iguales(d, m.descendientes_2026);
  const v = (x, k, est) => x && x[k] != null ? eur(x[k]) : `<span class="ayuda">${eur(est)}</span>`;
  const filasAuto = m.autonomicos.map(t => `<tr><td><a href="${enlaceTerritorio(t.territorio)}">${esc(t.nombre)}</a></td><td class="num">${v(t.contribuyente, "general", c.general)}</td><td class="num">${v(t.descendientes?.importes, "1", d.importes["1"])}</td><td class="num">${v(t.descendientes?.importes, "3", d.importes["3"])}</td><td class="num">${v(t.descendientes, "incremento_menor_3_anios", d.incremento_menor_3_anios)}</td><td class="num">${v(t.discapacidad, "grado_33_64", di.grado_33_64)}</td></tr>`).join("");
  const cuerpo = `
  <p class="entradilla">El mínimo personal y familiar es la parte de la renta que la ley considera necesaria para vivir y que, por eso, no paga IRPF. No reduce tus ingresos: se calcula la cuota de ese importe con la escala y se resta de la cuota de tu base.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Mínimo del contribuyente</h2>
    <ul>
      <li><b>${eur(c.general)}</b> con carácter general.</li>
      <li>${eur(c.incremento_mayor_65)} más si tienes más de 65 años.</li>
      <li>${eur(c.incremento_mayor_75)} más, adicionales, si tienes más de 75.</li>
    </ul>
    ${citaFuente(c)}
    <p>¿Cuánto supone en dinero? En la escala estatal, los primeros ${euros(tipo1.hasta)} tributan al ${pct(tipo1.tipo)}: los ${eur(c.general)} del mínimo general equivalen a ${eur(Math.round(ahorro * 100) / 100)} menos de cuota estatal, más lo que suponga en la escala de tu comunidad.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Mínimo por descendientes</h2>
    <p>Por cada hijo menor de ${d.edad_maxima} años (o con discapacidad, a cualquier edad) que conviva contigo y no tenga rentas anuales superiores a ${eur(d.limite_rentas_descendiente)}:</p>
    <table class="cobertura"><thead><tr><th>Hijo</th><th class="num">Importe</th></tr></thead><tbody>
      <tr><td>Primero</td><td class="num">${eur(d.importes["1"])}</td></tr><tr><td>Segundo</td><td class="num">${eur(d.importes["2"])}</td></tr>
      <tr><td>Tercero</td><td class="num">${eur(d.importes["3"])}</td></tr><tr><td>Cuarto y siguientes</td><td class="num">${eur(d.importes["4+"])}</td></tr>
    </tbody></table>
    <p>Por cada hijo menor de 3 años se suman ${eur(d.incremento_menor_3_anios)}. El hijo no puede presentar su propia declaración con rentas superiores a ${eur(d.limite_declaracion_descendiente)}. Si los dos progenitores tienen derecho, se reparte a partes iguales.</p>
    ${citaFuente(d)}
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Mínimo por ascendientes y por discapacidad</h2>
    <ul>
      <li>Por cada ascendiente mayor de ${a.edad_minima} años (o con discapacidad) que conviva contigo y no tenga rentas superiores a ${eur(a.limite_rentas_ascendiente)}: ${eur(a.importe)}, y ${eur(a.incremento_mayor_75)} más si tiene más de 75.</li>
      <li>Por discapacidad del contribuyente: ${eur(di.grado_33_64)} con un grado de entre el 33 % y el 64 %, y ${eur(di.grado_65_mas)} desde el 65 %. Se suman ${eur(di.gastos_asistencia)} por gastos de asistencia si se acredita necesitar ayuda de terceros o movilidad reducida, o con un grado igual o superior al 65 %.</li>
    </ul>
    ${citaFuente(a)}${citaFuente(di)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Comunidades con mínimos propios (2025)</h2>
    <p class="ayuda">Para calcular la parte autonómica de la cuota, estas comunidades fijan sus propios importes. En gris, los que coinciden con los estatales.</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Comunidad</th><th class="num">Contribuyente</th><th class="num">1.er hijo</th><th class="num">3.er hijo</th><th class="num">Hijo &lt; 3 años</th><th class="num">Discapacidad 33-64 %</th></tr></thead><tbody>${filasAuto}</tbody></table></div>
    <p class="ayuda">Normas: ${esc(m.autonomicos.map(t => `${t.nombre}: ${t.norma}`).join(". "))}.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">País Vasco y Navarra</h2>
    <p>En los territorios forales las circunstancias familiares no reducen la base: se aplican como deducciones de la cuota. Puedes verlas en las páginas de <a href="/irpf/gipuzkoa/deducciones/">Gipuzkoa</a>, <a href="/irpf/bizkaia/deducciones/">Bizkaia</a> y <a href="/irpf/navarra/deducciones/">Navarra</a>.</p>
  </div>
  ${igual26 ? "<p>En 2026 los importes estatales del mínimo personal y familiar no cambian.</p>" : ""}
  ${cta("Calcula tu IRPF con tu familia", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Cuánto es el mínimo personal en 2025?", `${eur(c.general)} con carácter general; ${eur(c.general + c.incremento_mayor_65)} desde los 65 años y ${eur(c.general + c.incremento_mayor_65 + c.incremento_mayor_75)} desde los 75, salvo en las comunidades con importes propios.`],
    ["¿El mínimo personal se resta del sueldo?", "No exactamente. Se calcula el impuesto que corresponde al importe del mínimo con la escala y se resta de la cuota. En la práctica, esa parte de la renta tributa al 0 %."],
    ["¿Quién aplica el mínimo por hijos si los padres declaran por separado?", "Se reparte a partes iguales entre los progenitores que convivan con el hijo y tengan derecho a aplicarlo."]
  ];
  return pagina(g, { slug: "minimo-personal-familiar", h1: "Mínimo personal y familiar del IRPF (2025)",
    titulo: `Mínimo personal y familiar 2025: ${euros(c.general)} e importes por hijo`,
    resumen: `el mínimo personal del IRPF de 2025 es de <b>${eur(c.general)}</b> (${eur(c.general + c.incremento_mayor_65)} desde los 65 años) y se suman ${eur(d.importes["1"])} por el primer hijo, ${eur(d.importes["2"])} por el segundo y ${eur(d.importes["3"])} por el tercero, tanto en el gravamen estatal como en el autonómico, salvo en las comunidades con importes propios.`,
    dataset: { nombre: "Mínimo personal y familiar del IRPF 2025", descripcion: "Importes del mínimo del contribuyente, por descendientes, ascendientes y discapacidad (estatal y autonómicos).", fuentes: [c.norma, c.fuente, d.norma, a.norma, di.norma] },
    description: `Mínimo personal y familiar del IRPF 2025 (gravamen estatal y autonómico): ${euros(c.general)} por contribuyente, ${euros(d.importes["1"])} por el primer hijo, mayores y discapacidad.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 3. Plan de pensiones -------------------------------------------------------------
function guiaPensiones(g) {
  const p = g.prevision_social, r = p.reduccion;
  const total = r.limite_general_abs + r.incremento_contribucion_empresarial;
  const igual26 = iguales(r, p.reduccion_2026);
  const sal = Object.keys(p.ahorro);
  // Solo los territorios donde el motor aplica la reducción (con ahorro en algún sueldo).
  const conAhorro = ORDEN_TERRITORIOS.filter(c => sal.some(s => p.ahorro[s].find(x => x.territorio === c).ahorro > 0));
  const filas = conAhorro.map(c => `<tr><td><a href="${enlaceTerritorio(c)}">${esc(p.ahorro[sal[0]].find(x => x.territorio === c).nombre)}</a></td>${sal.map(s => `<td class="num">${eur(p.ahorro[s].find(x => x.territorio === c).ahorro)}</td>`).join("")}</tr>`).join("");
  const mad = p.ahorro[sal[1]].find(x => x.territorio === "ES-MD");
  const cuerpo = `
  <p class="entradilla">Lo que aportas a un plan de pensiones se resta de tu base imponible general. Por eso desgrava a tu tipo marginal: cuanto más ganas, más impuesto te ahorras por cada euro aportado. Y cuenta en el año en que lo aportas: para que reduzca el IRPF de este año, la aportación tiene que estar hecha antes del 31 de diciembre.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Cuánto puedes aportar con derecho a reducción</h2>
    <ul>
      <li>Aportaciones propias: hasta <b>${eur(r.limite_general_abs)}</b> al año, sin pasar del ${pctCorto(r.limite_general_pct_rend)} de tus rendimientos netos del trabajo y de actividades económicas.</li>
      <li>Ese límite sube hasta ${eur(r.incremento_contribucion_empresarial)} más con las contribuciones de tu empresa a un plan de empleo: en total, hasta ${eur(total)}.</li>
      <li>Al plan de tu cónyuge, hasta ${eur(r.limite_aportacion_conyuge)} al año si sus rendimientos netos del trabajo y de actividades son inferiores a ${eur(r.rentas_conyuge_maximas)}.</li>
    </ul>
    ${citaFuente(r)}
    <p>Lo que no puedas reducir por superar el límite del ${pctCorto(r.limite_general_pct_rend)} o por no tener base suficiente se puede aplicar en los cinco ejercicios siguientes (${lirpf("art. 52.2")}).${igual26 ? " En 2026 los límites son los mismos." : ""}</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Cuánto te ahorras aportando ${euros(p.aportacion_ejemplo)} (2025)</h2>
    <p class="ayuda">Diferencia de cuota calculada con el motor de Mapafiscal, con y sin la aportación. Caso de referencia: ${esc(p.supuesto)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Territorio</th>${sal.map(s => `<th class="num">Sueldo de ${euros(Number(s))}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div>
    <p>Por ejemplo, en ${esc(mad.nombre)} y con ${euros(Number(sal[1]))} brutos, aportar ${euros(p.aportacion_ejemplo)} rebaja el IRPF en ${eur(mad.ahorro)}.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Antes de aportar, ten en cuenta</h2>
    <ul>
      <li>El ahorro es en parte un aplazamiento: cuando rescates el plan, lo que cobres tributará como rendimiento del trabajo en el año del cobro (${lirpf("art. 17.2.a)")}).</li>
      <li>Para aplicar la reducción hay que presentar la declaración, aunque no estés obligado (ver <a href="/guias/obligacion-declarar-renta/">¿Estoy obligado a declarar?</a>).</li>
      <li>En el País Vasco y Navarra los límites son los de su normativa foral.</li>
    </ul>
  </div>
  ${cta("Simula tu aportación al plan de pensiones", HERRAMIENTA.planPensiones, ["Calcula tu renta completa", HERRAMIENTA.calculadora])}`;
  const faq = [
    ["¿Hasta cuándo puedo aportar al plan de pensiones para desgravar este año?", "Hasta el 31 de diciembre: la reducción se aplica en el ejercicio en que se hace la aportación. Conviene no apurar, porque la gestora necesita unos días para tramitarla."],
    ["¿Cuánto desgrava un plan de pensiones?", `Las aportaciones propias reducen la base hasta ${eur(r.limite_general_abs)} al año (con el límite del ${pctCorto(r.limite_general_pct_rend)} de los rendimientos del trabajo y de actividades). El ahorro depende de tu tipo marginal: con ${euros(Number(sal[1]))} de sueldo en ${mad.nombre}, aportar ${euros(p.aportacion_ejemplo)} ahorra ${eur(mad.ahorro)}.`],
    ["¿Puedo aportar más de 1.500 euros?", `Puedes aportar más, pero solo reduce la base lo que esté dentro del límite. Con un plan de empleo de la empresa, el límite conjunto llega a ${eur(total)}.`]
  ];
  return pagina(g, { slug: "plan-pensiones-desgravar", h1: "Plan de pensiones: cuánto desgrava antes del 31 de diciembre",
    titulo: `Cuánto desgrava un plan de pensiones 2025: hasta ${euros(r.limite_general_abs)}`,
    resumen: `las aportaciones a un plan de pensiones reducen la base hasta <b>${eur(r.limite_general_abs)}</b> al año (${eur(total)} con plan de empleo). Con ${euros(Number(sal[1]))} brutos en ${esc(mad.nombre)}, aportar ${euros(p.aportacion_ejemplo)} rebaja el IRPF en <b>${eur(mad.ahorro)}</b>.`,
    description: `Plan de pensiones antes del 31 de diciembre: desgrava hasta ${euros(r.limite_general_abs)} (${euros(total)} con plan de empleo). Con ${euros(Number(sal[1]))} en Madrid ahorras ${euros(mad.ahorro)}. Por comunidad.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 4. Donativos ----------------------------------------------------------------------
function guiaDonativos(g) {
  const d = g.donativos.estatal, l = d.ley49_2002;
  const ded = (x, rec) => Math.min(x, l.tramo1_limite) * l.tramo1_porcentaje + Math.max(0, x - l.tramo1_limite) * (rec ? l.resto_porcentaje_recurrente : l.resto_porcentaje);
  const ejemplos = [100, l.tramo1_limite, 500, 1000];
  const igual26 = iguales(d, g.donativos.estatal_2026);
  const cuerpo = `
  <p class="entradilla">Los donativos a ONG, fundaciones y demás entidades acogidas a la Ley 49/2002 de mecenazgo dan derecho a una deducción en la cuota del IRPF. Los primeros euros son los que más desgravan.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Porcentajes de deducción</h2>
    <ul>
      <li><b>${pctCorto(l.tramo1_porcentaje)}</b> de los primeros ${eur(l.tramo1_limite)} donados en el año.</li>
      <li><b>${pctCorto(l.resto_porcentaje)}</b> de lo que exceda de ${eur(l.tramo1_limite)}.</li>
      <li><b>${pctCorto(l.resto_porcentaje_recurrente)}</b> en lugar del ${pctCorto(l.resto_porcentaje)} si en los dos años anteriores donaste a la misma entidad un importe igual o mayor (donación recurrente).</li>
    </ul>
    <p>La base de la deducción no puede superar el ${pctCorto(l.limite_base_liquidable_pct)} de tu base liquidable.</p>
    ${citaFuente(d)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplos</h2>
    <table class="cobertura"><thead><tr><th class="num">Donas al año</th><th class="num">Te deduces</th><th class="num">Si es recurrente</th><th class="num">Te cuesta de verdad</th></tr></thead><tbody>
    ${ejemplos.map(x => `<tr><td class="num">${eur(x)}</td><td class="num">${eur(ded(x, false))}</td><td class="num">${eur(ded(x, true))}</td><td class="num">${eur(x - ded(x, false))}</td></tr>`).join("")}
    </tbody></table>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Otras donaciones y aportaciones</h2>
    <ul>
      <li>Donativos a fundaciones y asociaciones de utilidad pública no incluidas en la Ley 49/2002: ${pctCorto(d.otras_fundaciones_porcentaje)}.</li>
      <li>Cuotas de afiliación y aportaciones a partidos políticos: ${pctCorto(d.cuotas_afiliacion_partidos.porcentaje)}, con una base máxima de ${eur(d.cuotas_afiliacion_partidos.base_maxima)} al año.</li>
      <li>Algunas comunidades añaden deducciones propias por donativos (por ejemplo, a entidades de su territorio). En el País Vasco y Navarra rige su propia ley de mecenazgo.</li>
    </ul>
    <p class="ayuda">Norma: ${lirpf("art. 68.3")}. ${igual26 ? "En 2026 los porcentajes no cambian." : ""}</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cómo se aplica en la declaración</h2>
    <p>Las entidades informan a Hacienda de los donativos que reciben, así que suelen aparecer ya en los datos fiscales del borrador. Comprueba que están todos, sobre todo si has donado a varias entidades, y guarda el certificado de cada una.</p>
  </div>
  ${cta("Calcula tu renta con tus donativos", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Cuánto me devuelve Hacienda si dono 250 euros?", `Te deduces el ${pctCorto(l.tramo1_porcentaje)}: ${eur(ded(250, false))}. El donativo te cuesta en realidad ${eur(250 - ded(250, false))}.`],
    ["¿Qué es una donación recurrente?", `La que haces a la misma entidad por tercer año seguido con un importe igual o mayor que en los dos años anteriores. Lo que pase de ${eur(l.tramo1_limite)} deduce el ${pctCorto(l.resto_porcentaje_recurrente)} en lugar del ${pctCorto(l.resto_porcentaje)}.`],
    ["¿Hay un límite para deducir donativos?", `Sí: la base de la deducción no puede pasar del ${pctCorto(l.limite_base_liquidable_pct)} de tu base liquidable. Y la deducción solo puede rebajar la cuota hasta cero: no se devuelve lo que no se pueda aplicar.`]
  ];
  return pagina(g, { slug: "deduccion-donativos", h1: "Deducción por donativos en el IRPF",
    titulo: `Deducción por donativos 2025: ${pctCorto(l.tramo1_porcentaje)} de los primeros ${euros(l.tramo1_limite)}`,
    resumen: `donar a una ONG acogida a la Ley 49/2002 deduce el <b>${pctCorto(l.tramo1_porcentaje)}</b> de los primeros ${eur(l.tramo1_limite)} y el ${pctCorto(l.resto_porcentaje)} del resto (${pctCorto(l.resto_porcentaje_recurrente)} si es recurrente): 250 € donados te cuestan ${eur(250 - ded(250, false))}.`,
    description: `Cuánto desgravan los donativos a ONG y fundaciones en el IRPF: ${pctCorto(l.tramo1_porcentaje)} de los primeros ${euros(l.tramo1_limite)}, ${pctCorto(l.resto_porcentaje)} del resto (${pctCorto(l.resto_porcentaje_recurrente)} si es recurrente), límites y ejemplos.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 5. Obligación de declarar ---------------------------------------------------------
function guiaObligacion(g) {
  const o = g.obligacion_declarar.estatal;
  const igual26 = iguales(o, g.obligacion_declarar.estatal_2026);
  const cuerpo = `
  <p class="entradilla">No todo el mundo tiene que presentar la declaración de la renta. La ley fija unos límites de ingresos por debajo de los cuales no es obligatorio, aunque a veces conviene presentarla igualmente para recuperar retenciones.</p>
  <div class="tarjeta">
    <h2 class="rotulo">No estás obligado si solo tienes estas rentas (2025)</h2>
    <ul>
      <li>Rendimientos del trabajo de hasta <b>${eur(o.trabajo_un_pagador)}</b> al año, si vienen de un solo pagador.</li>
      <li>Hasta <b>${eur(o.trabajo_varios_pagadores)}</b> si tienes más de un pagador y lo que cobras del segundo y siguientes suma más de ${eur(o.segundo_pagador_umbral)}. Este límite también se aplica, entre otros casos, si cobras una pensión compensatoria o anualidades por alimentos, o si tu pagador no está obligado a retener (${lirpf("art. 96.3")}).</li>
      <li>Rendimientos del capital mobiliario y ganancias patrimoniales sometidos a retención (intereses, dividendos, fondos) de hasta ${eur(o.capital_y_ganancias_con_retencion)}.</li>
      <li>Rentas inmobiliarias imputadas (segundas viviendas), rendimientos de Letras del Tesoro y ayudas públicas para vivienda protegida de hasta ${eur(o.rentas_inmobiliarias_imputadas)} en conjunto.</li>
      <li>Tampoco si la suma de rendimientos del trabajo, del capital, de actividades y de ganancias no pasa de ${eur(o.rentas_totales_minimas)} y las pérdidas patrimoniales son inferiores a ${eur(o.perdidas_patrimoniales_maximas)}.</li>
    </ul>
    ${citaFuente(o)}
    ${igual26 ? "<p>Para 2026 los límites son los mismos.</p>" : ""}
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Tienes que declarar en todo caso si…</h2>
    <ul>
      <li>Has estado de alta como autónomo en el RETA en algún momento del año.</li>
      <li>Quieres aplicar la deducción por vivienda habitual del régimen transitorio (compras anteriores a 2013) o reducir la base por aportaciones a planes de pensiones.</li>
    </ul>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Aunque no estés obligado, puede salirte a devolver</h2>
    <p>Si tu empresa te ha retenido más de lo que te corresponde pagar, solo recuperas la diferencia presentando la declaración. Pasa a menudo con sueldos bajos, contratos de pocos meses o cambios de empleo. Haz la prueba en la calculadora: te dice si estás obligado y cuánto te sale.</p>
    <p>En el País Vasco y Navarra los límites los fija su normativa foral.</p>
  </div>
  ${cta("Comprueba si te sale a devolver", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Con cuánto dinero estoy obligado a hacer la renta?", `Con un solo pagador, si tus rendimientos del trabajo superan ${eur(o.trabajo_un_pagador)} al año. Con dos o más pagadores, si superan ${eur(o.trabajo_varios_pagadores)} y el segundo y siguientes suman más de ${eur(o.segundo_pagador_umbral)}.`],
    ["Si tengo dos pagadores, ¿siempre tengo que declarar?", `No. Si el segundo y siguientes pagadores suman ${eur(o.segundo_pagador_umbral)} o menos, el límite sigue siendo ${eur(o.trabajo_un_pagador)}. Si suman más, baja a ${eur(o.trabajo_varios_pagadores)}.`],
    ["¿Me conviene presentar la declaración si no estoy obligado?", "Sí, si te han retenido más de lo que te corresponde: solo así te devuelven la diferencia. Si te sale a pagar y no estás obligado, no tienes que presentarla."]
  ];
  return pagina(g, { slug: "obligacion-declarar-renta", h1: "¿Estoy obligado a hacer la declaración de la renta?",
    titulo: `¿Obligado a hacer la renta 2025? Límite de ${euros(o.trabajo_un_pagador)}`,
    resumen: `en la renta de 2025 no tienes que declarar si solo cobras un sueldo de hasta <b>${eur(o.trabajo_un_pagador)}</b> de un pagador, o de hasta <b>${eur(o.trabajo_varios_pagadores)}</b> si el segundo pagador y siguientes suman más de ${eur(o.segundo_pagador_umbral)}.`,
    description: `Quién tiene que hacer la renta 2025: ${euros(o.trabajo_un_pagador)} con un pagador, ${euros(o.trabajo_varios_pagadores)} con dos si el segundo pasa de ${euros(o.segundo_pagador_umbral)}, y cuándo conviene declarar igualmente.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 6. Calendario ----------------------------------------------------------------------
function guiaCalendario(g) {
  const c = [...g.calendario].sort((a, b) => b.ejercicio - a.ejercicio)[0];
  const f = c.fraccionamiento;
  const cuerpo = `
  <p class="entradilla">La declaración de la renta de un año se presenta en la primavera del año siguiente. Cada campaña, una orden del Ministerio de Hacienda publicada en el BOE fija las fechas. Estas son las de la última campaña, la de la renta ${c.ejercicio}.</p>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Campaña de la renta ${c.ejercicio}</h2>
    <table class="cobertura"><thead><tr><th>Qué</th><th>Fecha</th></tr></thead><tbody>
      <tr><td>Empieza el plazo para presentar el borrador y la declaración, salga a pagar o a devolver</td><td>${fecha(c.inicio)}</td></tr>
      <tr><td>Último día para domiciliar el pago en tu banco</td><td>${fecha(c.fin_domiciliacion)}</td></tr>
      <tr><td>Último día para presentar la declaración</td><td>${fecha(c.fin)}</td></tr>
      <tr><td>Último día para domiciliar si solo domicilias el segundo plazo</td><td>${fecha(c.fin_domiciliacion_solo_segundo_plazo)}</td></tr>
      <tr><td>Cargo del segundo plazo domiciliado (${pctCorto(f.segundo_plazo_pct)})</td><td>${fecha(f.cargo_segundo_plazo_domiciliado)}</td></tr>
      <tr><td>Último día para pagar el segundo plazo sin domiciliar</td><td>${fecha(f.segundo_plazo_hasta)}</td></tr>
    </tbody></table>
    <p class="ayuda">Norma: ${esc(c.norma)}. Fuente: <a href="${urlBoe(c.boe)}" rel="noopener">${esc(c.fuente)}</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Pagar en dos plazos</h2>
    <p>Si te sale a pagar, puedes fraccionar el pago sin intereses ni recargo: el ${pctCorto(f.primer_plazo_pct)} al presentar la declaración y el ${pctCorto(f.segundo_plazo_pct)} restante hasta el ${fecha(f.segundo_plazo_hasta)}. Para fraccionar, tienes que presentar la declaración dentro de plazo.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Fechas que importan durante el año</h2>
    <ul>
      <li><b>31 de diciembre:</b> el IRPF se calcula por años naturales (${lirpf("art. 12")}). Lo que quieras que cuente en la renta del año (aportaciones a planes de pensiones, donativos, gastos con derecho a deducción) tiene que estar pagado antes de que acabe. Ver <a href="/guias/plan-pensiones-desgravar/">cuánto desgrava un plan de pensiones</a>.</li>
      <li><b>Primavera:</b> campaña de la renta del año anterior, normalmente de abril a finales de junio.</li>
      <li><b>Noviembre:</b> segundo plazo para quien fraccionó el pago.</li>
    </ul>
    <p>La orden de cada campaña sale en el BOE antes de que empiece; la de la renta ${c.ejercicio} se publicó el ${fecha(c.publicada)}. En cuanto se publique la de la campaña siguiente, actualizaremos esta página.</p>
  </div>
  ${cta("Calcula ya tu próxima renta", HERRAMIENTA.calculadora, ["¿Estoy obligado a declarar?", "/guias/obligacion-declarar-renta/"])}`;
  const faq = [
    [`¿Cuándo empezó la campaña de la renta ${c.ejercicio}?`, `El ${fecha(c.inicio)}, y terminó el ${fecha(c.fin)}. Si querías domiciliar el pago, el último día era el ${fecha(c.fin_domiciliacion)}.`],
    ["¿Se puede pagar la renta en dos veces?", `Sí: el ${pctCorto(f.primer_plazo_pct)} al presentar y el ${pctCorto(f.segundo_plazo_pct)} hasta el ${fecha(f.segundo_plazo_hasta)}, sin intereses, si presentas la declaración dentro de plazo.`],
    ["¿Cuándo es la próxima campaña de la renta?", "Las fechas las fija cada año una orden del Ministerio de Hacienda que se publica en el BOE antes de que empiece la campaña, normalmente en primavera. En cuanto salga, la recogemos aquí."]
  ];
  return pagina(g, { slug: "calendario-renta", h1: "Calendario de la declaración de la renta",
    titulo: `Fechas de la declaración de la renta ${c.ejercicio}: calendario`,
    resumen: `la campaña de la renta ${c.ejercicio} fue del <b>${fecha(c.inicio)}</b> al <b>${fecha(c.fin)}</b>; para domiciliar el pago, hasta el ${fecha(c.fin_domiciliacion)}, y el segundo plazo, hasta el ${fecha(f.segundo_plazo_hasta)}.`,
    description: `Renta ${c.ejercicio}: del ${fechaSinAnio(c.inicio)} al ${fecha(c.fin)}; domiciliación hasta el ${fechaSinAnio(c.fin_domiciliacion)} y segundo plazo el ${fechaSinAnio(f.segundo_plazo_hasta)}. Fechas con la orden del BOE.`,
    cuerpo, faq, generado: g.generado });
}

export const GUIAS = [
  { slug: "tramos-irpf-2025-2026", enlace: "Tramos del IRPF 2025 y 2026", resumen: "Escala estatal, del ahorro y de cada territorio.", fn: guiaTramos },
  { slug: "minimo-personal-familiar", enlace: "Mínimo personal y familiar", resumen: "Cuánto de tu renta no paga IRPF por ti, tus hijos y tus mayores.", fn: guiaMinimo },
  { slug: "plan-pensiones-desgravar", enlace: "Plan de pensiones: cuánto desgrava", resumen: "Límites y ahorro real en cada territorio si aportas antes del 31 de diciembre.", fn: guiaPensiones },
  { slug: "deduccion-donativos", enlace: "Deducción por donativos", resumen: "El 80 % de los primeros 250 € y el resto, con ejemplos.", fn: guiaDonativos },
  { slug: "obligacion-declarar-renta", enlace: "¿Estoy obligado a declarar?", resumen: "Límites de ingresos y cuándo conviene declarar aunque no sea obligatorio.", fn: guiaObligacion },
  { slug: "calendario-renta", enlace: "Calendario de la renta", resumen: "Fechas de la campaña, domiciliación y pago en dos plazos.", fn: guiaCalendario }
];

export function paginasGuias(g, T) {
  const paginas = GUIAS.map(x => x.fn(g, T));
  const migas = [["Inicio", "/"], ["Guías del IRPF", "/guias/"]];
  const main = `
  <h1>Guías del IRPF</h1>
  <p class="entradilla">Lo esencial de la renta explicado con las cifras oficiales de cada año y su norma: tramos, mínimos, deducciones y fechas. Todo enlaza con la calculadora para que lo apliques a tu caso.</p>
  <div class="prosa">
  <div class="tarjeta"><ul class="lista-guias">${GUIAS.map(x => `<li><a href="/guias/${x.slug}/">${esc(x.enlace)}</a><span>${esc(x.resumen)}</span></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Por territorio</h2><p>Tramos, mínimo y deducciones de cada comunidad autónoma, del País Vasco y de Navarra: <a href="/irpf/">IRPF por territorio</a>. Y si quieres comparar: <a href="/comparar-sueldo/">dónde se paga menos IRPF con tu sueldo</a>.</p></div>
  ${cta("Calcula tu IRPF", HERRAMIENTA.calculadora, ["Calcula tu sueldo neto", HERRAMIENTA.sueldoNeto])}
  </div>`;
  const description = "Guías del IRPF con cifras oficiales: tramos 2025 y 2026, mínimo personal, plan de pensiones, donativos, quién declara y fechas de la renta. Gratis.";
  paginas.push({ ruta: "/guias/", html: layout({
    title: "Guías del IRPF 2025 y 2026: tramos, mínimos y fechas", description,
    canonical: "/guias/", breadcrumb: migasHtml(migas), main, generado: g.generado, css: ["/css/guias.css"],
    jsonld: [jsonLdMigas(migas)] }) });
  return paginas;
}
