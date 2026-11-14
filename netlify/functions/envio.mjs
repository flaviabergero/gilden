// GET /api/envio?cp=5900&cant=2  ->  costo del envío a domicilio
import { cotizar, normalizarCP } from '../lib/envio.mjs';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const u = new URL(req.url);
  const cp = normalizarCP(u.searchParams.get('cp'));
  const cant = Math.min(10, Math.max(1, parseInt(u.searchParams.get('cant'), 10) || 1));
  if (!cp) return json({ ok: false, error: 'cp' }, 400);
  const c = await cotizar(cp, cant);
  if (!c) return json({ ok: false, coordinar: true });
  return json({ ok: true, cp, precio: c.precio, min: c.min, max: c.max, nombre: c.nombre });
};

export const config = { path: '/api/envio' };
