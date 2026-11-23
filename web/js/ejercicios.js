/* =============================================================================
 * Mapafiscal — el mismo caso en dos ejercicios (vista #ejercicios)
 * El mismo sueldo, en el mismo territorio, liquidado con los parámetros de dos ejercicios
 * (params_<año>.json y params.json): cuánto cambian el neto y el IRPF y qué conceptos
 * cambian, con la cifra de cada año sacada de los propios parámetros. No calcula nada
 * propio: usa irpfsim.sueldoNeto (paridad con R/15_sueldo_neto.R). Se carga después de
 * app.js, que muestra la vista y avisa con «mapafiscal:vista».
 * Enlace: #ejercicios?b=<bruto>&t=<territorio>. Las página /irpf-<año>-vs-<año>/
 * (tools/seo_comparadores.mjs) usa los mismos cálculos.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    ejercicios: { titulo: "El mismo sueldo en dos ejercicios", icono: "ejercicios", href: "#ejercicios",
      texto: "Tu IRPF y tu neto de un año frente al siguiente, y qué ha cambiado: mínimos, escala y deducción del SMI." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-ejercicios"))) return;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const TOPE = 5e6;
  const SITUACION = { edad: 35, hijos: [], tipoContrato: "indefinido" };

  // ---- formato (también para las páginas SEO) -------------------------------------------
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  const eur = n => {   // con céntimos solo si los tiene
    const v = Math.round(Math.abs(n) * 100) / 100, [e, d] = v.toFixed(2).split(".");
    return (n < 0 ? "−" : "") + miles(e) + (d !== "00" ? "," + d : "") + " €";
  };
  const pc = n => String(Math.round(n * 100000) / 1000).replace(".", ",") + " %";

  // ---- cálculos (también los usan test/ejercicios.test.mjs y tools/seo_comparadores.mjs) ----
  const sinMeta = o => JSON.stringify(o, (k, v) => (k === "norma" || k === "fuente" || k === "estado" ? undefined : v));
  const iguales = (a, b) => sinMeta(a) === sinMeta(b);
  // escala: [{hasta, tipo}] -> «del 9,5 % al 24,5 % en 6 tramos»
  const resumenEscala = e => `del ${pc(e[0].tipo)} al ${pc(e[e.length - 1].tipo)} en ${e.length} tramos`;
  const tramoTxt = (e, i) => i === 0 ? `hasta ${eur(e[0].hasta)}` : e[i].hasta == null ? `más de ${eur(e[i - 1].hasta)}` : `de ${eur(e[i - 1].hasta)} a ${eur(e[i].hasta)}`;
  // filas de una escala: si cambia, un tramo por fila (los límites y el tipo de cada año)
  function filasEscala(ea, eb) {
    if (iguales(ea, eb)) return [{ etq: "Tipos", a: resumenEscala(ea), b: resumenEscala(eb) }];
    const n = Math.max(ea.length, eb.length), out = [];
    for (let i = 0; i < n; i++) {
      const x = ea[i], y = eb[i];
      if (x && y && iguales(x, y)) continue;
      out.push({ etq: `Tramo ${i + 1}`, a: x ? `${tramoTxt(ea, i)}: ${pc(x.tipo)}` : "—", b: y ? `${tramoTxt(eb, i)}: ${pc(y.tipo)}` : "—" });
    }
    return out;
  }
  const fila = (etq, va, vb, f = eur) => ({ etq, a: va == null ? "—" : f(va), b: vb == null ? "—" : f(vb) });
  const escalaPv = (P, t) => ((P.foral_pv.overrides && P.foral_pv.overrides[t]) || {}).escala_general_foral || P.foral_pv.escala_general_foral;
  const pvBloque = (P, t, k) => Object.assign({}, P.foral_pv[k] || {}, ((P.foral_pv.overrides && P.foral_pv.overrides[t]) || {})[k] || {});
  const CLAVE_PV = { "ES-PV-BI": "importe_bizkaia", "ES-PV-SS": "importe_gipuzkoa", "ES-PV-VI": "importe_araba" };

  // Conceptos que fijan el IRPF de un asalariado sin hijos, con la cifra de cada ejercicio.
  // c: { titulo, norma (la del ejercicio nuevo), cambia, filas: [{ etq, a, b }], nota }
  function conceptos(Pa, Pb, t, bruto) {
    const reg = Pb.territorios[t].regimen, L = [];
    const add = (titulo, va, vb, filas, nota) => L.push({ titulo, norma: (vb && vb.norma) || (va && va.norma) || null,
      cambia: !iguales(va, vb), filas, nota: nota || null });
    const ca = Pa.estatal.cotizaciones_trabajador, cb = Pb.estatal.cotizaciones_trabajador;
    const tipoOrd = c => c.tipos.contingencias_comunes + c.tipos.desempleo_indefinido + c.tipos.formacion_profesional + c.tipos.mei;
    if (reg === "comun") {
      const ma = Pa.estatal.minimo_contribuyente, mb = Pb.estatal.minimo_contribuyente;
      add("Mínimo del contribuyente (estatal)", ma, mb, [fila("General", ma.general, mb.general), fila("Más de 65 años", ma.incremento_mayor_65, mb.incremento_mayor_65)]);
      const aa = Pa.territorios[t].minimo_autonomico, ab = Pb.territorios[t].minimo_autonomico;
      if (aa || ab) add(`Mínimo del contribuyente (${Pb.territorios[t].nombre})`, aa, ab,
        [fila("General", aa && aa.minimo_contribuyente.general, ab && ab.minimo_contribuyente.general)]);
      const ea = Pa.estatal.escala_general_estatal, eb = Pb.estatal.escala_general_estatal;
      add("Escala general estatal", ea, eb, filasEscala(ea, eb));
      const xa = Pa.territorios[t].escala_general_autonomica, xb = Pb.territorios[t].escala_general_autonomica;
      add(`Escala autonómica de ${Pb.territorios[t].nombre}`, xa, xb, filasEscala(xa, xb));
      const ra = Pa.estatal.trabajo_reduccion_art20, rb = Pb.estatal.trabajo_reduccion_art20;
      add("Reducción por rendimientos del trabajo (art. 20)", ra, rb, [fila("Reducción máxima", ra.importe_maximo, rb.importe_maximo),
        fila("Rendimiento neto con la reducción máxima, hasta", ra.umbral_pleno, rb.umbral_pleno), fila("Se anula con un rendimiento neto de", ra.umbral_final, rb.umbral_final)]);
      const da = Pa.estatal.deduccion_obtencion_rendimientos_trabajo, db = Pb.estatal.deduccion_obtencion_rendimientos_trabajo;
      if (da || db) {
        const tope = Math.max(da ? da.umbral_final : 0, db ? db.umbral_final : 0);
        add("Deducción por obtención de rendimientos del trabajo (la del SMI)", da, db, [fila("Deducción máxima", da && da.importe_maximo, db && db.importe_maximo),
          fila("Rendimiento íntegro con la deducción máxima, hasta", da && da.umbral_pleno, db && db.umbral_pleno), fila("Se anula con un rendimiento íntegro de", da && da.umbral_final, db && db.umbral_final)],
          bruto < tope ? `Con ${eur0(bruto)} brutos te afecta: solo se aplica por debajo de ${eur(tope)} de rendimiento íntegro del trabajo.` : `Con ${eur0(bruto)} brutos no se te aplica: solo cuenta por debajo de ${eur(tope)} de rendimiento íntegro del trabajo.`);
      }
    } else if (reg === "foral_pais_vasco") {
      const ea = escalaPv(Pa, t), eb = escalaPv(Pb, t);
      add(`Escala general de ${Pb.territorios[t].nombre}`, ea, eb, filasEscala(ea, eb));
      const ma = pvBloque(Pa, t, "minoracion_cuota"), mb = pvBloque(Pb, t, "minoracion_cuota");
      add("Minoración general de la cuota", ma[CLAVE_PV[t]], mb[CLAVE_PV[t]], [fila("Importe", ma[CLAVE_PV[t]], mb[CLAVE_PV[t]])]);
      L[L.length - 1].norma = mb.norma || ma.norma || null;
      const ba = pvBloque(Pa, t, "bonificacion_trabajo"), bb = pvBloque(Pb, t, "bonificacion_trabajo");
      add("Bonificación de los rendimientos del trabajo", ba, bb, [fila("Bonificación máxima", ba.importe_pleno, bb.importe_pleno),
        fila("Hasta un rendimiento neto de", ba.umbral_pleno, bb.umbral_pleno), fila("Bonificación mínima", ba.importe_minimo, bb.importe_minimo)]);
    } else {
      const ea = Pa.navarra.escala_general_foral, eb = Pb.navarra.escala_general_foral;
      add("Escala general de Navarra", ea, eb, filasEscala(ea, eb));
      const ma = Pa.navarra.minimo_personal_deduccion, mb = Pb.navarra.minimo_personal_deduccion;
      add("Mínimo personal (deducción en la cuota)", ma, mb, [fila("General", ma.importe_general, mb.importe_general),
        fila("Incremento por rentas bajas, máximo", ma.incremento_rentas_bajas != null ? ma.incremento_rentas_bajas : ma.incremento_rentas && ma.incremento_rentas[0].base,
          mb.incremento_rentas_bajas != null ? mb.incremento_rentas_bajas : mb.incremento_rentas && mb.incremento_rentas[0].base)]);
      const ta = Pa.navarra.deduccion_trabajo_cuota, tb = Pb.navarra.deduccion_trabajo_cuota;
      add("Deducción por rendimientos del trabajo", ta, tb, [fila("Deducción máxima", ta.tramos[0].base, tb.tramos[0].base),
        fila("Hasta un rendimiento neto de", ta.tramos[0].hasta, tb.tramos[0].hasta), fila("Deducción con más de 50.000 €", ta.tramos[ta.tramos.length - 1].base, tb.tramos[tb.tramos.length - 1].base)]);
    }
    add("Cotizaciones del trabajador a la Seguridad Social", ca, cb, [fila("Tipo ordinario (contrato indefinido)", tipoOrd(ca), tipoOrd(cb), pc),
      fila("Mecanismo de equidad intergeneracional (MEI)", ca.tipos.mei, cb.tipos.mei, pc), fila("Base máxima mensual", ca.base_maxima_mensual, cb.base_maxima_mensual)]);
    return L;
  }

  // El mismo caso con los dos ejercicios: neto, IRPF y cotizaciones de cada año y la diferencia
  function compararEjercicios(Pa, Pb, o) {
    const caso = Object.assign({}, SITUACION, { bruto: o.bruto, territorio: o.territorio });
    const sa = H.sueldoNeto(caso, Pa), sb = H.sueldoNeto(caso, Pb);
    const r = s => { const b = Math.round(o.bruto), ss = Math.round(s.cotizaciones), n = Math.round(s.neto);
      return { bruto: b, cotizaciones: ss, irpf: b - ss - n, neto: n, netoMes: Math.round(n / 12), tipoMedio: b > 0 ? (b - ss - n) / b : 0 }; };
    const a = r(sa), b = r(sb);
    return { anterior: Pa.ejercicio, actual: Pb.ejercicio, a, b, difNeto: b.neto - a.neto, difIrpf: b.irpf - a.irpf, difCot: b.cotizaciones - a.cotizaciones,
      conceptos: conceptos(Pa, Pb, o.territorio, o.bruto) };
  }
  // «En 2026 te quedan 245 € más al año (20 €/mes): pagas 260 € menos de IRPF y 15 € más de cotizaciones.»
  function frase(r) {
    const mas = n => n > 0 ? `${eur0(n)} más` : `${eur0(-n)} menos`;
    if (Math.abs(r.difNeto) < 1 && Math.abs(r.difIrpf) < 1 && Math.abs(r.difCot) < 1) return `Con este sueldo, ${r.actual} y ${r.anterior} te dejan el mismo neto.`;
    const neto = Math.abs(r.difNeto) < 1 ? "el mismo neto" : `${mas(r.difNeto)} al año (${eur0(Math.abs(r.difNeto / 12))}/mes)`;
    const partes = [];
    if (Math.abs(r.difIrpf) >= 1) partes.push(`${mas(r.difIrpf)} de IRPF`); else partes.push("el mismo IRPF");
    if (Math.abs(r.difCot) >= 1) partes.push(`${mas(r.difCot)} de cotizaciones`);
    return `En ${r.actual} te ${Math.abs(r.difNeto) < 1 ? "queda" : "quedan"} ${neto} que en ${r.anterior}: pagas ${partes.join(" y ")}.`;
  }
  const enlace = o => `#ejercicios?b=${Math.round(o.bruto)}&t=${o.territorio}`;
  function leerEnlace(hash) {
    const q = String(hash || "").split("?")[1] || "", out = {};
    for (const par of q.split("&")) { const [k, v] = par.split("="); if (k === "b" && v && Number.isFinite(+v)) out.bruto = Math.max(0, Math.min(TOPE, +v)); if (k === "t" && v) out.territorio = v; }
    return out;
  }
  const CALCULOS = { SITUACION, conceptos, compararEjercicios, frase, enlace, leerEnlace, filasEscala };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalEjercicios = CALCULOS;

  // ---- navegador -----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const conSigno = n => (n > 0.5 ? "+" : "") + eur0(n);
  const pct = n => (100 * (n || 0)).toFixed(1).replace(".", ",") + "&nbsp;%";
  const leer = id => window.MapafiscalImporte ? window.MapafiscalImporte.valor($(id)) : parseFloat($(id).value);
  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const cache = window.__mapafiscalJson = window.__mapafiscalJson || {};
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error("No se pudo cargar " + url);
      return r.text();
    }).catch(e => { delete cache[url]; throw e; });
    return JSON.parse(await cache[url]);
  }
  // params.json (ejercicio por defecto) y los demás publicados (params/ejercicios.yaml)
  async function cargar() {
    const P0 = await datos("datos-params", "datos/params.json"), PS = { [P0.ejercicio]: P0 };
    const otros = ((P0.ejercicios && P0.ejercicios.publicados) || [P0.ejercicio - 1]).map(Number).filter(a => a !== P0.ejercicio);
    await Promise.all(otros.map(async a => {
      try { const p = await datos("datos-params-" + a, "datos/params_" + a + ".json"); PS[p.ejercicio] = p; } catch (e) { /* solo el por defecto */ }
    }));
    return PS;
  }

  let PS = null, Pa = null, Pb = null;
  function elegirAnios() {
    const anios = Object.keys(PS).map(Number).sort((x, y) => x - y);
    const b = +$("ej-actual").value || anios[anios.length - 1], a = +$("ej-anterior").value || anios[Math.max(0, anios.length - 2)];
    Pa = PS[a]; Pb = PS[b];
  }
  function pintar() {
    elegirAnios();
    const t = $("ej-territorio").value, bruto = Math.max(0, Math.min(TOPE, leer("ej-bruto") || 0));
    const r = compararEjercicios(Pa, Pb, { bruto, territorio: t });
    $("ej-chip").textContent = `${Pb.territorios[t].nombre} · ${r.anterior} y ${r.actual}`;
    $("ej-tarjeta").className = "tarjeta tarjeta-resultado" + (r.difNeto > 0.5 ? " gana" : "");
    $("ej-principal").innerHTML = `<div class="res-etq">Neto en mano · ${r.actual} frente a ${r.anterior}</div>
      <div class="res-cifra">${conSigno(r.difNeto)} <small>al año</small></div>
      <p class="res-sub" id="ej-frase">${esc(frase(r))}</p>
      <dl class="kpis"><div><dt>Neto ${r.anterior}</dt><dd>${eur0(r.a.neto)}</dd></div><div><dt>Neto ${r.actual}</dt><dd>${eur0(r.b.neto)}</dd></div>
        <div><dt>IRPF ${r.actual} − ${r.anterior}</dt><dd>${conSigno(r.difIrpf)}</dd></div></dl>`;
    $("ej-tabla").innerHTML = `<caption class="sr">El mismo sueldo en ${r.anterior} y en ${r.actual}</caption><thead><tr><th scope="col">Concepto</th><th scope="col" class="num">${r.anterior}</th><th scope="col" class="num">${r.actual}</th><th scope="col" class="num">Diferencia</th></tr></thead><tbody>` +
      [["Bruto anual", "bruto"], ["Cotizaciones a la Seguridad Social", "cotizaciones"], ["IRPF del año", "irpf"], ["Neto al año", "neto"], ["Neto al mes (12 pagas)", "netoMes"]]
        .map(([n, k]) => `<tr class="${k === "neto" ? "total" : ""}"><th scope="row">${n}</th><td class="num">${eur0(r.a[k])}</td><td class="num">${eur0(r.b[k])}</td><td class="num">${conSigno(r.b[k] - r.a[k])}</td></tr>`).join("") +
      `<tr class="info"><th scope="row">Tipo medio del IRPF</th><td class="num">${pct(r.a.tipoMedio)}</td><td class="num">${pct(r.b.tipoMedio)}</td><td class="num"></td></tr></tbody>`;
    // una cifra corta («19.747,50 €») no se parte por el espacio antes de «€»; un texto sí
    const cifra = v => String(v).length <= 14 ? `<span class="sin-corte">${esc(v)}</span>` : esc(v);
    $("ej-conceptos").innerHTML = `<caption class="sr">Conceptos de ${r.anterior} y de ${r.actual}</caption><thead><tr><th scope="col">Concepto</th><th scope="col">${r.anterior}</th><th scope="col">${r.actual}</th></tr></thead>` +
      r.conceptos.map(c => `<tbody class="${c.cambia ? "cambia" : ""}"><tr class="ej-grupo"><th scope="rowgroup" colspan="3">${esc(c.titulo)} <span class="chip ${c.cambia ? "tu" : ""}">${c.cambia ? "Cambia" : "Igual"}</span></th></tr>` +
        c.filas.map(f => `<tr><th scope="row">${esc(f.etq)}</th><td>${cifra(f.a)}</td><td>${cifra(f.b)}</td></tr>`).join("") +
        (c.nota || c.norma ? `<tr class="info"><td colspan="3">${c.nota ? esc(c.nota) + " " : ""}${c.norma ? `<span class="ej-norma">${esc(c.norma)}</span>` : ""}</td></tr>` : "") + "</tbody>").join("");
    try { if (/^#ejercicios/.test(location.hash)) history.replaceState(null, "", enlace({ bruto, territorio: t })); } catch (e) { /* sin historial */ }
    $("ej-nota").textContent = `Persona de ${SITUACION.edad} años sin hijos, contrato indefinido y tributación individual, con la normativa de cada ejercicio: el IRPF del año tras la declaración y las cotizaciones del trabajador. ` +
      "Para la comunidad, si no ha aprobado cambios para el ejercicio nuevo, se mantienen los del anterior. Cifras redondeadas al euro.";
  }

  cargar().then(ps => {
    PS = ps;
    const anios = Object.keys(PS).map(Number).sort((x, y) => x - y);
    const P = PS[anios[anios.length - 1]];
    if (anios.length < 2) { $("ej-principal").innerHTML = '<p class="vacio">Solo hay un ejercicio publicado.</p>'; return; }
    const opt = sel => anios.map(a => `<option value="${a}">${a}</option>`).join("");
    $("ej-anterior").innerHTML = opt(); $("ej-actual").innerHTML = opt();
    $("ej-anterior").value = String(anios[anios.length - 2]); $("ej-actual").value = String(anios[anios.length - 1]);
    $("ej-territorio").innerHTML = ORDEN.filter(t => P.territorios[t]).map(t => `<option value="${t}">${esc(P.territorios[t].nombre)}</option>`).join("");
    const aplicarEnlace = () => {
      const e = leerEnlace(location.hash);
      $("ej-territorio").value = e.territorio && P.territorios[e.territorio] ? e.territorio : $("ej-territorio").value || "ES-MD";
      if (e.bruto != null && window.MapafiscalImporte) $("ej-bruto").value = window.MapafiscalImporte.formatearImporte(e.bruto);
    };
    $("ej-territorio").value = "ES-MD";
    aplicarEnlace();
    let t1;
    $("ej-form").addEventListener("input", () => { clearTimeout(t1); t1 = setTimeout(pintar, 150); });
    $("ej-form").addEventListener("change", pintar);
    $("ej-form").addEventListener("submit", e => e.preventDefault());
    window.addEventListener("hashchange", () => { if (/^#ejercicios\?/.test(location.hash)) { aplicarEnlace(); pintar(); } });
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "ejercicios") pintar(); });
    if (!$("v-ejercicios").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
