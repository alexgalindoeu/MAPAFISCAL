# Política de privacidad

> **BORRADOR — no publicar sin revisar.** Redacción de partida preparada con ayuda de una IA;
> la versión final es responsabilidad del titular o de un profesional. Rellena los huecos
> `[…]`, comprueba los `[VERIFICAR …]` y borra este recuadro.

*Última actualización: [FECHA]*

## 1. Responsable del tratamiento

- **Responsable:** [NOMBRE Y APELLIDOS / RAZÓN SOCIAL], NIF [NIF]
- **Domicilio:** [DOMICILIO]
- **Contacto para protección de datos:** [CORREO]

Esta política explica qué datos personales trata Mapafiscal, para qué, durante cuánto tiempo
y qué derechos tienes, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica
3/2018 (LOPDGDD).

## 2. Resumen

- **La calculadora no envía tus datos a ningún servidor.** El cálculo se hace en tu navegador
  y no hace falta cuenta.
- Si creas una cuenta, guardamos tu correo, tu nombre y tu despacho (opcionales) y el estado
  de tu plan. Los datos se alojan en la Unión Europea (París).
- Los pagos los procesa Stripe: **nunca vemos ni guardamos los datos de tu tarjeta**.
- Si eres gestor y guardas clientes, **tú decides sobre esos datos**. Mapafiscal los trata
  por cuenta tuya como encargado del tratamiento (ver las
  [condiciones del plan Gestor](condiciones_plan_gestor.md), anexo).
- Puedes borrar tu cuenta y todos tus datos cuando quieras desde *Perfil*.

## 3. Qué datos tratamos, para qué y con qué base legal

### 3.1 Uso de la calculadora (sin cuenta)

Los datos que introduces en la calculadora (ingresos, situación familiar, gastos…) se procesan
**solo en tu navegador** y no se envían a Mapafiscal. Para servir la web, el proveedor de
alojamiento y los servicios de fuentes y de librerías (apartado 5) reciben técnicamente tu
dirección IP y los datos de tu navegador.

- **Finalidad:** mostrarte la web.
- **Base legal:** interés legítimo en ofrecer una web funcional y segura (art. 6.1.f RGPD).

### 3.2 Cuenta de usuario

Al iniciar sesión por primera vez, con un enlace en tu correo o con tu cuenta de Google, se
crea tu cuenta. Tratamos:

- tu correo electrónico;
- el método de acceso;
- las fechas de alta y de último acceso;
- el nombre y el despacho que indiques en *Perfil*, si los indicas.

Si entras con Google, Google nos facilita tu nombre, tu correo, tu identificador de Google y
la dirección de tu foto de perfil (no la usamos); tu contraseña de Google nunca nos llega.

- **Finalidad:** darte acceso a tu cuenta y a los servicios contratados, y enviarte los
  correos de acceso.
- **Base legal:** ejecución del contrato o de medidas precontractuales a petición tuya
  (art. 6.1.b RGPD).
- **Conservación:** mientras mantengas la cuenta. Cuando la borras desde *Perfil*, se
  suprimen en el acto la cuenta, el perfil y los clientes guardados.
  [VERIFICAR: plazo de las copias de seguridad del proveedor de base de datos.]

### 3.3 Suscripción y pagos (plan Gestor)

Los pagos se hacen en páginas de **Stripe**. Stripe recoge y trata los datos de tu tarjeta o
de tu medio de pago, y los datos de facturación que indiques (nombre, dirección y NIF). En
Mapafiscal guardamos solo:

- los identificadores de cliente y de suscripción de Stripe;
- el plan, el periodo de facturación y el estado de la suscripción;
- las fechas de renovación o de fin.

- **Finalidades:** cobrar la suscripción, darte acceso al plan y emitir y conservar las
  facturas.
- **Bases legales:** ejecución del contrato (art. 6.1.b) y cumplimiento de obligaciones
  legales fiscales y mercantiles (art. 6.1.c).
- **Conservación:** los datos de la suscripción, mientras exista la cuenta. Las facturas y sus
  datos, durante los plazos legales: [PLAZO — p. ej. 6 años, art. 30 del Código de Comercio;
  4 años de prescripción tributaria, art. 66 de la Ley General Tributaria]. Por eso, si borras
  tu cuenta y tenías facturas, Stripe conserva tu ficha de cliente marcada como cuenta borrada.

### 3.4 Clientes guardados en «Mis clientes» (plan Gestor)

Si eres gestor, puedes guardar la situación fiscal de tus clientes:

- un alias que eliges tú (no pedimos nombre, NIF ni datos de contacto);
- las cifras de la declaración;
- tus notas;
- el resultado calculado.

**Respecto de estos datos, el responsable del tratamiento eres tú**, y Mapafiscal actúa como
encargado del tratamiento (art. 28 RGPD) en los términos del anexo de las
[condiciones del plan Gestor](condiciones_plan_gestor.md). Te recomendamos usar alias que no
identifiquen al cliente y no escribir en las notas datos que no necesites.

[VERIFICAR con un profesional: el formulario admite el grado de discapacidad, que es un dato
de salud (categoría especial, art. 9 RGPD). Valorar si hay que advertirlo expresamente o
limitar ese campo en los clientes guardados.]

Tras una baja, los clientes guardados quedan ocultos y reaparecen si vuelves a suscribirte.
Puedes borrarlos cuando quieras. [PLAZO — decidir un plazo máximo tras el que se borran,
p. ej. 12 meses desde el fin de la suscripción.]

### 3.5 Lista de espera y contacto

Si te apuntas para que te avisemos (por ejemplo, del plan Despacho), guardamos tu correo y el
plan que te interesa.

- **Base legal:** tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento
  escribiendo a [CORREO].
- **Conservación:** hasta que te avisemos, retires el consentimiento o borres tu cuenta.

Si nos escribes, usamos tus datos para responderte (art. 6.1.b o 6.1.f RGPD) y los
conservamos mientras dure la consulta. [PLAZO]

## 4. Almacenamiento en tu navegador (cookies y similares)

Mapafiscal **no usa cookies de analítica ni de publicidad**. Guarda en el almacenamiento local
de tu navegador (`localStorage`) solo lo necesario para el servicio que pides:

| Clave | Para qué | Duración |
|---|---|---|
| `sb-…-auth-token` | mantener tu sesión iniciada | hasta que cierras sesión o caduca |
| `mapafiscal.trasAcceso` | saber a qué pantalla volver después de iniciar sesión | se borra al volver |
| `mapafiscal.pagoPendiente` | seguir al pago del plan que elegiste después de iniciar sesión | se borra al volver (máx. 2 horas) |

Al ser estrictamente necesarios, no requieren consentimiento (art. 22.2 LSSI-CE). Las páginas
de pago y del portal de facturación son de Stripe y usan sus propias cookies (ver su política).

## 5. Destinatarios y proveedores

No vendemos tus datos ni los cedemos a terceros, salvo por obligación legal. Nos apoyamos en
estos proveedores:

| Proveedor | Servicio | Ubicación y garantías |
|---|---|---|
| Supabase, Inc. | base de datos, cuentas y funciones del servidor | datos en la UE (París, `eu-west-3`). [VERIFICAR: entidad y acuerdo de encargo (DPA), y garantía para posibles accesos desde EE. UU.: cláusulas contractuales tipo o Marco de Privacidad de Datos UE-EE. UU.] |
| Stripe Payments Europe, Ltd. | pagos, facturas y portal de facturación | Irlanda. [VERIFICAR: en qué tratamientos actúa Stripe como encargado y en cuáles como responsable independiente, p. ej. la prevención del fraude] |
| Google Ireland Limited | acceso con Google y fuentes tipográficas (Google Fonts) | UE / EE. UU. [VERIFICAR garantías; ver la nota sobre alojar las fuentes en la propia web] |
| GitHub, Inc. (GitHub Pages) | alojamiento de la web | EE. UU. [VERIFICAR garantías] |
| jsDelivr | distribución de la librería `supabase-js` | red global. [VERIFICAR, o alojar la librería en la propia web] |

## 6. Transferencias internacionales

Los datos de las cuentas y de los clientes guardados se alojan en la Unión Europea. Si algún
proveedor accede a ellos desde fuera del Espacio Económico Europeo, lo hace con las garantías
del capítulo V del RGPD (decisión de adecuación o cláusulas contractuales tipo). [VERIFICAR
cada proveedor.]

## 7. Tus derechos

Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del
tratamiento y portabilidad, y retirar tu consentimiento cuando sea la base del tratamiento:

- **desde *Perfil*:** cambiar tu nombre y tu despacho, borrar tus clientes y borrar tu cuenta;
- **por correo:** a [CORREO], indicando qué derecho ejerces, desde el correo de tu cuenta.

Te responderemos en el plazo de un mes. Si crees que no hemos atendido bien tu solicitud,
puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).

## 8. Seguridad

Todas las comunicaciones van cifradas (HTTPS). Cada cuenta solo puede leer sus propios datos:
lo imponen las políticas de seguridad de la base de datos, no solo la web. Los accesos no
usan contraseñas: se entra con un enlace de un solo uso o con Google.

## 9. Menores

Mapafiscal no está dirigido a menores de 14 años. El plan Gestor es un servicio para
profesionales mayores de edad.

## 10. Cambios

Si cambiamos esta política, publicaremos la nueva versión con su fecha. Si el cambio es
importante y tienes cuenta, te avisaremos por correo.
