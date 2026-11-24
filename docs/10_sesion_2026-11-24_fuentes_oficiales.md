# Sesión 24-11-2026: fuentes oficiales (forales, Navarra y estatal)

Retoma `fuentes-forales.patch` y `navarra.patch` de `docs/traspaso/` (rama
`claude/trusting-turing-60u8n9`). Todo cotejado con texto oficial descargado en la sesión.

## Qué cambia

- **params/ sin fuentes no oficiales.** Test nuevo `tests/testthat/test-fuentes-oficiales.R`:
  falla si un YAML de `params/` nombra Iberley, guiafiscal, Cuatrecasas, INVERCO, BBVA AM y
  similares. Con `main` detectaba 11 citas; ahora, ninguna.
- **País Vasco 2025.** Las fuentes de los bloques comunes van por territorio
  («Bizkaia: … / Gipuzkoa: … / Araba: …») y cada página muestra y enlaza solo la suya
  (`fuente_del_territorio()` en R y `fuenteDelTerritorio()` en `tools/seo_foral.mjs`).
  Enlaces nuevos, verificados: BOB n.º 249 (30-12-2023, NF 10/2023: minoración 1.583 € y
  descendientes 668/827/1.393/1.647/2.151 € + 386 €), BOB n.º 75 (22-04-2025, NF 2/2025:
  art. 86 alquiler 20 %/1.600 € y 35 %/2.800 €; art. 87.4, 23 %/1.955 €) y BOTHA n.º 147
  (30-12-2024, NF 19/2024). La tarifa de Araba está en el art. 75.1 NF 33/2013, no en el 74.
  `capital_inmobiliario` pasa a `provisional` (se retira Cuatrecasas; falta la fuente
  oficial de Gipuzkoa, Araba y el 20 % general). No interviene en el cálculo.
- **Navarra 2025.** Confirmado con el BOE y el Manual teórico 2025 de la Hacienda Foral
  (actualizado a 02-02-2026), sin cambiar ninguna cifra:
  - tarifa general (art. 59.1): LF 22/2023, BOE-A-2024-1694;
  - escala del ahorro (art. 60): LF 36/2022, BOE-A-2023-3349;
  - deducción por trabajo (art. 62.5): letras a), d) y e) LF 30/2018 (BOE-A-2019-752),
    b) LF 19/2021 (BOE-A-2022-2067; corrige a 10.500 € el 10.501 de 2018), c) LF 29/2019
    (BOE-A-2020-450); +50 %/+100 % por discapacidad en activo: Manual, pág. 271;
  - previsión social, 30 %/50 % (letra a´): Manual, pág. 209.
- **Estatal.** Art. 20 LIRPF: se sustituye Iberley por el BOE (BOE-A-2006-20764).

## Impacto en la web

Mismas 899 URLs del sitemap que `main`. Ninguna cifra de cálculo cambia (VALIDADOR OK 172).
Solo cambian los textos de «Fuente» y sus enlaces en las páginas forales, y el `lastmod`.

## Pendiente de decisión del dueño

- **Álava:** ascendientes (423,72 €), discapacidad (1.025,64 €…) y anualidades por alimentos
  tienen fuente oficial verificada (BOTHA n.º 147), pero se deja como comentario en el YAML:
  activarla publica 3 páginas nuevas en «cuánto me devuelve» y cambia la media de unas 60.

## Normativa nueva comprobada en el BOE

- **RDL 38/2026** (BOE-A-2026-24120, 18-11-2026): DA 61.ª LIRPF con efectos 1-1-2027
  (1.033,58 € hasta 18.004 € de íntegros del trabajo; −0,2 × exceso hasta 23.171,89 €) y
  art. 85 RIRPF. Para el ejercicio 2027; no toca 2025 ni 2026. SMI 2027: RD 1013/2026
  (BOE-A-2026-24189).
- **RDL 35/2026** (familias monoparentales): no modifica la Ley del IRPF; cambia la Ley
  40/2003 con efectos 2027.
