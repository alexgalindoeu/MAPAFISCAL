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
// resta: sin signo si el importe redondeado es 0 (evita «−0 €»)
const menos = n => (Math.round(Math.abs(n)) ? "−" : "") + euros(Math.abs(n));
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { graficoBrutoNeto, serieSueldoNeto } from "./seo_grafico.mjs";
import { conArticulo, conDe, conEn } from "./seo_deduccion_ficha.mjs";
import { NOMBRE_CORTO, SLUG, ORDEN_TERRITORIOS, HERRAMIENTA, esc, euros, pctMedio, pctTipo, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml, bloqueCalculoRapido } from "./seo_comun.mjs";

const FORAL = new Set(["ES-PV-BI", "ES-PV-SS", "ES-PV-VI", "ES-NC"]);

// Territorios que limitan por tierra, sacados del mapa de la web (web/datos/mapa_es.json):
// dos territorios son vecinos si sus contornos comparten al menos dos vértices. Las islas
// (Illes Balears, Canarias) no tienen vecinos.
export function vecinosGeograficos(mapa = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "web", "datos", "mapa_es.json"), "utf8"))) {
  const puntos = d => {
    const s = new Set(); let x = 0, y = 0, x0 = 0, y0 = 0;
    for (const seg of d.match(/[MLlz][^MLlz]*/g) || []) {
      const c = seg[0], n = (seg.slice(1).match(/-?\d+(\.\d+)?/g) || []).map(Number);
      if (c === "z") { x = x0; y = y0; continue; }
      for (let i = 0; i + 1 < n.length; i += 2) {
        // «M x y dx dy…»: el primer par es absoluto y los siguientes, relativos
        const absoluto = c === "L" || (c === "M" && i === 0);
        x = absoluto ? n[i] : x + n[i]; y = absoluto ? n[i + 1] : y + n[i + 1];
        if (c === "M" && i === 0) { x0 = x; y0 = y; }
        s.add(x + "," + y);
      }
    }
    return s;
  };
  const P = Object.fromEntries(Object.entries(mapa.territorios).map(([k, d]) => [k, puntos(d)]));
  const out = {};
  for (const a of Object.keys(P)) out[a] = Object.keys(P).filter(b => b !== a && [...P[a]].filter(p => P[b].has(p)).length >= 2);
  return out;
}

// Base con la que cada deducción compara su límite de renta (puerta_renta() de
// tools/generar_datos_seo.R, espejo de base_puerta() de R/06_deducciones.R).
const BASE_RENTA = {
  liquidable: "base liquidable", imponible: "base imponible",
  imponible_menos_minimo: "base imponible menos el mínimo personal y familiar",
  imponible_menos_minimo_contribuyente_descendientes: "base imponible menos el mínimo del contribuyente y por descendientes",
  general_menos_minimo: "base imponible general menos el mínimo personal y familiar"
};
// «te pasas por…», «entras, con … de margen» o «entras, pero el importe se reduce…»
const veredictoLimite = p => p.estado === "fuera" ? `te pasas por ${euros(p.valor - p.limite)}`
  : p.estado === "reducida" ? `entras, pero el importe se reduce a partir de ${euros(p.reduccion_desde)}`
    : `entras, con ${euros(p.limite - p.valor)} de margen`;
const minus = t => t.charAt(0).toLowerCase() + t.slice(1);
const listaY = l => l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " y " + l.at(-1);

// Enlaces a /irpf/<territorio>/ y a sus deducciones (solo régimen común), con anclas que
// cambian con el importe para no repetir siempre el mismo texto.
const ANCLAS_IRPF = [n => `IRPF en ${n}`, n => `tramos del IRPF en ${n}`, n => `tipo marginal y tipo medio en ${n}`, n => `la renta en ${n} frente a la media`];
const deN = n => n.startsWith("el ") ? "del " + n.slice(3) : "de " + n;
const ANCLAS_DED = [(n, a) => `deducciones autonómicas ${deN(n)}`, (n, a) => `qué deducciones tiene ${n} en la renta ${a}`, (n, a) => `deducciones de la renta ${a} en ${n}, con sus cuantías`];

// conDeducciones: territorios con página /irpf/<territorio>/deducciones/.
// fichasDe: código → fichas de deducción publicadas (con su `slug`); devuelve: datos de
// web/datos/seo_devuelve.json, para enlazar solo las páginas «¿cuánto me devuelve?» con cifra.
export function paginasSueldoNeto(d, { conDeducciones = new Set(), ejercicioDeducciones = null, fichasDe = new Map(), devuelve = null } = {}) {
  const EJ = d.ejercicio, gen = d.generado;
  const VECINOS = vecinosGeograficos();
  const det = (b, c) => d.detalle.territorios[String(b)][c];
  const [edad1, edad2] = d.detalle.edades_hijos;
  const conTerritorio = new Set(d.importes_territorio);
  const importes = Object.keys(d.sueldos).map(Number).sort((a, b) => a - b);
  const nombre = c => d.nombres[c];
  // Cifras como se ven: en euros enteros y cuadradas, para que las restas y las sumas de la
  // página den exactamente lo que se lee (bruto − SS − IRPF = neto, diferencias entre
  // territorios). La Seguridad Social total se redondea y sus partes se ajustan por el
  // método del mayor resto para que sumen ese total.
  const ssVista = new Map();
  const ss = b => {
    if (ssVista.has(b)) return ssVista.get(b);
    const o = d.sueldos[String(b)].ss, total = Math.round(o.total);
    const partes = ["contingencias_comunes", "desempleo", "formacion_profesional", "mei", "solidaridad"].filter(k => k in o);
    const r = { ...o, total };
    partes.forEach(k => { r[k] = Math.floor(o[k]); });
    let falta = total - partes.reduce((a, k) => a + r[k], 0);
    [...partes].sort((x, y) => (o[y] - Math.floor(o[y])) - (o[x] - Math.floor(o[x]))).forEach(k => { if (falta > 0 && o[k] > 0) { r[k]++; falta--; } });
    ssVista.set(b, r);
    return r;
  };
  const fila = (b, c) => {
    const o = d.sueldos[String(b)].territorios[c], irpf = Math.round(o.irpf);
    return { ...o, irpf, neto: b - ss(b).total - irpf };
  };
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
  // Enlaces a la página del territorio. En los forales el texto del enlace varía con la página
  // («IRPF en Gipuzkoa», «tablas IRPF Gipuzkoa 2026», «renta Gipuzkoa 2025») y se suma el simulador.
  const enlacesTerritorio = (c, v) => {
    const r = `/irpf/${SLUG[c]}/`;
    if (!FORAL.has(c)) return `<a href="${r}">IRPF en ${esc(nombre(c))}</a>`;
    const k = NOMBRE_CORTO[c];
    const [txt, href] = [[`IRPF en ${k}`, r], [`tablas IRPF ${k} ${EJ}`, `${r}#tabla-${EJ}`], [`renta ${k} ${EJ - 1}`, `${r}#renta`]][v];
    return `<a href="${href}">${esc(txt)}</a> · <a href="${r}simulador-renta/">simulador renta ${esc(EJ)} ${esc(k)}</a>`;
  };
  const paginas = [];

  // ---- lo que cada página por territorio tiene y no tiene la de al lado ----------------
  // Todo sale de d.detalle (motor R): el mismo sueldo con hijos o con el cónyuge a cargo, el
  // neto exacto con 1.000 € brutos más, los territorios vecinos y los límites de renta de las
  // deducciones autonómicas publicadas. Los textos se eligen por reglas a partir de las cifras.
  const vista = (b, o) => { const irpf = Math.round(o.irpf); return { irpf, neto: b - ss(b).total - irpf, modo: o.modo }; };
  const queda1000 = (b, c) => { const o = d.sueldos[String(b)].territorios[c], m = det(b, c).mas_1000;
    const neto = Math.round(m.neto - o.neto), irpf = Math.round(m.irpf - o.irpf);
    return { neto, irpf, ss: 1000 - neto - irpf }; };
  const rebajaHijos = (b, c) => fila(b, c).irpf - vista(b, det(b, c).hijos2).irpf;
  const modoTxt = m => m === "conjunta" ? "declaración conjunta" : "declaración individual";

  function bloquesPropios(b, c) {
    const nom = nombre(c), n = conArticulo(nom), N = n.charAt(0).toUpperCase() + n.slice(1), f = fila(b, c), D = det(b, c), r = ranking(b);
    const media = r.reduce((a, x) => a + x.neto, 0) / r.length;
    const enlaceT = x => `<a href="${rutaTer(b, x)}">${esc(nombre(x))}</a>`;

    // 1) Situación familiar
    const casos = [
      ["Sin hijos ni pareja (el caso de esta página)", f],
      [`Sin pareja, con un hijo de ${edad1} años`, vista(b, D.hijo1)],
      [`Sin pareja, con dos hijos de ${edad1} y ${edad2} años`, vista(b, D.hijos2)],
      ["Casado o casada, con el cónyuge sin ingresos", vista(b, D.pareja)],
      [`Casado o casada, cónyuge sin ingresos y dos hijos de ${edad1} y ${edad2} años`, vista(b, D.pareja_hijos2)]
    ];
    const filasFam = casos.map(([t, o], i) => `<tr${i ? "" : ' class="destacada"'}><td>${esc(t)}${o.modo ? ` <span class="ayuda">(${esc(modoTxt(o.modo))})</span>` : ""}</td><td class="num">${esc(euros(o.irpf))}</td><td class="num">${esc(euros(o.neto))}</td><td class="num">${esc(euros(o.neto / 14))}</td><td class="num">${i ? esc((o.neto >= f.neto ? "+" : "−") + euros(Math.abs(o.neto - f.neto))) : "—"}</td></tr>`).join("");
    const h1 = casos[1][1], h2 = casos[2][1], pj = casos[3][1], pjh = casos[4][1];
    const rebajas = ORDEN_TERRITORIOS.map(x => ({ c: x, v: rebajaHijos(b, x) })).sort((x, y) => y.v - x.v || x.c.localeCompare(y.c));
    const rebMedia = rebajas.reduce((a, x) => a + x.v, 0) / rebajas.length, reb = f.irpf - h2.irpf;
    const puestoReb = rebajas.findIndex(x => x.c === c) + 1;
    const famTxt = [
      reb > 0
        ? `En ${n}, con ${euros(b)} brutos, criar solo o sola a dos hijos de ${edad1} y ${edad2} años rebaja el IRPF del año en ${euros(reb)} (${euros(reb / 12)} al mes)${h2.irpf === 0 ? ", hasta dejarlo en cero" : ""}; con uno, en ${euros(f.irpf - h1.irpf)}.`
        : `En ${n}, con ${euros(b)} brutos, los hijos no rebajan el IRPF: ${f.irpf === 0 ? "la cuota ya sale a cero sin ellos" : "la cuota ya es tan baja que el mínimo por descendientes no tiene de dónde restar"}.`,
      reb > 0 && (Math.abs(reb - rebMedia) < 25 ? `Es casi lo mismo que la media de los 19 territorios (${euros(rebMedia)}).`
        : `La media de los 19 territorios es ${euros(rebMedia)}: ${n} queda en el puesto ${puestoReb} de 19${puestoReb === 1 ? ", el que más rebaja" : `, por detrás de ${nombre(rebajas[0].c)} (${euros(rebajas[0].v)})`}.`),
      pj.irpf < f.irpf
        ? `Si estás casado o casada y tu cónyuge no tiene ingresos, la ${modoTxt(pj.modo)} deja el IRPF en ${euros(pj.irpf)}: ${euros(f.irpf - pj.irpf)} menos que solo${pjh.irpf < pj.irpf ? `, y con los dos hijos, ${euros(pjh.irpf)}` : ""}.`
        : `Con el cónyuge sin ingresos, en ${n} el IRPF no baja respecto al de una persona sola (${euros(pj.irpf)}).`
    ].filter(Boolean).join(" ");
    const sitDev = devuelve && devuelve.situaciones && devuelve.situaciones.hijo && devuelve.situaciones.hijo[c];
    const enlacesFam = [
      sitDev && sitDev.publicable && `<a href="/cuanto-me-devuelve/hijo/${SLUG[c]}/">cuánto rebaja tener un hijo ${esc(conEn(nom))} (renta ${esc(devuelve.ejercicio)})</a>`,
      `<a href="/declaracion-conjunta/un-solo-sueldo/">declaración conjunta con un solo sueldo</a>`,
      `<a href="/declaracion-conjunta/con-hijos/">conjunta o individual con hijos</a>`
    ].filter(Boolean).join(" · ");
    const familia = `<div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">${esc(euros(b))} en ${esc(n)} con hijos o con pareja a cargo</h2>
    <p>${esc(famTxt)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Situación</th><th class="num">IRPF del año</th><th class="num">Neto anual</th><th class="num">Al mes (14 pagas)</th><th class="num">Frente a sin hijos</th></tr></thead><tbody>${filasFam}</tbody></table></div>
    <p class="ayuda">Mismo sueldo bruto, misma Seguridad Social (${esc(euros(ss(b).total))}) y ejercicio ${esc(EJ)}; solo cambia la familia. Sin pareja, el motor aplica la reducción de las familias monoparentales; con cónyuge, elige la declaración individual o la conjunta, la que salga mejor. Más: ${enlacesFam}.</p>
  </div>`;

    // 2) 1.000 € brutos más: exacto (motor con b + 1.000), frente a los 19
    const q = queda1000(b, c);
    const quedas = ORDEN_TERRITORIOS.map(x => ({ c: x, v: queda1000(b, x).neto })).sort((x, y) => y.v - x.v || x.c.localeCompare(y.c));
    const pq = quedas.findIndex(x => x.c === c) + 1, qMax = quedas[0], qMin = quedas.at(-1);
    const tipoMedioTotal = (f.irpf + ss(b).total) / b;
    const milTxt = `Con 1.000 € brutos más al año (${euros(b + 1000)}), en ${n} el neto sube ${euros(q.neto)}: ${q.irpf === 0 ? `el IRPF sigue a cero y solo se paga Seguridad Social (${euros(q.ss)})` : `el IRPF se lleva ${euros(q.irpf)} y la Seguridad Social ${euros(q.ss)}`}.`
      + (q.neto < 500 ? " Más de la mitad de la subida se va: en este tramo, además del tipo de la escala, se van perdiendo las reducciones y deducciones de los sueldos bajos, que menguan a medida que sube el sueldo." : "")
      + (q.neto >= 500 && q.neto / 1000 < 1 - tipoMedioTotal - 0.02 ? ` Es menos de lo que sugiere tu tipo medio (te quedas el ${pctMedio(1 - tipoMedioTotal)} del sueldo en conjunto), porque la subida tributa entera a tu tipo marginal.` : "")
      + (qMax.v === qMin.v ? " Con este sueldo, de la subida te quedarías lo mismo en los 19 territorios."
        : pq === 1 && quedas[1].v === q.neto ? ` Es lo máximo que queda de esa subida en los 19 territorios, empatado con ${quedas.filter(x => x.c !== c && x.v === q.neto).length} más.`
        : pq === 1 ? ` Es el territorio donde más se queda de esa subida con este sueldo (${nombre(quedas[1].c)}, el segundo, ${euros(quedas[1].v)}).`
          : ` De esa subida, en ${nombre(qMax.c)} te quedarías ${euros(qMax.v)} y en ${nombre(qMin.c)} ${euros(qMin.v)}: ${n} es el ${pq}.º de 19.`);

    // 3) Territorios que limitan con este
    const vec = VECINOS[c].map(x => ({ c: x, ...fila(b, x) })).sort((x, y) => y.neto - x.neto || x.c.localeCompare(y.c));
    const dif = x => (x.neto > f.neto ? "+" : x.neto < f.neto ? "−" : "") + euros(Math.abs(x.neto - f.neto));
    const encima = vec.filter(x => x.neto < f.neto).length, igualV = vec.filter(x => x.neto === f.neto).length, debajoV = vec.length - encima - igualV;
    const nVec = k => k === vec.length ? (vec.length > 1 ? `sus ${vec.length} vecinos` : "su único vecino") : `${k} de sus ${vec.length} vecinos`;
    const vecTxt = !vec.length
      ? `${N} no limita por tierra con ningún otro territorio fiscal: frente a la media de los 19 queda ${Math.abs(f.neto - media) < 50 ? "prácticamente en la media" : `${f.neto >= media ? "por encima" : "por debajo"}, con ${euros(Math.abs(f.neto - media))} ${f.neto >= media ? "más" : "menos"} al año`}.`
      : igualV === vec.length ? `Con ${euros(b)} brutos, ${n} deja el mismo neto que ${nVec(igualV)}.`
      : `Con ${euros(b)} brutos, ${n} deja ${listaY([encima && `más neto que ${nVec(encima)}`, debajoV && `menos neto que ${nVec(debajoV)}`, igualV && `lo mismo que ${igualV === 1 ? "otro" : `otros ${igualV}`}`].filter(Boolean))}. ` +
        `Con el mismo sueldo, al año quedarían ${listaY(vec.map(x => x.neto === f.neto ? `lo mismo en ${nombre(x.c)}` : `${euros(Math.abs(x.neto - f.neto))} ${x.neto > f.neto ? "más" : "menos"} en ${nombre(x.c)}`))}.`;
    const vecHtml = vec.length ? `<p class="ayuda">Vecinos con ${esc(euros(b))}: ${vec.map(x => `${enlaceT(x.c)} (${esc(dif(x))})`).join(" · ")}</p>` : "";

    // 4) Deducciones autonómicas publicadas que dejan entrar por renta con este sueldo
    let deducciones = "", dedResumen = null;
    if (D.renta && D.renta.length) {
      const fichas = fichasDe.get(c) || [];
      const items = D.renta.map(x => {
        const ficha = fichas.find(y => y.titulo === x.titulo);
        const tit = ficha && ficha.slug ? `<a href="/irpf/${SLUG[c]}/deducciones/${ficha.slug}/">${esc(x.titulo)}</a>` : esc(x.titulo);
        const partes = x.puertas.map(p => {
          const base = BASE_RENTA[p.base];
          if (p.por_miembro != null) return p.miembros <= 1
            ? { ok: true, txt: `límite de ${euros(p.por_miembro)} de ${base} por miembro de la unidad familiar; con ${euros(p.valor)} entras sea cual sea su tamaño` }
            : { ok: p.miembros <= 2 ? true : null, txt: `límite de ${euros(p.por_miembro)} de ${base} por miembro de la unidad familiar; con ${euros(p.valor)} entras si la unidad familiar tiene al menos ${p.miembros} miembros${p.miembros === 2 ? " (por ejemplo, tú y un hijo)" : p.miembros === 3 ? " (por ejemplo, tú, tu pareja y un hijo)" : ""}` };
          const cj = p.conjunta, separa = cj && (cj.limite !== p.limite || cj.valor !== p.valor);
          const ind = `límite de ${euros(p.limite)} de ${base}${cj && !separa ? " en individual y en conjunta" : cj ? " en individual" : ""}; con ${euros(p.valor)} ${veredictoLimite(p)}`;
          const okI = p.estado !== "fuera", okC = !!cj && cj.estado !== "fuera";
          return { ok: okI || okC, soloConjunta: !okI && okC,
            txt: ind + (separa ? `; en declaración conjunta, ${euros(cj.limite)}: con ${euros(cj.valor)} ${veredictoLimite(cj)}` : "") };
        });
        const estado = x.sin_limite || partes.some(p => p.ok === true && !p.soloConjunta) ? "entra" : partes.some(p => p.ok === true) ? "conjunta" : partes.some(p => p.ok === null) ? "depende" : "fuera";
        const txt = [x.sin_limite && (partes.length ? "un supuesto sin límite de renta" : "sin límite de renta: depende solo de tu situación y tus gastos"), ...partes.map(p => p.txt)].filter(Boolean).join("; ");
        return { estado, titulo: x.titulo, html: `<li>${tit}: ${esc(txt)}.</li>`, conLimite: partes.length > 0 };
      });
      const conLim = items.filter(x => x.conLimite), dentro = conLim.filter(x => x.estado === "entra" || x.estado === "conjunta"), fuera = conLim.filter(x => x.estado === "fuera");
      const soloConj = conLim.filter(x => x.estado === "conjunta").length;
      dedResumen = { total: items.length, conLimite: conLim.length, dentro: dentro.length, fuera: fuera.map(x => x.titulo) };
      const resumen = !conLim.length ? `Ninguna de las ${items.length} deducciones autonómicas ${conDe(nom)} publicadas aquí tiene límite de renta: con ${euros(b)} brutos entras en todas si cumples el resto de requisitos.`
        : `De las ${items.length} deducciones autonómicas ${conDe(nom)} publicadas aquí, ${conLim.length === 1 ? "una tiene" : `${conLim.length} tienen`} límite de renta. Con ${euros(b)} brutos ${fuera.length === conLim.length ? `no entras en ninguna de ellas${fuera.length <= 3 ? `: ${listaY(fuera.map(x => `«${minus(x.titulo)}»`))}` : ""}` : `entras en ${dentro.length === conLim.length ? (conLim.length === 1 ? "ella" : "todas") : dentro.length}${fuera.length ? ` y te quedas fuera de ${fuera.length === 1 ? "la deducción" : fuera.length <= 3 ? `${fuera.length}:` : fuera.length} ${fuera.length <= 3 ? listaY(fuera.map(x => `«${minus(x.titulo)}»`)) : ""}`.trimEnd() : ""}`}${conLim.length - dentro.length - fuera.length > 0 ? `; en ${conLim.length - dentro.length - fuera.length} depende del tamaño de la unidad familiar` : ""}.${soloConj ? ` En ${soloConj === 1 ? "una" : soloConj} de ellas, solo si haces la declaración conjunta, que tiene un límite más alto.` : ""}`;
      deducciones = `<div class="tarjeta">
    <h2 class="rotulo">Deducciones ${esc(conDe(nom))} a las que llegas con ${esc(euros(b))}</h2>
    <p>${esc(resumen)} El resto de requisitos (hijos, alquiler, gastos…) está en la ficha de cada una.</p>
    <ul class="lista-enlaces">${items.map(x => x.html).join("")}</ul>
    <p class="ayuda">Límites de la renta ${esc(d.detalle.ejercicio_deducciones)}, con la base que calcula el motor para ${esc(euros(b))} brutos sin otras rentas: en individual, sin hijos; en conjunta, con un hijo y sin pareja (familia monoparental), la unidad familiar más pequeña que puede declarar en conjunta. Los hijos no cambian la base imponible, pero sí el mínimo personal y familiar: en las que lo restan, la base que cuenta baja y el margen crece. Solo se listan las deducciones confirmadas con fuente oficial; <a href="/irpf/${SLUG[c]}/deducciones/">todas las deducciones ${esc(conDe(nom))}</a>.</p>
  </div>`;
    }

    // 5) Lectura: lo más llamativo de esta página, elegido por reglas
    const puesto = r.findIndex(x => x.c === c) + 1, empates = r.filter(x => x.c !== c && x.neto === f.neto);
    const todos19 = r[0].neto === r.at(-1).neto;
    const lectura = [
      todos19 ? `Con ${euros(b)} brutos el neto es el mismo en los 19 territorios${f.irpf === 0 ? ": la cuota del IRPF sale a cero en todos y solo se paga Seguridad Social" : ""}.`
      : r[0].neto === f.neto ? `Con ${euros(b)} brutos, en ningún territorio queda más neto que en ${n}${empates.length ? ` (empata con ${listaY(empates.map(x => nombre(x.c)))})` : ""}: ${euros(f.neto - media)} al año por encima de la media de los 19.`
      : r.at(-1).neto === f.neto ? `Con ${euros(b)} brutos, en ningún territorio queda menos neto que en ${n}${empates.length ? ` (empata con ${listaY(empates.map(x => nombre(x.c)))})` : ""}: ${euros(media - f.neto)} al año por debajo de la media de los 19.`
      : puesto <= 3 ? `${euros(b)} brutos rinden más en ${n} que en casi cualquier otro sitio: puesto ${puesto} de 19, ${euros(f.neto - media)} al año por encima de la media.`
        : puesto >= 17 ? `${N} está entre los territorios donde menos neto deja este sueldo (puesto ${puesto} de 19): ${euros(media - f.neto)} al año por debajo de la media.`
          : `${N} queda en la zona media con este sueldo (puesto ${puesto} de 19), ${Math.abs(f.neto - media) < 50 ? "prácticamente en la media" : `${euros(Math.abs(f.neto - media))} ${f.neto > media ? "por encima" : "por debajo"} de la media`}.`,
      !vec.length || todos19 || igualV === vec.length ? null
        : encima === vec.length ? `Deja más que cualquiera de sus vecinos (${listaY(vec.map(x => NOMBRE_CORTO[x.c]))}).`
        : debajoV === vec.length ? `Todos sus vecinos dejan más con este sueldo; el que más, ${nombre(vec[0].c)}: ${euros(vec[0].neto - f.neto)} al año.`
        : `Entre sus vecinos, ${nombre(vec[0].c)} deja ${vec[0].neto === f.neto ? "lo mismo" : `${euros(vec[0].neto - f.neto)} más`} y ${nombre(vec.at(-1).c)}, ${vec.at(-1).neto === f.neto ? "lo mismo" : `${euros(f.neto - vec.at(-1).neto)} menos`}.`,
      `De una subida de 1.000 € brutos te quedarías ${euros(q.neto)}${q.neto < 500 ? ": más de la mitad se iría en IRPF y cotizaciones" : q.neto < 550 ? ": casi la mitad se iría en IRPF y cotizaciones" : ""}.`,
      reb > 0 ? `Con dos hijos y sin pareja, el neto sube ${euros(h2.neto - f.neto)} al año.` : null,
      dedResumen && dedResumen.conLimite ? (dedResumen.fuera.length === dedResumen.conLimite ? `Por renta, este sueldo ya no llega a ninguna de las ${dedResumen.conLimite} deducciones autonómicas con límite publicadas.`
        : dedResumen.fuera.length ? `Por renta, este sueldo ya no llega a ${dedResumen.fuera.length === 1 ? "una" : dedResumen.fuera.length} de las ${dedResumen.conLimite} deducciones autonómicas con límite publicadas.`
        : `Por renta, este sueldo entra en ${dedResumen.conLimite === 1 ? "la única deducción autonómica con límite publicada" : "todas las deducciones autonómicas con límite publicadas"}.`) : null
    ].filter(Boolean).join(" ");

    return { familia, mil: { texto: milTxt }, vecinos: { texto: vecTxt, html: vecHtml }, deducciones, lectura,
      faqHijos: reb > 0
        ? `Sí cambia. Con ${euros(b)} brutos en ${n} y sin pareja, con un hijo de ${edad1} años el neto anual es ${euros(h1.neto)} y con dos (${edad1} y ${edad2} años), ${euros(h2.neto)}. Casado o casada con el cónyuge sin ingresos, ${euros(pj.neto)}. Con un contrato temporal se cotiza un poco más por desempleo; la calculadora de sueldo neto lo calcula con tu situación.`
        : `Con ${euros(b)} brutos en ${n} los hijos apenas cambian el IRPF, que ya es muy bajo. Con un contrato temporal se cotiza un poco más por desempleo; la calculadora de sueldo neto lo calcula con tu situación.` };
  }

  // ---- detalle por territorio -------------------------------------------------------
  function paginaTerritorio(b, c, iTer) {
    const f = fila(b, c), s = ss(b), r = ranking(b), puesto = r.findIndex(x => x.c === c) + 1;
    const n = nombre(c), mejor = r[0], peor = r[r.length - 1];
    const media = r.reduce((a, x) => a + x.neto, 0) / r.length;
    const tipoIrpf = f.irpf / b, tipoTotal = (f.irpf + s.total) / b;
    const v = (iTer + importes.indexOf(b)) % 3;
    const iB = d.importes_territorio.indexOf(b);
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
      .map(([t, x, tp]) => `<tr><td>${esc(t)} (${esc(pctTipo(tp))})</td><td class="num">${esc(menos(x))}</td></tr>`).join("")
      + (s.solidaridad > 0 ? `<tr><td>Cotización adicional de solidaridad</td><td class="num">${esc(menos(s.solidaridad))}</td></tr>` : "");
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
    // Ranking recortado: el primero, los vecinos de puesto, este territorio y el último. La
    // tabla completa de los 19 está en la página nacional del importe (evita repetir la
    // misma tabla en las 19 páginas de un importe).
    const puestos = [...new Set([0, puesto - 3, puesto - 2, puesto - 1, puesto, puesto + 1, r.length - 1])].filter(i => i >= 0 && i < r.length).sort((x, y) => x - y);
    const difTxt = x => x.c === c ? "—" : (x.neto > f.neto ? "+" : x.neto < f.neto ? "−" : "") + euros(Math.abs(x.neto - f.neto));
    const filas19 = puestos.map(i => { const x = r[i]; return `<tr${x.c === c ? ' class="destacada"' : ""}><td class="num">${i + 1}</td><td>${x.c === c ? `<b>${esc(nombre(x.c))}</b>` : `<a href="${rutaTer(b, x.c)}">${esc(nombre(x.c))}</a>`}</td><td class="num">${esc(euros(x.neto))}</td><td class="num">${esc(difTxt(x))}</td><td class="num">${esc(pctMedio(x.irpf / b))}</td></tr>`; }).join("");
    const otros = r.filter(x => x.c !== c && !puestos.some(i => r[i].c === x.c)).map(x => `<a href="${rutaTer(b, x.c)}">${esc(NOMBRE_CORTO[x.c])}</a>`).join(" · ");
    const arriba = puesto > 1 ? r[puesto - 2] : null, abajo = puesto < r.length ? r[puesto] : null;
    const vecinosPuesto = [arriba && `${nombre(arriba.c)}, justo por encima, deja ${euros(arriba.neto - f.neto)} más al año`, abajo && `${nombre(abajo.c)}, justo por debajo, ${euros(f.neto - abajo.neto)} menos`].filter(Boolean).join("; ");
    const lista = d.importes_territorio;
    // El mismo territorio con los sueldos vecinos: cifras del motor para cada importe.
    const iImp = lista.indexOf(b);
    const ventana = lista.slice(Math.max(0, iImp - 2), iImp + 3);
    const filasVentana = ventana.map(x => { const g = fila(x, c); return `<tr${x === b ? ' class="destacada"' : ""}><td>${x === b ? `<b>${esc(euros(x))}</b>` : `<a href="${rutaTer(x, c)}">${esc(euros(x))}</a>`}</td><td class="num">${esc(euros(g.neto))}</td><td class="num">${esc(euros(g.neto / 14))}</td><td class="num">${esc(euros(g.irpf))}</td><td class="num">${esc(pctMedio(g.marginal_irpf))}</td></tr>`; }).join("");
    const sig = lista[iImp + 1], ant = lista[iImp - 1];
    const saltoTxt = (x0, x1) => { const g0 = fila(x0, c), g1 = fila(x1, c), dn = g1.neto - g0.neto, db = x1 - x0;
      return `pasar de ${euros(x0)} a ${euros(x1)} brutos (${euros(db)} más) sube el neto en ${euros(dn)} al año: te quedas ${euros(100 * dn / db)} de cada 100 € de la subida`; };
    const salto = sig ? `En ${n}, ${saltoTxt(b, sig)}.` : `En ${n}, ${saltoTxt(ant, b)}.`;
    // ---- bloques propios de cada página (d.detalle, calculado por el motor R) ----------
    const B = bloquesPropios(b, c);
    const mil = B.mil.texto;
    const tramo = f.irpf === 0
      ? `Con ${euros(b)} brutos en ${n} la cuota del IRPF del año sale a cero: solo se paga Seguridad Social.`
      : f.marginal_irpf === 0
        ? `Con este sueldo el IRPF del año es pequeño (${euros(f.irpf)}) y un euro más no lo cambia: tu tipo marginal de IRPF es 0.`
        : `Tu último euro tributa en el IRPF al ${pctMedio(f.marginal_irpf)}, frente a un tipo medio sobre el bruto del ${pctMedio(tipoIrpf)}: el tipo marginal se aplica solo a lo que excede del tramo anterior, no a todo el sueldo.`;
    const faq = [
      [`¿Cuánto es ${euros(b)} brutos en netos al mes en ${n}?`, `En ${EJ}, unos ${euros(f.neto / 12)} al mes en 12 pagas o ${euros(f.neto / 14)} en 14 pagas (${euros(f.neto)} netos al año), para una persona soltera, sin hijos y con contrato indefinido.`],
      [`¿Cuánto IRPF se paga con ${euros(b)} en ${n}?`, `${euros(f.irpf)} al año, un tipo medio del ${pctMedio(tipoIrpf)} sobre el bruto. Con la Seguridad Social (${euros(s.total)}), el total es el ${pctMedio(tipoTotal)}.`],
      [`¿Coincide con lo que veré en la nómina?`, `No exactamente: la nómina aplica una retención a cuenta, que puede ser algo mayor o menor. La diferencia se regulariza en la declaración de la renta; este neto es el que queda tras ella.`],
      [`¿Y si tengo hijos o un contrato temporal?`, B.faqHijos]
    ];
    const titulo = `Sueldo neto de ${euros(b)} brutos en ${n} (${EJ})`;
    const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"], [`${euros(b)} brutos`, rutaNac(b)], [n, rutaTer(b, c)]];
    const main = `
  <h1>${esc(titulo)}</h1>
  <p class="entradilla">${intro}${eq.length ? ` Es lo que cobra quien gana ${esc(eq.join(" o "))}.` : ""}</p>
  ${bloqueCalculoRapido({ territorio: c, ejercicio: EJ, bruto: b, titulo: "Calcula el neto de tu sueldo" })}
  <div class="prosa">
  <div class="tarjeta">
    <dl class="kpis"><div><dt>Neto anual</dt><dd>${esc(euros(f.neto))}</dd></div><div><dt>Al mes, 12 pagas</dt><dd>${esc(euros(f.neto / 12))}</dd></div><div><dt>Al mes, 14 pagas</dt><dd>${esc(euros(f.neto / 14))}</dd></div></dl>
    <p class="ayuda">${esc(supuesto)}</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Lo que dice esta cifra</h2>
    <p>${esc(B.lectura)}</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Del bruto al neto</h2>
    <div class="envoltorio"><table class="cobertura"><tbody>
      <tr><td>Sueldo bruto anual</td><td class="num">${esc(euros(b))}</td></tr>
      ${filasSs}
      <tr><td><b>Seguridad Social</b> (${esc(pctMedio(s.total / b))})</td><td class="num"><b>${esc(menos(s.total))}</b></td></tr>
      <tr><td><b>IRPF del año</b> (tipo medio sobre el bruto: ${esc(pctMedio(tipoIrpf))})</td><td class="num"><b>${esc(menos(f.irpf))}</b></td></tr>
      <tr><td><b>Sueldo neto anual</b></td><td class="num"><b>${esc(euros(f.neto))}</b></td></tr>
    </tbody></table></div>
    <p>Entre IRPF y Seguridad Social se va el ${esc(pctMedio(tipoTotal))} del bruto. De cada 100 € más de sueldo, ${esc(euros(100 * f.marginal))} se irían en impuestos y cotizaciones (${esc(euros(100 * f.marginal_irpf))} de IRPF): es tu tipo marginal.${esc(topeSs)}</p>
    <p class="ayuda">${notaSs}</p>
  </div>
  ${graficoBrutoNeto({ serie: serieSueldoNeto(d, c), marca: b, titulo: `Del bruto al neto en ${n}`, pie: `Neto mensual en 12 pagas y tipo medio del IRPF en ${n} para cada sueldo bruto anual de ${euros(importes[0])} a ${euros(importes.at(-1))} (${EJ}, persona soltera sin hijos). El punto marca ${euros(b)}.` })}
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">${esc(n)} frente a los otros 18 territorios</h2>
    <p>${esc(comparacion)} Son ${esc(frenteMedia)}.${vecinosPuesto ? ` ${esc(vecinosPuesto)}.` : ""} ${esc(regimen)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Puesto</th><th>Territorio</th><th class="num">Neto anual</th><th class="num">Frente a ${esc(NOMBRE_CORTO[c])}</th><th class="num">Tipo medio sobre el bruto</th></tr></thead><tbody>${filas19}</tbody></table></div>
    <p>${esc(B.vecinos.texto)}</p>
    ${B.vecinos.html}
    <p class="ayuda">Tabla completa: <a href="${rutaNac(b)}">${esc(euros(b))} en los 19 territorios</a>. Resto de territorios: ${otros}</p>
  </div>
  ${B.familia}
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Si el sueldo cambia en ${esc(n)}</h2>
    <p>${esc(salto)} ${esc(mil)} ${esc(tramo)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Bruto anual</th><th class="num">Neto anual</th><th class="num">Al mes (14 pagas)</th><th class="num">IRPF</th><th class="num">Marginal IRPF</th></tr></thead><tbody>${filasVentana}</tbody></table></div>
    <p class="ayuda">Más: <a href="/tipo-marginal-real/">de cada 100 € más, cuánto te queda</a> · <a href="/comparar-ofertas/">comparar dos ofertas de trabajo</a></p>
  </div>
  ${B.deducciones}
  ${bloqueFaq(faq)}
  ${botones(c)}
  <p class="ayuda">Otros sueldos en ${esc(n)}: ${vecinos(lista, b, x => rutaTer(x, c), x => euros(x))} · <a href="${rutaNac(b)}">${esc(euros(b))} en los 19 territorios</a> · ${FORAL.has(c) ? enlacesTerritorio(c, v) : `<a href="/irpf/${SLUG[c]}/">${esc(ANCLAS_IRPF[iB % ANCLAS_IRPF.length](conArticulo(n)))}</a>${conDeducciones.has(c) ? ` · <a href="/irpf/${SLUG[c]}/deducciones/">${esc(ANCLAS_DED[iB % ANCLAS_DED.length](conArticulo(n), ejercicioDeducciones))}</a>` : ""}`}</p>
  </div>`;
    return layout({
      jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
      title: `Sueldo neto ${euros(b)} en ${NOMBRE_CORTO[c]} (${EJ}): ${euros(f.neto / 14)}/mes`,
      description: `${euros(b)} brutos en ${n} son ${euros(f.neto)} netos al año en ${EJ}: ${euros(f.neto / 12)} al mes en 12 pagas o ${euros(f.neto / 14)} en 14. Desglose de IRPF y Seguridad Social y comparación con los 19 territorios.`,
      canonical: rutaTer(b, c), breadcrumb: migasHtml(migas), main, generado: gen, ejercicio: EJ
    });
  }

  // ---- nacional por importe ------------------------------------------------------------
  function tabla19(b, mensualDe) {
    return `<div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Puesto</th><th>Territorio</th><th class="num">Neto anual</th><th class="num">12 pagas</th><th class="num">14 pagas</th><th class="num">IRPF</th><th class="num">Tipo medio sobre el bruto</th><th class="num">Carga total (IRPF + SS)</th><th class="num">Marginal IRPF</th></tr></thead><tbody>${ranking(b).map((x, i) =>
      `<tr><td class="num">${i + 1}</td><td>${enlaceTer(b, x.c, nombre(x.c))}</td><td class="num">${esc(euros(x.neto))}</td><td class="num"${mensualDe === 12 ? ' style="font-weight:700"' : ""}>${esc(euros(x.neto / 12))}</td><td class="num"${mensualDe === 14 ? ' style="font-weight:700"' : ""}>${esc(euros(x.neto / 14))}</td><td class="num">${esc(euros(x.irpf))}</td><td class="num">${esc(pctMedio(x.irpf / b))}</td><td class="num">${esc(pctMedio((x.irpf + ss(b).total) / b))}</td><td class="num">${esc(pctMedio(x.marginal_irpf))}</td></tr>`).join("")}</tbody></table></div>`;
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
      [`¿Cuánto se paga de Seguridad Social con ${euros(b)}?`, `${euros(s.total)} al año, el ${pctMedio(s.total / b)} del bruto, igual en los 19 territorios (contrato indefinido).`]
    ];
    // Sueldos vecinos: rango de neto entre territorios y Madrid, del motor.
    const iB = importes.indexOf(b), vent = importes.slice(Math.max(0, iB - 2), iB + 3);
    const filasVent = vent.map(x => { const rx = ranking(x); return `<tr${x === b ? ' class="destacada"' : ""}><td>${x === b ? `<b>${esc(euros(x))}</b>` : `<a href="${rutaNac(x)}">${esc(euros(x))}</a>`}</td><td class="num">${esc(euros(rx.at(-1).neto))}</td><td class="num">${esc(euros(rx[0].neto))}</td><td class="num">${esc(euros(rx[0].neto - rx.at(-1).neto))}</td><td class="num">${esc(euros(fila(x, "ES-MD").neto))}</td></tr>`; }).join("");
    const sigB = importes[iB + 1];
    const marg = r.map(x => x.marginal_irpf), mMin = Math.min(...marg), mMax = Math.max(...marg);
    const cambio = (sigB ? `De ${euros(b)} a ${euros(sigB)} brutos, el neto en Madrid sube ${euros(fila(sigB, "ES-MD").neto - md.neto)} al año y la distancia entre el territorio que más deja y el que menos pasa de ${euros(mejor.neto - peor.neto)} a ${euros(ranking(sigB)[0].neto - ranking(sigB).at(-1).neto)}.` : `Entre el territorio que más deja y el que menos hay ${euros(mejor.neto - peor.neto)} al año.`)
      + (mMax === 0 ? ` Con ${euros(b)} el tipo marginal del IRPF es 0 en los 19 territorios: un euro más de sueldo solo paga Seguridad Social.` : ` El tipo marginal del IRPF con este sueldo va del ${pctMedio(mMin)} al ${pctMedio(mMax)} según el territorio; con 1.000 € brutos más, en Madrid el neto subiría unos ${euros(1000 * (1 - md.marginal))}.`);
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
  ${graficoBrutoNeto({ serie: serieSueldoNeto(d), marca: b, titulo: "Del bruto al neto: media de los 19 territorios", pie: `Media de los 19 territorios del neto mensual en 12 pagas y del tipo medio del IRPF para cada sueldo bruto anual de ${euros(importes[0])} a ${euros(importes.at(-1))} (${EJ}, persona soltera sin hijos). El punto marca ${euros(b)}.` })}
  <div class="tarjeta"><h2 class="rotulo">Cuánto cambia con el sueldo</h2>
    <p>${esc(cambio)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Bruto anual</th><th class="num">Neto mínimo</th><th class="num">Neto máximo</th><th class="num">Diferencia</th><th class="num">Neto en Madrid</th></tr></thead><tbody>${filasVent}</tbody></table></div></div>
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
      canonical: rutaNac(b), breadcrumb: migasHtml(migas), main, generado: gen, ejercicio: EJ
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
      canonical: rutaMes(m), breadcrumb: migasHtml(migas), main, generado: gen, ejercicio: EJ
    });
  }

  function paginaIndice() {
    const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"]];
    const main = `
  <h1>Sueldo neto en ${EJ}: de bruto a neto en los 19 territorios</h1>
  <p class="entradilla">Cuánto queda en neto de cada sueldo bruto, en 12 y en 14 pagas, tras el IRPF y la Seguridad Social del ejercicio ${EJ}, en las 15 comunidades de régimen común, las tres diputaciones forales vascas y Navarra. ${esc(supuesto)}</p>
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Sueldos al mes</h2><ul class="lista-enlaces">${d.mensuales.map(m => `<li><a href="${rutaMes(m)}">${esc(euros(m))} brutos al mes a netos</a></li>`).join("")}</ul>
    <p>¿Tienes el bruto anual y quieres saber cuánto es al mes? <a href="/sueldo-mensual/">Sueldo bruto entre 12 y 14 pagas: tabla de 15.000 a 60.000 €</a>.</p></div>
  <div class="tarjeta"><h2 class="rotulo">Sueldos al año</h2><ul class="lista-enlaces">${importes.map(b => `<li><a href="${rutaNac(b)}">${esc(euros(b))} brutos a netos</a></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Por territorio</h2><p>Cada importe enlaza el detalle de los 19 territorios para ${d.importes_territorio.length} sueldos, de ${esc(euros(d.importes_territorio[0]))} a ${esc(euros(d.importes_territorio[d.importes_territorio.length - 1]))}. Por ejemplo, 30.000 € en ${ORDEN_TERRITORIOS.map(c => `<a href="${rutaTer(30000, c)}">${esc(nombre(c))}</a>`).join(", ")}.</p></div>
  ${botones()}
  <p class="ayuda"><a href="/comparar-sueldo/">Dónde se paga menos IRPF</a> · <a href="/irpf/">IRPF por territorio</a></p>
  </div>`;
    return layout({
      jsonld: [jsonLdMigas(migas)],
      title: `Sueldo neto ${EJ}: de bruto a neto en 12 y 14 pagas por territorio | Mapafiscal`,
      description: `Tablas de sueldo neto ${EJ} de 15.000 a 100.000 € brutos y de los sueldos mensuales más buscados, en 12 y 14 pagas, en los 19 territorios fiscales de España.`,
      canonical: "/sueldo-neto/", breadcrumb: migasHtml(migas), main, generado: gen, ejercicio: EJ
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
