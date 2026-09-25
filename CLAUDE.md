# Mapafiscal: notas para Claude

- Proyecto en español: código, comentarios, commits, issues y PRs.
- `web/js/irpfsim.js` es el port del motor R de referencia y debe dar los mismos resultados al céntimo. No cambies su lógica sin reflejar el mismo cambio en el motor R, o avisa de que la paridad queda pendiente.
- `web/datos/params.json` se genera desde `params/2025/*.yaml`. Todo parámetro nuevo lleva `norma`, `fuente` y `estado` (`confirmado` o `provisional`).
- `web/index.html` delimita el cuerpo con `<!--CUERPO-->`/`<!--/CUERPO-->`. `tools/empaquetar.mjs` sustituye las etiquetas `<link>` y `<script src>` por su contenido, así que no cambies esas líneas sin actualizar el empaquetador.
- Comprobaciones: `npm test`. Para ver la web: `npm run servir`, o `npm run empaquetar` y abrir `dist/mapafiscal.html`.
