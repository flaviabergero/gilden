# Gilden · tienda web

Web de Gilden con carrito y pago por Mercado Pago.

**Dirección:** https://gildenprofumi.com (también responde en www.gildenprofumi.com y gildenprofumi.netlify.app).

Formas de pago y precios (en pesos, al dólar vendedor del BNA):
- **Transferencia bancaria**: USD 140. El cliente ve tus datos bancarios y te manda el comprobante por WhatsApp.
- **Mercado Pago** (dinero en cuenta u otros medios): USD 140, en **1 pago**.
- **Tarjeta de crédito o débito**, dentro de la web: USD 160, en **1 pago** o **3 cuotas sin interés**.

Datos de transferencia (variables en Netlify): `TRANSFER_ALIAS`, `TRANSFER_CBU`, `TRANSFER_TITULAR`, `TRANSFER_BANCO`.
Precios en dólares: `PRECIO_USD` (transferencia y Mercado Pago, 140) y `PRECIO_USD_TARJETA` (tarjeta, 160).

Entrega:
- **Envío a domicilio**: gratis a todo el país (Correo Argentino). Para volver a cobrarlo, cargá `ENVIO_GRATIS` = `0` en Netlify y se cotiza con el código postal.
- **Retiro en persona**: sin cargo, se coordina por WhatsApp.

## Qué hay en esta carpeta
- `index.html`: la web completa (italiano / español, carrito incluido).
- `gracias.html`: la página a la que vuelve el cliente después de pagar.
- `dolce-peccato.jpg`, `il-tepore.jpg`: fotos de los perfumes.
- `netlify/functions/pago.mjs`: hace los cobros en Mercado Pago. No tiene claves adentro.
- `netlify/functions/envio.mjs` y `netlify/lib/envio.mjs`: cotizan el envío con Correo Argentino.
- `netlify.toml`: le indica a Netlify dónde están los archivos.

## Puesta en marcha (una sola vez)

1. **Mercado Pago**
   - En tu cuenta, "Costos y Cuotas": activá **3 cuotas sin interés**.
   - En mercadopago.com.ar/developers > "Tus integraciones" > "Crear aplicación" (tipo pagos online / Checkout Pro).
   - En "Credenciales de producción" > "Activar credenciales": elegí el rubro y poné la dirección de tu web (la de Netlify sirve).
   - Copiá la **Public Key** y el **Access Token** (los dos empiezan con `APP_USR-`). El Access Token es privado: no lo compartas con nadie.

2. **GitHub**
   - Creá una cuenta en github.com y un repositorio nuevo, privado, llamado `gilden-web`.
   - "uploading an existing file": arrastrá **todo el contenido** de esta carpeta, incluida la carpeta `netlify`. Confirmá con "Commit changes".

3. **Netlify**
   - Entrá a netlify.com con tu cuenta de GitHub.
   - "Add new project" > "Import an existing project" > GitHub > elegí `gilden-web` > "Deploy". No hace falta completar ningún comando.

4. **Claves y precio** (en Netlify: Project configuration > Environment variables > Add a variable)
   - `MP_ACCESS_TOKEN` = el Access Token de Mercado Pago
   - `MP_PUBLIC_KEY` = la Public Key de Mercado Pago
   - `PRECIO_USD` = precio de cada perfume en dólares (si no lo cargás, usa 140). Se cobra en pesos al **dólar vendedor del Banco Nación** del momento (se consulta bna.com.ar cada 15 minutos), redondeado hacia arriba a $100.
   - `CUOTAS_SIN_INTERES` = `3`
   - Después: Deploys > "Trigger deploy" > "Deploy project".

5. **Envíos con Correo Argentino**
   - Pedí acceso a la **API MiCorreo** de Correo Argentino (desde su web, sección empresas / MiCorreo, o con tu ejecutivo de cuenta). Te dan un usuario y una clave de API y tu número de cliente (customerId).
   - Cargá en Netlify:
     - `CORREO_USUARIO` y `CORREO_CLAVE` = usuario y clave de la API
     - `CORREO_CLIENTE` = tu customerId
     - `CP_ORIGEN` = código postal desde donde despachás
     - `PESO_GRAMOS` = peso de un perfume con su caja, en gramos (si no lo ponés, usa 400)
     - `CAJA_CM` = medidas de la caja en cm: largo,ancho,alto (si no lo ponés, usa 10,8,16)
   - **Mientras no tengas la API**, podés cargar `ENVIO_FIJO_ARS` con un costo fijo y la tienda cobra ese monto. Si no cargás ninguno, el envío figura "a coordinar" y se cobra solo el perfume.
   - Las etiquetas para despachar las generás en tu cuenta de MiCorreo con los datos del pedido que te llega por email.

6. **Pedidos por email**
   - En Netlify: Forms > activá "Form detection" y volvé a publicar (Trigger deploy).
   - En Forms > Form notifications: agregá tu email para el formulario **pedido** (y para **newsletter** si querés).

7. **Dominio**
   - Domain management > "Add a domain": comprá uno nuevo o conectá el que tengas (por ejemplo un .com.ar de nic.ar).

8. **Prueba**
   - Cargá temporalmente `PRECIO_ARS` = `100`, hacé una compra real con tu tarjeta y revisá que te llegue el email del pedido y el pago en Mercado Pago. Después devolvé el dinero desde Mercado Pago y borrá `PRECIO_ARS` para volver al precio con dólar BNA.

## Cómo te llega cada venta
- **Email de Netlify** con el pedido: número (ref), productos, forma de pago, entrega, costo de envío, total, nombre, teléfono y dirección.
- **Mercado Pago** te avisa del pago; la "referencia externa" es el mismo número de pedido.

## Cambiar el precio
- El precio en pesos se actualiza solo con el dólar vendedor del BNA.
- Para cambiar el precio en dólares, editá `PRECIO_USD` en Netlify y hacé "Trigger deploy".
- Si alguna vez querés un precio fijo en pesos, cargá `PRECIO_ARS` (ese valor manda sobre el dólar). Para volver al dólar, borrá `PRECIO_ARS`.
