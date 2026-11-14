// Cobros de Gilden con Mercado Pago.
// Variables de entorno que se cargan en Netlify (Project configuration > Environment variables):
//   MP_ACCESS_TOKEN     Access Token de producción (privado, empieza con APP_USR-)
//   MP_PUBLIC_KEY       Public Key de producción (empieza con APP_USR-)
//   PRECIO_USD          Precio por transferencia o Mercado Pago, en dólares (por defecto 140)
//   PRECIO_USD_TARJETA  Precio con tarjeta, en dólares (por defecto 160)
//   TRANSFER_ALIAS, TRANSFER_CBU, TRANSFER_TITULAR, TRANSFER_BANCO  datos para transferencias
//   CUOTAS_SIN_INTERES  Cuotas sin interés que activaste en Mercado Pago (3)
//
// GET  /api/pago  -> precio, cuotas y public key para la web
// POST /api/pago  -> { modo: 'tarjeta', ... }  cobra con la tarjeta (1 pago o 3 cuotas)
//                    { modo: 'mp', ... }       crea el link de Mercado Pago (un solo pago)

import { cotizar } from '../lib/envio.mjs';
import { precioActual } from '../lib/precio.mjs';

const PRODUCTOS = {
  'dolce-peccato': 'Dolce Peccato · Eau de parfum 45 ml',
  'il-tepore': 'Il tepore · Extrait de parfum 45 ml'
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const mp = (path, token, body, extraHeaders = {}) =>
  fetch(`https://api.mercadopago.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extraHeaders },
    body: JSON.stringify(body)
  }).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }));

export default async (req) => {
  const cuotas = Number(process.env.CUOTAS_SIN_INTERES || 3);
  const p = await precioActual();

  if (req.method === 'GET') {
    const e = process.env;
    return json({
      precio: p ? p.contado : 0, precioTarjeta: p ? p.tarjeta : 0,
      usd: p && p.usd, usdTarjeta: p && p.usdTarjeta, dolar: p && p.dolar, fuente: p && p.fuente,
      cuotas, publicKey: e.MP_PUBLIC_KEY || '',
      transferencia: (e.TRANSFER_ALIAS || e.TRANSFER_CBU)
        ? { alias: e.TRANSFER_ALIAS || '', cbu: e.TRANSFER_CBU || '', titular: e.TRANSFER_TITULAR || '', banco: e.TRANSFER_BANCO || '' }
        : null
    });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token || !p) return json({ error: 'config' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'body' }, 400); }
  // Tarjeta: USD 160. Mercado Pago (dinero en cuenta): USD 140.
  const precio = body.modo === 'tarjeta' ? p.tarjeta : p.contado;

  // El precio sale siempre de acá, nunca de lo que manda el navegador.
  const vistos = new Set();
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter((i) => PRODUCTOS[i.id] && !vistos.has(i.id) && vistos.add(i.id))
    .map((i) => ({
      id: i.id,
      title: PRODUCTOS[i.id],
      quantity: Math.min(10, Math.max(1, parseInt(i.qty, 10) || 1)),
      unit_price: precio,
      currency_id: 'ARS'
    }));
  if (!items.length) return json({ error: 'empty' }, 400);

  // Envío: se cotiza de nuevo acá, nunca se confía en el monto que manda el navegador.
  const entrega = body.entrega === 'retiro' ? 'retiro' : 'domicilio';
  let envio = 0;
  let envioTitulo = '';
  if (entrega === 'domicilio') {
    const unidades = items.reduce((s, i) => s + i.quantity, 0);
    const c = await cotizar(body.cp, unidades);
    if (c) { envio = c.precio; envioTitulo = `Envío a domicilio · ${c.nombre}`; }
  }
  const productos = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = productos + envio;
  const conEnvio = envio > 0
    ? [...items, { id: 'envio', title: envioTitulo, quantity: 1, unit_price: envio, currency_id: 'ARS' }]
    : items;
  const ref = String(body.ref || '').slice(0, 40);
  const nombre = String(body.nombre || '').slice(0, 80);
  const email = String(body.email || '').slice(0, 120);

  // Pago con tarjeta dentro de la web: solo 1 pago o 3 cuotas.
  if (body.modo === 'tarjeta') {
    const installments = parseInt(body.installments, 10);
    if (![1, cuotas].includes(installments) || !body.token || !body.payment_method_id) {
      return json({ error: 'datos' }, 400);
    }
    const pago = {
      transaction_amount: total,
      token: String(body.token),
      description: conEnvio.map((i) => `${i.title} x${i.quantity}`).join(', ').slice(0, 250),
      installments,
      payment_method_id: String(body.payment_method_id),
      payer: {
        email,
        first_name: nombre,
        identification: { type: String(body.doc_type || 'DNI'), number: String(body.doc_number || '') }
      },
      external_reference: ref,
      statement_descriptor: 'GILDEN',
      additional_info: { items: conEnvio.map((i) => ({ id: i.id, title: i.title, quantity: i.quantity, unit_price: i.unit_price })) }
    };
    if (body.issuer_id) pago.issuer_id = Number(body.issuer_id);

    const headers = { 'X-Idempotency-Key': `${ref}-${String(body.token).slice(-16)}` };
    if (body.device) headers['X-meli-session-id'] = String(body.device);

    const r = await mp('/v1/payments', token, pago, headers);
    if (!r.ok && !r.data.status) {
      console.error('Mercado Pago pago', r.status, r.data);
      return json({ error: 'mp', detail: r.data.cause?.[0]?.code || 'error' }, 502);
    }
    return json({ status: r.data.status, detail: r.data.status_detail, id: r.data.id, total, envio });
  }

  // Pago en la pantalla de Mercado Pago: un solo pago (dinero en cuenta, débito, etc.).
  const sitio = process.env.URL || new URL(req.url).origin;
  const preferencia = {
    items: conEnvio,
    payer: { name: nombre, email },
    external_reference: ref,
    back_urls: {
      success: `${sitio}/gracias.html?estado=ok`,
      pending: `${sitio}/gracias.html?estado=pendiente`,
      failure: `${sitio}/gracias.html?estado=error`
    },
    auto_return: 'approved',
    payment_methods: { installments: 1 },
    statement_descriptor: 'GILDEN'
  };
  const r = await mp('/checkout/preferences', token, preferencia);
  if (!r.ok || !r.data.init_point) {
    console.error('Mercado Pago preferencia', r.status, r.data);
    return json({ error: 'mp' }, 502);
  }
  return json({ url: r.data.init_point });
};

export const config = { path: '/api/pago' };
