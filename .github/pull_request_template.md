## Qué cambia

<!-- Resumen breve del cambio y por qué. -->

## Comprobaciones

- [ ] `npm test` pasa en local
- [ ] Si cambia un parámetro de `web/datos/params.json`: indica `norma`, `fuente` y `estado` (`confirmado` / `provisional`)
- [ ] Si cambia un parámetro: editado en `params/2025/*.yaml` y regenerado con `Rscript tools/exportar_params.R`
- [ ] Si cambia la lógica de `web/js/irpfsim.js` o de `R/`: mismo cambio en los dos motores, caso nuevo en `tools/validar_js.R` y `npm run validar` da «VALIDADOR OK»
- [ ] Si cambia la web: probada con `npm run servir` y con el HTML de `npm run empaquetar`
