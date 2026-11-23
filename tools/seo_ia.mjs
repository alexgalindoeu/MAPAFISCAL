// =============================================================================
// Visibilidad en buscadores con IA: robots.txt (con los rastreadores de IA permitidos
// de forma expresa) y /llms.txt (resumen del sitio con enlaces a las páginas clave,
// formato https://llmstxt.org). Las cifras salen de los mismos JSON que las páginas.
// =============================================================================
import { SITIO, SLUG, ORDEN_TERRITORIOS, NOMBRE_CORTO, euros, pctCorto } from "./seo_comun.mjs";
import { RUTA_RANKING } from "./seo_ranking.mjs";

// Rastreadores de buscadores y asistentes con IA que pueden citar Mapafiscal como fuente.
export const BOTS_IA = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "Google-Extended", "PerplexityBot", "ClaudeBot", "Applebot-Extended"];

export function robotsTxt() {
  return `Sitemap: ${SITIO}/sitemap.xml

User-agent: *
Allow: /

${BOTS_IA.map(b => `User-agent: ${b}\nAllow: /`).join("\n\n")}
`;
}

export function llmsTxt({ territorios, comparativas, guias, GUIAS, conDeducciones, VIVIENDA = [], AUTONOMOS = null, RANKING = null }) {
  const T = territorios.territorios;
  const est = guias.escalas.estatal_2025.tramos;
  const c30 = comparativas.comparativas["30000"];
  const barato = c30[0], caro = c30[c30.length - 1];
  const linea = c => {
    const tr = T[c].escala_combinada.tramos;
    return `- [IRPF en ${T[c].nombre}](${SITIO}/irpf/${SLUG[c]}/): tramos del ${pctCorto(tr[0].tipo)} al ${pctCorto(tr[tr.length - 1].tipo)} en ${territorios.ejercicio}${conDeducciones.has(c) ? `; [deducciones](${SITIO}/irpf/${SLUG[c]}/deducciones/)` : ""}`;
  };
  return `# Mapafiscal

> Calculadora gratuita del IRPF (impuesto sobre la renta) de España en sus 19 territorios fiscales: las 15 comunidades autónomas de régimen común, las tres diputaciones forales del País Vasco (Bizkaia, Gipuzkoa y Araba/Álava) y Navarra. Ejercicios 2025 y 2026. Cada cifra sale de un motor de cálculo abierto con los parámetros de la norma (LIRPF, leyes autonómicas y normas forales), y cada página cita su fuente oficial (BOE, boletines autonómicos y forales o el Manual práctico de la AEAT).

Datos clave (${territorios.ejercicio}, actualizados el ${territorios.generado}):

- Escala estatal general del IRPF: ${est.length} tramos, del ${pctCorto(est[0].tipo)} al ${pctCorto(est[est.length - 1].tipo)} (art. 63 LIRPF); se suma a la escala autonómica de cada comunidad.
- Con 30.000 € brutos al año (una persona, sin hijos), la cuota del IRPF va de ${euros(barato.cuota_liquida_total)} en ${NOMBRE_CORTO[barato.territorio]} a ${euros(caro.cuota_liquida_total)} en ${NOMBRE_CORTO[caro.territorio]}.
- Las estimaciones son informativas: no son una liquidación oficial ni asesoramiento fiscal. Contacto: contacto@mapafiscal.es.

## Herramientas

- [Calculadora del IRPF](${SITIO}/index.html#calculadora): la renta con tu situación real, en cualquiera de los 19 territorios.
- [Comparador de territorios](${SITIO}/index.html#comparar): la misma situación en los 19 territorios.
- [Sueldo neto](${SITIO}/sueldo-neto/): de bruto a neto en 12 y 14 pagas.
- [Dónde se paga menos IRPF](${SITIO}/comparar-sueldo/): ranking de los 19 territorios por sueldo.
${RANKING ? `
## Datos abiertos

- [Ranking IRPF por comunidades ${RANKING.datos.ejercicio}](${SITIO}${RUTA_RANKING}): estudio anual con ${RANKING.datos.salarios.map(s => euros(s)).join(", ").replace(/, ([^,]+)$/, " y $1")} brutos; tabla, mapa, metodología y cinco conclusiones.
${Object.keys(RANKING.ficheros).map(f => `- [${f.split("/").pop()}](${SITIO}/${f}): ${f.endsWith(".csv") ? "CSV (separador «;», coma decimal, UTF-8)" : "JSON"}, licencia CC BY 4.0.`).join("\n")}
${RANKING.conclusiones.map(c => `- ${c.texto}`).join("\n")}
` : ""}
## Guías

${GUIAS.map(g => `- [${g.enlace}](${SITIO}/guias/${g.slug}/): ${g.resumen}`).join("\n")}

## Vivienda

- [Cómo tributa la vivienda en el IRPF](${SITIO}/vivienda/): vivienda habitual, segunda vivienda, alquiler y venta.
${VIVIENDA.filter(v => v.slug).map(v => `- [${v.enlace}](${SITIO}/vivienda/${v.slug}/): ${v.resumen}`).join("\n")}

${AUTONOMOS ? `## Autónomos

- [IRPF de autónomos en estimación directa](${SITIO}/autonomos/): rendimiento neto, gastos de difícil justificación, cuota de autónomo como gasto y modelo 130.
${ORDEN_TERRITORIOS.map(c => `- [IRPF de un autónomo en ${NOMBRE_CORTO[c]}](${SITIO}/autonomos/${SLUG[c]}/): ${euros(AUTONOMOS.cifras[c][AUTONOMOS.referencia])} con ${euros(AUTONOMOS.referencia)} de rendimiento neto (${AUTONOMOS.ejercicio})`).join("\n")}

` : ""}## IRPF por territorio

${ORDEN_TERRITORIOS.map(linea).join("\n")}

## Otras páginas

- [¿Cuánto me devuelve Hacienda?](${SITIO}/cuanto-me-devuelve/): hijos, alquiler, hipoteca, discapacidad y donativos.
- [Rescate del plan de pensiones](${SITIO}/rescate-plan-pensiones/)
- [Declaración conjunta o individual](${SITIO}/declaracion-conjunta/)
- [Glosario del IRPF](${SITIO}/glosario/): definiciones de los términos de la renta, con su artículo de la ley.
- [Mapa del sitio](${SITIO}/sitemap.xml)
`;
}
