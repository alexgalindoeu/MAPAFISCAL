import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const motor = require("../web/js/irpfsim.js");
export const P = require("../web/datos/params.json");

// Hogar de una sola persona con salario (o pensión) y cotizaciones dadas.
export function hogarAsalariado(territorio, salario, cotizaciones, extra = {}) {
  return {
    territorio, ejercicio: 2025, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
    miembros: [Object.assign({
      id: "d1", rol: "declarante", edad: 40, discapacidad: "no",
      trabajo: salario > 0 ? { dinerarias: salario, cotizacionesSs: cotizaciones } : null
    }, extra)]
  };
}
