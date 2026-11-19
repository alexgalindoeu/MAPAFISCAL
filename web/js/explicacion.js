/* «¿Cómo hemos calculado esta cifra?»: explicación paso a paso de una liquidación.
 *
 * Solo lee el objeto que ya devuelve irpfsim.liquidar() y los parámetros del ejercicio
 * (escalas, normas): no recalcula la liquidación ni cambia ninguna cifra. El desglose por
 * tramos se reconstruye con irpfsim.aplicarEscala sobre las escalas de los params y se
 * muestra solo si cuadra al céntimo con la cuota íntegra del motor; si no (anualidades por
 * alimentos, declaraciones individuales sumadas…), se omite y se dice por qué.
 *
 * API: mfExplicacion.pasos(liq, P) -> [{ id, titulo, filas, tramos, norma, nota }]
 *      mfExplicacion.html(liq, P)  -> HTML del contenido del desplegable
 *      mfExplicacion.pintar(el, liq, P) -> rellena el <details> el (conserva si está abierto)
 */
(function (global) {
  "use strict";

  const red2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const num = x => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  const fmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const eur0 = x => Number.isInteger(num(x)) ? num(x).toLocaleString("es-ES", { useGrouping: true }) + " €" : eur(x);
  const eur = x => fmt.format(red2(num(x))) + " €";
  const pct = t => (Math.round(t * 10000) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " %";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normaDe = o => (o && typeof o === "object" && typeof o.norma === "string" ? o.norma : "");
  const escalaFn = () => (global.irpfsim && global.irpfsim.aplicarEscala) || aplicarEscalaLocal;
  // misma fórmula que irpfsim.aplicarEscala (solo por si se usa sin el motor cargado)
  function aplicarEscalaLocal(base, tramos) {
    if (!base || base <= 0) return 0;
    let cuota = 0, prev = 0;
    for (const tr of tramos) {
      if (tr.hasta == null || base <= tr.hasta) return cuota + (base - prev) * tr.tipo;
      cuota += (tr.hasta - prev) * tr.tipo; prev = tr.hasta;
    }
    return cuota;
  }

  // Reparto de una base entre los tramos de una escala: [{ desde, hasta, tipo, base, cuota }]
  function tramosAplicados(base, escala) {
    const out = [];
    if (!(base > 0) || !Array.isArray(escala)) return out;
    let prev = 0;
    for (const tr of escala) {
      const tope = tr.hasta == null ? Infinity : tr.hasta;
      const enTramo = Math.min(base, tope) - prev;
      if (enTramo <= 0) break;
      out.push({ desde: prev, hasta: tr.hasta, tipo: tr.tipo, base: enTramo, cuota: enTramo * tr.tipo });
      if (base <= tope) break;
      prev = tope;
    }
    return out;
  }

  // Gravamen de una base con su escala, restando la cuota del mínimo que cae en ella
  function gravamen(nombre, base, minimo, escala) {
    const ap = escalaFn();
    const m = Math.min(Math.max(0, minimo), base);
    const cuotaBase = ap(base, escala), cuotaMin = ap(m, escala);
    return { nombre, base, minimo: m, tramos: tramosAplicados(base, escala), cuotaBase, cuotaMinimo: cuotaMin,
      cuota: Math.max(0, cuotaBase - cuotaMin) };
  }

  const NOMBRES = {
    trabajoPrevio: "Rendimiento neto del trabajo (antes de la reducción)",
    capitalInmobiliario: "Rendimientos del capital inmobiliario",
    capitalMobiliarioGeneral: "Rendimientos del capital mobiliario (base general)",
    actividades: "Rendimientos de actividades económicas",
    imputaciones: "Imputaciones de renta",
    gananciasGeneral: "Ganancias y pérdidas patrimoniales (base general)",
    capitalMobiliarioAhorro: "Rendimientos del capital mobiliario (ahorro)",
    gananciasAhorro: "Ganancias y pérdidas patrimoniales (ahorro)",
    minimoPersonal: "Deducción por mínimo personal",
    minimoFamiliar: "Deducción por mínimo familiar",
    trabajo: "Deducción por rendimientos del trabajo"
  };
  const humano = id => NOMBRES[id] || (s => s.charAt(0).toUpperCase() + s.slice(1))(
    String(id).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase());
  const serpiente = id => String(id).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

  // Norma de una deducción: lista autonómica, bloques forales o estatales (por id o id_en_snake)
  function normaDeduccion(P, liq, id) {
    const terr = P.territorios[liq.territorio] || {};
    const lista = (terr.deducciones_autonomicas && terr.deducciones_autonomicas.lista) || [];
    const enLista = lista.find(d => d.id === id || d.id === serpiente(id));
    if (enLista) return normaDe(enLista);
    const NAV = { minimoPersonal: "minimo_personal_deduccion", minimoFamiliar: "minimo_familiar_deduccion", trabajo: "deduccion_trabajo_cuota" };
    const bloques = liq.regimen === "foral_navarra" ? [P.navarra]
      : liq.regimen === "foral_pais_vasco" ? [(P.foral_pv.overrides || {})[liq.territorio], P.foral_pv] : [P.estatal];
    for (const b of bloques) {
      if (!b) continue;
      for (const k of [id, serpiente(id), "deduccion_" + serpiente(id), NAV[id]]) if (k && b[k] && normaDe(b[k])) return normaDe(b[k]);
    }
    return "";
  }

  function pasos(liq, P) {
    const out = [];
    const reg = liq.regimen, comun = reg === "comun";
    const terr = P.territorios[liq.territorio] || {};
    const cr = liq.componentesRenta || {};
    // en individual con dos declarantes las cuotas van sumadas pero los componentes son del primero
    const coherente = Math.abs(num(cr.baseImponibleGeneral) - num(liq.baseImponibleGeneral)) < 0.01 &&
      Math.abs(num(cr.baseImponibleAhorro) - num(liq.baseImponibleAhorro)) < 0.01;
    const conjunta = liq.modo === "conjunta";

    // 1. Rendimientos -> bases imponibles
    {
      const filas = [];
      let norma = "";
      if (coherente) {
        if (num(cr.trabajoPrevio)) filas.push({ concepto: NOMBRES.trabajoPrevio, importe: cr.trabajoPrevio });
        if (num(cr.reduccionTrabajo)) {
          filas.push({ concepto: comun ? "Reducción por obtención de rendimientos del trabajo" : "Bonificación del trabajo", importe: -cr.reduccionTrabajo, resta: true });
          norma = comun ? normaDe(P.estatal.trabajo_reduccion_art20) : reg === "foral_pais_vasco" ? normaDe(P.foral_pv.bonificacion_trabajo) : "";
          filas.push({ concepto: "Rendimiento neto reducido del trabajo", importe: cr.trabajoNeto, sub: true });
        }
        for (const k of ["capitalInmobiliario", "capitalMobiliarioGeneral", "actividades", "imputaciones", "gananciasGeneral", "capitalMobiliarioAhorro", "gananciasAhorro"])
          if (num(cr[k])) filas.push({ concepto: NOMBRES[k], importe: cr[k] });
      }
      filas.push({ concepto: "Base imponible general", importe: liq.baseImponibleGeneral, sub: true });
      if (num(liq.baseImponibleAhorro)) filas.push({ concepto: "Base imponible del ahorro", importe: liq.baseImponibleAhorro, sub: true });
      out.push({ id: "rendimientos", titulo: "Rendimientos y base imponible", filas, norma,
        nota: coherente ? "" : "Son declaraciones individuales de dos personas: aquí se muestran sumadas." });
    }

    // 2. Reducciones -> bases liquidables
    {
      const rb = liq.reduccionesBase || {}, filas = [], normas = [];
      const R = { previsionSocial: ["Aportaciones a sistemas de previsión social", comun ? P.estatal.reduccion_prevision_social : reg === "foral_pais_vasco" ? P.foral_pv.reduccion_prevision_social : P.navarra.reduccion_prevision_social],
        pensionesCompensatorias: ["Pensiones compensatorias y anualidades por alimentos", null],
        tributacionConjunta: ["Reducción por tributación conjunta", comun ? P.estatal.reduccion_tributacion_conjunta : P.foral_pv.reduccion_tributacion_conjunta] };
      for (const [k, [n, b]] of Object.entries(R)) if (num(rb[k])) { filas.push({ concepto: n, importe: -rb[k], resta: true }); if (normaDe(b)) normas.push(normaDe(b)); }
      if (!filas.length) filas.push({ concepto: "Sin reducciones de la base en este caso", importe: null });
      filas.push({ concepto: "Base liquidable general", importe: liq.baseLiquidableGeneral, sub: true });
      if (num(liq.baseLiquidableAhorro)) filas.push({ concepto: "Base liquidable del ahorro", importe: liq.baseLiquidableAhorro, sub: true });
      out.push({ id: "reducciones", titulo: "Reducciones y base liquidable", filas, norma: normas.join(" · ") });
    }

    // 3. Mínimo personal y familiar
    if (comun) {
      const m = liq.minimoPersonalFamiliar || {}, ma = liq.minimoPersonalFamiliarAutonomico;
      const filas = [];
      if (coherente) for (const [k, n] of [["contribuyente", "Mínimo del contribuyente"], ["descendientes", "Por descendientes"], ["ascendientes", "Por ascendientes"], ["discapacidad", "Por discapacidad"]])
        if (num(m[k])) filas.push({ concepto: n, importe: m[k] });
      filas.push({ concepto: "Mínimo personal y familiar (estatal)", importe: m.total, sub: true });
      const distinto = ma && Math.abs(num(ma.total) - num(m.total)) > 0.005;
      if (distinto) filas.push({ concepto: "Mínimo con los importes de " + (terr.nombre || "la comunidad") + " (solo cuota autonómica)", importe: ma.total, sub: true });
      const normas = [normaDe(P.estatal.minimo_contribuyente)];
      if (distinto && normaDe(terr.minimo_autonomico)) normas.push(normaDe(terr.minimo_autonomico));
      out.push({ id: "minimo", titulo: "Mínimo personal y familiar", filas, norma: normas.filter(Boolean).join(" · "),
        nota: "No se resta de la base: la parte de la base que cubre se grava a la misma escala y esa cuota se descuenta (por eso tributa al 0 %)." });
    } else if (reg === "foral_navarra") {
      out.push({ id: "minimo", titulo: "Mínimo personal y familiar", filas: [], norma: "",
        nota: "En Navarra el mínimo personal y familiar no reduce la base: se aplica como deducción en la cuota (ver más abajo)." });
    } else {
      out.push({ id: "minimo", titulo: "Mínimo personal y familiar", filas: [], norma: "",
        nota: "En los territorios forales vascos no hay mínimo en la base: se aplica una minoración general de la cuota y deducciones familiares (ver más abajo)." });
    }

    // 4. Escalas por tramos -> cuota íntegra
    {
      const blg = num(liq.baseLiquidableGeneral), bla = num(liq.baseLiquidableAhorro);
      const grav = [];
      let cuadra = false;
      if (comun) {
        const m = num(liq.minimoPersonalFamiliar && liq.minimoPersonalFamiliar.total);
        const ma = liq.minimoPersonalFamiliarAutonomico ? num(liq.minimoPersonalFamiliarAutonomico.total) : m;
        const gE = gravamen("Escala general estatal", blg, m, P.estatal.escala_general_estatal);
        const gA = gravamen("Escala general autonómica de " + (terr.nombre || ""), blg, ma, terr.escala_general_autonomica);
        const aE = gravamen("Escala del ahorro estatal", bla, Math.max(0, m - blg), P.estatal.escala_ahorro_estatal);
        const aA = gravamen("Escala del ahorro autonómica", bla, Math.max(0, ma - blg), P.estatal.escala_ahorro_autonomica);
        grav.push(gE, gA); if (bla > 0) grav.push(aE, aA);
        cuadra = coherente && Math.abs(red2(gE.cuota + aE.cuota) - num(liq.cuotaIntegraEstatal)) < 0.011 &&
          Math.abs(red2(gA.cuota + aA.cuota) - num(liq.cuotaIntegraAutonomica)) < 0.011;
      } else {
        const J = reg === "foral_navarra" ? P.navarra : Object.assign({}, P.foral_pv, (P.foral_pv.overrides || {})[liq.territorio] || {});
        const g = gravamen("Escala general foral", blg, 0, J.escala_general_foral);
        const a = gravamen("Escala del ahorro foral", bla, 0, J.escala_ahorro_foral);
        grav.push(g); if (bla > 0) grav.push(a);
        cuadra = Math.abs(red2(g.cuota + a.cuota) - num(liq.cuotaIntegraAutonomica)) < 0.011;
      }
      const filas = comun
        ? [{ concepto: "Cuota íntegra estatal", importe: liq.cuotaIntegraEstatal }, { concepto: "Cuota íntegra autonómica", importe: liq.cuotaIntegraAutonomica }, { concepto: "Cuota íntegra total", importe: liq.cuotaIntegraTotal, sub: true }]
        : [{ concepto: "Cuota íntegra foral", importe: liq.cuotaIntegraTotal, sub: true }];
      out.push({ id: "escala", titulo: comun ? "Escalas estatal y autonómica: cuota íntegra" : "Escala foral: cuota íntegra",
        tramos: cuadra ? grav.filter(g => g.base > 0) : [], filas, norma: "",
        nota: cuadra ? (comun ? "Cada escala se aplica a la base liquidable y, aparte, al mínimo personal y familiar; la cuota íntegra es la diferencia." : "")
          : "El reparto por tramos no se muestra en este caso (" + (coherente ? "cálculo especial, p. ej. anualidades por alimentos a los hijos" : "declaraciones individuales sumadas") + "); la cuota íntegra es la del motor." });
    }

    // 5. Deducciones -> cuota líquida
    {
      const filas = [];
      if (num(liq.minoracionCuota)) filas.push({ concepto: "Minoración general de la cuota", importe: -liq.minoracionCuota, resta: true, norma: normaDe(P.foral_pv.minoracion_cuota) });
      const de = liq.deduccionesEstatales;
      for (const [id, v] of Object.entries((de && de.detalle) || {})) if (num(v) > 0)
        filas.push({ concepto: humano(id) + " (mitad estatal, mitad autonómica)", importe: -v, resta: true, norma: normaDeduccion(P, Object.assign({}, liq, { regimen: "comun", territorio: "" }), id) });
      for (const [id, v] of Object.entries((liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.detalle) || {})) if (num(v) > 0)
        filas.push({ concepto: humano(id), importe: -v, resta: true, norma: normaDeduccion(P, liq, id) });
      if (num(liq.bonificacionResidencia)) filas.push({ concepto: "Bonificación por residencia", importe: -liq.bonificacionResidencia, resta: true, norma: normaDe(terr.bonificacion_residencia) });
      if (!filas.length) filas.push({ concepto: "Sin deducciones en la cuota con estos datos", importe: null });
      if (comun) {
        filas.push({ concepto: "Cuota líquida estatal", importe: liq.cuotaLiquidaEstatal, sub: true });
        filas.push({ concepto: "Cuota líquida autonómica", importe: liq.cuotaLiquidaAutonomica, sub: true });
      }
      filas.push({ concepto: "Cuota líquida total", importe: liq.cuotaLiquidaTotal, sub: true });
      out.push({ id: "deducciones", titulo: "Deducciones y cuota líquida", filas, norma: "" });
    }

    // 6. De la cuota líquida al resultado
    {
      const filas = [{ concepto: "Cuota líquida total", importe: liq.cuotaLiquidaTotal }];
      const drt = num(liq.deduccionRendimientosTrabajo && liq.deduccionRendimientosTrabajo.total);
      if (drt) filas.push({ concepto: "Deducción por obtención de rendimientos del trabajo", importe: -drt, resta: true, norma: normaDe(P.estatal.deduccion_obtencion_rendimientos_trabajo) });
      filas.push({ concepto: "Cuota resultante de la autoliquidación", importe: liq.cuotaResultanteAutoliquidacion, sub: true });
      for (const [id, v] of Object.entries((liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.detalle) || {})) if (num(v) > 0)
        filas.push({ concepto: humano(id), importe: -v, resta: true, norma: normaDeduccion(P, liq, id) });
      if (num(liq.retenciones)) filas.push({ concepto: "Retenciones e ingresos a cuenta", importe: -liq.retenciones, resta: true });
      filas.push({ concepto: liq.cuotaDiferencial < 0 ? "Cuota diferencial: a devolver" : "Cuota diferencial", importe: Math.abs(num(liq.cuotaDiferencial)), total: true });
      out.push({ id: "resultado", titulo: "Resultado", filas, norma: "",
        nota: (conjunta ? "Tributación conjunta, " : "Tributación individual, ") + "la modalidad más favorable entre las posibles. Tipo medio efectivo: " + pct(num(liq.tipoMedioEfectivo)) + "." });
    }
    return out;
  }

  function htmlTramos(g) {
    const filas = g.tramos.map(t => `<tr><td class="num">${t.hasta == null ? "Más de " + eur0(t.desde) : "Hasta " + eur0(t.hasta)}</td><td class="num">${pct(t.tipo)}</td><td class="num">${eur(t.base)}</td><td class="num">${eur(t.cuota)}</td></tr>`).join("");
    const minimo = g.minimo > 0 ? `<tr class="exp-resta"><td colspan="3">Menos la cuota del mínimo personal y familiar (${eur(g.minimo)} a esta escala)</td><td class="num">−${eur(g.cuotaMinimo)}</td></tr>` : "";
    return `<table class="exp-tramos"><caption>${esc(g.nombre)} sobre ${eur(g.base)}</caption>
      <thead><tr><th scope="col" class="num">Tramo</th><th scope="col" class="num">Tipo</th><th scope="col" class="num">Base</th><th scope="col" class="num">Cuota</th></tr></thead>
      <tbody>${filas}${minimo}<tr class="exp-sub"><td colspan="3">Cuota</td><td class="num">${eur(g.cuota)}</td></tr></tbody></table>`;
  }

  function html(liq, P) {
    const ps = pasos(liq, P);
    return `<ol class="exp-pasos">${ps.map(p => `<li class="exp-paso"><h3>${esc(p.titulo)}</h3>
      ${(p.tramos || []).map(htmlTramos).join("")}
      ${p.filas.length ? `<table class="exp-filas"><tbody>${p.filas.map(f => `<tr class="${f.total ? "exp-total" : f.sub ? "exp-sub" : f.resta ? "exp-resta" : ""}"><td>${esc(f.concepto)}${f.norma ? `<span class="exp-norma">${esc(f.norma)}</span>` : ""}</td><td class="num">${f.importe == null ? "" : (f.importe < 0 ? "−" : "") + eur(Math.abs(f.importe))}</td></tr>`).join("")}</tbody></table>` : ""}
      ${p.nota ? `<p class="exp-nota">${esc(p.nota)}</p>` : ""}
      ${p.norma ? `<p class="exp-norma">Norma: ${esc(p.norma)}</p>` : ""}</li>`).join("")}</ol>
      <p class="exp-nota">Cifras del motor de Mapafiscal para el ejercicio ${esc(liq.ejercicio)}. Es una estimación, no una liquidación oficial.</p>`;
  }

  const CSS = `.explicacion{margin-top:14px;border-top:1px solid var(--linea);padding-top:10px}
.explicacion>summary{cursor:pointer;font-weight:600;color:var(--marca-tinta);padding:6px 0;list-style-position:inside}
.explicacion>summary:focus-visible{outline:2px solid var(--anillo);outline-offset:2px;border-radius:var(--radio-sm)}
.exp-pasos{margin:8px 0 0;padding-left:1.4em;color:var(--tinta-2)}
.exp-paso{margin:0 0 16px}.exp-paso h3{font-size:.95rem;margin:0 0 6px;color:var(--tinta)}
.exp-tramos{font-size:.8rem!important}.exp-tramos td,.exp-tramos th{padding:4px 3px!important}
.exp-filas,.exp-tramos{width:100%;border-collapse:collapse;font-size:.88rem;margin:0 0 8px;font-variant-numeric:tabular-nums}
.exp-filas td,.exp-tramos td,.exp-tramos th{padding:4px 6px;border-bottom:1px solid var(--linea);vertical-align:top;text-align:left}
.exp-tramos th{font-weight:600;color:var(--tinta-3);font-size:.8rem}
.exp-tramos caption{text-align:left;font-weight:600;color:var(--tinta);padding:4px 0}
.explicacion .num{text-align:right;white-space:nowrap}
.exp-sub td{font-weight:600;color:var(--tinta)}.exp-total td{font-weight:700;color:var(--tinta);border-bottom:2px solid var(--linea-2)}
.exp-resta td{color:var(--tinta-2)}
.exp-norma{display:block;font-size:.78rem;color:var(--tinta-3);margin-top:2px}
p.exp-norma,.exp-nota{font-size:.82rem;color:var(--tinta-3);margin:4px 0}
.exp-paso{overflow-x:auto}`;

  function estilos(doc) {
    if (!doc || doc.getElementById("mf-explicacion-css")) return;
    const s = doc.createElement("style"); s.id = "mf-explicacion-css"; s.textContent = CSS; doc.head.appendChild(s);
  }

  function pintar(el, liq, P) {
    if (!el) return;
    estilos(el.ownerDocument);
    const abierto = el.open;
    el.className = "explicacion";
    el.innerHTML = `<summary>¿Cómo hemos calculado esta cifra?</summary>` + html(liq, P);
    el.open = abierto;
    el.hidden = false;
  }

  const api = { pasos, html, pintar, tramosAplicados };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.mfExplicacion = api;
})(typeof window !== "undefined" ? window : this);
