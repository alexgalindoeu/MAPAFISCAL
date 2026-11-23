/* =============================================================================
 * Mapafiscal — cálculo rápido de las páginas SEO (/irpf/<territorio>/, /sueldo-neto/…,
 * /autonomos/<territorio>/ y guías). El bloque lo escribe tools/seo_comun.mjs
 * (bloqueCalculoRapido) con el territorio, el ejercicio y el bruto de la página.
 *
 * No calcula nada propio: usa irpfsim.sueldoNeto (paridad con R/15_sueldo_neto.R), el mismo
 * que la vista de sueldo neto y bruto.js, y el tipo marginal de la escala como la calculadora
 * (web/js/app.js). El motor (js/irpfsim.js), js/importe.js y datos/params*.json se cargan solo
 * cuando el bloque se acerca a la pantalla o al primer toque: la página no espera por ellos.
 * ========================================================================== */
(function () {
  "use strict";
  const raiz = document.querySelector("[data-calculo-rapido]");
  if (!raiz) return;
  const yo = document.currentScript;
  // misma versión (?v=<commit>) que este script, y rutas relativas a /js/
  const version = (yo && (yo.src.match(/\?v=[^#]*/) || [""])[0]) || "";
  const baseJs = yo && yo.src ? new URL(".", yo.src) : new URL("/js/", location.href);
  const baseDatos = new URL("../datos/", baseJs);
  const $ = sel => raiz.querySelector(sel);
  const campo = { bruto: $("#cr-bruto"), terr: $("#cr-territorio"), res: $("#cr-res"), afinar: $("#cr-afinar") };
  const ejercicio = Number(raiz.dataset.ejercicio) || null;
  const TOPE = 1e7;

  // ---- formato (el de web/js/app.js y tools/seo_comun.mjs) ------------------------------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  // porcentajes con el criterio común de js/importe.js (se carga antes de pintar)
  const pct = n => window.MapafiscalImporte.pctMedio(n), pctTipo = n => window.MapafiscalImporte.pctTipo(n);
  const nombre = t => { const o = campo.terr.querySelector(`option[value="${t}"]`); return o ? o.textContent : t; };

  // ---- carga bajo demanda ------------------------------------------------------------------
  const cargarScript = src => new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
  const json = async nombreFichero => {
    const r = await fetch(new URL(nombreFichero, baseDatos), { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + nombreFichero);
    return r.json();
  };
  // los parámetros del ejercicio de la página (params.json es el por defecto)
  async function cargarParams() {
    const P0 = await json("params.json");
    if (!ejercicio || P0.ejercicio === ejercicio) return P0;
    try { return await json(`params_${ejercicio}.json`); } catch (e) { return P0; }
  }
  let preparado = null, P = null;
  function preparar() {
    if (!preparado) {
      raiz.setAttribute("aria-busy", "true");
      preparado = Promise.all([
        window.irpfsim ? null : cargarScript(new URL("irpfsim.js", baseJs) + version),
        window.MapafiscalImporte ? null : cargarScript(new URL("importe.js", baseJs) + version),
        cargarParams()
      ]).then(([, , params]) => { P = params; raiz.removeAttribute("aria-busy"); pintar(); })
        .catch(e => {
          preparado = null; raiz.removeAttribute("aria-busy");
          campo.res.innerHTML = `<p class="cr-aviso">No se ha podido cargar la calculadora (${esc(e.message)}). <a href="${esc(campo.afinar.href)}">Ábrela en la página principal</a>.</p>`;
        });
    }
    return preparado;
  }

  // ---- cálculo: solo el motor ----------------------------------------------------------------
  const ORDEN = Array.from(campo.terr.options, o => o.value);
  const situacion = (territorio, bruto) => ({ bruto, territorio, edad: 40, hijos: [], tipoContrato: "indefinido" });
  // tipo marginal de la escala general en la base liquidable general (como web/js/app.js)
  function tipoMarginal(liq, terr) {
    const H = window.irpfsim, b = liq.baseLiquidableGeneral || 0, reg = P.territorios[terr].regimen;
    if (reg === "comun") return H.tipoMarginal(b, P.estatal.escala_general_estatal) + H.tipoMarginal(b, P.territorios[terr].escala_general_autonomica);
    if (reg === "foral_pais_vasco") return H.tipoMarginal(b, P.foral_pv.escala_general_foral);
    return H.tipoMarginal(b, P.navarra.escala_general_foral);
  }
  function leerBruto() {
    const v = window.MapafiscalImporte.valor(campo.bruto);
    return Number.isFinite(v) ? Math.max(0, Math.min(TOPE, v)) : 0;
  }
  const pagas = () => { const r = raiz.querySelector('input[name="cr-pagas"]:checked'); return r && r.value === "12" ? 12 : 14; };

  function actualizarEnlace(terr, bruto) {
    const q = [`t=${terr}`, bruto > 0 ? `bruto=${Math.round(bruto * 100) / 100}` : null, ejercicio ? `ejercicio=${ejercicio}` : null].filter(Boolean);
    campo.afinar.href = "/index.html#calculadora?" + q.join("&");
  }

  function pintar() {
    if (!P) return;
    const bruto = leerBruto(), terr = campo.terr.value, np = pagas();
    actualizarEnlace(terr, bruto);
    let todos;
    try {
      todos = ORDEN.filter(t => P.territorios[t]).map(t => ({ t, s: window.irpfsim.sueldoNeto(situacion(t, bruto), P) }));
    } catch (e) { campo.res.innerHTML = '<p class="cr-aviso">Revisa el sueldo: no se ha podido calcular.</p>'; return; }
    const mio = todos.find(x => x.t === terr);
    if (!mio) return;
    const s = mio.s, liq = s.liquidacion;
    // cifras redondeadas que cuadran al leerlas: bruto − Seguridad Social − IRPF = neto
    const b = Math.round(bruto), ss = Math.round(s.cotizaciones), neto = Math.round(s.neto), irpf = b - ss - neto;
    const irpfDe = x => Math.round(x.s.irpf);
    const orden = todos.slice().sort((x, y) => irpfDe(x) - irpfDe(y));
    const barato = orden[0], caro = orden[orden.length - 1], yoIrpf = irpfDe(mio);
    const puesto = 1 + todos.filter(x => irpfDe(x) < yoIrpf).length;
    let frase;
    if (irpfDe(caro) === 0) frase = "Con este sueldo no pagarías IRPF en ningún territorio.";
    else if (yoIrpf === irpfDe(barato)) frase = `<b>${esc(nombre(terr))}</b> es el territorio más barato para este sueldo: en ${esc(nombre(caro.t))} pagarías <b>${eur0(irpfDe(caro) - yoIrpf)} más</b>.`;
    else if (yoIrpf === irpfDe(caro)) frase = `En ${esc(nombre(barato.t))} pagarías <b>${eur0(yoIrpf - irpfDe(barato))} menos</b>: ${esc(nombre(terr))} es el territorio más caro para este sueldo.`;
    else frase = `En ${esc(nombre(barato.t))} pagarías <b>${eur0(yoIrpf - irpfDe(barato))} menos</b> y en ${esc(nombre(caro.t))}, <b>${eur0(irpfDe(caro) - yoIrpf)} más</b>.`;
    const n = todos.length;
    campo.res.innerHTML = `<p class="cr-cifra"><span class="cr-xl" data-cr="neto-paga">${eur0(neto / np)}</span>
        <span class="cr-etq">netos al mes en ${np} pagas · ${eur0(neto)} al año en ${esc(nombre(terr))}</span></p>
      <dl class="cr-datos">
        <div><dt>Neto al año</dt><dd data-cr="neto">${eur0(neto)}</dd></div>
        <div><dt>Al mes, 12 pagas</dt><dd data-cr="mes12">${eur0(neto / 12)}</dd></div>
        <div><dt>Al mes, 14 pagas</dt><dd data-cr="mes14">${eur0(neto / 14)}</dd></div>
        <div><dt>Seguridad Social</dt><dd data-cr="ss">${eur0(ss)}</dd></div>
        <div><dt>IRPF del año</dt><dd data-cr="irpf">${eur0(irpf)}</dd></div>
        <div><dt>Tipo medio sobre el bruto</dt><dd data-cr="medio">${pct(b > 0 ? irpf / b : 0)}</dd></div>
        <div><dt>Tipo marginal</dt><dd data-cr="marginal">${pctTipo(tipoMarginal(liq, terr))}</dd></div>
      </dl>
      <p class="cr-frase">${frase}${irpfDe(caro) === 0 ? "" : ` Puesto ${puesto} de ${n}, de menos a más IRPF.`}</p>`;
  }

  // ---- eventos -----------------------------------------------------------------------------
  const alCambiar = () => { if (P) pintar(); else preparar(); };
  campo.bruto.addEventListener("input", alCambiar);
  campo.terr.addEventListener("change", alCambiar);
  raiz.addEventListener("change", e => { if (e.target.name === "cr-pagas") alCambiar(); });
  raiz.querySelector("form").addEventListener("submit", e => { e.preventDefault(); alCambiar(); });
  ["pointerdown", "focusin", "touchstart"].forEach(ev => raiz.addEventListener(ev, () => preparar(), { once: true, passive: true }));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); preparar(); } }, { rootMargin: "200px 0px" });
    io.observe(raiz);
  } else preparar();
})();
