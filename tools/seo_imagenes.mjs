// =============================================================================
// Imágenes de las páginas, para que buscadores y asistentes con IA puedan mostrarlas y
// adjuntarlas: un PNG de 1200×630 por territorio (tramos del IRPF y lo que se paga con
// 30.000 € brutos). Licencia CC BY 4.0 (aviso legal, apartado 7, «#imagenes»).
//
// El HTML de cada imagen se construye aquí, con los mismos JSON que las páginas, y su hash
// va en web/img/manifiesto.json. Los PNG los hace `node tools/generar_imagenes.mjs --seo`
// con un navegador sin interfaz (la CI no los genera: se versionan, como web/og.png).
// `node tools/generar_paginas_seo.mjs --comprobar` falla si un PNG no corresponde a los
// datos actuales, sin necesitar navegador.
// =============================================================================
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WEB, SITIO, SLUG, ORDEN_TERRITORIOS, esc, euros, pctTipo } from "./seo_comun.mjs";

export const LICENCIA_IMAGENES = "https://creativecommons.org/licenses/by/4.0/deed.es";
export const CONDICIONES_IMAGENES = SITIO + "/legal/aviso-legal.html#imagenes";
export const CREDITO = "Mapafiscal (mapafiscal.es)";
const MANIFIESTO = join(WEB, "img", "manifiesto.json");

// Fuentes por ruta relativa al HTML temporal que escribe generar_imagenes.mjs (en tools/marca/).
const CSS = `
@font-face { font-family: "Archivo"; font-weight: 600 800; font-stretch: 100% 125%; src: url("../../web/fonts/archivo-latin-var.woff2") format("woff2"); }
@font-face { font-family: "Public Sans"; font-weight: 400 700; src: url("../../web/fonts/public-sans-latin-var.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 500; src: url("../../web/fonts/ibm-plex-mono-latin-500.woff2") format("woff2"); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body { background: #edf1f0; color: #0d1b22; font-family: "Public Sans", sans-serif;
  background-image: linear-gradient(#d9e0de 1px, transparent 1px), linear-gradient(90deg, #d9e0de 1px, transparent 1px);
  background-size: 40px 40px; }
.caja { position: absolute; inset: 48px 56px; display: grid; grid-template-columns: 1fr 470px; gap: 40px; }
.izq { display: flex; flex-direction: column; justify-content: space-between; }
.marca { display: flex; align-items: center; gap: 14px; }
.marca svg { width: 52px; height: 52px; }
.marca span { font-family: "Archivo"; font-stretch: 118%; font-weight: 800; font-size: 32px; letter-spacing: -.02em; }
.ante { font-family: "IBM Plex Mono"; font-weight: 500; font-size: 19px; letter-spacing: .06em; text-transform: uppercase; color: #1a36a8; margin: 0 0 12px; }
h1 { font-family: "Archivo"; font-stretch: 112%; font-weight: 800; font-size: 60px; line-height: 1.04; letter-spacing: -.03em; margin: 0; }
.cifra { margin-top: 26px; font-size: 24px; color: #34444c; }
.cifra b { display: block; font-family: "Archivo"; font-stretch: 110%; font-weight: 800; font-size: 64px; color: #0d1b22; letter-spacing: -.02em;
  background: linear-gradient(transparent 62%, #ffd23f 62%); width: fit-content; }
.pie { font-size: 17px; color: #34444c; line-height: 1.35; }
.pie strong { font-family: "Archivo"; font-stretch: 110%; color: #1f3fc4; font-size: 24px; display: block; margin-bottom: 4px; }
.tabla { background: #fff; border: 1px solid #c9d3d0; border-radius: 14px; padding: 18px 22px; align-self: center; }
.tabla h2 { font-family: "IBM Plex Mono"; font-weight: 500; font-size: 16px; letter-spacing: .05em; text-transform: uppercase; color: #1a36a8; margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
td { padding: 4px 0; border-top: 1px solid #e3e9e7; font-size: 19px; }
td.t { text-align: right; font-weight: 700; color: #1f3fc4; }
tr:first-child td { border-top: 0; }`;
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1f3fc4"/><path fill="#fff" d="M7 10.5 13 8v15.5L7 26z"/><path fill="#ffd23f" d="M13 8l6 2.5V26l-6-2.5z"/><path fill="#fff" fill-opacity=".55" d="M19 10.5 25 8v15.5L19 26z"/></svg>`;

function filasTramos(tramos) {
  let desde = 0;
  return tramos.map(t => {
    const txt = t.hasta == null ? `Desde ${euros(desde)}` : `${euros(desde)} – ${euros(t.hasta)}`;
    desde = t.hasta;
    return `<tr><td>${esc(txt)}</td><td class="t">${esc(pctTipo(t.tipo))}</td></tr>`;
  }).join("");
}

// Imágenes de los 19 territorios: [{ codigo, ruta, alt, html, hash }]
export function imagenesTerritorios({ territorios, comparativas }) {
  const ej = territorios.ejercicio;
  const c30 = comparativas.comparativas["30000"];
  return ORDEN_TERRITORIOS.map(codigo => {
    const t = territorios.territorios[codigo];
    const fila = c30.find(f => f.territorio === codigo);
    const nombre = t.nombre;
    const tramos = t.escala_combinada.tramos;
    const comun = t.regimen === "comun";
    const ruta = `/img/irpf/${SLUG[codigo]}-${ej}.png`;
    const alt = `IRPF ${ej} en ${nombre}: tramos del ${pctTipo(tramos[0].tipo)} al ${pctTipo(tramos[tramos.length - 1].tipo)}; con 30.000 € brutos se pagan ${euros(fila.cuota_liquida_total)} al año (puesto ${fila.puesto} de ${c30.length}). Fuente: Mapafiscal (mapafiscal.es), licencia CC BY 4.0.`;
    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(alt)}</title><style>${CSS}</style></head>
<body><div class="caja">
  <div class="izq">
    <div class="marca">${LOGO}<span>Mapafiscal</span></div>
    <div>
      <p class="ante">IRPF ${ej} · ${comun ? "escala estatal + autonómica" : "tarifa foral"}</p>
      <h1>${esc(nombre)}</h1>
      <p class="cifra">Con 30.000 € brutos al año<b>${esc(euros(fila.cuota_liquida_total))}</b>de IRPF · puesto ${fila.puesto} de ${c30.length} (de menos a más)</p>
    </div>
    <div class="pie"><strong>mapafiscal.es/irpf/${esc(SLUG[codigo])}/</strong>Persona sin hijos, un pagador, ejercicio ${ej}. Licencia CC BY 4.0: cita «${esc(CREDITO)}».</div>
  </div>
  <div class="tabla"><h2>Tramos de la base liquidable general</h2><table>${filasTramos(tramos)}</table></div>
</div></body></html>`;
    const hash = createHash("sha256").update(html).digest("hex").slice(0, 16);
    return { codigo, ruta, alt, html, hash };
  });
}

let manifiesto = null;
function leerManifiesto() {
  if (manifiesto == null) manifiesto = existsSync(MANIFIESTO) ? JSON.parse(readFileSync(MANIFIESTO, "utf8")) : {};
  return manifiesto;
}

// Una imagen solo se publica si su PNG existe y corresponde a los datos actuales.
export function imagenPublicada(img) {
  return leerManifiesto()[img.ruta] === img.hash && existsSync(join(WEB, img.ruta.slice(1)));
}

// Imágenes desfasadas o que faltan (para --comprobar y los tests).
export function imagenesDesfasadas(imgs) {
  return imgs.filter(img => !imagenPublicada(img)).map(img => img.ruta);
}

// Figura visible en la página, con el aviso de licencia.
export function figuraImagen(img) {
  return `<figure class="tarjeta figura-imagen">
    <img src="${img.ruta}" width="1200" height="630" loading="lazy" decoding="async" alt="${esc(img.alt)}">
    <figcaption class="ayuda">Imagen con licencia <a href="${LICENCIA_IMAGENES}" rel="license noopener">CC BY 4.0</a>: puedes usarla y compartirla citando «${esc(CREDITO)}» con un enlace a esta página. <a href="/legal/aviso-legal.html#imagenes">Condiciones</a>.</figcaption>
  </figure>`;
}

// Datos de la imagen para la cabecera (og:image) y el JSON-LD.
export function imagenCabecera(img) {
  return { src: SITIO + img.ruta, ancho: 1200, alto: 630, alt: img.alt };
}
export function jsonLdImagen(img, pagina) {
  return {
    "@context": "https://schema.org", "@type": "ImageObject", contentUrl: SITIO + img.ruta, url: SITIO + img.ruta,
    width: 1200, height: 630, caption: img.alt, description: img.alt, representativeOfPage: true,
    license: LICENCIA_IMAGENES, acquireLicensePage: CONDICIONES_IMAGENES, creditText: CREDITO,
    copyrightNotice: "© Mapafiscal · CC BY 4.0", creator: { "@id": SITIO + "/#organizacion" },
    isPartOf: SITIO + pagina
  };
}
