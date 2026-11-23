/* =============================================================================
 * Mapafiscal — «De cada 100 € más, te quedan…» (vista #marginal)
 * Para un territorio y sueldos de 12.000 a 120.000 €, lo que queda neto de cada 100 € brutos
 * más en cada punto: neto(b + 100) − neto(b), con irpfsim.sueldoNeto (paridad con
 * R/15_sueldo_neto.R). No hay lógica fiscal nueva: los saltos se localizan mirando qué cambia
 * en la propia liquidación del motor (reducción del trabajo, deducción del SMI, tramo de la
 * escala, base máxima de cotización…) y se explican con las cifras de los parámetros.
 * Se carga después de app.js, que muestra la vista y avisa con «mapafiscal:vista».
 * Enlace: #marginal?t=<territorio>. La página /tipo-marginal-real/ (tools/seo_comparadores.mjs)
 * usa estas mismas funciones, también para dibujar el gráfico SVG.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    marginal: { titulo: "De cada 100 € más, ¿cuánto te queda?", icono: "marginal", href: "#marginal",
      texto: "Tu tipo marginal real, IRPF y Seguridad Social juntos, de 12.000 a 120.000 €, con los saltos explicados." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-marginal"))) return;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const RANGO = { desde: 12000, hasta: 120000, paso: 250, delta: 100 };
  const SITUACION = { edad: 35, hijos: [], tipoContrato: "indefinido" };
  const red2 = n => Math.round((n + 1e-9) * 100) / 100;

  // ---- formato ---------------------------------------------------------------------------
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  const eur = n => { const v = Math.round(Math.abs(n) * 100) / 100, [e, d] = v.toFixed(2).split("."); return (n < 0 ? "−" : "") + miles(e) + (d !== "00" ? "," + d : "") + " €"; };
  const eur2 = n => (n < 0 ? "−" : "") + miles(Math.abs(n).toFixed(2).split(".")[0]) + "," + Math.abs(n).toFixed(2).split(".")[1] + " €";
  const pc = n => String(Math.round(n * 100000) / 1000).replace(".", ",") + " %";
  const coef = n => String(Math.round(n * 10000) / 10000).replace(".", ",");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- conceptos que pueden mover el marginal -------------------------------------------
  const pvBloque = (P, t, k) => Object.assign({}, P.foral_pv[k] || {}, ((P.foral_pv.overrides && P.foral_pv.overrides[t]) || {})[k] || {});
  const tramo = (base, escala) => { let i = 0; while (i < escala.length - 1 && escala[i].hasta != null && base > escala[i].hasta) i++; return i; };
  // tramos con base fija y coeficiente: [{desde, hasta, base, coef}] -> texto
  const tramosTxt = tr => tr.map(x => x.coef ? `baja ${coef(x.coef)} € por cada euro de ${eur(x.desde)} a ${x.hasta == null ? "en adelante" : eur(x.hasta)}`
    : `${eur(x.base)} ${x.hasta == null ? `desde ${eur(x.desde)}` : x.desde ? `de ${eur(x.desde)} a ${eur(x.hasta)}` : `hasta ${eur(x.hasta)}`}`).join("; ");
  function conceptos(P, t) {
    const reg = P.territorios[t].regimen, ct = P.estatal.cotizaciones_trabajador, L = [];
    L.push({ clave: "irpf", tipo: "punto", nombre: "IRPF", leer: x => x.s.irpf > 0.005 ? "paga" : "0" });
    if (reg === "comun") {
      const a = P.estatal.trabajo_reduccion_art20, d = P.estatal.deduccion_obtencion_rendimientos_trabajo;
      L.push({ clave: "reduccion", tipo: "importe", nombre: "la reducción por rendimientos del trabajo", norma: a.norma, leer: x => x.liq.componentesRenta.reduccionTrabajo,
        detalle: `${eur(a.importe_maximo)} con un rendimiento neto del trabajo de hasta ${eur(a.umbral_pleno)}; baja ${coef(a.coef_tramo1)} € por cada euro hasta ${eur(a.umbral_intermedio)} y ${coef(a.coef_tramo2)} € por euro hasta anularse en ${eur(a.umbral_final)}.` });
      if (d) L.push({ clave: "smi", tipo: "importe", nombre: "la deducción por obtención de rendimientos del trabajo (la del SMI)", norma: d.norma, leer: x => x.liq.deduccionRendimientosTrabajo.total,
        detalle: `${eur(d.importe_maximo)} con un rendimiento íntegro del trabajo de hasta ${eur(d.umbral_pleno)}; baja ${coef(d.coef_reduccion)} € por cada euro y se anula en ${eur(d.umbral_final)}.` });
      L.push({ clave: "estatal", tipo: "tramo", nombre: "la escala estatal", escala: P.estatal.escala_general_estatal, leer: x => tramo(x.liq.baseLiquidableGeneral, P.estatal.escala_general_estatal) });
      L.push({ clave: "autonomica", tipo: "tramo", nombre: `la escala autonómica de ${P.territorios[t].nombre}`, escala: P.territorios[t].escala_general_autonomica,
        leer: x => tramo(x.liq.baseLiquidableGeneral, P.territorios[t].escala_general_autonomica) });
    } else if (reg === "foral_pais_vasco") {
      const b = pvBloque(P, t, "bonificacion_trabajo");
      const escala = ((P.foral_pv.overrides && P.foral_pv.overrides[t]) || {}).escala_general_foral || P.foral_pv.escala_general_foral;
      L.push({ clave: "reduccion", tipo: "importe", nombre: "la bonificación de los rendimientos del trabajo", norma: b.norma, leer: x => x.liq.componentesRenta.reduccionTrabajo,
        detalle: `${eur(b.importe_pleno)} con un rendimiento neto del trabajo de hasta ${eur(b.umbral_pleno)}; baja ${coef(b.coef_reduccion)} € por cada euro hasta quedarse en ${eur(b.importe_minimo)} desde ${eur(b.umbral_minimo)}.` });
      L.push({ clave: "foral", tipo: "tramo", nombre: `la escala de ${P.territorios[t].nombre}`, escala, leer: x => tramo(x.liq.baseLiquidableGeneral, escala) });
    } else {
      const n = P.navarra, m = n.minimo_personal_deduccion;
      L.push({ clave: "trabajoNc", tipo: "importe", nombre: "la deducción por rendimientos del trabajo de Navarra", norma: n.deduccion_trabajo_cuota.norma || null,
        leer: x => (x.liq.deduccionesAutonomicas.detalle || {}).trabajo || 0, detalle: `Según el rendimiento neto del trabajo: ${tramosTxt(n.deduccion_trabajo_cuota.tramos)}.` });
      L.push({ clave: "minimoNc", tipo: "importe", nombre: "la deducción por mínimo personal de Navarra", norma: m.norma,
        leer: x => (x.liq.deduccionesAutonomicas.detalle || {}).minimoPersonal || 0,
        detalle: `${eur(m.importe_general)} para todos, más un incremento para rentas bajas: ` +
          (m.incremento_rentas ? tramosTxt(m.incremento_rentas) : `${eur(m.incremento_rentas_bajas)} con una base de hasta ${eur(m.umbral_rentas_bajas)}`) + "." });
      L.push({ clave: "foral", tipo: "tramo", nombre: "la escala de Navarra", escala: n.escala_general_foral, leer: x => tramo(x.liq.baseLiquidableGeneral, n.escala_general_foral) });
    }
    const tipoOrd = ct.tipos.contingencias_comunes + ct.tipos.desempleo_indefinido + ct.tipos.formacion_profesional + ct.tipos.mei;
    L.push({ clave: "ss", tipo: "punto", nombre: "las cotizaciones a la Seguridad Social", norma: ct.norma, cot: ct, tipoOrd,
      leer: x => { const m = x.bruto / 12; if (m <= ct.base_maxima_mensual) return 0; let i = 0, desde = ct.base_maxima_mensual;
        for (const tr of ct.solidaridad.tramos) { i++; if (tr.hasta == null || m <= tr.hasta) return i; desde = tr.hasta; } return i; } });
    return L;
  }

  // ---- la serie: lo que queda de cada 100 € en cada punto ---------------------------------
  function calculadora(P, t) {
    const cache = new Map();
    return b => {
      b = Math.round(b * 100) / 100;
      if (!cache.has(b)) { const s = H.sueldoNeto(Object.assign({}, SITUACION, { bruto: b, territorio: t }), P); cache.set(b, { bruto: b, s, liq: s.liquidacion }); }
      return cache.get(b);
    };
  }
  function serie(P, t, rango = RANGO) {
    const en = calculadora(P, t), out = [];
    for (let b = rango.desde; b <= rango.hasta + 1e-9; b += rango.paso) {
      const x0 = en(b), x1 = en(b + rango.delta);
      const queda = red2(x1.s.neto - x0.s.neto), irpf = red2(x1.s.irpf - x0.s.irpf), ss = red2(x1.s.cotizaciones - x0.s.cotizaciones);
      out.push({ bruto: b, queda, irpf, ss, neto: x0.s.neto });
    }
    return out;
  }
  // estado de un concepto en b: los «importe» por su pendiente en [b, b + delta]
  function estado(c, en, b, delta) {
    if (c.tipo !== "importe") return String(c.leer(en(b)));
    const v0 = c.leer(en(b)), v1 = c.leer(en(b + delta));
    if (Math.abs(v0) <= 0.005 && Math.abs(v1) <= 0.005) return "0";
    const k = Math.round((v1 - v0) / delta * 100) / 100;
    return k === 0 ? "f" : "s" + k;
  }
  // Los saltos: dónde cambia el estado de algún concepto, localizado por bisección (10 €) y
  // explicado con los parámetros. Un cambio que dura menos de un paso (la ventana de 100 €
  // cruzando el punto) se junta con el siguiente del mismo concepto.
  function saltos(P, t, rango = RANGO, s = serie(P, t, rango)) {
    const en = calculadora(P, t), cs = conceptos(P, t), brutos = s.map(x => x.bruto), crudos = [];
    for (const c of cs) {
      let prev = estado(c, en, brutos[0], rango.delta);
      for (let i = 1; i < brutos.length; i++) {
        const e = estado(c, en, brutos[i], rango.delta);
        if (e === prev) continue;
        let lo = brutos[i - 1], hi = brutos[i];
        while (hi - lo > 10) { const m = Math.round((lo + hi) / 2); if (estado(c, en, m, rango.delta) === prev) lo = m; else hi = m; }
        const donde = c.tipo === "importe" ? hi + rango.delta : hi;
        crudos.push({ c, i, de: prev, a: e, bruto: donde, v0: c.tipo === "importe" ? c.leer(en(brutos[i - 1])) : null });
        prev = e;
      }
    }
    // juntar los transitorios del mismo concepto
    const juntos = [];
    for (const h of crudos) {
      const u = juntos[juntos.length - 1];
      if (u && u.c === h.c && h.i - u.iFin <= 2) { u.a = h.a; u.iFin = h.i; continue; }
      juntos.push(Object.assign({}, h, { iFin: h.i }));
    }
    const out = [];
    for (const h of juntos) {
      const despues = s[Math.min(s.length - 1, h.iFin)], antes = s[h.i - 1];
      let v1 = null;
      if (h.c.tipo === "importe") v1 = h.c.leer(en(despues.bruto));
      if (h.de === h.a && !(h.c.tipo === "importe" && Math.abs(v1 - h.v0) > 1)) continue;
      const texto = explicar(h.c, h.de, h.a, h.v0, v1);
      // solo los que mueven lo que te queda (medio euro de cada 100 o más)
      if (!texto || Math.abs(despues.queda - antes.queda) < 0.5) continue;
      out.push({ bruto: Math.round(h.bruto / 10) * 10, concepto: h.c.clave, nombre: h.c.nombre, de: h.de, a: h.a,
        antes: antes.queda, despues: despues.queda, texto, detalle: h.c.detalle || null, norma: h.c.norma || null });
    }
    return out.sort((x, y) => x.bruto - y.bruto || x.concepto.localeCompare(y.concepto));
  }
  function explicar(c, de, a, v0, v1) {
    if (c.clave === "irpf") return a === "paga" ? "Empiezas a pagar IRPF: hasta aquí los mínimos y las reducciones dejaban la cuota a cero." : "Dejas de pagar IRPF.";
    if (c.tipo === "tramo") {
      const i = +de, j = +a, e = c.escala;
      if (j <= i) return null;
      return `Tu base liquidable pasa de ${eur(e[j - 1].hasta)}: el tipo de ${c.nombre} sube del ${pc(e[i].tipo)} al ${pc(e[j].tipo)}.`;
    }
    if (c.clave === "ss") {
      const ct = c.cot, tr = ct.solidaridad.tramos;
      if (+de === 0 && +a >= 1) return `Llegas a la base máxima de cotización (${eur(ct.base_maxima_mensual)} al mes, ${eur(12 * ct.base_maxima_mensual)} al año): lo que ganes de más ya no paga el ${pc(c.tipoOrd)} de cotizaciones ordinarias, solo la cotización adicional de solidaridad del ${pc(tr[+a - 1].tipo)}.`;
      if (+a > +de) return `La cotización adicional de solidaridad pasa al ${pc(tr[+a - 1].tipo)} desde ${eur(12 * tr[+a - 2].hasta)} brutos al año.`;
      return null;
    }
    const baja = e => e[0] === "s" && +e.slice(1) < 0;
    if ((de === "f" || de === "0") && baja(a)) return `Empieza a reducirse ${c.nombre}: cada euro más de sueldo te quita parte de ella.`;
    if (baja(de) && a === "0") return `Se acaba ${c.nombre}: desde aquí ya no hay nada que perder y te quedas con más de cada euro.`;
    if (baja(de) && a === "f") return `${mayus(c.nombre)} deja de bajar: se queda en ${eur(v1)}.`;
    const sube = e => e[0] === "s" && +e.slice(1) > 0;
    if (sube(de) && baja(a)) return `${mayus(c.nombre)} deja de crecer y empieza a reducirse.`;
    if (baja(de) && baja(a)) return `${mayus(c.nombre)} sigue bajando, pero a otro ritmo.`;
    if (de === a) return `${mayus(c.nombre)} baja de golpe ${eur(Math.abs(v1 - v0))}.`;
    if (de === "0") return `Empieza a aplicarse ${c.nombre}.`;
    return `${mayus(c.nombre)} cambia.`;
  }
  const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);
  // resumen para textos: el punto donde menos queda y la media del rango
  function resumen(s) {
    const peor = s.reduce((m, x) => x.queda < m.queda ? x : m, s[0]);
    return { peor, media: s.reduce((a, x) => a + x.queda, 0) / s.length };
  }

  // ---- gráfico SVG (lo usan la vista y la página SEO) ------------------------------------
  // `ancho`: el ancho en píxeles al que se va a ver. Con el viewBox a esa medida, 1 unidad = 1 px
  // y los rótulos de los ejes se leen a su tamaño (12 px) también en un móvil; con un viewBox
  // fijo de 680 dentro de una columna de 330 px se quedaban en 6 px.
  function grafico(s, hs, { titulo = "", marca = null, ancho = 680, clase = "" } = {}) {
    const AN = Math.max(280, Math.round(ancho)), AL = AN < 520 ? 230 : 260, IZQ = 44, DER = 14, ARR = 26, ABA = 30;
    const x0 = s[0].bruto, x1 = s[s.length - 1].bruto;
    const X = x => IZQ + (x - x0) / (x1 - x0) * (AN - IZQ - DER), Y = y => ARR + (1 - Math.max(0, Math.min(100, y)) / 100) * (AL - ARR - ABA);
    const lineasY = [0, 25, 50, 75, 100], ticksX = [];
    const pasoX = (AN - IZQ - DER) / ((x1 - x0) / 20000) < 62 ? 40000 : 20000;   // «100 mil» mide unos 45 px
    for (let v = Math.ceil(x0 / pasoX) * pasoX; v <= x1; v += pasoX) ticksX.push(v);
    // el último rótulo va alineado a la derecha (no se sale): fuera el anterior si lo pisaría
    if (ticksX.length > 1 && X(ticksX[ticksX.length - 1]) > AN - DER - 20 && X(ticksX[ticksX.length - 2]) + 24 > AN - DER - 52) ticksX.splice(ticksX.length - 2, 1);
    const camino = s.map((p, i) => `${i ? "L" : "M"}${X(p.bruto).toFixed(1)},${Y(p.queda).toFixed(1)}`).join("");
    const area = camino + `L${X(x1).toFixed(1)},${Y(0).toFixed(1)}L${X(x0).toFixed(1)},${Y(0).toFixed(1)}Z`;
    const r = resumen(s);
    const etiqueta = titulo || `De cada 100 € brutos más te quedan entre ${eur0(r.peor.queda)} y ${eur0(Math.max(...s.map(x => x.queda)))}; el mínimo, con ${eur0(r.peor.bruto)} brutos al año.`;
    // saltos muy juntos: una sola marca con sus números («1–9» si son más de dos), sin que los
    // rótulos se pisen (≈ 6,5 px por carácter a 11 px)
    const rotulo = n => n.length > 2 ? `${n[0]}–${n[n.length - 1]}` : n.join(",");
    const anchoRot = n => rotulo(n).length * 6.5;
    const grupos = [];
    hs.forEach((h, i) => { const x = X(h.bruto), u = grupos[grupos.length - 1];
      if (u && x - u.x < (anchoRot(u.n) + anchoRot([i + 1])) / 2 + 6) { u.n.push(i + 1); } else grupos.push({ x, n: [i + 1] }); });
    const m = marca != null ? s.reduce((a, p) => Math.abs(p.bruto - marca) < Math.abs(a.bruto - marca) ? p : a, s[0]) : null;
    // el último rótulo del eje X, alineado a la derecha para no salirse del gráfico
    const anclaX = v => X(v) > AN - DER - 20 ? "end" : "middle";
    return `<svg class="mg-svg${clase ? " " + clase : ""}" viewBox="0 0 ${AN} ${AL}" role="img" aria-label="${esc(etiqueta)}" preserveAspectRatio="xMidYMid meet">
  ${lineasY.map(v => `<line class="mg-reticula" x1="${IZQ}" x2="${AN - DER}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="mg-eje" x="${IZQ - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v} €</text>`).join("")}
  ${ticksX.map(v => `<text class="mg-eje" x="${(anclaX(v) === "end" ? AN - DER : X(v)).toFixed(1)}" y="${AL - 10}" text-anchor="${anclaX(v)}">${Math.round(v / 1000)} mil</text>`).join("")}
  <path class="mg-area" d="${area}"/><path class="mg-linea" d="${camino}"/>
  ${grupos.map(g => `<g class="mg-salto"><line x1="${g.x.toFixed(1)}" x2="${g.x.toFixed(1)}" y1="${ARR - 4}" y2="${Y(0).toFixed(1)}"/><text x="${g.x.toFixed(1)}" y="${ARR - 9}" text-anchor="middle">${rotulo(g.n)}</text></g>`).join("")}
  ${m ? `<circle class="mg-punto" cx="${X(m.bruto).toFixed(1)}" cy="${Y(m.queda).toFixed(1)}" r="5"/>` : ""}
</svg>`;
  }
  // filas de la tabla alternativa: cada `cada` euros
  const filasTabla = (s, cada = 2000) => s.filter(p => (p.bruto - s[0].bruto) % cada === 0);
  const enlace = t => `#marginal?t=${t}`;
  const leerEnlace = hash => { const m = String(hash || "").match(/[?&]t=(ES-[A-Z]{2}(?:-[A-Z]{2})?)\b/); return m ? m[1] : null; };

  const CALCULOS = { RANGO, SITUACION, conceptos, serie, saltos, resumen, grafico, filasTabla, enlace, leerEnlace, eur0, eur2 };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalMarginal = CALCULOS;

  // ---- navegador -----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
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
  let P = null, ultimo = null;
  // ancho de la columna del resultado (680 si aún no se ve)
  const anchoGrafico = () => $("mg-grafico").clientWidth || 680;
  let anchoPintado = 0;
  window.addEventListener("resize", () => {
    if (!ultimo || $("v-marginal").hidden) return;
    const a = anchoGrafico();
    if (Math.abs(a - anchoPintado) < 24) return;
    anchoPintado = a;
    const svg = $("mg-grafico").querySelector("svg.mg-svg");
    if (svg) svg.outerHTML = grafico(ultimo.s, ultimo.hs, { ancho: a });
  });
  function pintar() {
    const t = $("mg-territorio").value, s = serie(P, t), hs = saltos(P, t, RANGO, s), r = resumen(s);
    const nombre = P.territorios[t].nombre;
    $("mg-chip").textContent = `${nombre} · ${P.ejercicio}`;
    $("mg-principal").innerHTML = `<div class="res-etq">De cada 100 € brutos más, entre ${eur0(RANGO.desde)} y <span class="sin-corte">${eur0(RANGO.hasta)}</span></div>
      <div class="res-cifra">${eur0(r.media)} <small>de media</small></div>
      <p class="res-sub" id="mg-frase">En ${esc(nombre)}, lo menos que te queda es <b>${eur0(r.peor.queda)}</b> de cada 100 €, con ${eur0(r.peor.bruto)} brutos al año: ahí el IRPF y la Seguridad Social se llevan <span class="sin-corte">${eur0(100 - r.peor.queda)}.</span></p>`;
    ultimo = { s, hs }; anchoPintado = anchoGrafico();
    $("mg-grafico").innerHTML = grafico(s, hs, { ancho: anchoGrafico() }) + `<p class="ayuda">Eje horizontal: sueldo bruto anual. Eje vertical: lo que queda neto de 100 € brutos más. Los números marcan los saltos que se explican debajo.</p>`;
    $("mg-saltos").innerHTML = hs.length ? hs.map(h => `<li><b>Hacia ${eur0(h.bruto)} brutos:</b> ${esc(h.texto)} <span class="mg-antes">De cada 100 € te quedaban <span class="sin-corte">${eur0(h.antes)};</span> ahora, <span class="sin-corte">${eur0(h.despues)}.</span></span>` +
      (h.detalle || h.norma ? `<span class="ayuda mg-detalle">${h.detalle ? esc(h.detalle) + " " : ""}${h.norma ? esc(h.norma) : ""}</span>` : "") + "</li>").join("") : "<li>No hay saltos en este rango.</li>";
    $("mg-tabla").innerHTML = `<caption class="sr">Lo que queda de cada 100 € brutos más en ${esc(nombre)}</caption><thead><tr><th scope="col" class="num">Sueldo bruto anual</th><th scope="col" class="num">Te quedan</th><th scope="col" class="num">IRPF</th><th scope="col" class="num">Seguridad Social</th></tr></thead><tbody>` +
      filasTabla(s).map(p => `<tr><th scope="row" class="num">${eur0(p.bruto)}</th><td class="num">${eur2(p.queda)}</td><td class="num">${eur2(p.irpf)}</td><td class="num">${eur2(p.ss)}</td></tr>`).join("") + "</tbody>";
    try { if (/^#marginal/.test(location.hash)) history.replaceState(null, "", enlace(t)); } catch (e) { /* sin historial */ }
    $("mg-nota").textContent = `Ejercicio ${P.ejercicio}. Persona de ${SITUACION.edad} años sin hijos, con contrato indefinido y tributación individual: neto tras la Seguridad Social del trabajador y el IRPF del año. ` +
      `Cada punto es neto(bruto + ${RANGO.delta} €) − neto(bruto), cada ${RANGO.paso} €. Las explicaciones salen de los parámetros del motor, con su norma.`;
  }
  datos("datos-params", "datos/params.json").then(p => {
    P = p;
    $("mg-territorio").innerHTML = ORDEN.filter(t => P.territorios[t]).map(t => `<option value="${t}">${esc(P.territorios[t].nombre)}</option>`).join("");
    const aplicar = () => { const t = leerEnlace(location.hash); $("mg-territorio").value = t && P.territorios[t] ? t : ($("mg-territorio").value || "ES-MD"); };
    $("mg-territorio").value = "ES-MD"; aplicar();
    $("mg-territorio").addEventListener("change", pintar);
    $("mg-form").addEventListener("submit", e => e.preventDefault());
    window.addEventListener("hashchange", () => { if (/^#marginal\?/.test(location.hash)) { aplicar(); pintar(); } });
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "marginal") pintar(); });
    if (!$("v-marginal").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
