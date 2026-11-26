// Genera las imágenes de marca en PNG (sin dependencias: usa Edge o Chrome sin interfaz):
//   web/og.png                 1200×630, imagen para redes (Open Graph / Twitter), de tools/marca/og.html
//   web/iconos/icono-192.png   192×192 y icono-512.png 512×512 (manifest), de web/favicon.svg
//   web/iconos/icono-maskable-512.png  512×512 con margen de seguridad (Android)
//   web/iconos/apple-touch-icon.png    180×180 (iOS)
//
//   node tools/generar_imagenes.mjs     (NAVEGADOR=<ruta a msedge/chrome> para otro navegador)
//
// Con --seo genera solo las imágenes de las páginas (tools/seo_imagenes.mjs): un PNG de
// 1200×630 por territorio en web/img/irpf/ y web/img/manifiesto.json con el hash de los datos
// de cada uno. `node tools/generar_paginas_seo.mjs --comprobar` (CI) falla si no coinciden:
// repítelo cuando cambien las escalas o la comparativa con 30.000 €.
//
// No lo ejecuta la CI: los PNG se versionan. Repítelo si cambias el logotipo o tools/marca/og.html.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATOS = [process.env.NAVEGADOR,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/opt/pw-browsers/chromium"].filter(Boolean);
const NAV = CANDIDATOS.find(p => existsSync(p));
if (!NAV) { console.error("No encuentro Edge ni Chrome: indica la ruta con NAVEGADOR=…"); process.exit(1); }

function captura(url, ancho, alto, salida) {
  mkdirSync(dirname(salida), { recursive: true });
  const perfil = join(tmpdir(), "mapafiscal-capturas");
  execFileSync(NAV, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--user-data-dir=${perfil}`, `--window-size=${ancho},${alto}`, `--screenshot=${salida}`, url], { stdio: "ignore" });
  console.log(`${salida.replace(RAIZ, ".")} (${ancho}×${alto}, ${(readFileSync(salida).length / 1024).toFixed(1)} KB)`);
}

const svg = readFileSync(join(RAIZ, "web", "favicon.svg"), "utf8").trim();
const tmp = join(tmpdir(), "mapafiscal-icono.html");
function icono(lado, salida, margen = 0) {
  // margen: fracción del lado que queda de fondo de marca alrededor (zona segura de los maskable)
  const dentro = Math.round(lado * (1 - 2 * margen));
  const fondo = margen ? "#1f3fc4" : "transparent";
  writeFileSync(tmp, `<!doctype html><style>html,body{margin:0;width:${lado}px;height:${lado}px;overflow:hidden;background:${fondo};display:grid;place-items:center}svg{width:${dentro}px;height:${dentro}px;display:block}</style>${svg}`);
  captura(pathToFileURL(tmp).href, lado, lado, join(RAIZ, "web", "iconos", salida));
}

if (process.argv.includes("--seo")) {
  const { imagenesTerritorios } = await import("./seo_imagenes.mjs");
  const leer = f => JSON.parse(readFileSync(join(RAIZ, "web", "datos", f), "utf8"));
  const imgs = imagenesTerritorios({ territorios: leer("seo_territorios.json"), comparativas: leer("seo_comparativas.json") });
  const manifiesto = {};
  for (const img of imgs) {
    // El HTML va en tools/marca/ para que las fuentes (../../web/fonts/) se resuelvan igual que en og.html.
    const html = join(RAIZ, "tools", "marca", `_imagen-${img.codigo}.html`);
    writeFileSync(html, img.html);
    captura(pathToFileURL(html).href, 1200, 630, join(RAIZ, "web", img.ruta.slice(1)));
    rmSync(html, { force: true });
    manifiesto[img.ruta] = img.hash;
  }
  writeFileSync(join(RAIZ, "web", "img", "manifiesto.json"), JSON.stringify(manifiesto, null, 1) + "\n");
  console.log(`web/img/manifiesto.json: ${imgs.length} imágenes.`);
  process.exit(0);
}

captura(pathToFileURL(join(RAIZ, "tools", "marca", "og.html")).href, 1200, 630, join(RAIZ, "web", "og.png"));
icono(192, "icono-192.png");
icono(512, "icono-512.png");
icono(512, "icono-maskable-512.png", 0.1);
icono(180, "apple-touch-icon.png");
rmSync(tmp, { force: true });
