/* =============================================================================
 * Mapafiscal — lógica de las cuentas sin DOM: validación del correo, textos de error de
 * Supabase Auth, cuenta atrás del reenvío, vuelta con error del enlace o de Google, ventajas
 * de registrarse, cálculo pendiente de guardar y bienvenida del primer acceso.
 * app.js la usa como window.MapafiscalCuentas; los tests de Node, con require().
 * ========================================================================== */
(function (raiz) {
  "use strict";

  // ---- correo ----------------------------------------------------------------------------
  const RE_CORREO = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
  const normalizarCorreo = s => String(s == null ? "" : s).trim().toLowerCase();
  const correoValido = s => { const c = normalizarCorreo(s); return c.length <= 254 && RE_CORREO.test(c); };

  // Erratas frecuentes en el dominio: se sugiere, nunca se corrige sola.
  const ERRATAS = {
    "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
    "gmail.co": "gmail.com", "gmail.es": "gmail.com", "gmail.con": "gmail.com", "gnail.com": "gmail.com",
    "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmai.com": "hotmail.com",
    "hotmail.co": "hotmail.com", "otmail.com": "hotmail.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com",
    "outllok.com": "outlook.com", "yahoo.con": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.es.com": "yahoo.es",
    "icloud.con": "icloud.com", "iclod.com": "icloud.com", "telefonica.ne": "telefonica.net"
  };
  function sugerirCorreo(s) {
    const c = normalizarCorreo(s), i = c.lastIndexOf("@");
    if (i < 1) return null;
    const dom = ERRATAS[c.slice(i + 1)];
    return dom ? c.slice(0, i + 1) + dom : null;
  }

  // Botón «Abrir Gmail/Outlook…» tras enviar el enlace, solo para los buzones conocidos.
  const BANDEJAS = [
    [/^(gmail|googlemail)\.com$/, "Gmail", "https://mail.google.com/mail/u/0/#search/from%3Amapafiscal"],
    [/^(outlook|hotmail|live|msn)\.(com|es)$/, "Outlook", "https://outlook.live.com/mail/0/"],
    [/^yahoo\.(com|es)$/, "Yahoo Mail", "https://mail.yahoo.com/"],
    [/^(icloud|me|mac)\.com$/, "iCloud Mail", "https://www.icloud.com/mail"],
    [/^proton(mail)?\.(me|com)$/, "Proton Mail", "https://mail.proton.me/"]
  ];
  function bandejaDe(s) {
    const c = normalizarCorreo(s), dom = c.slice(c.lastIndexOf("@") + 1);
    const b = BANDEJAS.find(([re]) => re.test(dom));
    return b ? { nombre: b[1], url: b[2] } : null;
  }

  // ---- errores de Supabase Auth ------------------------------------------------------------
  // Supabase devuelve los errores en inglés; aquí se traducen a algo que se pueda hacer.
  function segundosDeEspera(texto) {
    const m = /after (\d+) seconds?/i.exec(texto || "");
    return m ? +m[1] : null;
  }
  function textoError(error, modo) {
    const t = String((error && (error.message || error.msg || error.error_description)) || error || "");
    const codigo = error && (error.code || error.error_code);
    const espera = segundosDeEspera(t);
    if (espera) return { texto: `Por seguridad, espera ${espera} s antes de pedir otro enlace.`, espera };
    if (codigo === "over_email_send_rate_limit" || /rate limit/i.test(t) || (error && error.status === 429))
      return { texto: "Se han pedido demasiados enlaces seguidos. Espera unos minutos y vuelve a intentarlo.", espera: 60 };
    if (codigo === "otp_disabled" || codigo === "signup_disabled" || /signups? not allowed/i.test(t))
      return modo === "entrar"
        ? { texto: "No hay ninguna cuenta con este correo.", sinCuenta: true }
        : { texto: "Ahora mismo no se pueden crear cuentas nuevas. Inténtalo más tarde." };
    if (codigo === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(t))
      return { texto: "Ese correo no parece válido. Revísalo." };
    if (/provider is not enabled|unsupported provider/i.test(t))
      return { texto: "El acceso con Google no está disponible ahora mismo. Entra con tu correo: te mandamos un enlace.", sinGoogle: true };
    if (/failed to fetch|network|load failed/i.test(t))
      return { texto: "No hay conexión con el servidor. Comprueba tu conexión y vuelve a intentarlo." };
    return { texto: "No se ha podido completar. Inténtalo de nuevo en unos minutos." };
  }

  // Vuelta del enlace o de Google con error: Supabase lo pone en el hash o en la consulta.
  function errorDeVuelta(hash, search) {
    const leer = s => { try { return new URLSearchParams(String(s || "").replace(/^[#?]/, "")); } catch (e) { return new URLSearchParams(); } };
    const h = leer(hash), q = leer(search);
    const p = h.get("error") || h.get("error_code") ? h : (q.get("error") || q.get("error_code") ? q : null);
    if (!p) return null;
    const codigo = p.get("error_code") || p.get("error") || "";
    const desc = p.get("error_description") || "";
    if (codigo === "otp_expired" || /expired|invalid/i.test(desc))
      return { codigo, texto: "El enlace ha caducado o ya se usó. Pide uno nuevo: tarda unos segundos.", caducado: true };
    if (/provider|oauth|google/i.test(desc + " " + codigo) || codigo === "server_error" || codigo === "invalid_request")
      return { codigo, texto: "No se ha podido entrar con Google. Prueba con tu correo: te mandamos un enlace.", sinGoogle: true };
    if (codigo === "access_denied")
      return { codigo, texto: "Se canceló el acceso. Cuando quieras, vuelve a intentarlo." };
    return { codigo, texto: "No se ha podido iniciar sesión. Vuelve a intentarlo." };
  }

  // ---- cuenta atrás del reenvío --------------------------------------------------------------
  const ESPERA_REENVIO = 60;    // s; Supabase no deja pedir otro enlace al mismo correo antes
  const segundosRestantes = (enviadoEn, ahora, espera = ESPERA_REENVIO) =>
    enviadoEn ? Math.max(0, Math.ceil(espera - (ahora - enviadoEn) / 1000)) : 0;
  const textoReenvio = s => s > 0 ? `Reenviar en ${s} s` : "Reenviar el enlace";

  // ---- ventajas de registrarse -----------------------------------------------------------------
  // Solo lo que existe hoy. `calculos`: la tabla está desplegada; `ejercicios`: años publicados;
  // `pagos`: se puede contratar el plan Gestor.
  function ventajas({ calculos = false, ejercicios = 1, pagos = false } = {}) {
    const l = [];
    if (calculos) {
      l.push({ t: "Guarda tus cálculos", d: "Tu situación queda guardada: no tienes que volver a rellenar la calculadora." });
      l.push({ t: "Retómalos en cualquier dispositivo", d: "Empieza en el móvil y sigue en el ordenador, con la misma cuenta." });
      if (ejercicios > 1) l.push({ t: "Compara ejercicios", d: "Abre un cálculo guardado y cambia de año para ver cómo te afecta la normativa." });
    }
    l.push({ t: "Sin contraseñas", d: "Entras con Google o con un enlace que te llega al correo." });
    if (pagos) l.push({ t: "Plan Gestor cuando lo necesites", d: "Para asesores: «Mis clientes», con tu cartera guardada y siempre recalculada." });
    return l;
  }

  // ---- cálculo pendiente de guardar ----------------------------------------------------------
  // «Guarda este cálculo» sin sesión: se recuerda el hogar y, al volver con la sesión iniciada
  // (en esta pestaña o en la que abre el enlace), se guarda. Caduca a las 2 horas.
  const CADUCIDAD_PENDIENTE = 2 * 3600e3;
  const pendienteGuardar = (fila, ahora) => JSON.stringify({ fila, t: ahora });
  function leerPendiente(raw, ahora) {
    let p = null;
    try { p = JSON.parse(raw || "null"); } catch (e) { return null; }
    if (!p || !p.fila || typeof p.fila !== "object" || !p.fila.hogar || typeof p.t !== "number") return null;
    return ahora - p.t < CADUCIDAD_PENDIENTE && ahora >= p.t ? p.fila : null;
  }

  // Fila de `calculos` (ver la migración 20261111100000_calculos_guardados.sql).
  function filaCalculo({ hogar, liq, ejercicio, territorio, nombreTerritorio, retenciones, motor, titulo, ahora }) {
    const fecha = new Date(ahora || Date.now()).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    const t = String(titulo || "").trim() || `${nombreTerritorio || territorio} · ${ejercicio} · ${fecha}`;
    return {
      titulo: t.slice(0, 120), ejercicio: +ejercicio, territorio, hogar,
      resultado: {
        cuotaLiquidaTotal: liq.cuotaLiquidaTotal, cuotaDiferencial: liq.cuotaDiferencial,
        retenciones: retenciones || 0, tipoMedioEfectivo: liq.tipoMedioEfectivo,
        modo: liq.modoTributacionElegido, motor: motor || null
      },
      cuota_liquida: Math.round((liq.cuotaLiquidaTotal || 0) * 100) / 100
    };
  }

  // ---- bienvenida del primer acceso ----------------------------------------------------------
  // Toca si la cuenta se creó hace poco (15 min) y este navegador no la ha mostrado ya.
  const VENTANA_BIENVENIDA = 15 * 60e3;
  function tocaBienvenida(usuario, perfil, vista, ahora) {
    if (!usuario || vista) return false;
    const alta = Date.parse((perfil && perfil.creado_en) || usuario.created_at || "");
    return Number.isFinite(alta) && ahora - alta >= -60e3 && ahora - alta < VENTANA_BIENVENIDA;
  }

  // Iniciales del avatar: «Ana Gómez» → «AG»; sin nombre, la primera letra del correo.
  function iniciales(nombre, correo) {
    const p = String(nombre || "").trim().split(/\s+/).filter(Boolean);
    if (p.length) return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
    return (String(correo || "?").trim()[0] || "?").toUpperCase();
  }

  const API = {
    normalizarCorreo, correoValido, sugerirCorreo, bandejaDe, textoError, errorDeVuelta,
    ESPERA_REENVIO, segundosRestantes, textoReenvio, ventajas,
    CADUCIDAD_PENDIENTE, pendienteGuardar, leerPendiente, filaCalculo, tocaBienvenida, iniciales
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.MapafiscalCuentas = API;
})(typeof window !== "undefined" ? window : null);
