# Arquitectura de la web (Mapafiscal)

Estado a 2026-09-25. Sustituye a las opciones A/B/C que se barajaban al principio: se
eligió **web estática + motor en el navegador + Supabase** (sin servidor propio).

```
             params/*.yaml  (fuente de verdad, en git)
                   │  tools/exportar_params.R
                   ▼
   ┌──────── web/datos/params.json ───────┐
   │                                      │ tools/sincronizar_supabase.R
   ▼                                      ▼
 web/  (GitHub Pages)                Supabase `mapafiscal` (UE)
 ├─ index.html · js/app.js · css/          ├─ catálogo normativo (lectura pública)
 ├─ js/irpfsim.js ← motor JS (≡ motor R)   ├─ auth (enlace mágico) + perfiles
 └─ datos/params.json · mapa_es.json       ├─ clientes (RLS por gestor)
        │                                  ├─ lista_espera (solo insert)
        │ supabase-js (clave publicable)   ├─ suscripciones (solo webhook)
        └────────────────────────────────▶ └─ Edge Functions: crear-checkout,
                                              stripe-webhook, portal-facturacion ─▶ Stripe
```

## Decisiones

- **El cálculo ocurre en el navegador.** `irpfsim.js` es un port del motor R validado al
  céntimo (`tools/validar_js*.`); la liquidación de un hogar tarda milisegundos y los
  datos de la declaración no salen del navegador salvo que el gestor guarde un cliente.
- **Sin servidor propio.** Lo único que necesita servidor (cuentas, cartera de
  clientes, pagos) lo da Supabase: Postgres con RLS, Auth y Edge Functions (Deno).
- **Seguridad por RLS, no por ocultar claves.** La web lleva la clave publicable; cada
  tabla tiene políticas (ver `supabase/README.md`). El plan de pago de una cuenta solo
  lo cambia el webhook de Stripe (privilegios por columna en `perfiles`).
- **Minimización de datos (RGPD).** Un cliente es un alias + la entrada numérica del
  motor; no se piden NIF ni nombres. Datos alojados en la UE (París).
- **Parámetros versionados en git.** Supabase guarda una copia consultable
  (`ejercicios.params`, `deducciones`, `deducciones_pendientes`), derivada del mismo
  `params.json` que usa la web.
- **Mapa sin librerías.** Trazados SVG precalculados en R (proyección cónica conforme de
  Lambert, Canarias en recuadro) a partir de es-atlas / IGN.

## Configuración: producción y demo

`web/config.js` es la configuración de producción: URL del proyecto de Supabase, clave
publicable (`sb_publishable_…`), `pagosActivos` y precios. `web/index.html` carga
`supabase-js` 2.49.4 desde jsDelivr con hash SRI (el fichero `dist/umd/supabase.js`, que es
estático; `supabase.min.js` lo genera jsDelivr al vuelo y no admite SRI). Si se sube de
versión, hay que recalcular el hash:

```bash
curl -s https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<versión>/dist/umd/supabase.js | openssl dgst -sha384 -binary | openssl base64 -A
```

## Versión autónoma

`npm run empaquetar` genera `dist/mapafiscal.html`: la misma web en un solo archivo, en
modo demo (sin Supabase). Sirve como vista previa pública (el artifact de Claude) y para
abrirla sin servidor. El empaquetador quita el `<script>` de `supabase-js` y fuerza
`demo: true` y `pagosActivos: false` sobre `web/config.js`; `test/empaquetar.test.mjs` lo
comprueba.

## Pagos

Plan Gestor con Stripe Checkout (suscripción semanal, mensual o anual) y portal de cliente
de Stripe para cambiar de periodo, tarjeta o darse de baja. La web solo llama a las Edge
Functions (`crear-checkout`, `portal-facturacion`) con la sesión del gestor; el plan de la
cuenta lo cambia únicamente el webhook de Stripe. Al volver del pago (`#gestor?pago=ok`),
la web consulta el perfil cada 2 s hasta que el webhook activa el plan (máximo 30 s).
Detalle y puesta en marcha: `supabase/README.md`, sección *Cobros (Stripe)*.

«Mis clientes» es exclusivo del plan de pago (decisión de 2026-09-26; ya no hay plan
gratuito con 3 clientes). Lo impone la RLS de `clientes`; la web lo refleja: sin plan, la
pestaña sale atenuada con un candado y la vista muestra una cartera de ejemplo difuminada
con «Se desbloquea con el plan Gestor» y el enlace a *Planes*; «Guardar como cliente» lleva
a esa misma vista. Tras una baja, los clientes quedan ocultos y el gestor puede borrarlos.

## La API R (plumber) y el dashboard Shiny

Siguen disponibles (`inst/plumber/`, `inst/shiny/`) para usos internos: microsimulación
de reformas sobre la muestra sintética y métricas distributivas, que no forman parte de
la web pública.

## Pendiente antes de abrir al público

1. Cobros configurados y probados en modo test (2026-09-26); faltan precios definitivos
   (ahora 19,99 €/semana para la campaña de la renta, 39,99 €/mes y 290 €/año, IVA
   incluido, provisionales); productos y webhook en modo live.
2. URL pública: GitHub Pages (`https://alexgalindoeu.github.io/MAPAFISCAL/`); configurarla
   en Supabase Auth.
3. SMTP propio para los correos de acceso (el de Supabase tiene un límite bajo).
4. Textos legales: aviso legal, privacidad y condiciones del servicio de pago.
5. Completar las deducciones pendientes (ver `docs/02_cobertura.md`).
