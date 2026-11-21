/* =============================================================================
 * Mapafiscal — «Encuentra tus deducciones» (vista #encuentra-deducciones)
 * Un cuestionario corto que, con reglas fijas (nada de IA), busca las deducciones estatales y
 * autonómicas que podrían corresponder a un hogar. Las cuentas son las del motor
 * (irpfsim.liquidar): se liquida el hogar descrito y se leen las deducciones que aplica, y para
 * las que dependen de un gasto que no se ha indicado se prueba con un gasto alto y se da el
 * máximo. Solo se muestran como firmes las autonómicas que publican las páginas de deducciones
 * (web/datos/seo_deducciones.json: «confirmado», con fuente primaria y todos sus supuestos
 * confirmados); el resto no se muestra y solo se cuenta. Las estatales sin confirmar se marcan.
 * Se carga después de app.js, que muestra la vista y avisa con «mapafiscal:vista».
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    "encuentra-deducciones": { titulo: "Encuentra tus deducciones", icono: "deducciones", href: "#encuentra-deducciones",
      texto: "Responde unas preguntas y te decimos qué deducciones estatales y de tu comunidad podrían corresponderte, y cuánto ahorran." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-encuentra-deducciones"))) return;

  const COMUNES = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC"];
  const FORALES = ["ES-PV-BI", "ES-PV-SS", "ES-PV-VI", "ES-NC"];
  const SLUG = { "ES-AN": "andalucia", "ES-AR": "aragon", "ES-AS": "asturias", "ES-IB": "islas-baleares",
    "ES-CN": "canarias", "ES-CB": "cantabria", "ES-CM": "castilla-la-mancha", "ES-CL": "castilla-y-leon",
    "ES-CT": "cataluna", "ES-EX": "extremadura", "ES-GA": "galicia", "ES-MD": "madrid",
    "ES-MC": "murcia", "ES-RI": "la-rioja", "ES-VC": "comunidad-valenciana",
    "ES-PV-BI": "bizkaia", "ES-PV-SS": "gipuzkoa", "ES-PV-VI": "araba-alava", "ES-NC": "navarra" };
  // gasto que pide cada deducción (claves `campo` de params), en palabras
  const GASTO = {
    alquiler_vivienda_pagos: "el alquiler de tu vivienda habitual",
    cuotas_ss_empleada_hogar: "las cotizaciones de una persona empleada del hogar",
    gastos_deporte: "gastos de deporte y ejercicio físico",
    gastos_cuidado_hijos: "el cuidado de tus hijos (empleada del hogar o escuela infantil)",
    gastos_libros_texto: "libros de texto y material escolar",
    gastos_idiomas_informatica: "clases extraescolares de idiomas o informática",
    gastos_escolaridad: "gastos de escolaridad",
    gastos_idiomas: "clases de idiomas",
    gastos_vestuario_escolar: "vestuario escolar",
    gastos_estudios_no_superiores: "estudios no superiores (libros, material, transporte, uniforme o comedor)",
    gastos_guarderia: "guardería o escuela infantil",
    rehabilitacion_vivienda_pagos: "obras de rehabilitación de tu vivienda habitual",
    donativos_lengua_catalana: "donativos para el fomento de la lengua catalana u occitana",
    donativos_investigacion: "donativos a la investigación científica",
    inversion_cooperativas_cat: "aportaciones de capital a cooperativas agrarias o de vivienda"
  };
  // campos que se rellenan con las respuestas: gastos de los hijos (repartidos entre ellos) y del declarante
  const EDUCATIVOS = ["gastosLibrosTexto", "gastosEscolaridad", "gastosEstudiosNoSuperiores"];
  const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const num = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? Math.max(0, x) : d; };
  const r2 = x => Math.round(x * 100) / 100;

  // ---- reglas (también las usa test/deducciones.test.mjs) ------------------------------
  // r: { territorio, edad, bruto, discapacidad, pareja, brutoPareja, hijos: [{ edad, discapacidad }],
  //      partoMultiple, familiaNumerosa, ascendiente ("no" | "65" | "75"), alquiler, habitantes,
  //      zonaDespoblada, guarderia, educacion, donativos, empleadaHogar }
  function hogarDe(P, r) {
    const persona = (id, rol, edad, bruto, disc) => ({ id, rol, edad: num(edad, 40), discapacidad: disc || "no",
      trabajo: num(bruto) > 0 ? { dinerarias: num(bruto), cotizacionesSs: H.cotizacionesTrabajador(num(bruto), P, "indefinido") } : null });
    const d1 = Object.assign(persona("d1", "declarante", r.edad, r.bruto, r.discapacidad), {
      alquilerViviendaPagos: num(r.alquiler), donativos: num(r.donativos), cuotasSsEmpleadaHogar: num(r.empleadaHogar) });
    const miembros = [d1];
    if (r.pareja) miembros.push(persona("c1", "conyuge", r.edadPareja || r.edad, r.brutoPareja, "no"));
    const hijos = (r.hijos || []).map((h, i) => ({ id: "h" + (i + 1), rol: "descendiente", edad: Math.round(num(h.edad)),
      discapacidad: h.discapacidad || "no", rentasPropias: 0, nacidoEnEjercicio: num(h.edad) === 0 }));
    // guardería: entre los menores de 3 años (si no hay, entre todos); educación: entre los de 3 o más
    const reparte = (lista, k, total) => { if (total > 0 && lista.length) lista.forEach(h => { h[k] = total / lista.length; }); };
    const peques = hijos.filter(h => h.edad < 3), mayores = hijos.filter(h => h.edad >= 3);
    reparte(peques.length ? peques : hijos, "gastosGuarderia", num(r.guarderia));
    for (const k of EDUCATIVOS) reparte(mayores.length ? mayores : hijos, k, num(r.educacion));
    miembros.push(...hijos);
    if (r.ascendiente === "65" || r.ascendiente === "75")
      miembros.push({ id: "a1", rol: "ascendiente", edad: r.ascendiente === "75" ? 76 : 66, discapacidad: "no", rentasPropias: 0, convivenciaMeses: 12 });
    const tipo = r.pareja ? "biparental" : hijos.length ? "monoparental" : "ninguna";
    const hogar = { territorio: r.territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: tipo,
      familiaNumerosa: ["general", "especial"].includes(r.familiaNumerosa) ? r.familiaNumerosa : "no",
      partoMultiple: !!r.partoMultiple, zonaDespoblada: !!r.zonaDespoblada, miembros };
    if (r.habitantes != null && r.habitantes !== "") hogar.municipioHabitantes = num(r.habitantes);
    return hogar;
  }

  // supuestos firmes: los de las páginas de deducciones; sin ese fichero (o de otro ejercicio),
  // los de estado «confirmado» con fuente
  function firmes(P, seo, t) {
    const lista = ((P.territorios[t] || {}).deducciones_autonomicas || {}).lista || [];
    // un territorio sin página de deducciones no tiene ninguna verificada
    const fichas = seo && seo.ejercicio === P.ejercicio && seo.territorios ? ((seo.territorios[t] || {}).fichas || []) : null;
    const porId = {};
    if (fichas) for (const f of fichas) for (const s of f.supuestos) porId[s.id] = f;
    const ok = d => fichas ? !!porId[d.id] : (d.estado === "confirmado" && !!d.fuente);
    return { lista, porId, firmes: lista.filter(ok), noFirmes: lista.filter(d => !ok(d)).length };
  }

  const eurTxt = n => (Math.round(n) < 0 ? "−" : "") + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  const pctTxt = p => (Math.round(p * 1000) / 10).toString().replace(".", ",") + " %";
  // importe en una frase corta
  function cuanto(d) {
    const lim = d.limite != null ? `, máximo ${eurTxt(d.limite)}` : "";
    switch (d.tipo) {
      case "fija": return eurTxt(d.importe);
      case "fija_por_hijo": return `${eurTxt(d.importe)} por hijo`;
      case "fija_por_hijo_nacido": return d.importes_por_orden ? `${eurTxt(Math.min(...Object.values(d.importes_por_orden)))} o más por hijo nacido o adoptado` : `${eurTxt(d.importe)} por hijo nacido o adoptado`;
      case "fija_por_ascendiente": return `${eurTxt(d.importe)} por ascendiente`;
      case "porcentaje_campo": return `${pctTxt(d.porcentaje)} de ${GASTO[d.campo] || "ese gasto"}${lim}`;
      case "porcentaje_campo_hijo": return `${pctTxt(d.porcentaje)} de ${GASTO[d.campo] || "ese gasto"}${d.limite != null ? `, máximo ${eurTxt(d.limite)} por hijo` : ""}`;
      case "porcentaje_campos_hijo": return `Un porcentaje de ${Object.keys(d.campos).map(k => GASTO[k] || k).join(", ")}${d.limite != null ? `, máximo ${eurTxt(d.limite)} por hijo` : ""}`;
      case "porcentaje_cuota_autonomica": return `${pctTxt(d.porcentaje)} de la cuota autonómica${lim}`;
      default: return "";
    }
  }
  const cuantoBien = d => cuanto(d).replace(/ de el /g, " del ");
  // requisitos principales en frases cortas (la lista completa, en la norma y en la página de deducciones)
  function requisitos(d) {
    const q = [];
    if (d.edad_max != null) q.push(d.edad_min_alt != null ? `Menos de ${d.edad_max} años o ${d.edad_min_alt} o más` : `Tener menos de ${d.edad_max} años`);
    if (d.edad_min != null) q.push(`Tener ${d.edad_min} años o más`);
    if (d.requiere_discapacidad_contribuyente) q.push("Discapacidad propia igual o superior al 33 %");
    if (d.requiere_discapacidad_grado === "65_mas") q.push("Discapacidad propia igual o superior al 65 %");
    if (d.requiere_discapacidad_65_de) q.push("Discapacidad igual o superior al 65 % (tuya o de un hijo)");
    if (d.requiere_familia_numerosa === true) q.push("Título de familia numerosa");
    if (d.requiere_familia_numerosa === "especial" || d.familia_numerosa_categoria === "especial") q.push("Familia numerosa especial");
    if (d.familia_numerosa_categoria === "general") q.push("Familia numerosa general");
    if (d.requiere_monoparental) q.push("Familia monoparental");
    if (d.descendientes_min != null) q.push(`Al menos ${d.descendientes_min} ${d.descendientes_min === 1 ? "hijo" : "hijos"}`);
    if (d.descendiente_edad_max != null) q.push(`Algún hijo de ${d.descendiente_edad_max} años o menos`);
    if (d.edad_hijo_max != null) q.push(`Por hijos de ${d.edad_hijo_max} años o menos`);
    if (d.anios_ventana != null && d.tipo === "fija_por_hijo_nacido") q.push(d.anios_ventana > 1 ? `Hasta ${d.anios_ventana} años desde el nacimiento o la adopción` : "Nacimiento o adopción en el año");
    if (d.requiere_zona_despoblada) q.push("Vivir en un municipio en riesgo de despoblación");
    if (d.municipio_hab_max != null) q.push(`Municipio de hasta ${eurTxt(d.municipio_hab_max).replace(" €", "")} habitantes`);
    if (d.requiere_progenitores_trabajan) q.push("Que los progenitores trabajen");
    if (d.base_max_individual != null) q.push(`Base imponible hasta ${eurTxt(d.base_max_individual)} (individual)${d.base_max_conjunta != null ? ` o ${eurTxt(d.base_max_conjunta)} (conjunta)` : ""}`);
    if (d.taper_individual) q.push(`Se reduce con bases entre ${eurTxt(d.taper_individual[0])} y ${eurTxt(d.taper_individual[1])}`);
    return q;
  }

  const ESTATALES = {
    maternidad: { titulo: "Por maternidad (hijos menores de 3 años)", clave: "deduccion_maternidad",
      cuanto: e => `${eurTxt(e.importe_anual)} al año por hijo menor de 3 años, más hasta ${eurTxt(e.incremento_guarderia)} por gastos de guardería`,
      requisitos: ["Hijos menores de 3 años", "Trabajar por cuenta propia o ajena"] },
    familiaNumerosa: { titulo: "Por familia numerosa", clave: "deduccion_familia_numerosa_y_discapacidad_cargo",
      cuanto: e => `${eurTxt(e.familia_numerosa_general)} (general) o ${eurTxt(e.familia_numerosa_especial)} (especial)`,
      requisitos: ["Título de familia numerosa"] },
    discapacidadFamiliaresCargo: { titulo: "Por descendientes o ascendientes con discapacidad a cargo", clave: "deduccion_familia_numerosa_y_discapacidad_cargo",
      cuanto: e => `${eurTxt(e.ascendiente_o_descendiente_discapacidad)} por familiar`,
      requisitos: ["Familiar con discapacidad que da derecho al mínimo por descendientes o ascendientes"] },
    donativos: { titulo: "Por donativos a ONG y fundaciones (Ley 49/2002)", clave: "deduccion_donativos",
      cuanto: e => `${pctTxt(e.ley49_2002.tramo1_porcentaje)} de los primeros ${eurTxt(e.ley49_2002.tramo1_limite)} y ${pctTxt(e.ley49_2002.resto_porcentaje)} del resto`,
      requisitos: ["Donar a entidades acogidas a la Ley 49/2002", "La base no puede pasar del 10 % de tu base liquidable"] }
  };

  // los params sin los supuestos firmes (el motor aplica también los que están en revisión)
  const sinDeducciones = (P, t, ids) => {
    const Q = JSON.parse(JSON.stringify(P)), da = Q.territorios[t].deducciones_autonomicas;
    da.lista = da.lista.filter(d => !ids.has(d.id));
    return Q;
  };

  // Resultado: { territorio, foral, ejercicio, aplicadas, posibles, ahorroTotal, nominalTotal, noFirmes, enlace }
  function encontrar(P, r, seo) {
    const t = r.territorio, terr = P.territorios[t];
    if (!terr) throw new Error("territorio desconocido: " + t);
    const enlace = `irpf/${SLUG[t]}/deducciones/`;
    if (terr.regimen !== "comun") return { territorio: t, foral: true, ejercicio: P.ejercicio, aplicadas: [], posibles: [], ahorroTotal: 0, nominalTotal: 0, noFirmes: 0, enlace };
    const hogar = hogarDe(P, r);
    const liq = H.liquidar(hogar, P);
    const F = firmes(P, seo, t);
    const detAut = (liq.deduccionesAutonomicas || {}).detalle || {};
    const ficha = d => F.porId[d.id] || null;
    const aut = d => {
      const f = ficha(d);
      return { id: d.id, ambito: "autonomica", titulo: f ? f.titulo : d.id.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()),
        cuanto: cuantoBien(d), requisitos: requisitos(d), norma: d.norma, fuente: d.fuente || "", url: f && f.url_aeat ? f.url_aeat : null,
        boe: f && f.boe ? f.boe : [], estado: "confirmado", firme: true, grupo: d.grupo || null };
    };
    const aplicadas = [];
    for (const d of F.firmes) if (num(detAut[d.id]) > 0) aplicadas.push(Object.assign(aut(d), { importe: r2(detAut[d.id]) }));
    // estatales: las del motor (donativos y las de la cuota diferencial)
    const detEst = Object.assign({}, (liq.deduccionesEstatales || {}).detalle, (liq.deduccionesCuotaDiferencial || {}).detalle);
    for (const [k, def] of Object.entries(ESTATALES)) {
      if (!(num(detEst[k]) > 0)) continue;
      const e = P.estatal[def.clave];
      aplicadas.push({ id: k, ambito: "estatal", titulo: def.titulo, cuanto: def.cuanto(e), requisitos: def.requisitos, norma: e.norma,
        fuente: e.fuente || "", url: null, boe: [], estado: e.estado || "pendiente", firme: e.estado === "confirmado", importe: r2(detEst[k]) });
    }
    // posibles: las firmes que no se aplican y que se aplicarían con un gasto (o un municipio)
    // que no se ha indicado; se da el máximo que saldría
    const gruposAplicados = new Set(aplicadas.filter(a => a.grupo).map(a => a.grupo));
    const posibles = [];
    for (const d of F.firmes) {
      if (num(detAut[d.id]) > 0 || (d.grupo && gruposAplicados.has(d.grupo))) continue;
      const pruebas = [];
      const campos = d.campo ? [d.campo] : d.campos ? Object.keys(d.campos) : [];
      if (campos.length) pruebas.push({ falta: `si pagas ${campos.map(c => GASTO[c] || "ese gasto").join(" o ")}`, aplicar: h => {
        for (const m of h.miembros) for (const c of campos) if (m.rol !== "ascendiente") m[camel(c)] = 1e5;
      } });
      if (d.requiere_zona_despoblada && !r.zonaDespoblada) pruebas.push({ falta: "si tu municipio figura en la lista de zonas en riesgo de despoblación", aplicar: h => {
        h.zonaDespoblada = true; for (const m of h.miembros) for (const c of campos) if (m.rol !== "ascendiente" && !num(m[camel(c)])) m[camel(c)] = 1e5;
      } });
      for (const p of pruebas) {
        const h2 = JSON.parse(JSON.stringify(hogar)); p.aplicar(h2);
        const v = num(((H.liquidar(h2, P).deduccionesAutonomicas || {}).detalle || {})[d.id]);
        if (v > 0) { posibles.push(Object.assign(aut(d), { maximo: r2(v), falta: p.falta })); break; }
      }
    }
    // ahorro real de las autonómicas y los donativos: la deducción no puede pasar de la cuota
    const nominalTotal = r2(aplicadas.reduce((s, a) => s + a.importe, 0));
    const hSin = JSON.parse(JSON.stringify(hogar)); hSin.miembros.forEach(m => { m.donativos = 0; });
    const sin = H.liquidar(hSin, sinDeducciones(P, t, new Set(F.firmes.map(d => d.id))));
    const impropias = num((liq.deduccionesCuotaDiferencial || {}).total);
    const ahorroTotal = r2(Math.max(0, sin.cuotaDiferencial - liq.cuotaDiferencial) + impropias);
    aplicadas.sort((a, b) => b.importe - a.importe);
    posibles.sort((a, b) => b.maximo - a.maximo);
    return { territorio: t, foral: false, ejercicio: P.ejercicio, aplicadas, posibles, ahorroTotal, nominalTotal, noFirmes: F.noFirmes, enlace, cuota: liq.cuotaDiferencial };
  }

  const CALCULOS = { hogarDe, firmes, encontrar, requisitos, cuanto, COMUNES, FORALES };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalDeducciones = CALCULOS;

  // ---- interfaz ------------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur0 = n => eurTxt(n || 0);
  const val = id => $(id).value;
  // importes en formato español (js/importe.js); sin el módulo (tests), como antes
  const imp = id => window.MapafiscalImporte ? Math.max(0, window.MapafiscalImporte.valor($(id))) : num(val(id));
  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + url);
    return r.json();
  }

  let P = null, SEO = null, edades = [];
  const inicial = (location.hash.match(/[?&]t=(ES-[A-Z]{2}(?:-[A-Z]{2})?)\b/) || [])[1];

  function pintarHijos() {
    const n = parseInt(val("dd-hijos"), 10) || 0;
    while (edades.length < n) edades.push({ edad: edades.length ? Math.min(25, edades[edades.length - 1].edad + 3) : 2, discapacidad: "no" });
    edades = edades.slice(0, n);
    $("dd-edades").innerHTML = edades.map((h, i) => `<label>Edad del hijo ${i + 1}
      <input type="number" min="0" max="30" step="1" value="${h.edad}" data-edad="${i}" inputmode="numeric"></label>`).join("");
    $("dd-bloque-hijos").hidden = n === 0;
  }
  const respuestas = () => ({
    territorio: val("dd-territorio"), edad: num(val("dd-edad"), 40), bruto: imp("dd-bruto"), discapacidad: val("dd-discapacidad"),
    pareja: val("dd-pareja") === "si", brutoPareja: imp("dd-bruto-pareja"),
    hijos: edades.map((h, i) => ({ edad: h.edad, discapacidad: i === 0 && $("dd-hijo-disc").checked ? "33_64" : "no" })),
    partoMultiple: $("dd-multiple").checked, familiaNumerosa: val("dd-fn"), ascendiente: val("dd-ascendiente"),
    alquiler: imp("dd-alquiler"), habitantes: val("dd-habitantes"), zonaDespoblada: $("dd-despoblada").checked,
    guarderia: imp("dd-guarderia"), educacion: imp("dd-educacion"), donativos: imp("dd-donativos"),
    empleadaHogar: imp("dd-empleada")
  });

  const etiquetaEstado = a => a.firme ? "" : `<span class="dd-estado" title="Cifra pendiente de verificar con la fuente oficial">${esc(a.estado === "provisional" ? "Provisional" : "Pendiente de verificar")}</span>`;
  function fichaHtml(a, posible) {
    const fuente = a.url ? `<a href="${esc(a.url)}" rel="noopener" target="_blank">Manual de la AEAT</a>` : "";
    const boe = (a.boe || []).map(b => `<a href="https://www.boe.es/buscar/act.php?id=${encodeURIComponent(b)}" rel="noopener" target="_blank">${esc(b)}</a>`).join(" · ");
    return `<li class="dd-ficha${posible ? " posible" : ""}">
      <div class="dd-ficha-cab"><h3>${esc(a.titulo)}</h3>
        <span class="dd-importe">${posible ? "hasta " + eur0(a.maximo) : eur0(a.importe)}</span></div>
      <p class="dd-meta"><span class="dd-ambito">${a.ambito === "estatal" ? "Estatal" : "Autonómica"}</span>${etiquetaEstado(a)}${posible ? ` <span>Te correspondería ${esc(a.falta)}.</span>` : ""}</p>
      <p class="dd-cuanto">${esc(a.cuanto)}.</p>
      ${a.requisitos.length ? `<ul class="dd-req">${a.requisitos.map(q => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
      <p class="dd-norma">Norma: ${esc(a.norma)}${fuente || boe ? `. Fuente: ${[fuente, boe].filter(Boolean).join(" · ")}` : ""}.</p>
    </li>`;
  }

  function pintar() {
    const r = respuestas();
    $("dd-l-bruto-pareja").hidden = !r.pareja;
    let res;
    try { res = encontrar(P, r, SEO); } catch (e) { $("dd-principal").innerHTML = '<p class="vacio">Revisa los datos introducidos.</p>'; return; }
    const nombre = P.territorios[r.territorio].nombre;
    $("dd-chip").textContent = `${nombre} · renta ${P.ejercicio}`;
    $("dd-ver-todas").href = res.enlace;
    if (res.foral) {
      $("dd-principal").innerHTML = `<p class="res-sub">${esc(nombre)} tiene su propio IRPF foral, con deducciones propias que este buscador aún no recorre.
        Consulta <a href="${esc(res.enlace)}">las deducciones de ${esc(nombre)}</a> o haz el cálculo completo en la calculadora.</p>`;
      $("dd-lista").innerHTML = ""; $("dd-posibles-caja").hidden = true; $("dd-nota").textContent = "";
      return;
    }
    const n = res.aplicadas.length;
    $("dd-principal").innerHTML = `<div class="res-etq">Ahorro estimado con tus respuestas</div>
      <div class="res-cifra">${eur0(res.ahorroTotal)}</div>
      <p class="res-sub">${n ? `${n === 1 ? "Una deducción" : n + " deducciones"} encajan con lo que nos has contado.` : "Con tus respuestas no encontramos deducciones que se apliquen ya."}
        ${res.posibles.length ? ` Y ${res.posibles.length === 1 ? "otra podría corresponderte" : res.posibles.length + " más podrían corresponderte"} si tienes ciertos gastos.` : ""}
        ${res.nominalTotal > res.ahorroTotal + 1 ? ` Algunas no se aprovechan enteras porque superan tu cuota (suman ${eur0(res.nominalTotal)}).` : ""}</p>`;
    $("dd-lista").innerHTML = n ? res.aplicadas.map(a => fichaHtml(a, false)).join("") : '<li class="vacio">Prueba a indicar tus gastos de alquiler, guardería o educación, o tu situación familiar.</li>';
    $("dd-posibles-caja").hidden = !res.posibles.length;
    $("dd-posibles").innerHTML = res.posibles.map(a => fichaHtml(a, true)).join("");
    $("dd-nota").textContent = `Renta ${P.ejercicio} (la que se presenta en ${P.ejercicio + 1}). Importes calculados con el motor de Mapafiscal para un hogar como el que describes: ` +
      "sueldo de contrato indefinido, tributación individual o conjunta según lo que salga mejor, y gastos de los hijos repartidos entre ellos. " +
      "Solo mostramos las deducciones autonómicas verificadas con su fuente oficial" + (res.noFirmes ? ` (${res.noFirmes === 1 ? "otro supuesto" : "otros " + res.noFirmes + " supuestos"} de ${nombre} ${res.noFirmes === 1 ? "está" : "están"} en revisión y no se muestran)` : "") +
      ". Cada deducción tiene más requisitos de los que caben aquí (justificantes, plazos, límites): compruébalos en su norma antes de aplicarla. Es una orientación, no asesoramiento fiscal.";
  }

  // Las deducciones verificadas (seo_deducciones.json) son de un ejercicio concreto: se usan los
  // parámetros de ese mismo ejercicio aunque el ejercicio por defecto de la web sea otro.
  Promise.all([datos("datos-params", "datos/params.json"), datos("datos-seo-deducciones", "datos/seo_deducciones.json").catch(() => null)])
    .then(([p, seo]) => seo && seo.ejercicio && seo.ejercicio !== p.ejercicio
      ? datos("datos-params-" + seo.ejercicio, "datos/params_" + seo.ejercicio + ".json").then(q => [q, seo], () => [p, seo])
      : [p, seo])
    .then(([p, seo]) => {
    P = p; SEO = seo;
    const sel = $("dd-territorio"), ts = COMUNES.concat(FORALES).filter(t => P.territorios[t]);
    sel.innerHTML = ts.map(t => `<option value="${t}">${esc(P.territorios[t].nombre)}</option>`).join("");
    sel.value = inicial && ts.includes(inicial) ? inicial : "ES-MD";
    pintarHijos();
    let t1;
    $("dd-hijos").addEventListener("change", pintarHijos);
    $("dd-edades").addEventListener("input", e => { const i = e.target.dataset.edad; if (i != null) edades[+i].edad = Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)); });
    $("dd-form").addEventListener("input", () => { clearTimeout(t1); t1 = setTimeout(pintar, 150); });
    $("dd-form").addEventListener("change", pintar);
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "encuentra-deducciones") pintar(); });
    if (!$("v-encuentra-deducciones").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
