// Espera antes del PDF (web/js/informe.js) y analítica sin cookies (web/js/analitica.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { empaquetar } from "../tools/empaquetar.mjs";

const require = createRequire(import.meta.url);
const I = require("../web/js/informe.js");
const A = require("../web/js/analitica.js");
const CFG = { pdfEspera: 5 };

// reloj falso: programar() guarda las tareas y avanzar() las ejecuta en orden
function reloj() {
  let ahora = 0, id = 0;
  const tareas = new Map();
  return {
    programar: (f, ms) => { tareas.set(++id, { f, t: ahora + ms }); return id; },
    anular: k => tareas.delete(k),
    avanzar(ms) {
      const fin = ahora + ms;
      for (;;) {
        const sig = [...tareas.entries()].filter(([, x]) => x.t <= fin).sort((a, b) => a[1].t - b[1].t)[0];
        if (!sig) break;
        tareas.delete(sig[0]); ahora = sig[1].t; sig[1].f();
      }
      ahora = fin;
    },
    pendientes: () => tareas.size
  };
}

test("espera del PDF: 5 s para quien no tiene plan; con plan o pagado, ninguna", () => {
  assert.equal(I.segundosEspera({ cfg: CFG, via: "registro", plan: "gratis" }), 5);
  assert.equal(I.segundosEspera({ cfg: CFG, via: "registro" }), 5);
  assert.equal(I.segundosEspera({ cfg: CFG, via: "plan", plan: "gestor" }), 0, "con plan, directo");
  assert.equal(I.segundosEspera({ cfg: CFG, via: "registro", plan: "gestor" }), 0, "el plan manda aunque la vía sea otra");
  assert.equal(I.segundosEspera({ cfg: CFG, via: "pago", plan: "gratis" }), 0, "pago único: directo");
  assert.equal(I.segundosEspera({ cfg: CFG, via: "anuncio" }), 0, "ya vio el anuncio bonificado");
  assert.equal(I.segundosEspera({ cfg: CFG, via: "demo", demo: true }), 0, "versión autónoma: sin espera");
  assert.equal(I.segundosEspera({ cfg: CFG, via: "registro", yaEsperado: true }), 0, "una sola espera por informe");
});

test("espera del PDF: el interruptor pdfEspera (apagado, redondeo y tope)", () => {
  for (const v of [0, false, null, undefined, "x", -3]) assert.equal(I.segundosEspera({ cfg: { pdfEspera: v }, via: "registro" }), 0, String(v));
  assert.equal(I.segundosEspera({ cfg: { pdfEspera: 4.6 }, via: "registro" }), 5);
  assert.equal(I.segundosEspera({ cfg: { pdfEspera: 600 }, via: "registro" }), 30);
  assert.equal(I.segundosEspera({}), 0);
});

test("cuenta atrás: «Saltar» solo al terminar, y avisa en cada segundo", () => {
  const r = reloj(), tics = [];
  let terminada = 0;
  const e = I.crearEspera(5, { alTic: n => tics.push(n), alTerminar: () => terminada++, programar: r.programar, anular: r.anular });
  assert.equal(e.estado(), "parada");
  e.iniciar();
  assert.equal(e.puedeSaltar(), false);
  r.avanzar(4999);
  assert.equal(e.puedeSaltar(), false, "a los 4,999 s aún no se puede saltar");
  assert.equal(e.restante(), 1);
  r.avanzar(1);
  assert.equal(e.puedeSaltar(), true);
  assert.equal(terminada, 1);
  assert.deepEqual(tics, [5, 4, 3, 2, 1, 0]);
  e.iniciar();                      // no vuelve a empezar
  r.avanzar(10000);
  assert.equal(terminada, 1);
  assert.equal(r.pendientes(), 0);
});

test("cuenta atrás: cancelar la para y no termina; con 0 s termina al instante", () => {
  const r = reloj();
  let terminada = 0;
  const e = I.crearEspera(5, { alTerminar: () => terminada++, programar: r.programar, anular: r.anular });
  e.iniciar(); r.avanzar(2000); e.cancelar(); r.avanzar(10000);
  assert.deepEqual([e.estado(), e.puedeSaltar(), terminada, r.pendientes()], ["cancelada", false, 0, 0]);
  const cero = I.crearEspera(0, { alTerminar: () => terminada++, programar: r.programar, anular: r.anular });
  cero.iniciar();
  assert.deepEqual([cero.puedeSaltar(), terminada], [true, 1]);
});

test("hueco opcional de la espera: si no responde en 3 s cuenta como fallido", async () => {
  const r = reloj();
  const nunca = new Promise(() => {});
  const p = I.conLimite(nunca, 3000, r.programar);
  r.avanzar(3000);
  assert.equal(await p, false);
  assert.equal(await I.conLimite(Promise.resolve(true), 3000, r.programar), true);
  assert.equal(await I.conLimite(Promise.reject(new Error("sin anuncio")), 3000, r.programar), false);
});

test("la pantalla de espera no lleva AdSense (política de AdSense: nada de «pre-roll» antes de una descarga)", () => {
  const js = readFileSync(new URL("../web/js/informe.js", import.meta.url), "utf8");
  const espera = js.slice(js.indexOf("function mostrarEspera"), js.indexOf("function quitarEspera"));
  assert.ok(espera.length > 100);
  assert.doesNotMatch(espera, /adsbygoogle|googlesyndication|data-ad-slot/);
  assert.match(espera, /Generando tu PDF/);
  assert.doesNotMatch(espera, /Hazte Gestor/);
});

test("analítica: solo con goatcounter, un código válido y fuera de la demo", () => {
  assert.equal(A.activa({ analitica: "goatcounter", goatcounterCodigo: "mapafiscal" }), true);
  assert.equal(A.activa({ analitica: false, goatcounterCodigo: "mapafiscal" }), false);
  assert.equal(A.activa({ analitica: "goatcounter", goatcounterCodigo: "mapafiscal", demo: true }), false);
  assert.equal(A.activa({ analitica: "goatcounter", goatcounterCodigo: "x.evil.com/" }), false);
  assert.equal(A.activa({ analitica: "goatcounter" }), false);
});

test("analítica: rutas de vista sin parámetros, eventos de una lista cerrada y sin importes", () => {
  assert.equal(A.rutaVista("/", "inicio"), "/");
  assert.equal(A.rutaVista("/", "calculadora"), "/#calculadora");
  assert.equal(A.rutaVista("/index.html", "planes"), "/#planes");
  assert.equal(A.rutaVista("/", "informe=pagado&x=1"), "/", "nada del hash real");
  assert.equal(A.rutaVista("/?email=a@b.c", "planes"), "/#planes", "nada de la query");
  assert.deepEqual(A.EVENTOS, ["calculo_iniciado", "calculo_completado", "resultado_compartido", "pdf_descargado", "registro", "suscripcion_iniciada"]);
  for (const e of A.EVENTOS) assert.deepEqual(A.datosEvento(e), { path: e, title: e, event: true });
  assert.equal(A.datosEvento("cuota_1234"), null);
  assert.equal(A.datosEvento(undefined), null);
  assert.equal(A.referente("https://www.google.com/search?q=irpf+madrid", "https://mapafiscal.es"), "https://www.google.com");
  assert.equal(A.referente("https://mapafiscal.es/#planes", "https://mapafiscal.es"), "");
  assert.equal(A.referente("", "https://mapafiscal.es"), "");
});

test("config.js: espera de 5 s y GoatCounter con el código mapafiscal", () => {
  const window = {};
  new Function("window", readFileSync(new URL("../web/config.js", import.meta.url), "utf8"))(window);
  const c = window.MAPAFISCAL_CONFIG;
  assert.equal(c.pdfEspera, 5);
  assert.equal(c.analitica, "goatcounter");
  assert.equal(c.goatcounterCodigo, "alexgalindo");
});

test("la versión empaquetada no lleva analítica ni espera", () => {
  const html = empaquetar();
  assert.doesNotMatch(html, /gc\.zgo\.at|goatcounter\.com\/count|MapafiscalAnalitica/);
  const cfg = html.match(/<script>\n([^<]*MAPAFISCAL_CONFIG[^<]*)<\/script>\n<script type="application\/json" id="datos-params">/);
  const window = {};
  new Function("window", cfg[1])(window);
  assert.equal(window.MAPAFISCAL_CONFIG.analitica, false);
  assert.equal(window.MAPAFISCAL_CONFIG.pdfEspera, 0);
});

test("la política de cookies y la de privacidad mencionan GoatCounter", () => {
  for (const p of ["cookies.html", "privacidad.html"]) {
    assert.match(readFileSync(new URL("../web/legal/" + p, import.meta.url), "utf8"), /GoatCounter/, p);
  }
});
