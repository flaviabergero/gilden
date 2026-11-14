// Cotización de envíos con Correo Argentino (API MiCorreo).
// Variables de entorno en Netlify:
//   CORREO_USUARIO, CORREO_CLAVE  credenciales de la API MiCorreo (las da Correo Argentino)
//   CORREO_CLIENTE                tu customerId de MiCorreo
//   CP_ORIGEN                     código postal desde donde despachás (ej: 5900)
//   CORREO_ENTORNO                "test" para el entorno de prueba (opcional)
//   PESO_GRAMOS                   peso de cada perfume con su caja (por defecto 400)
//   CAJA_CM                       medidas de la caja: largo,ancho,alto en cm (por defecto 10,8,16)
//   ENVIO_FIJO_ARS                costo fijo de respaldo si la API no responde (opcional)

const BASE = () => process.env.CORREO_ENTORNO === 'test'
  ? 'https://apitest.correoargentino.com.ar/micorreo/v1'
  : 'https://api.correoargentino.com.ar/micorreo/v1';

let cache = null;

export const correoConfigurado = () =>
  !!(process.env.CORREO_USUARIO && process.env.CORREO_CLAVE && process.env.CORREO_CLIENTE && process.env.CP_ORIGEN);

export const normalizarCP = (cp) => {
  const m = String(cp || '').toUpperCase().match(/\d{4}/);
  return m ? m[0] : '';
};

async function token() {
  if (cache && cache.exp > Date.now() + 60000) return cache.token;
  const auth = Buffer.from(`${process.env.CORREO_USUARIO}:${process.env.CORREO_CLAVE}`).toString('base64');
  const r = await fetch(`${BASE()}/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}` } });
  if (!r.ok) throw new Error(`correo token ${r.status}`);
  const d = await r.json();
  const exp = Date.parse(d.expires || '') || Date.now() + 20 * 60000;
  cache = { token: d.token, exp };
  return d.token;
}

// Devuelve { precio, min, max, nombre } del envío a domicilio más barato.
async function cotizarCorreo(cp, cantidad) {
  const peso = Number(process.env.PESO_GRAMOS || 400);
  const [largo, ancho, alto] = String(process.env.CAJA_CM || '10,8,16').split(',').map((n) => Math.max(1, Math.round(Number(n) || 1)));
  const q = Math.max(1, cantidad);
  const r = await fetch(`${BASE()}/rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({
      customerId: String(process.env.CORREO_CLIENTE),
      postalCodeOrigin: normalizarCP(process.env.CP_ORIGEN),
      postalCodeDestination: cp,
      deliveredType: 'D',
      dimensions: { weight: Math.min(25000, peso * q), length: largo, width: ancho, height: Math.min(150, alto * q) }
    })
  });
  if (!r.ok) throw new Error(`correo rates ${r.status}`);
  const d = await r.json();
  const rates = (d.rates || []).filter((x) => x.deliveredType === 'D' && Number(x.price) > 0)
    .sort((a, b) => Number(a.price) - Number(b.price));
  if (!rates.length) throw new Error('correo sin tarifas');
  const t = rates[0];
  return { precio: Math.ceil(Number(t.price)), min: Number(t.deliveryTimeMin) || null, max: Number(t.deliveryTimeMax) || null, nombre: t.productName || 'Correo Argentino' };
}

// Cotiza; si Correo no está configurado o falla, usa el costo fijo (si hay).
// Devuelve null si no hay forma de calcular el envío (se coordina por WhatsApp).
export async function cotizar(cpRaw, cantidad) {
  const cp = normalizarCP(cpRaw);
  const fijo = Number(process.env.ENVIO_FIJO_ARS || 0);
  if (cp && correoConfigurado()) {
    try { return { ...(await cotizarCorreo(cp, cantidad)), fuente: 'correo' }; }
    catch (e) { console.error('Cotización Correo Argentino', e.message); }
  }
  if (fijo > 0) return { precio: fijo, min: null, max: null, nombre: 'Envío', fuente: 'fijo' };
  return null;
}
