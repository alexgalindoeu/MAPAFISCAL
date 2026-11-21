// =============================================================================
// Curva «del bruto al neto» en SVG inline, generada en el servidor y sin librerías.
// Dos paneles que comparten el eje del bruto anual: neto mensual (12 pagas) y tipo medio
// del IRPF. Solo dibuja cifras que ya trae web/datos/seo_sueldo_neto.json (motor R):
// aquí no se calcula ningún impuesto. Colores con las variables CSS del tema (claro y
// oscuro); el ancho lo da el contenedor (viewBox), así que se adapta al móvil.
// =============================================================================
import { esc, euros, pct } from "./seo_comun.mjs";

const AN = 640, AL = 190, IZQ = 64, DER = 16, ARR = 14, ABA = 30;

// puntos: [{ bruto, valor }] ordenados; formato: n → texto del eje y de la tabla
function panel({ puntos, titulo, formato, marca, pasoY }) {
  const xs = puntos.map(p => p.bruto), ys = puntos.map(p => p.valor);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const y1 = Math.ceil(Math.max(...ys) / pasoY) * pasoY || pasoY;
  const X = x => IZQ + (x - x0) / (x1 - x0) * (AN - IZQ - DER);
  const Y = y => ARR + (1 - y / y1) * (AL - ARR - ABA);
  const lineasY = [];
  for (let v = 0; v <= y1 + 1e-9; v += y1 / 4) lineasY.push(v);
  const ticksX = [];
  for (let v = Math.ceil(x0 / 20000) * 20000; v <= x1; v += 20000) ticksX.push(v);
  const camino = puntos.map((p, i) => `${i ? "L" : "M"}${X(p.bruto).toFixed(1)},${Y(p.valor).toFixed(1)}`).join("");
  const m = marca != null ? puntos.find(p => p.bruto === marca) : null;
  return `<svg class="grafico-svg" viewBox="0 0 ${AN} ${AL}" role="img" aria-label="${esc(titulo)}" preserveAspectRatio="xMidYMid meet">
  ${lineasY.map(v => `<line class="g-reticula" x1="${IZQ}" x2="${AN - DER}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="g-eje" x="${IZQ - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(formato(v))}</text>`).join("")}
  ${ticksX.map(v => `<text class="g-eje" x="${X(v).toFixed(1)}" y="${AL - 10}" text-anchor="middle">${esc(Math.round(v / 1000) + " mil")}</text>`).join("")}
  <path class="g-linea" d="${camino}"/>
  ${m ? `<circle class="g-punto" cx="${X(m.bruto).toFixed(1)}" cy="${Y(m.valor).toFixed(1)}" r="5"/><text class="g-valor" x="${Math.min(X(m.bruto), AN - DER - 60).toFixed(1)}" y="${(Y(m.valor) - 10).toFixed(1)}" text-anchor="middle">${esc(formato(m.valor))}</text>` : ""}
</svg>`;
}

// serie: [{ bruto, neto, irpf }] (cifras anuales del motor). marca: bruto a destacar.
export function graficoBrutoNeto({ serie, titulo, pie, marca = null }) {
  const s = [...serie].sort((a, b) => a.bruto - b.bruto);
  const neto = s.map(p => ({ bruto: p.bruto, valor: p.neto / 12 }));
  const tipo = s.map(p => ({ bruto: p.bruto, valor: p.irpf / p.bruto }));
  const eurCorto = n => euros(n);
  const filas = s.map(p => `<tr${p.bruto === marca ? ' class="destacada"' : ""}><td class="num">${esc(euros(p.bruto))}</td><td class="num">${esc(euros(p.neto / 12))}</td><td class="num">${esc(pct(p.irpf / p.bruto))}</td></tr>`).join("");
  return `<div class="tarjeta">
    <figure class="grafico">
      <h2 class="rotulo">${esc(titulo)}</h2>
      <p class="grafico-leyenda">Neto al mes (12 pagas)</p>
      ${panel({ puntos: neto, titulo: `Neto mensual en 12 pagas según el sueldo bruto anual, de ${euros(neto[0].valor)} a ${euros(neto[neto.length - 1].valor)} al mes`, formato: eurCorto, marca, pasoY: 1000 })}
      <p class="grafico-leyenda">Tipo medio del IRPF sobre el bruto</p>
      ${panel({ puntos: tipo, titulo: `Tipo medio del IRPF según el sueldo bruto anual, del ${pct(tipo[0].valor)} al ${pct(tipo[tipo.length - 1].valor)}`, formato: v => pct(v), marca, pasoY: 0.05 })}
      <figcaption class="ayuda">${esc(pie)} Eje horizontal: sueldo bruto anual, en miles de euros.</figcaption>
    </figure>
    <details class="grafico-datos"><summary>Ver los datos del gráfico</summary>
      <div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Bruto anual</th><th class="num">Neto al mes (12 pagas)</th><th class="num">Tipo medio IRPF</th></tr></thead><tbody>${filas}</tbody></table></div>
    </details>
  </div>`;
}

// Serie de un territorio (o la media de los 19 si `codigo` es null) a partir de
// seo_sueldo_neto.json: neto e IRPF anuales del motor para cada bruto.
export function serieSueldoNeto(d, codigo = null) {
  return Object.keys(d.sueldos).map(Number).sort((a, b) => a - b).map(bruto => {
    const t = d.sueldos[String(bruto)].territorios;
    const filas = codigo ? [t[codigo]] : Object.values(t);
    const media = k => filas.reduce((a, f) => a + f[k], 0) / filas.length;
    return { bruto, neto: media("neto"), irpf: media("irpf") };
  });
}
