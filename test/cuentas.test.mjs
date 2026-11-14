// Lógica de las cuentas (web/js/cuentas.js) y piezas del acceso en index.html, app.js,
// las plantillas de correo y la migración de `calculos`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const C = require("../web/js/cuentas.js");
const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("correo: validación y normalización", () => {
  assert.equal(C.normalizarCorreo("  Ana@Despacho.ES "), "ana@despacho.es");
  for (const ok of ["ana@despacho.es", "a.b+c@sub.dominio.com", " ANA@GMAIL.COM "]) assert.ok(C.correoValido(ok), ok);
  for (const no of ["", "ana", "ana@", "@gmail.com", "ana@gmail", "ana @gmail.com", "ana@gmail..com", "ana@@gmail.com", null])
    assert.ok(!C.correoValido(no), String(no));
  assert.ok(!C.correoValido("a@" + "b".repeat(250) + ".es"), "más de 254 caracteres");
});

test("correo: sugiere erratas del dominio sin corregirlas", () => {
  assert.equal(C.sugerirCorreo("ana@gmial.com"), "ana@gmail.com");
  assert.equal(C.sugerirCorreo("Ana@Hotmal.com"), "ana@hotmail.com");
  assert.equal(C.sugerirCorreo("ana@gmail.com"), null);
  assert.equal(C.sugerirCorreo("sin-arroba"), null);
});

test("correo: botón para abrir el buzón conocido", () => {
  assert.equal(C.bandejaDe("ana@gmail.com").nombre, "Gmail");
  assert.equal(C.bandejaDe("ana@hotmail.es").nombre, "Outlook");
  assert.equal(C.bandejaDe("ana@despacho.es"), null);
  assert.match(C.bandejaDe("ana@icloud.com").url, /^https:\/\//);
});

test("errores de Supabase Auth en castellano y con lo que hay que hacer", () => {
  const espera = C.textoError({ message: "For security purposes, you can only request this after 42 seconds." });
  assert.equal(espera.espera, 42);
  assert.match(espera.texto, /42 s/);
  assert.ok(C.textoError({ message: "email rate limit exceeded", status: 429 }).espera);
  assert.ok(C.textoError({ code: "otp_disabled", message: "Signups not allowed for otp" }, "entrar").sinCuenta);
  assert.ok(!C.textoError({ message: "Signups not allowed for otp" }, "crear").sinCuenta);
  assert.ok(C.textoError({ message: "Unsupported provider: provider is not enabled" }).sinGoogle);
  assert.match(C.textoError({ message: "Failed to fetch" }).texto, /conexión/);
  assert.match(C.textoError({ message: "cualquier otra cosa" }).texto, /Inténtalo/);
  // nunca se enseña el mensaje en inglés
  assert.doesNotMatch(C.textoError({ message: "Database error saving new user" }).texto, /Database/);
});

test("vuelta del enlace o de Google con error", () => {
  const cad = C.errorDeVuelta("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "");
  assert.ok(cad.caducado);
  const g = C.errorDeVuelta("", "?error=invalid_request&error_description=Unsupported+provider%3A+provider+is+not+enabled");
  assert.ok(g.sinGoogle);
  assert.equal(C.errorDeVuelta("#calculadora", ""), null);
  assert.equal(C.errorDeVuelta("#access_token=abc&type=magiclink", ""), null);
  assert.match(C.errorDeVuelta("#error=access_denied", "").texto, /cancel/i);
});

test("cuenta atrás del reenvío", () => {
  const t0 = 1_000_000;
  assert.equal(C.segundosRestantes(t0, t0), 60);
  assert.equal(C.segundosRestantes(t0, t0 + 59_100), 1);
  assert.equal(C.segundosRestantes(t0, t0 + 60_000), 0);
  assert.equal(C.segundosRestantes(t0, t0 + 999_999), 0);
  assert.equal(C.segundosRestantes(0, t0), 0);
  assert.equal(C.textoReenvio(12), "Reenviar en 12 s");
  assert.equal(C.textoReenvio(0), "Reenviar el enlace");
});

test("ventajas: solo lo que existe", () => {
  const titulos = o => C.ventajas(o).map(v => v.t);
  assert.deepEqual(titulos({}), ["Sin contraseñas"]);
  const todo = titulos({ calculos: true, ejercicios: 2, pagos: true });
  assert.ok(todo.includes("Guarda tus cálculos") && todo.includes("Compara ejercicios") && todo.includes("Plan Gestor cuando lo necesites"));
  assert.ok(!titulos({ calculos: true, ejercicios: 1 }).includes("Compara ejercicios"), "con un solo ejercicio no hay qué comparar");
  assert.ok(!titulos({ calculos: false, ejercicios: 3 }).some(t => /cálculo|ejercicio|dispositivo/i.test(t)), "sin la tabla no se promete guardar");
});

test("cálculo pendiente de guardar: ida y vuelta y caducidad", () => {
  const fila = { titulo: "x", hogar: { territorio: "ES-MD" }, ejercicio: 2025 };
  const raw = C.pendienteGuardar(fila, 1000);
  assert.deepEqual(C.leerPendiente(raw, 1000 + 60e3), fila);
  assert.equal(C.leerPendiente(raw, 1000 + C.CADUCIDAD_PENDIENTE), null, "caducado a las 2 h");
  assert.equal(C.leerPendiente(raw, 500), null, "fecha en el futuro");
  assert.equal(C.leerPendiente("{roto", 1000), null);
  assert.equal(C.leerPendiente(null, 1000), null);
  assert.equal(C.leerPendiente(JSON.stringify({ fila: { titulo: "sin hogar" }, t: 1000 }), 1000), null);
});

test("fila de `calculos` desde una liquidación", () => {
  const liq = { cuotaLiquidaTotal: 4812.374, cuotaDiferencial: -612.5, tipoMedioEfectivo: 0.15, modoTributacionElegido: "individual" };
  const f = C.filaCalculo({ hogar: { territorio: "ES-MD" }, liq, ejercicio: "2025", territorio: "ES-MD", nombreTerritorio: "Madrid",
    retenciones: 5400, motor: "v1", ahora: Date.UTC(2026, 10, 11, 12) });
  assert.equal(f.ejercicio, 2025);
  assert.equal(f.cuota_liquida, 4812.37);
  assert.match(f.titulo, /^Madrid · 2025 · /);
  assert.equal(f.resultado.retenciones, 5400);
  assert.equal(f.resultado.cuotaDiferencial, -612.5);
  assert.equal(C.filaCalculo({ hogar: {}, liq, ejercicio: 2025, territorio: "ES-MD", titulo: "  Mi renta  " }).titulo, "Mi renta");
  assert.equal(C.filaCalculo({ hogar: {}, liq, ejercicio: 2025, territorio: "ES-MD", titulo: "a".repeat(300) }).titulo.length, 120);
});

test("bienvenida: solo en el primer acceso y una vez por navegador", () => {
  const ahora = Date.parse("2026-11-11T12:00:00Z");
  const u = { id: "u1", created_at: "2026-11-11T11:58:00Z" };
  assert.ok(C.tocaBienvenida(u, null, null, ahora));
  assert.ok(!C.tocaBienvenida(u, null, "1", ahora), "ya vista");
  assert.ok(!C.tocaBienvenida({ id: "u1", created_at: "2026-10-01T10:00:00Z" }, null, null, ahora), "cuenta antigua");
  assert.ok(C.tocaBienvenida({ id: "u1" }, { creado_en: "2026-11-11T11:50:00Z" }, null, ahora), "fecha del perfil");
  assert.ok(!C.tocaBienvenida(null, null, null, ahora));
  assert.ok(!C.tocaBienvenida({ id: "u1" }, null, null, ahora), "sin fecha");
});

test("iniciales del avatar", () => {
  assert.equal(C.iniciales("Ana Gómez Ruiz", "x@y.es"), "AR");
  assert.equal(C.iniciales("ana", "x@y.es"), "A");
  assert.equal(C.iniciales("", "zoe@y.es"), "Z");
  assert.equal(C.iniciales("  ", ""), "?");
});

test("index.html: diálogo de acceso completo y accesible", () => {
  const html = leer("web/index.html");
  const dlg = html.slice(html.indexOf('id="dlg-acceso"'), html.indexOf("</dialog>", html.indexOf('id="dlg-acceso"')));
  for (const id of ["tab-crear", "tab-entrar", "btn-google", "acceso-email", "acceso-acepto", "btn-enviar-enlace", "acceso-enviado", "btn-reenviar", "btn-otro-correo", "btn-cerrar-acceso"])
    assert.match(dlg, new RegExp(`id="${id}"`), id);
  assert.ok(dlg.indexOf('id="btn-google"') < dlg.indexOf('id="acceso-email"'), "Google arriba, el correo debajo");
  assert.match(dlg, /<label for="acceso-email">/);
  assert.match(dlg, /autocomplete="email"/);
  assert.match(dlg, /role="tablist"/);
  // casilla única con la redacción decidida por Alex y enlaces a /legal/
  assert.match(html, /He leído y acepto las <a href="legal\/condiciones.html"[^>]*>Condiciones<\/a> y la <a href="legal\/privacidad.html"[^>]*>Política de privacidad<\/a>\./);
  assert.doesNotMatch(html, /Uso Mapafiscal para mi actividad profesional/);
  assert.equal((dlg.match(/type="checkbox"/g) || []).length, 1, "una sola casilla");
  assert.doesNotMatch(dlg, /checked/, "la casilla no viene marcada");
  assert.match(html, /id="dlg-bienvenida"/);
  assert.match(html, /id="btn-guardar-calculo"/);
  assert.match(html, /<script src="js\/cuentas.js"><\/script>\s*<script src="js\/app.js">/);
});

test("app.js: redirección tras el acceso y casilla solo al crear la cuenta", () => {
  const js = leer("web/js/app.js");
  assert.match(js, /TRAS_ACCESO = "mapafiscal.trasAcceso"/);
  assert.match(js, /recordar\(TRAS_ACCESO, p.destino\)/);
  assert.match(js, /shouldCreateUser: modoAcceso === "crear"/);
  assert.match(js, /modoAcceso !== "crear"/);
  assert.match(js, /CALCULO_PENDIENTE/);
});

test("plantillas de correo con marca y sin datos personales", () => {
  for (const f of ["magic_link.html", "confirmation.html"]) {
    const h = leer("supabase/templates/" + f);
    assert.match(h, /\{\{ \.ConfirmationURL \}\}/, f + ": enlace");
    assert.match(h, /Mapafiscal/);
    assert.match(h, /#1f3fc4/i, f + ": color de marca");
    assert.match(h, /contacto@mapafiscal\.es/);
    const correos = h.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [];
    assert.deepEqual([...new Set(correos)], ["contacto@mapafiscal.es"], f + ": solo el correo de contacto");
    assert.doesNotMatch(h, /<script/i);
    assert.doesNotMatch(h, /https?:\/\/(?!mapafiscal\.es)[^"'\s{]+/, f + ": sin recursos externos");
  }
});

test("migración de `calculos`: RLS por usuario y borrado con la cuenta", () => {
  const sql = leer("supabase/migrations/20261111100000_calculos_guardados.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /references auth\.users \(id\) on delete cascade/);
  assert.equal((sql.match(/usuario_id = \(select auth\.uid\(\)\)/g) || []).length, 3);
  assert.match(sql, /revoke all on public\.calculos from anon/);
});
