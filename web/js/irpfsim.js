/* =============================================================================
 * irpfsim.js — motor de liquidación del IRPF (port del motor R a JavaScript)
 * Fuente única de parámetros: params.json (generado de params/2025/*.yaml).
 * Debe reproducir R/00..08 al céntimo. Ver tools/validar_js.html.
 * ========================================================================== */
(function (global) {
  "use strict";

  const red2 = n => Math.round((n + 1e-9) * 100) / 100;
  const num = (x, d = 0) => (x === undefined || x === null || Number.isNaN(x)) ? d : x;

  // Escala progresiva por tramos marginales. tramos: [{hasta|null, tipo}]
  function aplicarEscala(base, tramos) {
    if (!base || base <= 0) return 0;
    let cuota = 0, prev = 0;
    for (const tr of tramos) {
      const lim = tr.hasta;
      if (lim === null || lim === undefined || base <= lim) {
        return cuota + (base - prev) * tr.tipo;
      }
      cuota += (lim - prev) * tr.tipo;
      prev = lim;
    }
    return cuota;
  }
  function tipoMarginal(base, tramos) {
    if (base < 0) base = 0;
    for (const tr of tramos) {
      if (tr.hasta === null || tr.hasta === undefined || base <= tr.hasta) return tr.tipo;
    }
    return tramos[tramos.length - 1].tipo;
  }

  // ---- Rendimientos ---------------------------------------------------------
  // Rendimiento neto que fija la cuantía de la reducción del art. 20: íntegro − gastos
  // a) a e) del art. 19.2, sin los «otros gastos» de la letra f)
  function rnTrabajoPrevioArt20(pe) {
    const tr = pe.trabajo;
    if (!tr) return 0;
    let integro = num(tr.dinerarias) + num(tr.especie);
    const irr = tr.rendimientoIrregular;
    if (irr && num(irr.importe) > 0 && num(irr.anios) > 2) {
      integro -= Math.min(irr.importe, 300000) * 0.30;
    }
    return integro - num(tr.cotizacionesSs) - num(tr.otrosGastos);
  }

  // Rendimiento neto previo a la reducción (tras la letra f, limitada al íntegro menos
  // el resto de gastos)
  function rnTrabajoPrevio(pe, P, regimen) {
    const tr = pe.trabajo;
    if (!tr) return 0;
    const previoArt20 = rnTrabajoPrevioArt20(pe);
    let otros = 0;
    if (regimen === "comun") {
      const og = P.estatal.trabajo_otros_gastos;
      otros = og.generico;
      if (tr.movilidadGeografica) otros += og.incremento_movilidad_geografica;
      if (pe.discapacidad === "33_64" && tr.trabajadorActivoDiscapacidad) otros += og.incremento_discapacidad_33_64;
      if ((pe.discapacidad === "65_mas" || pe.movilidadReducida) && tr.trabajadorActivoDiscapacidad)
        otros += og.incremento_discapacidad_65_o_movilidad;
    }
    return previoArt20 - Math.min(otros, Math.max(0, previoArt20));
  }

  function reduccionTrabajo(rnPrevio, otrasRentas, pe, P, regimen) {
    if (rnPrevio <= 0) return 0;
    if (regimen === "comun") {
      const a = P.estatal.trabajo_reduccion_art20;
      if (otrasRentas > a.limite_otras_rentas) return 0;
      if (rnPrevio <= a.umbral_pleno) return Math.min(a.importe_maximo, rnPrevio);
      if (rnPrevio <= a.umbral_intermedio) return Math.max(0, a.importe_maximo - a.coef_tramo1 * (rnPrevio - a.umbral_pleno));
      if (rnPrevio <= a.umbral_final) return Math.max(0, a.base_tramo2 - a.coef_tramo2 * (rnPrevio - a.umbral_intermedio));
      return 0;
    }
    if (regimen === "foral_pais_vasco") {
      const b = P.foral_pv.bonificacion_trabajo;
      let bimp;
      if (otrasRentas > b.limite_otras_rentas) bimp = b.importe_minimo;
      else if (rnPrevio < b.umbral_pleno) bimp = b.importe_pleno;
      else if (rnPrevio <= b.umbral_minimo) bimp = Math.max(b.importe_minimo, b.importe_pleno - b.coef_reduccion * (rnPrevio - b.umbral_pleno));
      else bimp = b.importe_minimo;
      let mult = 1;
      if (pe.discapacidad === "33_64" && pe.trabajo && pe.trabajo.trabajadorActivoDiscapacidad) mult = 1 + b.incremento_discapacidad_33_64;
      if ((pe.discapacidad === "65_mas" || pe.movilidadReducida) && pe.trabajo && pe.trabajo.trabajadorActivoDiscapacidad)
        mult = 1 + b.incremento_discapacidad_65_o_movilidad;
      return Math.min(bimp * mult, rnPrevio);
    }
    return 0; // navarra -> deducción en cuota
  }

  function rnCapitalInmobiliario(pe, P, regimen) {
    const inms = pe.capitalInmobiliario;
    if (!inms || !inms.length) return 0;
    let total = 0;
    for (const im of inms) {
      const ingresos = num(im.ingresos);
      let neto = ingresos - (num(im.gastosDeducibles) + num(im.gastosFinancieros));
      if (im.arrendamientoVivienda && neto > 0) {
        if (regimen === "comun") {
          const r = P.estatal.capital_inmobiliario ? P.estatal.capital_inmobiliario.reduccion_arrendamiento_vivienda : null;
          const pct = { zona_tensionada_bajada: 0.90, joven_o_admon: 0.70, rehabilitacion: 0.60 }[im.tipoArrendamiento] || 0.50;
          neto = neto * (1 - pct);
        } else if (regimen === "foral_pais_vasco") {
          const pct = { zona_tensionada: 0.70, programas_publicos: 0.70, vivienda_habitual: 0.30 }[im.tipoArrendamiento] || 0.20;
          neto = ingresos * (1 - pct) - num(im.gastosFinancieros);
        }
      }
      total += neto;
    }
    return total;
  }

  function rnCapitalMobiliario(pe, P, regimen) {
    const cm = pe.capitalMobiliario;
    if (!cm) return { ahorro: 0, general: 0 };
    const div = num(cm.dividendos);
    let exencion = 0;
    if (regimen === "foral_pais_vasco") exencion = Math.min(div, num(P.foral_pv.exencion_dividendos && P.foral_pv.exencion_dividendos.importe, 0));
    return {
      ahorro: (div - exencion) + num(cm.intereses) + num(cm.seguros) + num(cm.cesionTercerosGeneral),
      general: num(cm.baseGeneralOtros)
    };
  }

  function rnActividades(pe, P) {
    const ac = pe.actividades;
    if (!ac) return 0;
    if (ac.metodo === "objetiva") return num(ac.rendimientoNetoModulos);
    let rnp = num(ac.rendimientoNetoPrevio);
    if (ac.metodo === "directa_simplificada") {
      const s = P.estatal.actividades_directa_simplificada;
      rnp -= Math.min(s.gastos_dificil_justificacion_pct * Math.max(0, rnp), s.gastos_dificil_justificacion_max);
    }
    if (ac.inicioActividad && rnp > 0) rnp -= Math.min(rnp, 100000) * 0.20;
    return rnp;
  }

  function imputacionInmobiliaria(pe, P) {
    const ii = pe.imputacionInmobiliaria;
    if (!ii) return 0;
    const tipo = ii.revisado10Anios ? P.estatal.imputacion_renta_inmobiliaria.tipo_revisado_10_anios
                                    : P.estatal.imputacion_renta_inmobiliaria.tipo_general;
    return num(ii.valorCatastral) * tipo;
  }

  function gananciaElemento(el, P, regimen) {
    if (el.exenta) return { ahorro: 0, general: 0 };
    const ganancia0 = num(el.valorTransmision) - num(el.valorAdquisicion);
    if (el.esTransmision === false) return { ahorro: 0, general: ganancia0 };
    if (ganancia0 <= 0) return { ahorro: ganancia0, general: 0 };
    let ganancia = ganancia0;
    const dt = regimen === "comun" ? P.estatal.dt9_abatimiento : (regimen === "foral_pais_vasco" ? P.foral_pv.dt_abatimiento_pre1994 : P.navarra.dt_abatimiento_pre1994);
    if (dt && el.fechaAdquisicion && new Date(el.fechaAdquisicion) <= new Date(dt.fecha_corte_adquisicion || "1994-12-31")) {
      const dTot = (new Date(el.fechaTransmision || "2025-12-31") - new Date(el.fechaAdquisicion)) / 86400000;
      const dPre = (new Date("2006-01-20") - new Date(el.fechaAdquisicion)) / 86400000;
      const fracPre = dTot > 0 ? Math.min(1, Math.max(0, dPre / dTot)) : 1;
      const gananciaPre = ganancia * fracPre;
      const anios = Math.ceil((new Date("1996-12-31") - new Date(el.fechaAdquisicion)) / (365.25 * 86400000));
      const exceso = Math.max(0, anios - 2);
      const coef = { inmueble: dt.coeficientes_por_anio_exceso.inmuebles, accion_cotizada: dt.coeficientes_por_anio_exceso.acciones_cotizadas }[el.tipoElemento] || dt.coeficientes_por_anio_exceso.resto;
      ganancia -= Math.min(1, exceso * coef) * gananciaPre;
    }
    return { ahorro: ganancia, general: 0 };
  }

  function integrarCompensar(rendGeneral, ganGeneral, mobAhorro, ganAhorro, P) {
    const ic = P.estatal.integracion_compensacion;
    let sR = rendGeneral, sG = ganGeneral;
    if (sG < 0 && sR > 0) {
      const c = Math.min(-sG, sR * ic.base_general_limite_perdidas_pct);
      sG += c; sR -= c;
    }
    const big = sR + sG;
    let m = mobAhorro, g = ganAhorro;
    if (m < 0 && g > 0) { const c = Math.min(-m, g * ic.base_ahorro_limite_compensacion_pct); m += c; g -= c; }
    else if (g < 0 && m > 0) { const c = Math.min(-g, m * ic.base_ahorro_limite_compensacion_pct); g += c; m -= c; }
    return { big: big, bia: Math.max(0, m + g) };
  }

  // ---- Agregación ---------------------------------------------------------
  function agregarRentas(personas, P, regimen) {
    let trabajoPrevio = 0, capInmob = 0, capMobA = 0, capMobG = 0, actividades = 0, imput = 0;
    let ganA = 0, ganG = 0, psInd = 0, psEmp = 0, pensComp = 0, retenciones = 0, anualidades = 0;
    let otrasRentas = 0;
    for (const pe of personas) {
      trabajoPrevio += rnTrabajoPrevio(pe, P, regimen);
      const ci = rnCapitalInmobiliario(pe, P, regimen);
      const cm = rnCapitalMobiliario(pe, P, regimen);
      const ac = rnActividades(pe, P);
      const im = imputacionInmobiliaria(pe, P);
      capInmob += ci; capMobA += cm.ahorro; capMobG += cm.general; actividades += ac; imput += im;
      for (const el of (pe.ganancias || [])) {
        const gg = gananciaElemento(el, P, regimen);
        ganA += gg.ahorro; ganG += gg.general;
      }
      ganG += num(pe.gananciasPerdidasNoTransmision);
      otrasRentas += ci + cm.ahorro + cm.general + ac + im;
      if (pe.previsionSocial) { psInd += num(pe.previsionSocial.aportacionIndividual); psEmp += num(pe.previsionSocial.contribucionEmpresarial); }
      if (pe.reducciones) { pensComp += num(pe.reducciones.pensionesCompensatorias); anualidades += num(pe.reducciones.anualidadesAlimentosHijos); }
      retenciones += num(pe.retenciones);
    }
    let redTrabajo = 0;
    for (const pe of personas) {
      // la cuantía se fija sin la letra f); no puede dejar negativo el rendimiento ya minorado en ella
      const red = reduccionTrabajo(rnTrabajoPrevioArt20(pe), otrasRentas, pe, P, regimen);
      redTrabajo += Math.min(red, Math.max(0, rnTrabajoPrevio(pe, P, regimen)));
    }
    const trabajoNeto = Math.max(0, trabajoPrevio - redTrabajo);
    const rendGeneral = trabajoNeto + capInmob + capMobG + actividades + imput;
    const ic = integrarCompensar(rendGeneral, ganG, capMobA, ganA, P);
    return {
      trabajoNeto, trabajoPrevio, reduccionTrabajo: redTrabajo, capitalInmobiliario: capInmob,
      capitalMobiliarioAhorro: capMobA, capitalMobiliarioGeneral: capMobG, actividades, imputaciones: imput,
      gananciasAhorro: ganA, gananciasGeneral: ganG,
      baseImponibleGeneral: ic.big, baseImponibleAhorro: ic.bia,
      previsionSocialIndividual: psInd, previsionSocialEmpresarial: psEmp,
      pensionesCompensatorias: pensComp, anualidadesAlimentos: anualidades, retenciones
    };
  }

  // ---- Mínimo personal y familiar (común) --------------------------------
  function minimoDiscapacidadPersona(p, mdi) {
    if (!p.discapacidad || p.discapacidad === "no") return 0;
    const base = p.discapacidad === "65_mas" ? mdi.grado_65_mas : mdi.grado_33_64;
    const extra = (p.ayudaTerceros || p.movilidadReducida || p.discapacidad === "65_mas") ? mdi.gastos_asistencia : 0;
    return base + extra;
  }

  // ov: `minimo_autonomico` del territorio para el gravamen autonómico (solo los importes
  // que la CCAA modifica; el resto, límites y edades incluidos, es el estatal)
  function minimoPersonalFamiliar(hogar, P, modo, declaranteId, ov) {
    const e = P.estatal, o = ov || {};
    const mc = Object.assign({}, e.minimo_contribuyente, o.minimo_contribuyente);
    const md = Object.assign({}, e.minimo_descendientes, o.minimo_descendientes);
    md.importes = Object.assign({}, e.minimo_descendientes.importes, (o.minimo_descendientes || {}).importes);
    const ma = Object.assign({}, e.minimo_ascendientes, o.minimo_ascendientes);
    const mdi = Object.assign({}, e.minimo_discapacidad, o.minimo_discapacidad);
    const mdiDesc = Object.assign({}, mdi, o.minimo_discapacidad_descendientes);
    // mínimo general: algunas CCAA fijan otro importe para mayores de 65 años (Illes Balears)
    const generalDe = c => (c.edad > 65 && mc.general_mayor_65 != null) ? mc.general_mayor_65 : mc.general;
    const decs = hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
    const prorrateo = (modo === "individual" && decs.length > 1) ? 0.5 : 1;
    const contribs = modo === "conjunta" ? decs : hogar.miembros.filter(m => m.id === declaranteId);

    let minContrib = 0, minDiscContrib = 0;
    contribs.forEach((c, idx) => {
      if (modo === "conjunta") {
        if (idx === 0) minContrib += generalDe(c);
        if (c.edad > 65) minContrib += mc.incremento_mayor_65;
        if (c.edad > 75) minContrib += mc.incremento_mayor_75;
      } else {
        let m = generalDe(c);
        if (c.edad > 65) m += mc.incremento_mayor_65;
        if (c.edad > 75) m += mc.incremento_mayor_75;
        minContrib += m;
      }
      minDiscContrib += minimoDiscapacidadPersona(c, mdi);
    });

    let desc = hogar.miembros.filter(m => m.rol === "descendiente")
      .filter(d => num(d.rentasPropias) <= md.limite_rentas_descendiente && (d.edad < md.edad_maxima || (d.discapacidad && d.discapacidad !== "no")));
    let minDesc = 0, minDiscDesc = 0;
    desc.forEach((d, i) => {
      let imp = i === 0 ? md.importes["1"] : i === 1 ? md.importes["2"] : i === 2 ? md.importes["3"] : md.importes["4+"];
      if (d.edad < 3) imp += md.incremento_menor_3_anios;
      const factor = num(d.convivenciaMeses, 12) >= 6 ? 1 : 0.5;
      minDesc += imp * factor * prorrateo;
      minDiscDesc += minimoDiscapacidadPersona(d, mdiDesc) * prorrateo;
    });

    const asc = hogar.miembros.filter(m => m.rol === "ascendiente")
      .filter(a => num(a.rentasPropias) <= ma.limite_rentas_ascendiente && (a.edad >= ma.edad_minima || (a.discapacidad && a.discapacidad !== "no")) && num(a.convivenciaMeses, 12) >= 6);
    let minAsc = 0, minDiscAsc = 0;
    for (const a of asc) {
      let imp = ma.importe;
      if (a.edad > 75) imp += ma.incremento_mayor_75;
      minAsc += imp * prorrateo;
      minDiscAsc += minimoDiscapacidadPersona(a, mdi) * prorrateo;
    }
    const total = minContrib + minDesc + minAsc + minDiscContrib + minDiscDesc + minDiscAsc;
    return { total, contribuyente: minContrib, descendientes: minDesc, ascendientes: minAsc, discapacidad: minDiscContrib + minDiscDesc + minDiscAsc };
  }

  // ---- Deducciones autonómicas (DSL, común) ------------------------------
  function deduccionesAutonomicas(hogar, terr, P, modo, baseTotal, cuotaIntegraAut, minimo, declaranteId) {
    minimo = minimo || 0;
    const da = terr.deducciones_autonomicas;
    if (!da || da.estado === "pendiente" || !da.lista || !da.lista.length) return { detalle: {}, total: 0, estado: da ? da.estado : "pendiente" };
    const esConj = modo === "conjunta";
    const decs = hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
    const nProg = decs.length;
    const desc = hogar.miembros.filter(m => m.rol === "descendiente");
    const asc = hogar.miembros.filter(m => m.rol === "ascendiente");
    // ámbito personal: el declarante liquidado (individual) o todos (conjunta)
    let ambito = (esConj || declaranteId == null) ? decs : decs.filter(p => p.id === declaranteId);
    if (!ambito.length) ambito = decs.slice(0, 1);
    const idsAmbito = new Set(ambito.map(p => p.id));
    const indCompartido = !esConj && nProg > 1;

    const pasaPersonales = (d, p) => {
      const edad = num(p.edad, 40), disc = !!(p.discapacidad && p.discapacidad !== "no");
      if (d.requiere_discapacidad_grado != null && (p.discapacidad || "no") !== d.requiere_discapacidad_grado) return false;
      if (d.edad_max != null && d.edad_min_alt != null) {
        if (edad >= d.edad_max && edad < d.edad_min_alt && !disc) return false;
      } else {
        if (d.edad_max != null && edad >= d.edad_max) return false;
        if (d.edad_min != null && edad < d.edad_min) return false;
      }
      if (d.requiere_discapacidad_contribuyente && !disc) return false;
      return true;
    };
    const esFamiliar = d =>
      ["fija_por_hijo", "fija_por_hijo_nacido", "porcentaje_campo_hijo", "fija_por_ascendiente"].includes(d.tipo) ||
      (d.tipo === "fija" && (d.requiere_familia_numerosa != null || d.familia_numerosa_categoria != null ||
        d.requiere_monoparental || d.descendientes_min != null || d.requiere_dependiente_a_cargo ||
        d.requiere_familiar_discapacidad_65 || d.requiere_parto_multiple));
    const prorratea = d => d.prorratea_progenitores == null ? esFamiliar(d) : !!d.prorratea_progenitores;

    const pasaPuertas = d => {
      const b = d.base_gate === "menos_minimo" ? Math.max(0, baseTotal - minimo) : baseTotal;
      if (d.base_max_individual != null && !esConj && b > d.base_max_individual) return false;
      if (d.base_max_conjunta != null && esConj && b > d.base_max_conjunta) return false;
      if (d.base_min_individual != null && !esConj && b < d.base_min_individual) return false;
      if (d.base_min_conjunta != null && esConj && b < d.base_min_conjunta) return false;
      if (d.base_max_unidad_familiar != null && baseTotal > d.base_max_unidad_familiar) return false;
      if (d.descendientes_min != null && desc.length < d.descendientes_min) return false;
      if (d.descendientes_max != null && desc.length > d.descendientes_max) return false;
      if (d.descendiente_edad_max != null && !desc.some(h => num(h.edad, 99) <= d.descendiente_edad_max)) return false;
      if (!ambito.some(p => pasaPersonales(d, p))) return false;
      if (d.requiere_familia_numerosa === "especial" && hogar.familiaNumerosa !== "especial") return false;
      if (d.requiere_familia_numerosa === true && (!hogar.familiaNumerosa || hogar.familiaNumerosa === "no")) return false;
      if (d.familia_numerosa_categoria != null) {
        const catH = hogar.familiaNumerosa === "especial" ? "especial"
          : (hogar.familiaNumerosa && hogar.familiaNumerosa !== "no") ? "general" : "no";
        if (catH !== d.familia_numerosa_categoria) return false;
      }
      if (d.requiere_monoparental && hogar.tipoUnidadFamiliar !== "monoparental") return false;
      if (d.requiere_dependiente_a_cargo) {
        const hayDep = asc.some(p => num(p.edad, 0) >= 75) ||
          asc.concat(desc).some(p => (p.discapacidad || "no") === "65_mas");
        if (!hayDep) return false;
      }
      if (d.requiere_familiar_discapacidad_65 &&
          !asc.concat(desc).some(p => (p.discapacidad || "no") === "65_mas")) return false;
      if (d.requiere_parto_multiple && !hogar.partoMultiple) return false;
      // municipio de residencia: población máxima y/o lista oficial de zonas despobladas
      if (d.municipio_hab_max != null && (hogar.municipioHabitantes == null || hogar.municipioHabitantes > d.municipio_hab_max)) return false;
      if (d.requiere_zona_despoblada && !hogar.zonaDespoblada) return false;
      if (d.excluye_zona_despoblada && hogar.zonaDespoblada) return false;
      if (d.municipio_hab_min != null && hogar.municipioHabitantes != null && hogar.municipioHabitantes < d.municipio_hab_min) return false;
      if (d.requiere_desempleo && !decs.some(p => p.desempleado)) return false;
      if (d.requiere_progenitores_trabajan && !decs.every(p => p.trabajo || p.actividades)) return false;
      return true;
    };

    // reducción lineal (taper) entre dos umbrales de base
    const factorTaper = d => {
      const tp = esConj ? d.taper_conjunta : d.taper_individual;
      if (!tp) return 1;
      const b = d.base_gate === "menos_minimo" ? Math.max(0, baseTotal - minimo) : baseTotal;
      if (b <= tp[0]) return 1;
      return Math.max(0, Math.min(1, 1 - (b - tp[0]) / (tp[1] - tp[0])));
    };

    const cand = [];
    for (const d of da.lista) {
      if (!pasaPuertas(d)) continue;
      let val = 0;
      const ft = factorTaper(d);
      const limBase = (esConj && d.limite_conjunta != null) ? d.limite_conjunta : d.limite;
      const taperEnLimite = (d.tipo === "porcentaje_campo" || d.tipo === "porcentaje_campo_hijo") && limBase != null;
      const lim = taperEnLimite ? limBase * ft : limBase;
      if (d.tipo === "fija") val = num(d.importe);
      else if (d.tipo === "porcentaje_campo") {
        // gasto propio de las personas del ámbito; el de hijos/ascendientes se reparte en individual
        let base = 0;
        for (const m of hogar.miembros) {
          const v = num(m[camelize(d.campo)]);
          if (m.rol === "declarante" || m.rol === "conyuge") { if (idsAmbito.has(m.id)) base += v; }
          else base += indCompartido ? v / nProg : v;
        }
        if (d.base_maxima != null) base = Math.min(base, d.base_maxima);
        val = base * num(d.porcentaje);
        if (lim != null) val = Math.min(val, lim);
        if (d.limite_pct_cuota_autonomica != null && cuotaIntegraAut != null && !Number.isNaN(cuotaIntegraAut))
          val = Math.min(val, cuotaIntegraAut * d.limite_pct_cuota_autonomica);
      } else if (d.tipo === "porcentaje_campo_hijo") {
        for (const h of desc) {
          if (d.edad_hijo_max != null && num(h.edad, 99) > d.edad_hijo_max) continue;
          let v = num(h[camelize(d.campo)]) * num(d.porcentaje);
          if (lim != null) v = Math.min(v, lim);
          val += v;
        }
      } else if (d.tipo === "fija_por_hijo_nacido") {
        const ventana = num(d.anios_ventana, 1);
        const esNacido = h => num(h.edad, 99) <= ventana - 1 || h.nacidoEnEjercicio;
        if (d.importes_por_orden) {
          const ord = desc.slice().sort((a, b) => num(b.edad, 0) - num(a.edad, 0));
          val = 0;
          ord.forEach((h, k) => { if (esNacido(h)) { const key = k < 2 ? String(k + 1) : "3+"; val += num(d.importes_por_orden[key] != null ? d.importes_por_orden[key] : d.importes_por_orden["3+"]); } });
        } else {
          const impH = (esConj && d.importe_conjunta != null) ? d.importe_conjunta : num(d.importe);
          val = desc.filter(esNacido).length * impH;
          if (hogar.partoMultiple) val += num(d.importe_multiple != null ? d.importe_multiple : impH);
        }
      } else if (d.tipo === "fija_por_hijo") {
        const hh = desc.filter(h => (d.edad_hijo_min == null || num(h.edad, 99) >= d.edad_hijo_min) &&
                                    (d.edad_hijo_max == null || num(h.edad, 99) <= d.edad_hijo_max));
        val = hh.length * num(d.importe);
      } else if (d.tipo === "fija_por_ascendiente") {
        const cuenta = asc.filter(a => num(a.edad, 0) >= num(d.edad_ascendiente_min, 65) ||
                                       (a.discapacidad && a.discapacidad !== "no")).length;
        val = cuenta * num(d.importe);
      }
      if (!taperEnLimite) val *= ft;
      // incremento por residir en un municipio pequeño (p. ej. +20 % en Galicia, < 5.000 hab.)
      const fm = d.incremento_municipio;
      if (fm && hogar.municipioHabitantes != null && hogar.municipioHabitantes <= fm.hab_max) val *= fm.factor;
      if (prorratea(d) && indCompartido) val /= nProg;
      if (val > 0) cand.push({ id: d.id || "ded", val, grupo: d.grupo });
    }
    // variantes excluyentes: por `grupo`, solo la de mayor importe
    let total = 0; const detalle = {};
    for (const c of cand) {
      if (c.grupo != null) {
        const rivales = cand.filter(x => x.grupo === c.grupo);
        let mejor = rivales[0];
        for (const x of rivales) if (x.val > mejor.val) mejor = x;
        if (mejor.id !== c.id) continue;
      }
      detalle[c.id] = red2(c.val); total += c.val;
    }
    // 2ª pasada: % de la cuota íntegra autonómica (minorada por defecto; completa con sobre_cuota_integra)
    if (cuotaIntegraAut != null && !Number.isNaN(cuotaIntegraAut)) {
      const baseCuota = Math.max(0, cuotaIntegraAut - total);
      for (const d of da.lista) {
        if (d.tipo !== "porcentaje_cuota_autonomica" || !pasaPuertas(d)) continue;
        if (d.min_descendientes != null && desc.length < d.min_descendientes) continue;
        const b = d.sobre_cuota_integra ? Math.max(0, cuotaIntegraAut) : baseCuota;
        let val = b * num(d.porcentaje);
        const lim = (esConj && d.limite_conjunta != null) ? d.limite_conjunta : d.limite;
        if (lim != null) val = Math.min(val, lim);
        val *= factorTaper(d);
        if (val > 0) { detalle[d.id || "ded"] = red2(val); total += val; }
      }
    }
    return { detalle, total: red2(total), estado: "cargado" };
  }
  const camelize = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  // Deducciones "impropias" (maternidad, familia numerosa, discapacidad a cargo)
  function deduccionesImpropias(hogar, P, modo, declaranteId) {
    const e = P.estatal; const detalle = {}; let total = 0;
    const desc = hogar.miembros.filter(m => m.rol === "descendiente");
    const asc = hogar.miembros.filter(m => m.rol === "ascendiente");
    const decs = hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
    const indCompartido = modo !== "conjunta" && decs.length > 1 && declaranteId != null;
    const trabaja = m => !!(m.trabajo || m.actividades);
    const hijosMenores3 = desc.filter(d => d.edad < 3).length;
    // maternidad: una sola vez, al primer progenitor con actividad (el motor no registra el sexo)
    const titular = decs.find(trabaja);
    const madreTrabaja = indCompartido ? !!titular && titular.id === declaranteId : decs.some(trabaja);
    if (hijosMenores3 > 0 && madreTrabaja) {
      const dm = e.deduccion_maternidad;
      let val = hijosMenores3 * dm.importe_anual;
      const guarderia = hogar.miembros.reduce((s, m) => s + num(m.gastosGuarderia), 0);
      if (guarderia > 0) val += Math.min(guarderia, dm.incremento_guarderia * hijosMenores3);
      detalle.maternidad = red2(val); total += val;
    }
    if (hogar.familiaNumerosa && hogar.familiaNumerosa !== "no") {
      const df = e.deduccion_familia_numerosa_y_discapacidad_cargo;
      let val = hogar.familiaNumerosa === "especial" ? df.familia_numerosa_especial : df.familia_numerosa_general;
      const umbral = hogar.familiaNumerosa === "especial" ? 6 : 4;
      if (desc.length > umbral) val += (desc.length - umbral + 1) * df.incremento_por_hijo_adicional;
      if (indCompartido) val /= decs.length;          // art. 81 bis.3: prorrateo por partes iguales
      detalle.familiaNumerosa = red2(val); total += val;
    }
    const nDiscFam = desc.concat(asc).filter(p => p.discapacidad && p.discapacidad !== "no").length;
    if (nDiscFam > 0) {
      const df = e.deduccion_familia_numerosa_y_discapacidad_cargo;
      let val = nDiscFam * df.ascendiente_o_descendiente_discapacidad;
      if (indCompartido) val /= decs.length;
      detalle.discapacidadFamiliaresCargo = red2(val); total += val;
    }
    return { detalle, total: red2(total) };
  }

  // ---- Pipeline régimen común -------------------------------------------
  function gravarConMinimo(base, minAplic, escala) {
    return Math.max(0, aplicarEscala(base, escala) - aplicarEscala(Math.min(minAplic, base), escala));
  }

  // Deducción por obtención de rendimientos del trabajo (DA 61.ª LIRPF, Ley 5/2025): por
  // persona con rendimientos íntegros de una relación laboral o estatutaria (no pensiones)
  // bajo el umbral final y otras rentas no superiores al límite; limitada a la parte de la
  // cuota íntegra total que corresponde a esos rendimientos (ver estatal.yaml).
  function deduccionRendimientosTrabajo(personas, P, cuotaIntegraTotal) {
    const d = P.estatal.deduccion_obtencion_rendimientos_trabajo;
    if (!d || cuotaIntegraTotal <= 0) return { total: 0, detalle: {} };
    const filas = personas.map(pe => {
      const tr = pe.trabajo;
      const rit = tr ? num(tr.dinerarias) + num(tr.especie) : 0;
      const neto = tr ? Math.max(0, rit - num(tr.cotizacionesSs) - num(tr.otrosGastos)) : 0;
      const laboral = !!tr && !tr.pensionJubilacion;
      const cm = rnCapitalMobiliario(pe, P, "comun");
      let gan = num(pe.gananciasPerdidasNoTransmision);
      for (const el of (pe.ganancias || [])) { const g = gananciaElemento(el, P, "comun"); gan += g.ahorro + g.general; }
      const otras = Math.max(0, rnCapitalInmobiliario(pe, P, "comun")) + Math.max(0, cm.ahorro) + Math.max(0, cm.general) +
        Math.max(0, rnActividades(pe, P)) + Math.max(0, imputacionInmobiliaria(pe, P)) + Math.max(0, gan) +
        (laboral ? 0 : neto);
      return { id: pe.id, rit: laboral ? rit : 0, neto: laboral ? neto : 0, otras };
    });
    const denominador = filas.reduce((s, x) => s + x.neto + x.otras, 0);
    const detalle = {};
    let total = 0;
    for (const x of filas) {
      if (x.rit <= 0 || x.rit >= d.umbral_final || x.otras > d.limite_otras_rentas) continue;
      const importe = x.rit <= d.umbral_pleno ? d.importe_maximo : d.importe_maximo - d.coef_reduccion * (x.rit - d.umbral_pleno);
      const limite = denominador > 0 ? cuotaIntegraTotal * x.neto / denominador : 0;
      const v = Math.max(0, Math.min(importe, limite));
      if (v > 0) { detalle[x.id] = red2(v); total += red2(v); }
    }
    return { total, detalle };
  }

  // Deducciones estatales de la cuota (art. 68 LIRPF): donativos a entidades de la Ley 49/2002 y
  // vivienda habitual en régimen transitorio (DT 18.ª). Gastos propios de las personas del
  // ámbito; cada una se reparte entre la cuota estatal y la autonómica.
  function deduccionesEstatales(personas, P, baseLiquidableTotal) {
    const e = P.estatal, detalle = {};
    let totEst = 0, totAut = 0;
    let donativos = 0, recurrente = false;
    for (const m of personas) { donativos += num(m.donativos); if (m.donativosRecurrentes) recurrente = true; }
    if (donativos > 0) {
      const d = e.deduccion_donativos.ley49_2002;
      // art. 69.1: la BASE de la deducción no puede superar el 10 % de la base liquidable
      const base = Math.min(donativos, baseLiquidableTotal * d.limite_base_liquidable_pct);
      const restoPct = recurrente ? d.resto_porcentaje_recurrente : d.resto_porcentaje;
      const ded = Math.min(base, d.tramo1_limite) * d.tramo1_porcentaje + Math.max(0, base - d.tramo1_limite) * restoPct;
      detalle.donativos = red2(ded);
      totEst += ded / 2; totAut += ded / 2;   // 50 % en cada cuota íntegra
    }
    let viv = 0;
    for (const m of personas) viv += num(m.viviendaTransitoriaPagos);
    if (viv > 0) {
      const dv = e.deduccion_vivienda_transitoria;
      const base = Math.min(viv, dv.base_maxima);
      const dEst = base * dv.porcentaje_estatal, dAut = base * dv.porcentaje_autonomico_defecto;
      detalle.viviendaTransitoria = red2(dEst + dAut);
      totEst += dEst; totAut += dAut;
    }
    return { detalle, totalEstatal: red2(totEst), totalAutonomico: red2(totAut) };
  }

  function liquidarComunScope(hogar, terr, P, modo, declaranteId) {
    const personas = modo === "conjunta"
      ? hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge" || m.rol === "descendiente")
      : hogar.miembros.filter(m => m.id === declaranteId);
    const r = agregarRentas(personas, P, "comun");

    // reducciones de base
    let big = r.baseImponibleGeneral, bia = r.baseImponibleAhorro;
    const rs = P.estatal.reduccion_prevision_social;
    const rendBase = r.trabajoNeto + Math.max(0, r.actividades);
    const redPsInd = Math.min(r.previsionSocialIndividual, rs.limite_general_abs, rs.limite_general_pct_rend * rendBase);
    const redPsEmp = Math.min(r.previsionSocialEmpresarial, rs.incremento_contribucion_empresarial);
    const redPs = Math.min(redPsInd + redPsEmp, Math.max(0, big)); big -= redPs;
    const redPc = Math.min(r.pensionesCompensatorias, Math.max(0, big)); big -= redPc;
    const restoPc = r.pensionesCompensatorias - redPc; bia = Math.max(0, bia - Math.min(restoPc, bia));
    let redConj = 0;
    if (modo === "conjunta") {
      const rc = P.estatal.reduccion_tributacion_conjunta;
      redConj = hogar.tipoUnidadFamiliar === "monoparental" ? rc.monoparental : rc.biparental;
      const ap = Math.min(redConj, Math.max(0, big)); big -= ap;
      bia = Math.max(0, bia - Math.min(redConj - ap, bia));
    }
    const blg = Math.max(0, big), bla = Math.max(0, bia);

    const mpf = minimoPersonalFamiliar(hogar, P, modo, declaranteId);
    const minimo = mpf.total;
    const eGE = P.estatal.escala_general_estatal, eGA = terr.escala_general_autonomica;
    const eAE = P.estatal.escala_ahorro_estatal, eAA = P.estatal.escala_ahorro_autonomica;
    const minEnGeneral = Math.min(minimo, blg), minEnAhorro = Math.max(0, minimo - blg);
    // mínimo para el gravamen autonómico (importes propios de la CCAA, si los tiene)
    const mpfAut = minimoPersonalFamiliar(hogar, P, modo, declaranteId, terr.minimo_autonomico);
    const minimoAut = mpfAut.total;
    const minAutEnGeneral = Math.min(minimoAut, blg), minAutEnAhorro = Math.max(0, minimoAut - blg);

    let cigEst, cigAut;
    const anual = r.anualidadesAlimentos;
    if (anual > 0 && modo !== "conjunta") {
      const inc = P.estatal.anualidades_alimentos_hijos.incremento_minimo_contribuyente;
      cigEst = Math.max(0, aplicarEscala(anual, eGE) + aplicarEscala(Math.max(0, blg - anual), eGE) - aplicarEscala(Math.min(minimo + inc, blg), eGE));
      cigAut = Math.max(0, aplicarEscala(anual, eGA) + aplicarEscala(Math.max(0, blg - anual), eGA) - aplicarEscala(Math.min(minimoAut + inc, blg), eGA));
    } else {
      cigEst = gravarConMinimo(blg, minEnGeneral, eGE);
      cigAut = gravarConMinimo(blg, minAutEnGeneral, eGA);
    }
    const ciaEst = gravarConMinimo(bla, minEnAhorro, eAE);
    const ciaAut = gravarConMinimo(bla, minAutEnAhorro, eAA);
    const cuotaIntegraEstatal = cigEst + ciaEst;
    const cuotaIntegraAutonomica = cigAut + ciaAut;

    const dedAut = deduccionesAutonomicas(hogar, terr, P, modo, blg + bla, cuotaIntegraAutonomica, mpf.total, declaranteId);
    const dedEst = deduccionesEstatales(personas, P, blg + bla);
    let clEst = Math.max(0, cuotaIntegraEstatal - dedEst.totalEstatal);
    let clAut = Math.max(0, cuotaIntegraAutonomica - dedAut.total - dedEst.totalAutonomico);

    let bonifCm = 0;
    if (terr.bonificacion_residencia) {
      const b = terr.bonificacion_residencia.porcentaje;
      bonifCm = (clEst + clAut) * b;
      clEst *= (1 - b); clAut *= (1 - b);
    }
    const cuotaLiquida = clEst + clAut;
    // DA 61.ª: se resta de la cuota líquida total y da la cuota resultante (no negativa)
    const drt = deduccionRendimientosTrabajo(personas, P, cuotaIntegraEstatal + cuotaIntegraAutonomica);
    drt.total = red2(Math.min(drt.total, cuotaLiquida));
    const cuotaResultante = cuotaLiquida - drt.total;
    const impropias = deduccionesImpropias(hogar, P, modo, declaranteId);
    const cuotaDiferencial = cuotaResultante - r.retenciones - impropias.total;
    const bit = r.baseImponibleGeneral + r.baseImponibleAhorro;

    return {
      modo, regimen: "comun",
      componentesRenta: r,
      baseImponibleGeneral: r.baseImponibleGeneral, baseImponibleAhorro: r.baseImponibleAhorro,
      reduccionesBase: { previsionSocial: redPs, pensionesCompensatorias: redPc, tributacionConjunta: redConj },
      baseLiquidableGeneral: blg, baseLiquidableAhorro: bla,
      minimoPersonalFamiliar: mpf, minimoPersonalFamiliarAutonomico: mpfAut,
      cuotaIntegraEstatal: red2(cuotaIntegraEstatal), cuotaIntegraAutonomica: red2(cuotaIntegraAutonomica),
      cuotaIntegraTotal: red2(cuotaIntegraEstatal + cuotaIntegraAutonomica),
      deduccionesEstatales: dedEst, deduccionesAutonomicas: dedAut, bonificacionResidencia: red2(bonifCm),
      cuotaLiquidaEstatal: red2(clEst), cuotaLiquidaAutonomica: red2(clAut),
      cuotaLiquidaTotal: red2(cuotaLiquida),
      deduccionRendimientosTrabajo: drt,
      cuotaResultanteAutoliquidacion: red2(cuotaResultante),
      retenciones: red2(r.retenciones),
      deduccionesCuotaDiferencial: impropias,
      cuotaDiferencial: red2(cuotaDiferencial),
      tipoMedioEfectivo: bit > 0 ? Math.round(cuotaResultante / bit * 10000) / 10000 : 0
    };
  }

  // ---- País Vasco -------------------------------------------------------
  function liquidarPaisVascoScope(hogar, terrCode, P, modo, declaranteId) {
    const J = P.foral_pv;
    const personas = modo === "conjunta"
      ? hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge" || m.rol === "descendiente")
      : hogar.miembros.filter(m => m.id === declaranteId);
    const r = agregarRentas(personas, P, "foral_pais_vasco");
    let big = r.baseImponibleGeneral, bia = r.baseImponibleAhorro;
    const aport = r.previsionSocialIndividual + r.previsionSocialEmpresarial;
    const redPs = Math.min(aport, (J.reduccion_prevision_social && J.reduccion_prevision_social.limite_conjunto) || 12000, Math.max(0, big)); big -= redPs;
    const redPc = Math.min(r.pensionesCompensatorias, Math.max(0, big)); big -= redPc;
    let redConj = 0;
    if (modo === "conjunta") { redConj = J.reduccion_tributacion_conjunta.importe; big = Math.max(0, big - redConj); }
    const blg = Math.max(0, big), bla = Math.max(0, bia);

    const cig = aplicarEscala(blg, J.escala_general_foral);
    const cia = aplicarEscala(bla, J.escala_ahorro_foral);
    const cuotaIntegra = cig + cia;

    let minCuota = J.minoracion_cuota.importe_gipuzkoa || J.minoracion_cuota.importe || 1583;
    const nombre = (P.territorios[terrCode] || {}).nombre;
    if (nombre === "Bizkaia") minCuota = J.minoracion_cuota.importe_bizkaia || minCuota;
    if (nombre === "Araba/Álava") minCuota = J.minoracion_cuota.importe_araba || minCuota;

    const ovT = (J.overrides && J.overrides[terrCode]) || {};
    const ded = deduccionesForalesPv(hogar, J, modo, blg + bla, ovT, declaranteId);
    const cuotaLiquida = Math.max(0, cuotaIntegra - minCuota - ded.total);
    const bit = r.baseImponibleGeneral + r.baseImponibleAhorro;
    return {
      modo, regimen: "foral_pais_vasco", componentesRenta: r,
      baseImponibleGeneral: r.baseImponibleGeneral, baseImponibleAhorro: r.baseImponibleAhorro,
      reduccionesBase: { previsionSocial: redPs, pensionesCompensatorias: redPc, tributacionConjunta: redConj },
      baseLiquidableGeneral: blg, baseLiquidableAhorro: bla,
      minimoPersonalFamiliar: { total: 0 },
      cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: red2(cuotaIntegra), cuotaIntegraTotal: red2(cuotaIntegra),
      minoracionCuota: red2(minCuota), deduccionesAutonomicas: ded,
      cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: red2(cuotaLiquida), cuotaLiquidaTotal: red2(cuotaLiquida),
      deduccionRendimientosTrabajo: { total: 0, detalle: {} }, cuotaResultanteAutoliquidacion: red2(cuotaLiquida),   // DA 61.ª: solo régimen común
      retenciones: red2(r.retenciones), deduccionesCuotaDiferencial: { total: 0, detalle: {} },
      cuotaDiferencial: red2(cuotaLiquida - r.retenciones),
      tipoMedioEfectivo: bit > 0 ? Math.round(cuotaLiquida / bit * 10000) / 10000 : 0
    };
  }

  function deduccionesForalesPv(hogar, J, modo, baseTotal, ovT, declaranteId) {
    ovT = ovT || {};
    const detalle = {}; let total = 0;
    const decs = hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
    const prorr = (modo === "individual" && decs.length > 1) ? 0.5 : 1;
    // personas cuyas circunstancias y gastos propios cuentan en este ámbito
    const ambito = (modo === "conjunta" || declaranteId == null) ? decs : decs.filter(p => p.id === declaranteId);
    const inc6 = num((ovT.deduccion_descendientes && ovT.deduccion_descendientes.incremento_menor_6_anios) != null
      ? ovT.deduccion_descendientes.incremento_menor_6_anios : J.deduccion_descendientes.incremento_menor_6_anios);
    let desc = hogar.miembros.filter(m => m.rol === "descendiente").filter(d => num(d.rentasPropias) <= 8000);
    if (desc.length) {
      let sd = 0;
      desc.forEach((d, i) => {
        const key = i < 4 ? String(i + 1) : "5+";
        let imp = J.deduccion_descendientes.importes[key] || J.deduccion_descendientes.importes["5+"];
        if (num(d.edad, 99) < 6) imp += inc6;
        sd += imp;
      });
      sd *= prorr; detalle.descendientes = red2(sd); total += sd;
    }
    const asc = hogar.miembros.filter(m => m.rol === "ascendiente").filter(a => num(a.rentasPropias) <= 8000 && num(a.convivenciaMeses, 12) >= 6);
    if (asc.length) { const v = asc.length * num(J.deduccion_ascendientes.importe) * prorr; detalle.ascendientes = red2(v); total += v; }
    const dsc = J.deduccion_discapacidad;
    const importeDisc = p => p.discapacidad === "33_64" ? dsc.grado_33_64
      : p.discapacidad === "65_mas" ? (p.ayudaTerceros ? dsc.grado_75_40_puntos_o_gran_dependencia : dsc.grado_65_mas_o_dependencia_moderada) : 0;
    const discTotal = ambito.reduce((s, p) => s + importeDisc(p), 0) + prorr * desc.concat(asc).reduce((s, p) => s + importeDisc(p), 0);
    if (discTotal > 0) { detalle.discapacidad = red2(discTotal); total += discTotal; }
    for (const p of ambito) {
      if (num(p.edad, 0) < 65) continue;
      const cfg = p.edad >= 75 ? J.deduccion_edad.individual.edad_75 : J.deduccion_edad.individual.edad_65;
      const val = baseTotal <= cfg.base_plena ? cfg.importe : baseTotal >= cfg.base_cero ? 0 : Math.max(0, cfg.importe - cfg.coef_reduccion * (baseTotal - cfg.base_plena));
      if (val > 0) { detalle.edad = red2(num(detalle.edad) + val); total += val; }
    }
    for (const m of ambito) {
      const alq = num(m.alquilerViviendaPagos);
      if (alq > 0) {
        const cfg = m.colectivoEspecialVivienda ? J.deduccion_alquiler_vivienda.colectivo_especial : J.deduccion_alquiler_vivienda.general;
        const v = Math.min(alq * cfg.porcentaje, cfg.limite);
        detalle.alquilerVivienda = red2(num(detalle.alquilerVivienda) + v); total += v;
      }
      const adq = num(m.adquisicionViviendaPagos);
      if (adq > 0) {
        const dq = J.deduccion_adquisicion_vivienda;
        const cfg = num(m.edad, 99) < 36 ? dq.menor_36 : m.colectivoEspecialVivienda ? dq.colectivo_especial : dq.general;
        const v = Math.min(adq * cfg.porcentaje, cfg.limite_anual);
        detalle.adquisicionVivienda = red2(num(detalle.adquisicionVivienda) + v); total += v;
      }
    }
    return { detalle, total: red2(total) };
  }

  // ---- Navarra --------------------------------------------------------
  function deduccionTrabajoNavarra(rnt, pe, P) {
    const dt = P.navarra.deduccion_trabajo_cuota;
    if (!dt || rnt <= 0) return 0;
    let val = 0;
    for (const tr of dt.tramos) {
      if (tr.hasta == null || rnt <= tr.hasta) { val = tr.base - num(tr.coef) * (rnt - num(tr.desde)); break; }
    }
    val = Math.max(0, val);
    if (pe.discapacidad === "33_64" && pe.trabajo && pe.trabajo.trabajadorActivoDiscapacidad) val *= (1 + dt.incremento_discapacidad_33_64);
    if (pe.discapacidad === "65_mas" && pe.trabajo && pe.trabajo.trabajadorActivoDiscapacidad) val *= (1 + dt.incremento_discapacidad_65_mas);
    return Math.min(val, aplicarEscala(rnt, P.navarra.escala_general_foral));
  }

  function liquidarNavarraScope(hogar, P, modo, declaranteId) {
    const J = P.navarra;
    const personas = modo === "conjunta"
      ? hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge" || m.rol === "descendiente")
      : hogar.miembros.filter(m => m.id === declaranteId);
    const r = agregarRentas(personas, P, "foral_navarra");
    const blg = Math.max(0, r.baseImponibleGeneral - Math.min(r.pensionesCompensatorias, r.baseImponibleGeneral));
    const bla = r.baseImponibleAhorro;
    const cig = aplicarEscala(blg, J.escala_general_foral);
    const cia = aplicarEscala(bla, J.escala_ahorro_foral);
    const cuotaIntegra = cig + cia;
    let dedTrabajo = 0;
    for (const pe of personas) {
      const rnt = rnTrabajoPrevio(pe, P, "foral_navarra");
      if (rnt > 0) dedTrabajo += deduccionTrabajoNavarra(rnt, pe, P);
    }
    const mp = J.minimo_personal_deduccion;
    const baseTotal = blg + bla;
    const decsNv = hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
    // contribuyentes del ámbito: en individual, el declarante que se liquida (no el primero)
    const contribsNv = modo === "conjunta" ? decsNv
      : (declaranteId != null ? decsNv.filter(m => m.id === declaranteId) : decsNv.slice(0, 1));
    let dedMin = 0;
    for (const c of contribsNv) {
      let inc;
      if (baseTotal <= (mp.umbral_pleno || 17500)) inc = num(mp.incremento_rentas_bajas);
      else if (baseTotal >= (mp.umbral_cero_incremento || 32000)) inc = 0;
      else inc = num(mp.incremento_rentas_bajas) * (1 - (baseTotal - mp.umbral_pleno) / (mp.umbral_cero_incremento - mp.umbral_pleno));
      let m = num(mp.importe_general) + Math.max(0, inc);
      if (num(c.edad, 0) >= 65) m += num(mp.incremento_65);
      if (num(c.edad, 0) >= 75) m += num(mp.incremento_75);
      if (c.discapacidad === "33_64") m += num(mp.incremento_discapacidad_33_64);
      if (c.discapacidad === "65_mas") m += num(mp.incremento_discapacidad_65_mas);
      dedMin += m;
    }

    // mínimo familiar — art. 62.9.b (prorrateo entre progenitores en individual)
    const mf = J.minimo_familiar_deduccion;
    const prorrNv = (modo === "individual" && hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge").length > 1) ? 0.5 : 1;
    let dedFam = 0;
    if (mf) {
      const limR = num(mf.limite_rentas_familiar, 8000);
      const descNv = hogar.miembros.filter(m => m.rol === "descendiente" && num(m.rentasPropias) <= limR);
      descNv.forEach((d, i) => {
        const key = i < 5 ? String(i + 1) : "6+";
        let imp = num(mf.descendientes.importes[key] != null ? mf.descendientes.importes[key] : mf.descendientes.importes["6+"]);
        if (num(d.edad, 99) < 3) imp += num(mf.descendientes.incremento_menor_3_anios);
        if (d.discapacidad === "33_64") imp += num(mf.descendientes.incremento_discapacidad_33_64);
        if (d.discapacidad === "65_mas") imp += num(mf.descendientes.incremento_discapacidad_65_mas);
        dedFam += imp * prorrNv;
      });
      hogar.miembros.filter(m => m.rol === "ascendiente" && num(m.rentasPropias) <= limR &&
        (num(m.edad, 0) >= 65 || (m.discapacidad && m.discapacidad !== "no"))).forEach(a => {
        let imp = num(a.edad, 0) >= 75 ? num(mf.ascendientes.importe_75) : num(mf.ascendientes.importe_65);
        if (a.discapacidad === "33_64") imp += num(mf.ascendientes.incremento_discapacidad_33_64);
        if (a.discapacidad === "65_mas") imp += num(mf.ascendientes.incremento_discapacidad_65_mas);
        dedFam += imp * prorrNv;
      });
    }

    const bit = r.baseImponibleGeneral + r.baseImponibleAhorro;
    const cuotaDisponible = Math.max(0, cuotaIntegra - dedMin - dedFam - dedTrabajo);

    // alquiler (art. 62.2, cuota) y emancipación (art. 68 quinquies.A, cuota diferencial):
    // incompatibles; se aplica la más favorable. Pagos propios del ámbito.
    const alq = contribsNv.reduce((s, p) => s + num(p.alquilerViviendaPagos), 0);
    const da = J.deduccion_alquiler_vivienda, de = J.deduccion_emancipacion;
    let dedAlq = 0, dedEman = 0;
    if (alq > 0 && da) {
      const joven = contribsNv.some(p => num(p.edad, 99) < da.joven_o_monoparental.edad_max) || hogar.tipoUnidadFamiliar === "monoparental";
      const cfg = joven ? da.joven_o_monoparental : da.general;
      if (bit <= da.rentas_max && alq > da.umbral_esfuerzo * bit)
        dedAlq = Math.min(alq * cfg.porcentaje, cfg.limite, cuotaDisponible);
    }
    if (alq > 0 && de) {
      const edadOk = contribsNv.some(p => num(p.edad, 0) >= de.edad_min && num(p.edad, 0) <= de.edad_max);
      const enUf = decsNv.length > 1 || hogar.miembros.some(m => m.rol === "descendiente");
      const limR = enUf ? de.rentas_max_unidad_familiar : de.rentas_max_individual;
      if (edadOk && bit <= limR) dedEman = Math.min(alq * de.porcentaje, 12 * de.limite_mensual);
    }
    if (dedEman > 0 && dedEman >= dedAlq) dedAlq = 0; else dedEman = 0;

    // pensión de jubilación contributiva (art. 68.B, cuota diferencial): hasta 14.490 €
    const dp = J.deduccion_pension_jubilacion;
    let dedPen = 0;
    if (dp) for (const p of contribsNv) {
      const pen = num(p.trabajo && p.trabajo.dinerarias);
      if (p.trabajo && p.trabajo.pensionJubilacion && pen > 0 && pen < dp.umbral) {
        let d = dp.umbral - pen;
        const lim = decsNv.length > 1 ? dp.rentas_max_unidad_familiar : dp.rentas_max_individual;
        const exceso = (bit + d) - lim;
        if (exceso > 0) d = Math.max(0, d - exceso);
        dedPen += d;
      }
    }

    const cuotaLiquida = Math.max(0, cuotaDisponible - dedAlq);
    const dedCd = dedEman + dedPen;
    const detCd = {};
    if (dedEman > 0) detCd.emancipacion = red2(dedEman);
    if (dedPen > 0) detCd.pensionJubilacion = red2(dedPen);
    const detAut = { minimoPersonal: red2(dedMin), minimoFamiliar: red2(dedFam), trabajo: red2(dedTrabajo) };
    if (dedAlq > 0) detAut.alquilerVivienda = red2(dedAlq);
    return {
      modo, regimen: "foral_navarra", componentesRenta: r,
      baseImponibleGeneral: r.baseImponibleGeneral, baseImponibleAhorro: r.baseImponibleAhorro,
      reduccionesBase: {}, baseLiquidableGeneral: blg, baseLiquidableAhorro: bla,
      minimoPersonalFamiliar: { total: red2(dedMin + dedFam) },
      cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: red2(cuotaIntegra), cuotaIntegraTotal: red2(cuotaIntegra),
      deduccionesAutonomicas: { total: red2(dedMin + dedFam + dedTrabajo + dedAlq), detalle: detAut },
      cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: red2(cuotaLiquida), cuotaLiquidaTotal: red2(cuotaLiquida),
      deduccionRendimientosTrabajo: { total: 0, detalle: {} }, cuotaResultanteAutoliquidacion: red2(cuotaLiquida),   // DA 61.ª: solo régimen común
      retenciones: red2(r.retenciones), deduccionesCuotaDiferencial: { total: red2(dedCd), detalle: detCd },
      cuotaDiferencial: red2(cuotaLiquida - r.retenciones - dedCd),
      tipoMedioEfectivo: bit > 0 ? Math.round(cuotaLiquida / bit * 10000) / 10000 : 0
    };
  }

  // ---- Dispatcher ----------------------------------------------------
  function combinarIndividuales(lst) {
    if (lst.length === 1) return lst[0];
    const base = JSON.parse(JSON.stringify(lst[0]));
    const campos = ["baseImponibleGeneral", "baseImponibleAhorro", "baseLiquidableGeneral", "baseLiquidableAhorro",
      "cuotaIntegraEstatal", "cuotaIntegraAutonomica", "cuotaIntegraTotal", "cuotaLiquidaEstatal", "cuotaLiquidaAutonomica",
      "cuotaLiquidaTotal", "cuotaResultanteAutoliquidacion", "retenciones", "cuotaDiferencial"];
    for (const c of campos) base[c] = red2(lst.reduce((s, x) => s + num(x[c]), 0));
    // detalle de deducciones de todos los declarantes (solo informativo: las cuotas ya van sumadas)
    const sumaDetalle = k => {
      const out = { detalle: {}, total: 0 };
      for (const x of lst) {
        const d = x[k]; if (!d) continue;
        out.total += num(d.total);
        for (const [kk, v] of Object.entries(d.detalle || {})) out.detalle[kk] = red2(num(out.detalle[kk]) + num(v));
      }
      out.total = red2(out.total);
      return out;
    };
    base.deduccionesAutonomicas = Object.assign({}, lst[0].deduccionesAutonomicas, sumaDetalle("deduccionesAutonomicas"));
    base.deduccionesCuotaDiferencial = sumaDetalle("deduccionesCuotaDiferencial");
    const est = { detalle: {}, totalEstatal: 0, totalAutonomico: 0 };
    for (const x of lst) {
      const d = x.deduccionesEstatales; if (!d) continue;
      est.totalEstatal = red2(est.totalEstatal + num(d.totalEstatal)); est.totalAutonomico = red2(est.totalAutonomico + num(d.totalAutonomico));
      for (const [k, v] of Object.entries(d.detalle || {})) est.detalle[k] = red2(num(est.detalle[k]) + num(v));
    }
    base.deduccionesEstatales = est;
    base.deduccionRendimientosTrabajo = sumaDetalle("deduccionRendimientosTrabajo");
    base.minoracionCuota = red2(lst.reduce((s, x) => s + num(x.minoracionCuota), 0));
    const bit = base.baseImponibleGeneral + base.baseImponibleAhorro;
    base.tipoMedioEfectivo = bit > 0 ? Math.round(base.cuotaResultanteAutoliquidacion / bit * 10000) / 10000 : 0;
    base.modo = "individual";
    return base;
  }

  // ---- Obligación de declarar (art. 96 LIRPF, régimen común) -----------------
  // Por declarante. Mismas simplificaciones que el motor R (R/14_obligacion.R): ganancias
  // como no sometidas a retención y actividad económica = alta en el RETA.
  function obligacionDeclararPersona(pe, P) {
    const o = P.estatal.obligacion_declarar, tr = pe.trabajo;
    const trabajo = tr ? num(tr.dinerarias) + num(tr.especie) : 0;
    const otrosPagadores = tr ? num(tr.otrosPagadores) : 0;
    const cm = pe.capitalMobiliario;
    const capitalRet = cm ? Object.values(cm).reduce((s, v) => s + (typeof v === "number" ? Math.max(0, v) : 0), 0) : 0;
    const imput = imputacionInmobiliaria(pe, P);
    const alquileres = (pe.capitalInmobiliario || []).reduce((s, im) => s + Math.max(0, num(im.ingresos)), 0);
    const act = rnActividades(pe, P);
    const hayActividad = !!pe.actividades;
    const gan = (pe.ganancias || []).map(el => num(el.valorTransmision) - num(el.valorAdquisicion));
    gan.push(num(pe.gananciasPerdidasNoTransmision));
    const ganancias = gan.filter(g => g > 0).reduce((s, g) => s + g, 0);
    const perdidas = -gan.filter(g => g < 0).reduce((s, g) => s + g, 0);
    const paraAplicar = [];
    if (num(pe.viviendaTransitoriaPagos) > 0) paraAplicar.push("vivienda_transitoria");
    const ps = pe.previsionSocial;
    if (ps && num(ps.aportacionIndividual) + num(ps.contribucionEmpresarial) > 0) paraAplicar.push("prevision_social");
    const limiteTrabajo = otrosPagadores > o.segundo_pagador_umbral ? o.trabajo_varios_pagadores : o.trabajo_un_pagador;
    const altaReta = pe.altaReta != null ? !!pe.altaReta : hayActividad;
    const res = (obligado, motivo) => ({ obligado, motivo, limiteTrabajo, paraAplicar });
    if (altaReta) return res(true, "alta_reta");
    const soloAbc = alquileres === 0 && !hayActividad && ganancias === 0 && perdidas === 0;
    if (soloAbc && trabajo <= limiteTrabajo && capitalRet <= o.capital_y_ganancias_con_retencion &&
        imput <= o.rentas_inmobiliarias_imputadas) return res(false, "limites");
    const total = trabajo + capitalRet + alquileres + Math.max(0, act) + ganancias;
    if (total <= o.rentas_totales_minimas && perdidas < o.perdidas_patrimoniales_maximas) return res(false, "rentas_minimas");
    const motivo = trabajo > limiteTrabajo ? "trabajo" : capitalRet > o.capital_y_ganancias_con_retencion ? "capital"
      : imput > o.rentas_inmobiliarias_imputadas ? "imputaciones" : "otras_rentas";
    return res(true, motivo);
  }
  function obligacionDeclarar(hogar, P, regimen, cuotaDiferencial) {
    if (regimen !== "comun") return { obligado: null, convienePresentar: null, porPersona: {} };
    const porPersona = {};
    for (const d of hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge"))
      porPersona[d.id] = obligacionDeclararPersona(d, P);
    const obligado = Object.values(porPersona).some(x => x.obligado);
    return { obligado, convienePresentar: !obligado && cuotaDiferencial < 0, porPersona };
  }

  function liquidar(hogar, P, modo) {
    modo = modo || "auto";
    const terrCode = hogar.territorio;
    const terr = P.territorios[terrCode];
    if (!terr) throw new Error("territorio desconocido: " + terrCode);
    const regimen = terr.regimen;
    const fscope = regimen === "comun" ? (h, m, id) => liquidarComunScope(h, terr, P, m, id)
      : regimen === "foral_pais_vasco" ? (h, m, id) => liquidarPaisVascoScope(h, terrCode, P, m, id)
      : (h, m, id) => liquidarNavarraScope(h, P, m, id);

    const decs = hogar.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
    const puedeConjunta = hogar.tipoUnidadFamiliar === "biparental" || hogar.tipoUnidadFamiliar === "monoparental";
    const res = {};
    if (modo === "auto" || modo === "individual")
      res.individual = combinarIndividuales(decs.map(d => fscope(hogar, "individual", d.id)));
    if ((modo === "auto" || modo === "conjunta") && puedeConjunta)
      res.conjunta = fscope(hogar, "conjunta", null);

    let elegido;
    if (modo === "conjunta" && res.conjunta) elegido = "conjunta";
    else if (modo === "individual") elegido = "individual";
    // la modalidad se elige por la cuota resultante (cuota líquida menos la DA 61.ª)
    else if (res.conjunta && res.conjunta.cuotaResultanteAutoliquidacion < res.individual.cuotaResultanteAutoliquidacion) elegido = "conjunta";
    else elegido = "individual";

    const liq = res[elegido];
    liq.territorio = terrCode;
    liq.territorioNombre = terr.nombre;
    liq.ejercicio = P.ejercicio;
    liq.modoTributacionElegido = elegido;
    liq.comparativa = { individual: res.individual ? res.individual.cuotaResultanteAutoliquidacion : null, conjunta: res.conjunta ? res.conjunta.cuotaResultanteAutoliquidacion : null };
    liq.obligacionDeclarar = obligacionDeclarar(hogar, P, regimen, liq.cuotaDiferencial);
    return liq;
  }

  function compararTerritorios(hogar, P, territorios) {
    territorios = territorios || Object.keys(P.territorios);
    return territorios.map(t => {
      const h = Object.assign({}, hogar, { territorio: t });
      try {
        const liq = liquidar(h, P, "auto");
        return {
          territorio: t, nombre: P.territorios[t].nombre, regimen: P.territorios[t].regimen,
          cuotaLiquidaTotal: liq.cuotaLiquidaTotal, cuotaResultanteAutoliquidacion: liq.cuotaResultanteAutoliquidacion,
          tipoMedioEfectivo: liq.tipoMedioEfectivo,
          cuotaDiferencial: liq.cuotaDiferencial, modo: liq.modoTributacionElegido,
          baseImponible: red2(liq.baseImponibleGeneral + liq.baseImponibleAhorro)
        };
      } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => a.cuotaResultanteAutoliquidacion - b.cuotaResultanteAutoliquidacion);
  }

  // ---- Optimizador (palancas de ahorro) --------------------------------
  function optimizar(hogar, P, opts) {
    opts = opts || {};
    const pasos = opts.pasosPlan || [500, 1000, 1500, 2000, 3000, 5000, 8000];
    const liq0 = liquidar(hogar, P, "auto");
    const cuota0 = liq0.cuotaResultanteAutoliquidacion;
    const recs = [];
    const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    // 1. individual vs conjunta
    if (liq0.comparativa.conjunta != null && liq0.comparativa.individual != null) {
      const dif = Math.abs(liq0.comparativa.conjunta - liq0.comparativa.individual);
      const mejor = liq0.comparativa.conjunta < liq0.comparativa.individual ? "conjunta" : "individual";
      if (dif >= 1) recs.push({
        id: "modo", categoria: "declaracion",
        titulo: "Presentar declaración " + mejor,
        detalle: "Individual " + fmt(liq0.comparativa.individual) + " € vs. conjunta " + fmt(liq0.comparativa.conjunta) + " €.",
        ahorro: red2(dif), yaAplicado: liq0.modoTributacionElegido === mejor
      });
    }

    // 2. plan de pensiones — punto de saturación
    const d1 = hogar.miembros.find(m => m.rol === "declarante");
    const simulaPlan = paso => {
      const h2 = JSON.parse(JSON.stringify(hogar));
      const m = h2.miembros.find(x => x.id === d1.id);
      m.previsionSocial = m.previsionSocial || { aportacionIndividual: 0 };
      m.previsionSocial.aportacionIndividual = num(m.previsionSocial.aportacionIndividual) + paso;
      return liquidar(h2, P, "auto").cuotaResultanteAutoliquidacion;
    };
    let mejorPaso = 0, mejorAhorro = 0;
    for (const p of pasos) { const a = cuota0 - simulaPlan(p); if (a > mejorAhorro + 0.5) { mejorAhorro = a; mejorPaso = p; } }
    if (mejorAhorro > 0.5) {
      // menor paso que alcanza ~el máximo
      let pOpt = mejorPaso;
      for (const p of pasos) if (cuota0 - simulaPlan(p) >= mejorAhorro - 0.5) { pOpt = p; break; }
      recs.push({
        id: "plan_pensiones", categoria: "prevision",
        titulo: "Aportar ~" + fmt(pOpt) + " € a un plan de pensiones / EPSV",
        detalle: "Reduce tu cuota en " + fmt(mejorAhorro) + " €/año (≈" + Math.round(mejorAhorro / pOpt * 100) + " % de lo aportado). Por encima ya no ahorra más este año.",
        ahorro: red2(mejorAhorro)
      });
    }

    // 3. traslados — mejores territorios, sin duplicar cuota (Ceuta≈Melilla)
    const cmp = compararTerritorios(hogar, P);
    const vistos = new Set();
    cmp.filter(c => c.territorio !== hogar.territorio && c.cuotaResultanteAutoliquidacion < cuota0 - 1)
       .filter(c => { const k = Math.round(c.cuotaResultanteAutoliquidacion); if (vistos.has(k)) return false; vistos.add(k); return true; })
       .slice(0, 3).forEach(c => recs.push({
      id: "traslado_" + c.territorio, categoria: "territorio",
      titulo: "Residencia fiscal en " + c.nombre + (c.nombre === "Ceuta" ? " o Melilla" : ""),
      detalle: "Con la misma situación pagarías " + fmt(c.cuotaResultanteAutoliquidacion) + " € (requiere residencia efectiva > 183 días/año y centro de intereses económicos allí).",
      ahorro: red2(cuota0 - c.cuotaResultanteAutoliquidacion)
    }));

    // 4. deducciones autonómicas potenciales no usadas (agrupadas, máx. 3)
    const terr = P.territorios[hogar.territorio];
    const da = terr && terr.deducciones_autonomicas;
    if (da && da.estado === "cargado") {
      const potenc = [];
      for (const d of (da.lista || [])) {
        if (d.tipo === "porcentaje_campo" && d.campo) {
          const ya = hogar.miembros.reduce((s, m) => s + num(m[camelize(d.campo)]), 0);
          if (ya === 0 && !potenc.some(p => p.campo === d.campo)) potenc.push(d);
        }
      }
      potenc.slice(0, 3).forEach(d => recs.push({
        id: "ded_" + d.id, categoria: "deduccion_potencial",
        titulo: "Deducción autonómica: " + d.id.replace(/_/g, " ").replace(/gastos educativos/, "gastos educativos"),
        detalle: "Si tienes este gasto y cumples los requisitos de renta/edad de " + terr.nombre + ", deduce el " + Math.round((d.porcentaje || 0) * 100) + " %" + (d.limite ? " (límite " + fmt(d.limite) + " €)" : "") + ".",
        ahorro: null
      }));
    }

    recs.sort((a, b) => (b.ahorro == null ? -1 : b.ahorro) - (a.ahorro == null ? -1 : a.ahorro));
    return { cuotaActual: red2(cuota0), recomendaciones: recs };
  }

  const api = { aplicarEscala, tipoMarginal, liquidar, compararTerritorios, optimizar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.irpfsim = api;
})(typeof window !== "undefined" ? window : this);
