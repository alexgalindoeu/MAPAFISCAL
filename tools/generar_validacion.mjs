// Página pública «Cómo comprobamos los cálculos» (web/validacion/index.html), hecha solo con
// datos reales del repositorio:
//   - el validador R ↔ JS: cada caso de tools/casos.json se liquida con web/js/irpfsim.js y se
//     compara con la referencia del motor R (tools/validar_js_node.js);
//   - una muestra de esos casos, con su entrada y su resultado;
//   - los ejemplos oficiales (AEAT y Hacienda Foral) documentados en docs/03_casos_validacion.md,
//     recalculados con el motor de la web;
//   - la última modificación de los parámetros de cada territorio (git blame de params/);
//   - el registro de cambios del motor (git log de R/, params/ y web/js/irpfsim.js).
//
//   node tools/generar_validacion.mjs              escribe web/validacion/index.html
//   node tools/generar_validacion.mjs --comprobar  lo que hace la CI: falla si algún caso
//        R ↔ JS no coincide o si un ejemplo oficial citado ya no está en docs/03 o el motor ya
//        no da su cifra. No compara con la página guardada: «Publicar web» la regenera con el
//        historial completo antes de cada publicación, así que siempre sale al día.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { layout, esc, miles, fecha, jsonLdMigas, migasHtml } from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = require("./validar_js_node.js");
const irpfsim = require(join(RAIZ, "web/js/irpfsim.js"));
// Sin enlaces al repositorio: su dirección lleva el nombre del titular (decisión de Alex, 17-11-2026).
const SALIDA = "web/validacion/index.html";
const leer = f => readFileSync(join(RAIZ, f), "utf8");

const eur = n => {
  const v = Math.abs(n || 0).toFixed(2).split(".");
  return (n < -0.004 ? "−" : "") + miles(v[0]) + "," + v[1] + " €";
};

// ---- git ------------------------------------------------------------------------------------
function git(args) {
  try { return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); }
  catch (e) { return null; }
}
const historialCompleto = () => { const s = git(["rev-parse", "--is-shallow-repository"]); return s != null && s.trim() === "false"; };
const isoDe = t => new Date(t * 1000).toISOString().slice(0, 10);

// fecha (segundos) de la última modificación de cada línea de un fichero
function fechasPorLinea(fichero) {
  const s = git(["blame", "--line-porcelain", "--", fichero]);
  if (!s) return null;
  const fechas = [];
  let t = 0;
  for (const l of s.split("\n")) {
    if (l.startsWith("committer-time ")) t = +l.slice(15);
    else if (l.startsWith("\t")) fechas.push(t);
  }
  return fechas;
}
// bloques de un YAML: líneas de cada `  ES-XX:` (sangría 2) y de cada clave de primer nivel
function bloquesYaml(texto) {
  const lineas = texto.split("\n"), bloques = {};
  let actual = null, raiz = null;
  lineas.forEach((l, i) => {
    let m;
    if (!l.trim()) return;                 // las líneas en blanco no cuentan
    if ((m = l.match(/^([A-Za-z_]+):/))) { raiz = m[1]; actual = null; (bloques[raiz] = bloques[raiz] || []).push(i); return; }
    if ((m = l.match(/^  (ES-[A-Z]{2}(?:-[A-Z]{2})?):/))) { actual = m[1]; }
    if (actual) (bloques[actual] = bloques[actual] || []).push(i);
    else if (raiz) bloques[raiz].push(i);
    else (bloques._cabecera = bloques._cabecera || []).push(i);
  });
  return bloques;
}
function fechaMax(fechas, lineas) {
  if (!fechas || !lineas || !lineas.length) return 0;
  return Math.max(...lineas.map(i => fechas[i] || 0));
}

// Última modificación de los parámetros de cada territorio y ejercicio. Un ejercicio que hereda
// de otro (meta.hereda_de) incluye la fecha de lo heredado.
function fechasTerritorios(territorios, ejercicios) {
  const cache = {};
  const ficha = f => {
    if (!(f in cache)) {
      const ruta = join(RAIZ, f);
      cache[f] = existsSync(ruta) ? { fechas: fechasPorLinea(f), bloques: bloquesYaml(readFileSync(ruta, "utf8")) } : null;
    }
    return cache[f];
  };
  const fueraDeTerritorios = b => Object.entries(b).filter(([k]) => !/^ES-/.test(k) && k !== "territorios" && k !== "overrides").flatMap(([, v]) => v);
  const res = { estatal: {}, territorios: {} };
  let anterior = null;
  for (const a of ejercicios) {
    const fEst = ficha(`params/${a}/estatal.yaml`);
    const est = fEst ? fechaMax(fEst.fechas, fEst.fechas && fEst.fechas.map((_, i) => i)) : 0;
    res.estatal[a] = Math.max(est, anterior ? res.estatal[anterior] : 0);
    for (const [codigo, t] of Object.entries(territorios)) {
      let f = 0;
      if (t.regimen === "comun") {
        const x = ficha(`params/${a}/autonomico.yaml`);
        if (x) f = Math.max(fechaMax(x.fechas, x.bloques[codigo]), anterior ? fechaMax(x.fechas, fueraDeTerritorios(x.bloques)) : 0);
      } else if (t.regimen === "foral_pais_vasco") {
        const x = ficha(`params/${a}/foral_pais_vasco.yaml`);
        if (x) f = Math.max(fechaMax(x.fechas, x.bloques[codigo]), fechaMax(x.fechas, fueraDeTerritorios(x.bloques)));
      } else {
        const x = ficha(`params/${a}/navarra.yaml`);
        if (x && x.fechas) f = fechaMax(x.fechas, x.fechas.map((_, i) => i));
      }
      const previo = anterior ? res.territorios[codigo][anterior] : 0;
      (res.territorios[codigo] = res.territorios[codigo] || {})[a] = Math.max(f, previo || 0);
    }
    anterior = a;
  }
  return res;
}

// Registro de cambios del motor: commits (sin fusiones) que tocan el motor o sus parámetros.
function registroCambios(n = 40) {
  const s = git(["log", "--no-merges", `-n${n}`, "--date=short", "--format=%H%x09%ad%x09%s", "--", "R", "params", "web/js/irpfsim.js"]);
  if (!s) return null;
  return s.trim().split("\n").filter(Boolean).map(l => { const [hash, dia, asunto] = l.split("\t"); return { hash, dia, asunto: limpiarAsunto(asunto) }; })
    .filter(c => c.asunto);
}
// Fuera los commits de trabajo (WIP, importación inicial) y, del asunto, las coletillas sobre
// lo que queda por cotejar: el estado de cada parámetro ya se ve en Metodología.
function limpiarAsunto(a) {
  if (!a || /^(WIP\b|Importar$|Merge\b)/i.test(a.trim())) return "";
  return a.split(/(?<=[,;]) /).filter(p => !/provisional|incomplet|pendiente/i.test(p)).join(" ").replace(/[,;]\s*$/, "").trim();
}

// ---- ejemplos oficiales documentados en docs/03 ------------------------------------------------
// Solo los que docs/03_casos_validacion.md recoge con su cifra oficial. `anclas` tienen que seguir
// estando en docs/03; `cifras` se recalculan con el motor de la web y deben coincidir al céntimo.
const EJEMPLOS = [
  {
    caso: "da61_aeat_md", fuente: "AEAT",
    titulo: "Ejemplo 1 de la AEAT: Madrid, 16.500 € íntegros del trabajo y 1.200 € de cotizaciones",
    anclas: ["### Ejemplo 1 de la AEAT (Madrid, 16.500 € íntegros, 1.200 € de cotizaciones)", "**187,19 €**"],
    cifras: [
      ["Base liquidable general", 6782, l => l.baseLiquidableGeneral],
      ["Cuota íntegra total (estatal + autonómica)", 187.19, l => l.cuotaIntegraEstatal + l.cuotaIntegraAutonomica]
    ]
  },
  {
    caso: "aeat_ejemplo_ar", fuente: "AEAT",
    titulo: "Ejemplo práctico de la AEAT «Cálculo de las cuotas íntegras estatal y autonómica»: Aragón, base general de 23.900 € y del ahorro de 2.800 €",
    anclas: ["**Ejemplo práctico de la AEAT** (*Cálculo de las cuotas íntegras estatal y autonómica*)", "**2.406,50 €**", "**2.360,64 €**"],
    cifras: [
      ["Cuota íntegra estatal", 2406.50, l => l.cuotaIntegraEstatal],
      ["Cuota íntegra autonómica", 2360.64, l => l.cuotaIntegraAutonomica]
    ]
  },
  {
    caso: "nc_ejemplo4_manual", fuente: "Hacienda Foral de Navarra", modo: "individual",
    titulo: "Ejemplo 4 del Manual teórico Renta y Patrimonio 2025 de la Hacienda Foral de Navarra: Paco (16.000 €) y Teresa (27.000 €), hijos de 2, 5 y 7 años, declaraciones individuales",
    anclas: ["**Cotejo con el manual de Hacienda Foral**", "Paco × 1,40 = **1.659,70 €**", "**1.452,24 €**"],
    cifras: [
      ["Deducción por mínimo familiar de Paco + la de Teresa (1.659,70 + 1.452,24)", 3111.94, l => l.deduccionesAutonomicas.detalle.minimoFamiliar]
    ]
  }
];
function comprobarEjemplos(CASOS, PS, docs) {
  return EJEMPLOS.map(e => {
    const c = CASOS[e.caso];
    const faltan = e.anclas.filter(a => !docs.includes(a));
    let filas = [], error = null;
    if (!c) error = `falta el caso ${e.caso} en tools/casos.json`;
    else {
      try {
        const l = irpfsim.liquidar(c.js, PS[c.js.ejercicio], e.modo || "auto");
        filas = e.cifras.map(([n, oficial, f]) => { const m = f(l); return { concepto: n, oficial, motor: m, ok: Math.abs(m - oficial) <= 0.005 }; });
      } catch (x) { error = x.message; }
    }
    return Object.assign({}, e, { ejercicio: c && c.js.ejercicio, territorio: c && c.js.territorio, faltan, filas, error,
      ok: !error && !faltan.length && filas.every(f => f.ok) });
  });
}

// ---- muestra de casos ---------------------------------------------------------------------------
const ETIQUETAS = { dinerarias: "trabajo", cotizacionesSs: "cotizaciones", intereses: "intereses", dividendos: "dividendos",
  gananciasPerdidasNoTransmision: "ganancias", bruto: "sueldo bruto", aportacionIndividual: "plan de pensiones",
  antes2007: "plan (hasta 2006)", despues2007: "plan (desde 2007)", otrosIngresos: "otros ingresos", donativos: "donativos",
  alquilerVivienda: "alquiler", retenciones: "retenciones" };
function resumenEntrada(js, nombres) {
  const partes = [`${nombres[js.territorio] || js.territorio}, ${js.ejercicio}`];
  const miembros = js.miembros || [];
  const quien = { declarante: "declarante", conyuge: "cónyuge", descendiente: "hijo", ascendiente: "ascendiente" };
  for (const m of miembros) {
    const dinero = [];
    (function rec(o) {
      for (const [k, v] of Object.entries(o || {})) {
        if (typeof v === "number" && v > 0 && k !== "edad" && ETIQUETAS[k]) dinero.push(`${ETIQUETAS[k]} ${miles(String(Math.round(v)))} €`);
        else if (v && typeof v === "object" && !Array.isArray(v)) rec(v);
      }
    })(m);
    partes.push(`${quien[m.rol] || m.rol} de ${m.edad} años${dinero.length ? " (" + dinero.join(", ") + ")" : ""}`);
  }
  if (!miembros.length) {
    const dinero = Object.entries(js).filter(([k, v]) => typeof v === "number" && v > 0 && ETIQUETAS[k]).map(([k, v]) => `${ETIQUETAS[k]} ${miles(String(Math.round(v)))} €`);
    if (js.edad) dinero.unshift(`${js.edad} años`);
    partes.push(dinero.join(", "));
  }
  return partes.join(" · ");
}
const CIFRA_PRINCIPAL = { liquidacion: ["cl", "Cuota líquida"], neto: ["neto", "Sueldo neto anual"], rescate: ["capital", "IRPF extra de rescatar de una vez"] };
function muestra(res, territorios) {
  // un caso de cada grupo, el primero por orden alfabético: régimen común, País Vasco y Navarra en
  // cada ejercicio, más un sueldo neto y un rescate del plan de pensiones
  const grupos = [];
  const ejercicios = [...new Set(res.map(r => r.caso.js.ejercicio))].sort();
  for (const a of ejercicios) for (const reg of ["comun", "foral_pais_vasco", "foral_navarra"])
    grupos.push(r => r.tipo === "liquidacion" && r.caso.js.ejercicio === a && territorios[r.caso.js.territorio] && territorios[r.caso.js.territorio].regimen === reg);
  grupos.push(r => r.tipo === "neto", r => r.tipo === "rescate");
  const orden = [...res].sort((x, y) => x.id.localeCompare(y.id));
  return grupos.map(g => orden.find(g)).filter(Boolean);
}

// ---- página -------------------------------------------------------------------------------------
function construir({ conGit = true, previa = null } = {}) {
  const CASOS = V.cargarCasos(), PS = V.cargarParams();
  const res = V.validar(CASOS, PS);
  const docs = leer("docs/03_casos_validacion.md");
  const ejemplos = comprobarEjemplos(CASOS, PS, docs);
  const ejercicios = Object.keys(PS).map(Number).sort();
  const Pdef = PS[Math.min(...ejercicios.filter(a => PS[a].territorios))] || PS[ejercicios[0]];
  const territorios = Pdef.territorios;
  const nombres = Object.fromEntries(Object.entries(territorios).map(([k, t]) => [k, t.nombre]));

  const ok = res.filter(r => !r.error && !r.fallos.length);
  const cifras = res.reduce((s, r) => s + r.comprobaciones.length, 0);
  const porEjercicio = ejercicios.map(a => [a, res.filter(r => r.caso.js.ejercicio === a).length]).filter(([, n]) => n);
  const terrCubiertos = new Set(res.map(r => r.caso.js.territorio)).size;
  const porTipo = t => res.filter(r => r.tipo === t).length;

  let git = previa && previa.git;
  if (conGit) git = { fechas: fechasTerritorios(territorios, ejercicios), cambios: registroCambios() };
  const generado = (git && git.cambios && git.cambios[0] && git.cambios[0].dia) || new Date().toISOString().slice(0, 10);

  const tablaCasos = muestra(res, territorios).map(r => {
    const [k, n] = CIFRA_PRINCIPAL[r.tipo];
    const c = r.comprobaciones.find(x => x[0] === k) || [];
    const bien = !r.error && !r.fallos.length;
    return `<tr><td><code class="id-caso">${esc(r.id)}</code><br>${esc(resumenEntrada(r.caso.js, nombres))}
      <details><summary>Entrada completa (JSON)</summary><pre class="json">${esc(JSON.stringify(r.caso.js))}</pre></details></td>
      <td>${esc(n)}</td><td class="num">${typeof c[2] === "number" ? eur(c[2]) : esc(String(c[2]))}</td>
      <td class="num">${typeof c[1] === "number" ? eur(c[1]) : esc(String(c[1]))}</td><td>${bien ? "Coinciden" : "No coinciden"}</td></tr>`;
  }).join("\n");

  const bloqueEjemplos = ejemplos.map(e => `<div class="tarjeta">
    <h3>${esc(e.titulo)}</h3>
    <p class="ayuda">Fuente: ${esc(e.fuente)} · Ejercicio ${esc(e.ejercicio)} · caso <code>${esc(e.caso)}</code> del validador</p>
    <table class="cobertura"><thead><tr><th>Cifra</th><th class="num">Oficial</th><th class="num">Mapafiscal</th><th></th></tr></thead><tbody>
    ${e.filas.map(f => `<tr><td>${esc(f.concepto)}</td><td class="num">${eur(f.oficial)}</td><td class="num">${eur(f.motor)}</td><td>${f.ok ? "Al céntimo" : "Distinta"}</td></tr>`).join("")}
    </tbody></table></div>`).join("\n");

  const fechasHtml = !git || !git.fechas ? "" : `
  <h2 id="territorios">Última actualización de cada territorio</h2>
  <p>Fecha del último cambio en los parámetros de cada territorio (escalas, mínimos, deducciones), sacada del historial de
  params/. Un ejercicio que hereda del anterior cuenta también los cambios de lo heredado.
  Núcleo estatal (Ley del IRPF): ${ejercicios.map(a => `${a}, ${esc(fecha(isoDe(git.fechas.estatal[a])))}`).join("; ")}.</p>
  <div class="tarjeta tarjeta-tabla"><table class="cobertura"><thead><tr><th>Territorio</th>${ejercicios.map(a => `<th class="num">Ejercicio ${a}</th>`).join("")}</tr></thead><tbody>
  ${Object.keys(territorios).map(k => `<tr><td>${esc(nombres[k])}</td>${ejercicios.map(a => `<td class="num">${git.fechas.territorios[k] && git.fechas.territorios[k][a] ? esc(isoDe(git.fechas.territorios[k][a]).split("-").reverse().join("-")) : "—"}</td>`).join("")}</tr>`).join("\n")}
  </tbody></table></div>`;

  const cambiosHtml = !git || !git.cambios ? "" : `
  <h2 id="cambios">Registro de cambios del motor</h2>
  <p>Los últimos ${git.cambios.length} cambios en el motor de cálculo (R/,
  web/js/irpfsim.js) y en sus parámetros (params/).
  El historial completo está en el repositorio del proyecto.</p>
  <ul class="registro-cambios">
  ${git.cambios.map(c => `<li><time datetime="${c.dia}">${esc(c.dia.split("-").reverse().join("-"))}</time> <code>${c.hash.slice(0, 7)}</code> ${esc(c.asunto)}</li>`).join("\n  ")}
  </ul>`;

  const titulo = "Cómo comprobamos los cálculos | Mapafiscal";
  const descripcion = `Cómo se verifica la calculadora del IRPF de Mapafiscal: ${res.length} casos que el motor de referencia en R y el de la web dan iguales al céntimo, ejemplos oficiales de la AEAT y la Hacienda Foral, fechas de actualización por territorio y registro de cambios.`;
  const migas = [["Mapafiscal", "/"], ["Cómo comprobamos los cálculos", "/validacion/"]];
  const main = `
  <h1>Cómo comprobamos los cálculos</h1>
  <p class="entradilla">Todo lo que ves aquí sale del propio repositorio de Mapafiscal, que es público, y se regenera en cada publicación de la web.</p>

  <h2 id="validador">Dos motores que tienen que dar lo mismo</h2>
  <p>El IRPF se calcula con dos programas escritos por separado: el motor de referencia en R y el de la web en JavaScript, que es el que corre en tu navegador.
  Un validador liquida cada caso de prueba con los dos y exige que coincidan al céntimo (±0,02 €) en las bases liquidables, los mínimos, las cuotas íntegras, líquida, resultante y diferencial, la modalidad de tributación y la obligación de declarar.</p>
  <dl class="comprobacion-cifras">
    <div><dt>Casos de prueba</dt><dd>${res.length}</dd></div>
    <div><dt>Coinciden al céntimo</dt><dd>${ok.length} de ${res.length}</dd></div>
    <div><dt>Cifras comparadas</dt><dd>${miles(String(cifras))}</dd></div>
    <div><dt>Territorios con casos</dt><dd>${terrCubiertos} de ${Object.keys(territorios).length}</dd></div>
  </dl>
  <p>Por ejercicio: ${porEjercicio.map(([a, n]) => `${a}, ${n} casos`).join("; ")}. Por tipo: ${porTipo("liquidacion")} declaraciones completas, ${porTipo("neto")} de sueldo neto y ${porTipo("rescate")} de rescate del plan de pensiones.
  Los casos están en tools/validar_js.R y el cálculo a mano de muchos de ellos, en docs/03_casos_validacion.md.</p>

  <h2 id="muestra">Una muestra de los casos</h2>
  <p>Un caso de cada grupo (régimen común, País Vasco y Navarra en cada ejercicio, sueldo neto y rescate), con su entrada y la cifra principal de cada motor.</p>
  <div class="tarjeta tarjeta-tabla"><table class="cobertura muestra-casos"><thead><tr><th>Caso y entrada</th><th>Cifra</th><th class="num">Motor R</th><th class="num">Web (JS)</th><th>Resultado</th></tr></thead><tbody>
  ${tablaCasos}
  </tbody></table></div>

  <h2 id="oficiales">Cotejados con ejemplos oficiales</h2>
  <p>Además de comparar los dos motores entre sí, algunos casos reproducen ejemplos resueltos por la Agencia Tributaria y por las haciendas forales. Estos son los que tenemos documentados, recalculados ahora con el motor de la web:</p>
  ${bloqueEjemplos}
  <p class="ayuda">Los parámetros se cotejan además con el BOE, los boletines autonómicos y forales y el Manual Práctico de Renta de la AEAT: cada cifra del motor lleva la norma de la que sale.</p>
  ${fechasHtml}
  ${cambiosHtml}

  <h2 id="error">¿Has visto un error?</h2>
  <p>Debajo de cada resultado de la calculadora y de las herramientas hay un enlace «Comunicar un error»: abre tu correo con los datos del cálculo para que nos digas qué cifra esperabas y de dónde sale. También puedes escribir a <a href="mailto:contacto@mapafiscal.es">contacto@mapafiscal.es</a>.</p>`;

  const html = layout({ title: titulo, description: descripcion, canonical: "/validacion/", breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas)] }).replace("</body>", `<script type="application/json" id="datos-validacion">${JSON.stringify({ git }).replace(/</g, "\\u003c")}</script>\n</body>`);
  return { html, res, ok, ejemplos };
}

function leerPrevia() {
  const ruta = join(RAIZ, SALIDA);
  if (!existsSync(ruta)) return null;
  const m = readFileSync(ruta, "utf8").match(/<script type="application\/json" id="datos-validacion">([^<]*)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

export { construir, EJEMPLOS, bloquesYaml };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const comprobar = process.argv.includes("--comprobar");
  const conGit = historialCompleto();
  if (!conGit) console.log("Historial de git incompleto (clon superficial): se conservan las fechas y el registro de cambios de la página guardada.");
  const { html, res, ok, ejemplos } = construir({ conGit, previa: conGit ? null : leerPrevia() });
  const errores = [];
  if (ok.length !== res.length) errores.push(`${res.length - ok.length} casos R ↔ JS no coinciden (node tools/validar_js_node.js)`);
  for (const e of ejemplos) {
    if (e.error) errores.push(`${e.caso}: ${e.error}`);
    for (const a of e.faltan) errores.push(`${e.caso}: docs/03 ya no dice «${a}»`);
    for (const f of e.filas.filter(f => !f.ok)) errores.push(`${e.caso}: ${f.concepto}: oficial ${f.oficial}, motor ${f.motor}`);
  }
  if (errores.length) { console.error("generar_validacion: " + errores.join("\n  ")); process.exit(1); }
  if (comprobar) { console.log(`validacion: ${res.length} casos R ↔ JS y ${ejemplos.length} ejemplos oficiales, todo bien.`); process.exit(0); }
  mkdirSync(dirname(join(RAIZ, SALIDA)), { recursive: true });
  writeFileSync(join(RAIZ, SALIDA), html);
  console.log(`${SALIDA}: ${res.length} casos, ${ejemplos.length} ejemplos oficiales.`);
}
