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

## Versión autónoma

`npm run empaquetar` genera `dist/mapafiscal.html`: la misma web en un solo archivo, en
modo demo (sin Supabase). Sirve como vista previa pública (el artifact de Claude) y para
abrirla sin servidor.

## La API R (plumber) y el dashboard Shiny

Siguen disponibles (`inst/plumber/`, `inst/shiny/`) para usos internos: microsimulación
de reformas sobre la muestra sintética y métricas distributivas, que no forman parte de
la web pública.

## Pendiente antes de abrir al público

1. Claves de Stripe y precios definitivos (`supabase/README.md`, `web/config.js`).
2. Dominio y URL pública; configurar esa URL en Supabase Auth.
3. SMTP propio para los correos de acceso (el de Supabase tiene un límite bajo).
4. Textos legales: aviso legal, privacidad y condiciones del servicio de pago.
5. Completar las deducciones pendientes (ver `docs/02_cobertura.md`).
