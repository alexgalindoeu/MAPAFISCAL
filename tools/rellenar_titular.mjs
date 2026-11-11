// Rellena el correo de contacto en los textos legales justo antes de publicar la web.
//
// REGLA ABSOLUTA (28-09-2026, tras exponer por error el nombre, el NIF y el domicilio reales
// de Alex en la web pública): ningún dato personal identificativo del titular se publica en
// ningún sitio de la web. Los textos legales (web/legal/) solo usan el nombre comercial
// «Mapafiscal» y el correo de contacto. Si algún día una norma exige identificar al titular
// con más detalle (LSSI art. 10, RGPD art. 13, TRLGDCU art. 21.3), se lo plantea antes a Alex
// en el chat, dejando muy claro que sería público, y se espera su decisión expresa — nunca se
// reintroduce un hueco {{TITULAR_…}} en una página que se publica sola.
//
// El correo ({{CONTACTO}}) sale de `contacto` en web/config.js, no del repositorio (que es
// público). Si el correo es el marcador de pruebas o queda algún {{…}} sin rellenar, termina
// con error y no se publica nada a medias.
//
//   node tools/rellenar_titular.mjs [carpeta]      (por defecto: web)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OBLIGATORIOS = ["CONTACTO"];
// Marcador de web/config.js que no es un buzón real.
export const CONTACTO_FALSO = "hola@mapafiscal.es";

const HUECO = /\{\{([A-Z_]+)\}\}/g;

// Escapa también ` \ $ { } para que el valor sea inofensivo si el hueco está dentro de un
// literal de JavaScript embebido en el HTML.
const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;", "\\": "&#92;", "$": "&#36;", "{": "&#123;", "}": "&#125;" };
export const escapar = s => String(s).replace(/[&<>"'`\\${}]/g, c => ENTIDADES[c]);

export function contactoDeConfig(config) {
  const m = config.match(/^\s*contacto:\s*"([^"]*)"/m);
  return m ? m[1].trim() : "";
}

// Datos que faltan (o que son el marcador) para poder publicar.
export function faltan(datos) {
  const f = OBLIGATORIOS.filter(k => !datos[k]);
  if (datos.CONTACTO === CONTACTO_FALSO) f.push(`CONTACTO (web/config.js todavía tiene el marcador ${CONTACTO_FALSO})`);
  return f;
}

// Devuelve el HTML relleno y la lista de huecos que no se han podido rellenar.
export function rellenar(html, datos) {
  const salida = html.replace(HUECO, (m, k) => (datos[k] ? escapar(datos[k]) : m));
  const quedan = [...new Set(salida.match(HUECO) || [])];
  return { html: salida, quedan };
}

// Páginas que pueden llevar el hueco del correo: index.html (información básica de protección
// de datos en los diálogos) y las páginas legales.
export function paginas(web) {
  return ["index.html", ...readdirSync(join(web, "legal")).filter(f => f.endsWith(".html")).sort().map(f => join("legal", f))];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const web = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "web"));
  const datos = { CONTACTO: contactoDeConfig(readFileSync(join(web, "config.js"), "utf8")) };
  const f = faltan(datos);
  if (f.length) {
    console.error(`::error::Falta el correo de contacto para los textos legales: ${f.join(", ")}. ` +
      "Ponlo en `contacto`, en web/config.js. Ver docs/legal/README.md.");
    process.exit(1);
  }
  let error = false;
  for (const p of paginas(web)) {
    const ruta = join(web, p);
    const { html, quedan } = rellenar(readFileSync(ruta, "utf8"), datos);
    if (quedan.length) { console.error(`::error file=web/${p.replace(/\\/g, "/")}::Huecos sin rellenar: ${quedan.join(", ")}`); error = true; continue; }
    writeFileSync(ruta, html);
    console.log(`web/${p.replace(/\\/g, "/")}: correo de contacto rellenado`);
  }
  if (error) process.exit(1);
}
