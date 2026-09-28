// Rellena los datos del titular en los textos legales justo antes de publicar la web.
//
// El repositorio es público y guarda todo su historial, así que los datos personales del
// titular no se escriben en él: son variables de GitHub (Settings → Secrets and variables →
// Actions → Variables) que el workflow «Publicar web» pasa como variables de entorno.
//
//   TITULAR_NOMBRE      nombre y apellidos o razón social           (obligatoria)
//   TITULAR_NIF         NIF                                         (obligatoria)
//   TITULAR_DOMICILIO   domicilio completo                          (obligatoria)
//   TITULAR_REGISTRO    datos del Registro Mercantil, si es sociedad (opcional: si falta,
//                       desaparece la línea entera que la contiene)
//
// El correo ({{CONTACTO}}) sale de `contacto` en web/config.js. Si falta algún dato o queda
// algún {{…}} sin rellenar, termina con error y no se publica nada con huecos.
//
//   node tools/rellenar_titular.mjs [carpeta]      (por defecto: web)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OBLIGATORIOS = ["TITULAR_NOMBRE", "TITULAR_NIF", "TITULAR_DOMICILIO", "CONTACTO"];
export const OPCIONALES = ["TITULAR_REGISTRO"];
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
  const lineas = html.split("\n").filter(l => !OPCIONALES.some(k => !datos[k] && l.includes(`{{${k}}}`)));
  const salida = lineas.join("\n").replace(HUECO, (m, k) => (datos[k] ? escapar(datos[k]) : m));
  const quedan = [...new Set(salida.match(HUECO) || [])];
  return { html: salida, quedan };
}

// Páginas que pueden llevar huecos: index.html (información básica de protección de datos en
// los diálogos) y las páginas legales.
export function paginas(web) {
  return ["index.html", ...readdirSync(join(web, "legal")).filter(f => f.endsWith(".html")).sort().map(f => join("legal", f))];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const web = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "web"));
  const datos = {};
  for (const k of [...OBLIGATORIOS, ...OPCIONALES]) datos[k] = (process.env[k] || "").trim();
  datos.CONTACTO = contactoDeConfig(readFileSync(join(web, "config.js"), "utf8"));
  const f = faltan(datos);
  if (f.length) {
    console.error(`::error::Faltan datos del titular para los textos legales: ${f.join(", ")}. ` +
      "Ponlos en GitHub → Settings → Secrets and variables → Actions → Variables (el correo, en web/config.js). Ver docs/legal/README.md.");
    process.exit(1);
  }
  let error = false;
  for (const p of paginas(web)) {
    const ruta = join(web, p);
    const { html, quedan } = rellenar(readFileSync(ruta, "utf8"), datos);
    if (quedan.length) { console.error(`::error file=web/${p.replace(/\\/g, "/")}::Huecos sin rellenar: ${quedan.join(", ")}`); error = true; continue; }
    writeFileSync(ruta, html);
    console.log(`web/${p.replace(/\\/g, "/")}: datos del titular rellenados`);
  }
  if (error) process.exit(1);
}
