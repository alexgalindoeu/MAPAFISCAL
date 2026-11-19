/* =============================================================================
 * Mapafiscal — piezas de confianza sin dependencias:
 *  - rótulo del ejercicio: «Renta 2025 (la declaración que se presentó en 2026)» o
 *    «Simulación 2026 (la que presentarás en 2027)», según la fecha de hoy;
 *  - «Comunicar un error»: un mailto a contacto@mapafiscal.es con el territorio, el ejercicio,
 *    la entrada en JSON compacto y el resultado de la web. Sin backend.
 * La web la usa como window.MapafiscalConfianza; los tests de Node, con require().
 * ========================================================================== */
(function (raiz) {
  "use strict";

  // ---- ejercicio ----------------------------------------------------------------------------
  // La declaración del ejercicio N se presenta en N+1, en la campaña de abril a junio (ver
  // params/calendario_renta.yaml). Hasta que acaba el año N, el cálculo es una simulación.
  const FIN_CAMPANA = { mes: 5, dia: 30 };           // 30 de junio (meses desde 0)
  function rotuloEjercicio(a, hoy) {
    a = Number(a);
    const h = hoy instanceof Date ? hoy : new Date();
    const fin = new Date(a + 1, FIN_CAMPANA.mes, FIN_CAMPANA.dia, 23, 59, 59);
    const etapa = h.getFullYear() <= a ? "simulacion" : h <= fin ? "campana" : "presentada";
    const corto = etapa === "simulacion" ? `Simulación ${a}` : `Renta ${a}`;
    const detalle = etapa === "simulacion" ? `la que presentarás en ${a + 1}`
      : etapa === "campana" ? `la declaración que se presenta en ${a + 1}`
      : `la declaración que se presentó en ${a + 1}`;
    return { ejercicio: a, etapa, corto, detalle, completo: `${corto} (${detalle})` };
  }
  // el ejercicio que conviene abrir hoy: el del año en curso si se ofrece; si no, el último
  // ofrecido que no sea posterior al año en curso
  function ejercicioEnCurso(ofrecidos, hoy) {
    const y = (hoy instanceof Date ? hoy : new Date()).getFullYear();
    const l = (ofrecidos || []).map(Number).filter(Number.isFinite).sort((p, q) => p - q);
    if (l.includes(y)) return y;
    const previos = l.filter(x => x < y);
    return previos.length ? previos[previos.length - 1] : l[0];
  }

  // ---- «Comunicar un error» -----------------------------------------------------------------
  const CONTACTO = "contacto@mapafiscal.es";
  const LIMITE_MAILTO = 1900;              // algunos clientes de correo cortan los mailto largos

  // quita lo que no aporta (nulos, ceros, falsos, vacíos) para que el JSON quepa en el mailto
  function compactar(v) {
    if (Array.isArray(v)) return v.map(compactar).filter(x => x !== undefined &&
      !(typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length));
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        const c = compactar(x);
        if (c === undefined) continue;
        if (typeof c === "object" && !Object.keys(c).length) continue;      // {} y []
        o[k] = c;
      }
      return o;
    }
    if (v == null || v === "" || v === false || v === 0) return undefined;
    if (typeof v === "number") return Math.round(v * 100) / 100;
    return v;
  }

  // d: { herramienta, territorio, ejercicio, resultado, entrada, pagina }
  function correoError(d) {
    const ej = d.ejercicio ? rotuloEjercicio(d.ejercicio, d.hoy) : null;
    const asunto = ["Posible error en Mapafiscal", d.herramienta, d.territorio, ej && ej.corto].filter(Boolean).join(" · ");
    const pie = [
      "--- Datos del cálculo (no incluyen nombre ni NIF; revísalos antes de enviar) ---",
      d.herramienta && "Herramienta: " + d.herramienta,
      d.territorio && "Territorio: " + d.territorio,
      ej && "Ejercicio: " + ej.completo,
      d.resultado && "Resultado de la web: " + d.resultado,
      d.pagina && "Página: " + d.pagina
    ].filter(Boolean);
    const cuerpo = entrada => ["Hola:", "", "Creo que este cálculo de Mapafiscal no es correcto.", "",
      "Qué esperabas (la cifra y de dónde sale: Renta Web, tu declaración, un asesor…):", "", "", ""]
      .concat(pie, entrada ? ["Entrada: " + entrada] : []).join("\n");
    const url = c => `mailto:${CONTACTO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(c)}`;
    let json = d.entrada == null ? "" : JSON.stringify(compactar(d.entrada) || {});
    let enlace = url(cuerpo(json));
    if (enlace.length > LIMITE_MAILTO && json) {
      // demasiado larga: se recorta la entrada y se avisa (el resto de datos sigue entero)
      const MARCA = " …(recortado)";
      let n = json.length;
      while (n > 0 && enlace.length > LIMITE_MAILTO) {
        n = Math.floor(n * Math.min(0.95, LIMITE_MAILTO / enlace.length));
        enlace = url(cuerpo(json.slice(0, n) + MARCA));
      }
      json = json.slice(0, n) + MARCA;
    }
    return { asunto, cuerpo: cuerpo(json), enlace };
  }

  const API = { rotuloEjercicio, ejercicioEnCurso, compactar, correoError, CONTACTO };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (!raiz) return;
  raiz.MapafiscalConfianza = API;

  // ---- en la página -------------------------------------------------------------------------
  // Cada tarjeta de resultado (.tarjeta-resultado) recibe un botón «Comunicar un error». Sus datos
  // salen del proveedor que registre su código (app.js para la calculadora) o, si no hay, del
  // formulario de la misma vista: sus campos, el chip (territorio · ejercicio) y la cifra.
  const doc = raiz.document;
  if (!doc) return;
  const proveedores = {};
  API.registrar = (idTarjeta, fn) => { proveedores[idTarjeta] = fn; };

  const texto = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  function datosGenericos(tarjeta) {
    const vista = tarjeta.closest("section.vista");
    const form = vista && vista.querySelector("form");
    const entrada = {};
    if (form) form.querySelectorAll("input, select").forEach(c => {
      const k = c.id || c.name;
      if (!k || c.disabled) return;
      if (c.type === "radio") { if (c.checked) entrada[c.name] = c.value; return; }
      entrada[k.replace(/^[a-z]+-/, "")] = c.type === "checkbox" ? c.checked : (c.type === "number" ? Number(c.value) : c.value);
    });
    // radios de la cabecera de la vista (modo de la herramienta: neto/subida, plan/donativos…)
    if (vista) vista.querySelectorAll(".cabecera-acciones input[type=radio]:checked").forEach(r => { entrada[r.name] = r.value; });
    const selTerr = form && form.querySelector("select[id$='-territorio']");
    const selEj = form && form.querySelector("select[id$='-ejercicio']");
    const chip = texto(tarjeta.querySelector(".chip"));
    const ejChip = (chip.match(/(20\d\d)\s*$/) || [])[1];
    const etq = texto(tarjeta.querySelector(".res-etq")), cifra = texto(tarjeta.querySelector(".res-cifra"));
    return {
      herramienta: texto(vista && vista.querySelector("h1")),
      territorio: selTerr ? `${texto(selTerr.selectedOptions && selTerr.selectedOptions[0])} (${selTerr.value})` : chip.split("·")[0].trim(),
      ejercicio: selEj ? +selEj.value : (ejChip ? +ejChip : null),
      resultado: [etq, cifra].filter(Boolean).join(": "),
      entrada
    };
  }
  // el correo que se abriría desde esa tarjeta (también sirve para comprobarlo en la consola)
  API.correoDe = tarjeta => {
    let d;
    try { d = proveedores[tarjeta.id] ? proveedores[tarjeta.id]() : datosGenericos(tarjeta); }
    catch (e) { d = null; }
    const vista = tarjeta.closest("section.vista");
    const loc = raiz.location;
    d = Object.assign({ pagina: loc ? loc.origin + loc.pathname + (vista ? "#" + vista.id.replace(/^v-/, "") : "") : "" }, d || {});
    return correoError(d);
  };
  function comunicar(tarjeta) { raiz.location.href = API.correoDe(tarjeta).enlace; }
  function montar() {
    doc.querySelectorAll(".tarjeta-resultado").forEach(t => {
      if (t.querySelector("[data-comunicar-error]")) return;
      const p = doc.createElement("p");
      p.className = "res-error";
      p.innerHTML = '<button type="button" class="enlace-error" data-comunicar-error>Comunicar un error</button>' +
        '<span> · Se abre tu correo con los datos del cálculo para que nos digas qué esperabas.</span>';
      t.appendChild(p);
    });
  }
  doc.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-comunicar-error]");
    if (!b) return;
    e.preventDefault();
    comunicar(b.closest(".tarjeta-resultado"));
  });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", montar); else montar();
})(typeof window !== "undefined" ? window : null);
