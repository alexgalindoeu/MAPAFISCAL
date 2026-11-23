// =============================================================================
// Página propia de cada deducción: /irpf/<territorio>/deducciones/<slug>/.
//
// Parte de lo que ya redacta tools/seo_deducciones.mjs (que solo publica lo `confirmado`,
// con fuente primaria y con todos sus supuestos confirmados): aquí no se añade ningún
// requisito ni ninguna cifra que no salga de web/datos/seo_deducciones.json o de
// web/datos/params_<año>.json. Los ejemplos salen del motor (web/js/irpfsim.js) y solo se
// publican si la diferencia de cuota que da el motor coincide al céntimo con el importe que
// resulta de los parámetros (si no cuadra, no hay ejemplo).
// =============================================================================
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SLUG, HERRAMIENTA, NOMBRE_CORTO, MAX_DESCRIPCION, esc, eurosExactos, pctTipo,
  layout, jsonLdMigas, jsonLdFaq, jsonLdArticulo, bloqueFaq, migasHtml, respuestaDirecta, tituloQueQuepa
} from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const motor = require(join(WEB, "js", "irpfsim.js"));
const eur = eurosExactos;
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);

export function paramsDe(ejercicio) {
  const f = join(WEB, "datos", `params_${ejercicio}.json`);
  const P = JSON.parse(readFileSync(existsSync(f) ? f : join(WEB, "datos", "params.json"), "utf8"));
  return P.ejercicio === ejercicio ? P : null;
}

// Nombre con artículo cuando lo lleva: «la Comunidad de Madrid», «el Principado de Asturias».
export const conArticulo = n => /^(Comunidad|Comunitat|Región) /.test(n) ? "la " + n : /^Principado /.test(n) ? "el " + n : n;
export const conDe = n => { const a = conArticulo(n); return a.startsWith("el ") ? "del " + a.slice(3) : "de " + a; };
export const conEn = n => "en " + conArticulo(n);

// Tipo de deducción, para enlazar la misma deducción en otros territorios.
const TIPOS = [
  ["alquiler", /alquiler|arrendamiento/i],
  ["nacimiento", /nacimiento|adopci/i],
  ["familia-numerosa", /familia numerosa/i],
  ["monoparental", /monoparental/i],
  ["cuidado-hijos", /guarder|custodia|cuidado de hijos/i],
  ["material-escolar", /libros de texto|material escolar/i],
  ["gastos-educativos", /gastos educativos/i],
  ["discapacidad", /discapacidad/i],
  ["ascendientes", /ascendiente/i],
  ["descendientes", /^por descendientes$/i],
  ["ayuda-domestica", /ayuda doméstica/i],
  ["deporte", /ejercicio físico|deport/i],
  ["rehabilitacion", /rehabilitación/i],
  ["adquisicion-vivienda", /adquisición de vivienda/i]
];
export const tipoDe = titulo => (TIPOS.find(([, re]) => re.test(titulo)) || [null])[0];

// «Por alquiler de la vivienda habitual» -> «Deducción por alquiler de la vivienda habitual».
const nombreDeduccion = titulo => /^(Por|Para) /.test(titulo) ? "Deducción " + titulo.charAt(0).toLowerCase() + titulo.slice(1) : titulo;
const VACIAS = new Set(["de", "del", "la", "las", "el", "los", "a", "y", "e", "o", "u", "por", "para", "en", "con", "que", "un", "una"]);
// Nombre corto, solo para el <title> y el <h1> cuando el oficial no cabe.
const CORTOS = [
  [/lengua catalana/i, "donativos a la lengua catalana"], [/investigación/i, "donativos a la investigación"],
  [/cooperativas agrarias/i, "inversión en cooperativas"], [/condición de familia numerosa/i, "familia numerosa"],
  [/libros de texto|material escolar/i, "material escolar"], [/^Por ascendientes/i, "ascendientes"],
  [/nacimiento o adopción/i, "nacimiento o adopción"], [/acogimiento/i, "nacimiento, adopción o acogimiento"],
  [/patrimonios protegidos/i, "patrimonios protegidos"], [/discapacidad o dependencia/i, "discapacidad"]
];
function tituloPagina(titulo, corto, anio, ocupados) {
  const n = nombreDeduccion(titulo);
  const vars = [`${n} en ${corto} (renta ${anio})`, `${n} en ${corto} ${anio}`];
  const c = CORTOS.find(([re]) => re.test(titulo));
  if (c) vars.push(`Deducción por ${c[1]} en ${corto} (renta ${anio})`, `Deducción por ${c[1]} en ${corto} ${anio}`);
  // recorte por palabras, sin terminar en preposición o artículo
  const pal = n.replace(/\s*\(.*?\)/g, "").split(" ");
  for (let k = pal.length; k >= 3; k--) {
    let p = pal.slice(0, k); while (p.length > 2 && VACIAS.has(p[p.length - 1].toLowerCase())) p = p.slice(0, -1);
    vars.push(`${p.join(" ")} en ${corto} (renta ${anio})`, `${p.join(" ")} en ${corto} ${anio}`);
  }
  const libres = vars.filter(v => v.length <= 65 && !ocupados.has(v));
  return libres[0] || tituloQueQuepa(...vars);
}

// ---- ejemplos con el motor (solo régimen común) ---------------------------------------
// Claves con las que se sabe montar un hogar que cumple el supuesto.
const CLAVES_EJEMPLO = new Set(["id", "norma", "estado", "fuente", "tipo", "campo", "porcentaje", "limite", "limite_conjunta",
  "base_maxima", "edad_max", "base_gate", "suma_bases", "base_max_individual", "base_max_conjunta", "base_ahorro_max", "grupo", "prorratea_progenitores", "factor_discapacidad"]);
const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function hogar(codigo, P, ejercicio, salario, edad, campo, gasto) {
  const m = { id: "d1", rol: "declarante", edad, discapacidad: "no",
    trabajo: { dinerarias: salario, cotizacionesSs: motor.cotizacionesTrabajador(salario, P) } };
  if (campo) m[camel(campo)] = gasto;
  return { territorio: codigo, ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no", miembros: [m] };
}
const red2 = x => Math.round(x * 100) / 100;

export function ejemplos(codigo, ficha, P) {
  if (!P) return [];
  const lista = P.territorios[codigo]?.deducciones_autonomicas?.lista || [];
  for (const s of ficha.supuestos) {
    const d = lista.find(x => x.id === s.id);
    if (!d || d.estado !== "confirmado" || d.tipo !== "porcentaje_campo") continue;
    if (Object.keys(d).some(k => !CLAVES_EJEMPLO.has(k))) continue;
    const edad = d.edad_max != null ? d.edad_max - 6 : 40;
    // un gasto por debajo del límite y otro que lo supera
    const gastos = d.limite != null ? [Math.round(d.limite / d.porcentaje / 2 / 100) * 100, Math.round(d.limite / d.porcentaje * 1.5 / 100) * 100] : [3000];
    const out = [];
    for (const gasto of gastos) {
      if (!(gasto > 0)) continue;
      for (const salario of [22000, 18000]) {
        let a, b;
        try {
          a = motor.liquidar(hogar(codigo, P, P.ejercicio, salario, edad, d.campo, 0), P, "individual");
          b = motor.liquidar(hogar(codigo, P, P.ejercicio, salario, edad, d.campo, gasto), P, "individual");
        } catch (e) { continue; }
        const base = d.base_maxima != null ? Math.min(gasto, d.base_maxima) : gasto;
        const esperado = red2(d.limite != null ? Math.min(base * d.porcentaje, d.limite) : base * d.porcentaje);
        const delta = red2(a.cuotaLiquidaTotal - b.cuotaLiquidaTotal);
        if (delta > 0 && Math.abs(delta - esperado) < 0.005) { out.push({ salario, edad, gasto, delta, d, tope: d.limite != null && base * d.porcentaje > d.limite }); break; }
      }
    }
    if (out.length) return out;
  }
  return [];
}

// Deducciones por hijos (nacimiento, material escolar, guardería): una familia monoparental con
// un hijo y tributación individual. Se publica solo si el importe que aplica el motor para esa
// deducción coincide al céntimo con el que sale de los parámetros y la cuota autonómica no se
// queda en cero (es decir, la deducción se aplica entera).
const CLAVES_FAMILIAR = new Set(["id", "norma", "estado", "fuente", "tipo", "importe", "importe_multiple", "multiple_por_hijo",
  "importes_por_orden", "anios_ventana", "grupo", "prorratea_progenitores", "suma_bases", "base_max_individual", "base_max_conjunta",
  "edad_hijo_min", "edad_hijo_max", "campo", "porcentaje", "limite", "requiere_monoparental", "familia_numerosa_categoria",
  "base_gate", "base_max_por_miembro_uf", "miembros_uf_hijos_edad_max", "descendiente_edad_max", "requiere_progenitores_trabajan",
  "factor_discapacidad", "duplica_hijo_discapacidad", "campos", "limite_si_campo", "primer_ciclo"]);
const TIPOS_FAMILIAR = ["fija_por_hijo_nacido", "fija_por_hijo", "porcentaje_campo_hijo", "porcentaje_campo", "porcentaje_campos_hijo"];
export function ejemploFamiliar(codigo, ficha, P) {
  if (!P) return null;
  const lista = P.territorios[codigo]?.deducciones_autonomicas?.lista || [];
  for (const s of ficha.supuestos) {
    const d = lista.find(x => x.id === s.id);
    if (!d || d.estado !== "confirmado" || !TIPOS_FAMILIAR.includes(d.tipo)) continue;
    // porcentaje_campo: solo los gastos por tener un hijo (p. ej. su cuidado), que paga el progenitor
    if (d.tipo === "porcentaje_campo" && d.descendiente_edad_max == null) continue;
    if (Object.keys(d).some(k => !CLAVES_FAMILIAR.has(k))) continue;
    if (d.familia_numerosa_categoria != null && d.familia_numerosa_categoria !== "no") continue;
    if (d.tipo === "fija_por_hijo_nacido" && (d.anios_ventana || 1) !== 1) continue;
    const nacido = d.tipo === "fija_por_hijo_nacido";
    const edadHijo = nacido ? 0 : Math.min(Math.max(8, d.edad_hijo_min ?? 0), d.edad_hijo_max ?? 8, d.descendiente_edad_max ?? 8);
    // porcentaje_campos_hijo: un solo gasto, el de mayor porcentaje que no cambia el límite,
    // con un hijo que no está en el primer ciclo
    let campo = d.campo, porcentaje = d.porcentaje;
    if (d.tipo === "porcentaje_campos_hijo") {
      if (d.primer_ciclo && edadHijo <= d.primer_ciclo.edad_hijo_max) continue;
      const cands = Object.entries(d.campos).filter(([k]) => k !== d.limite_si_campo?.campo).sort((a, b) => b[1] - a[1]);
      if (!cands.length) continue;
      [campo, porcentaje] = cands[0];
    }
    const conGasto = d.tipo !== "fija_por_hijo_nacido" && d.tipo !== "fija_por_hijo";
    const gasto = conGasto ? (d.limite != null ? Math.round(d.limite / porcentaje / 2 / 100) * 100 : 1000) : 0;
    if (conGasto && !(gasto > 0)) continue;
    const esperado = red2(nacido ? (d.importes_por_orden ? d.importes_por_orden["1"] : d.importe)
      : d.tipo === "fija_por_hijo" ? d.importe : Math.min(gasto * porcentaje, d.limite ?? Infinity));
    if (!(esperado > 0)) continue;
    for (const salario of [22000, 18000]) {
      const h = hogar(codigo, P, P.ejercicio, salario, 35, null, 0);
      h.tipoUnidadFamiliar = "monoparental";
      const hijo = { id: "h1", rol: "descendiente", edad: edadHijo, rentasPropias: 0, nacidoEnEjercicio: nacido };
      if (gasto) (d.tipo === "porcentaje_campo" ? h.miembros[0] : hijo)[camel(campo)] = gasto;
      h.miembros.push(hijo);
      let l;
      try { l = motor.liquidar(h, P, "individual"); } catch (e) { continue; }
      const v = l.deduccionesAutonomicas?.detalle?.[d.id];
      if (v != null && Math.abs(v - esperado) < 0.005 && l.cuotaLiquidaAutonomica > 0)
        return { salario, edad: 35, edadHijo, nacido, gasto, campo: gasto ? campo : null, importe: red2(v), d, ejercicio: P.ejercicio };
    }
  }
  return null;
}
export function htmlEjemploFamiliar(e, campoTexto) {
  const hijo = e.nacido ? `un hijo nacido en ${e.ejercicio}` : `un hijo de ${e.edadHijo} años`;
  const gasto = e.gasto ? ` y ${esc(eur(e.gasto))} de gasto (${esc(campoTexto)})` : "";
  return `<p>Una familia monoparental (un padre o una madre de ${e.edad} años con ${hijo}), con un sueldo bruto de ${esc(eur(e.salario))} al año, tributación individual${gasto}: el motor de Mapafiscal aplica <b>${esc(eur(e.importe))}</b> por esta deducción.</p>`;
}

export function htmlEjemplos(ex, campoTexto) {
  return ex.map(e => `<p>Una persona de ${e.edad} años, sin hijos, con un sueldo bruto de ${esc(eur(e.salario))} al año y tributación individual, con ${esc(eur(e.gasto))} de gasto deducible (${esc(campoTexto)}): ` +
    `${pctTipo(e.d.porcentaje)} de ${esc(eur(Math.min(e.gasto, e.d.base_maxima ?? Infinity)))} = ${esc(eur(red2(Math.min(e.gasto, e.d.base_maxima ?? Infinity) * e.d.porcentaje)))}` +
    `${e.tope ? `, que se queda en el máximo de ${esc(eur(e.d.limite))}` : ""}. Con el motor de Mapafiscal, su cuota del IRPF baja <b>${esc(eur(e.delta))}</b>.</p>`).join("\n    ");
}

// ---- páginas -----------------------------------------------------------------------
// ded: [{ codigo, t (de seo_deducciones.json), p (resultado de paginaDeducciones) }]
// Anclas de los enlaces internos: cambian de una ficha a otra para no repetir siempre el mismo texto.
const ANCLAS_IRPF = [n => `tramos y mínimo del IRPF en ${n}`, n => `IRPF en ${n}: tramos y tipo medio`, n => `cuánto IRPF se paga en ${n}`, n => `la renta en ${n}, tramo a tramo`];
const de = n => n.startsWith("el ") ? "del " + n.slice(3) : "de " + n;
const ANCLAS_DED = [(n, a) => `todas las deducciones autonómicas ${de(n)}`, (n, a) => `lista de deducciones ${de(n)} en la renta ${a}`, (n, a) => `deducciones ${de(n)} con sus cuantías`];
const ANCLAS_NETO = [[30000, (n, b) => `sueldo neto de ${b} en ${n}`], [25000, (n, b) => `cuánto se cobra en neto con ${b} en ${n}`], [40000, (n, b) => `del bruto al neto en ${n} con ${b}`]];

// importesSueldo: importes con página de sueldo neto por territorio (/sueldo-neto/<importe>/<territorio>/).
export function paginasFichasDeduccion(ded, generado, ejercicio, CAMPO, { importesSueldo = [] } = {}) {
  const P = paramsDe(ejercicio);
  const items = [];
  for (const { codigo, t, p } of ded) for (const f of p.fichas.filter(x => x.slug)) items.push({ codigo, t, f, tipo: tipoDe(f.titulo) });
  const ocupados = new Set(), paginas = [];
  for (const it of items) {
    const { codigo, t, f } = it;
    const slugT = SLUG[codigo], corto = NOMBRE_CORTO[codigo], nombre = t.nombre, comun = t.regimen === "comun";
    const ruta = `/irpf/${slugT}/deducciones/${f.slug}/`, rutaDed = `/irpf/${slugT}/deducciones/`;
    const title = tituloPagina(f.titulo, corto, ejercicio, ocupados); ocupados.add(title);
    const nd = nombreDeduccion(f.titulo), ndMin = nd.charAt(0).toLowerCase() + nd.slice(1);

    // importe, requisitos y textos según el régimen
    let cuantos, bloques, incompat = [], normaTxt, faqReq = null;
    if (comun) {
      const r = f.redaccion;
      cuantos = r.supuestos.map(s => mayus(s.cuanto) + ".");
      bloques = r.supuestos.map((s, i) => `<div class="supuesto">
      ${r.supuestos.length > 1 ? `<p class="ayuda">Supuesto ${i + 1}</p>` : ""}<p class="supuesto-importe">${esc(mayus(s.cuanto))}.</p>
      ${s.requisitos.length ? `<p>Requisitos:</p><ul>${s.requisitos.map(q => `<li>${esc(q)}.</li>`).join("")}</ul>` : ""}
      ${s.notas.map(q => `<p class="ayuda">${esc(q)}</p>`).join("")}
    </div>`).join("");
      if (r.excluyentes) incompat.push("Estos supuestos no se suman: se aplica el que dé más deducción.");
      if (r.acumulables) incompat.push("Si se cumplen varios supuestos, sus importes se suman.");
      if (r.reparto) incompat.push("Si dos contribuyentes tienen derecho y declaran por separado, se la reparten a partes iguales.");
      normaTxt = r.normas.join("; ");
      const reqs = [...new Set(r.supuestos.flatMap(s => s.requisitos))];
      if (reqs.length) faqReq = reqs.join(". ") + ".";
    } else {
      cuantos = f.lineas;
      bloques = `<div class="supuesto"><ul>${f.lineas.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>`;
      incompat = f.lineas.filter(q => /^No se puede sumar/.test(q));
      normaTxt = f.norma;
    }
    const ex = comun ? ejemplos(codigo, f.ficha, P) : [];
    const campoTexto = ex.length ? CAMPO[ex[0].d.campo] : null;
    const exFam = comun && !ex.length ? ejemploFamiliar(codigo, f.ficha, P) : null;

    const queEs = comun
      ? `Es una deducción autonómica de ${esc(nombre)}: se resta de la parte autonómica de la cuota del IRPF en la declaración de la renta de ${ejercicio} (la que se presenta en ${ejercicio + 1}). La regula ${esc(normaTxt)}.`
      : `Es una deducción del IRPF foral de ${esc(nombre)}, que tiene su propio impuesto: se resta de la cuota en la declaración de la renta de ${ejercicio} (la que se presenta en ${ejercicio + 1}). La regula ${esc(normaTxt)}.`;
    const como = comun
      ? `Se declara en el apartado de deducciones autonómicas de ${esc(nombre)} de la declaración de la renta de ${ejercicio}. El manual práctico de la AEAT y la norma, enlazados abajo, recogen los requisitos completos y cómo se consignan.`
      : `Se aplica en la declaración del IRPF foral de ${esc(nombre)}${t.norma_base ? ` (${esc(t.norma_base)})` : ""}, que se presenta ante su hacienda foral y no ante la AEAT. La norma enlazada abajo recoge los requisitos completos.`;

    const otros = items.filter(o => o !== it && o.tipo && o.tipo === it.tipo && o.codigo !== codigo);
    const faq = [
      [`¿Cuánto es la ${ndMin.replace(/^deducción /, "deducción ")} en ${nombre}?`, cuantos.join(" ")],
      ...(faqReq ? [[`¿Qué requisitos hay que cumplir?`, faqReq]] : []),
      ...(incompat.length ? [[`¿Se puede sumar con otros supuestos?`, incompat.join(" ")]] : []),
      [`¿Dónde está regulada?`, `${mayus(normaTxt)}.`]
    ];
    if (ex.length) faq.push([`¿Cuánto ahorra en un caso concreto?`, `Con un sueldo bruto de ${eur(ex[0].salario)} y ${eur(ex[0].gasto)} de gasto deducible (${campoTexto}), la cuota baja ${eur(ex[0].delta)}, según el motor de Mapafiscal.`]);
    else if (exFam) faq.push([`¿Cuánto ahorra en un caso concreto?`, `Una familia monoparental con ${exFam.nacido ? `un hijo nacido en ${exFam.ejercicio}` : `un hijo de ${exFam.edadHijo} años`} y un sueldo bruto de ${eur(exFam.salario)} se deduce ${eur(exFam.importe)}, según el motor de Mapafiscal.`]);
    // Enlaces internos con anclas variadas (solo régimen común).
    const iT = items.filter(o => o.codigo === codigo).indexOf(it);
    const hermanas = items.filter(o => o.codigo === codigo && o !== it);
    const neto = ANCLAS_NETO.filter(([b]) => importesSueldo.includes(b));
    const masComun = comun ? [
      `<a href="/irpf/${slugT}/">${esc(ANCLAS_IRPF[iT % ANCLAS_IRPF.length](conArticulo(nombre)))}</a>`,
      `<a href="${rutaDed}">${esc(ANCLAS_DED[iT % ANCLAS_DED.length](conArticulo(nombre), ejercicio))}</a>`,
      ...(neto.length ? [(([b, fn]) => `<a href="/sueldo-neto/${b}/${slugT}/">${esc(fn(conArticulo(nombre), eur(b)))}</a>`)(neto[iT % neto.length])] : [])
    ] : null;

    const migas = [["Inicio", "/"], ["IRPF por territorio", "/irpf/"], [nombre, `/irpf/${slugT}/`], ["Deducciones", rutaDed], [f.titulo, ruta]];
    const main = `
  <h1>${esc(title)}</h1>
  ${respuestaDirecta(esc(cuantos[0]))}
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Qué es</h2><p>${queEs}</p></div>
  <div class="tarjeta"><h2 class="rotulo">Quién puede aplicarla, importe y límites</h2>
    ${bloques}
    ${comun ? `<p class="ayuda">Cuando hablamos de hijos nos referimos a los descendientes que dan derecho al mínimo por descendientes.</p>` : ""}
  </div>
  ${incompat.length ? `<div class="tarjeta"><h2 class="rotulo">Incompatibilidades</h2>${incompat.map(q => `<p>${esc(q)}</p>`).join("")}</div>` : ""}
  ${ex.length ? `<div class="tarjeta"><h2 class="rotulo">Ejemplo${ex.length > 1 ? "s" : ""}</h2>
    ${htmlEjemplos(ex, campoTexto)}
    <p class="ayuda">Diferencia entre la cuota líquida con y sin el gasto, calculada con la normativa de ${ejercicio}.</p>
  </div>` : ""}${exFam ? `
  <div class="tarjeta"><h2 class="rotulo">Ejemplo</h2>
    ${htmlEjemploFamiliar(exFam, exFam.campo ? CAMPO[exFam.campo] : "")}
    <p class="ayuda">Importe de esta deducción en la liquidación del motor, con la normativa de ${ejercicio}; coincide con el que resulta de la norma.</p>
  </div>` : ""}
  <div class="tarjeta"><h2 class="rotulo">Cómo se aplica en la declaración</h2><p>${como}</p></div>
  <div class="tarjeta ficha-deduccion"><h2 class="rotulo">Norma y fuente</h2>
    ${f.html.match(/<p class="fuente">[\s\S]*?<\/p>/)[0]}
  </div>
  ${otros.length ? `<div class="tarjeta"><h2 class="rotulo">La misma deducción en otros territorios</h2><ul class="lista-enlaces">${otros.map(o =>
    `<li><a href="/irpf/${SLUG[o.codigo]}/deducciones/${o.f.slug}/">${esc(o.f.titulo)} (${esc(o.t.nombre)})</a></li>`).join("")}</ul></div>` : ""}
  ${bloqueFaq(faq)}
  <p><a class="btn btn-pri" href="${HERRAMIENTA.calculadora}">Calcula tu renta en ${esc(nombre)}</a> <a class="btn btn-sec" href="${rutaDed}">Todas las deducciones de ${esc(nombre)}</a></p>
  ${masComun ? `<p class="ayuda">Más: ${masComun.join(" · ")}.</p>${hermanas.length ? `
  <p class="ayuda">Otras deducciones ${esc(conDe(nombre))}: ${hermanas.map(o => `<a href="/irpf/${slugT}/deducciones/${o.f.slug}/">${esc(o.f.titulo)}</a>`).join(" · ")}.</p>` : ""}`
    : `<p class="ayuda">Más: <a href="/irpf/${slugT}/">tramos y mínimo del IRPF en ${esc(nombre)}</a> · <a href="${rutaDed}">deducciones de ${esc(nombre)}</a>.</p>`}
  </div>`;
    const armar = c => `${nd} en ${corto}, renta ${ejercicio}: ${c} Requisitos, límites y norma.`;
    let description = armar(cuantos[0]);
    if (description.length > MAX_DESCRIPCION) description = `${nd} en ${corto} (renta ${ejercicio}): importe, requisitos, límites y norma oficial.`;
    if (description.length > MAX_DESCRIPCION) description = description.slice(0, MAX_DESCRIPCION - 1).replace(/\s\S*$/, "") + "…";
    paginas.push({ ruta, html: layout({
      title, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado, css: ["/css/guias.css"],
      jsonld: [jsonLdMigas(migas), jsonLdFaq(faq), jsonLdArticulo({ titulo: title, descripcion: description, ruta, generado })]
    }), codigo, ejemplos: ex.length });
  }
  return paginas;
}
