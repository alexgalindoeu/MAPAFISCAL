/* esquema.js — versión del formato de los hogares guardados y compartidos.
 *
 * `schema_version` (entero, empieza en 1) es la versión del FORMATO de los datos, no el
 * ejercicio fiscal. Viaja en el payload de los enlaces compartidos (#vista?s=…) y dentro del
 * hogar que se guarda en Supabase (`calculos.hogar`, `clientes.hogar`).
 *
 *   migrarHogar(obj) -> { ok: true, hogar, version, avisos } | { ok: false, error }
 *
 * Nunca lanza: lo que no se puede migrar vuelve como { ok: false, error } con un mensaje
 * claro, para que la página siga funcionando.
 *   - Sin `schema_version` (los datos anteriores): versión 0 -> 1.
 *   - Versión futura desconocida: se intenta abrir tal cual, con un aviso.
 *   - Contrato del motor: los importes son números (o vacío). Un importe en texto con forma
 *     de número ("30000", "1.234,56") se convierte de forma explícita, con aviso; cualquier
 *     otro texto en un campo numérico se rechaza.
 */
(function (raiz) {
  "use strict";
  const VERSION = 1;

  // campos del hogar que son texto por contrato; el resto de valores escalares son números o booleanos
  const TEXTO = new Set(["territorio", "tipoUnidadFamiliar", "familiaNumerosa", "tituloMonoparental", "id", "rol",
    "discapacidad", "tipoArrendamiento", "tipoElemento", "fechaAdquisicion", "fechaTransmision", "modo"]);
  const esTexto = k => TEXTO.has(k) || /^(tipo|fecha)[A-Z]/.test(k) || k === "tipo";

  // "30000", "-12,5", "1.234,56", "1234.56" -> número; lo demás -> null
  function numeroDeTexto(s) {
    const t = String(s).trim().replace(/\s|€/g, "");
    if (!/^-?\d[\d.,]*$/.test(t)) return null;
    let x = t;
    if (/,\d{1,2}$/.test(x)) x = x.replace(/\./g, "").replace(",", ".");   // coma decimal española
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, "");      // punto de miles
    else x = x.replace(/,/g, "");
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }

  class ErrorEsquema extends Error {}

  // recorre y valida; devuelve una copia con los importes convertidos
  function validar(x, ruta, avisos) {
    if (Array.isArray(x)) return x.map((v, i) => validar(v, ruta + "[" + i + "]", avisos));
    if (x && typeof x === "object") {
      const o = {};
      for (const [k, v] of Object.entries(x)) {
        const r = ruta ? ruta + "." + k : k;
        if (typeof v === "string" && !esTexto(k)) {
          if (v.trim() === "") { o[k] = null; continue; }
          const n = numeroDeTexto(v);
          if (n == null) throw new ErrorEsquema(`El campo «${r}» debería ser un importe y trae el texto «${v}».`);
          avisos.push(`«${r}» venía como texto («${v}») y se ha leído como ${n}.`);
          o[k] = n;
        } else if (typeof v === "number" && !Number.isFinite(v)) {
          o[k] = null;
        } else o[k] = validar(v, r, avisos);
      }
      return o;
    }
    return x;
  }

  // migraciones: MIGRACIONES[n] pasa de la versión n a la n + 1
  const MIGRACIONES = {
    0: h => h      // los hogares sin versión ya tienen el formato de la versión 1
  };

  function versionDe(obj) {
    if (!obj || !("schema_version" in obj)) return 0;
    const v = obj.schema_version;
    return Number.isInteger(v) && v >= 0 ? v : NaN;
  }

  function migrarHogar(obj) {
    try {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new ErrorEsquema("Los datos del hogar no son un objeto.");
      const version = versionDe(obj);
      if (Number.isNaN(version)) throw new ErrorEsquema(`La versión del formato («${obj.schema_version}») no es válida.`);
      const avisos = [];
      let h = JSON.parse(JSON.stringify(obj));
      delete h.schema_version;
      if (version > VERSION) avisos.push(`Estos datos usan un formato más nuevo (versión ${version}) que el de esta página (versión ${VERSION}): se abren con lo que se reconoce; recarga la página para tener la última versión.`);
      for (let v = version; v < VERSION; v++) h = MIGRACIONES[v](h);
      if (h.miembros != null && !Array.isArray(h.miembros)) throw new ErrorEsquema("La lista de miembros del hogar no es válida.");
      if (h.territorio != null && typeof h.territorio !== "string") throw new ErrorEsquema("El territorio del hogar no es válido.");
      h = validar(h, "", avisos);
      h.schema_version = VERSION;
      return { ok: true, hogar: h, version, avisos };
    } catch (e) {
      return { ok: false, error: e instanceof ErrorEsquema ? e.message : "Los datos del hogar no se pueden leer." };
    }
  }

  // hogar del formulario -> hogar para guardar (con versión) y al revés (para comparar)
  const conVersion = h => Object.assign({}, h, { schema_version: VERSION });
  const sinVersion = h => { if (!h || typeof h !== "object") return h; const o = Object.assign({}, h); delete o.schema_version; return o; };

  const API = { VERSION, migrarHogar, conVersion, sinVersion, numeroDeTexto };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.MapafiscalEsquema = API;
})(typeof window !== "undefined" ? window : null);
