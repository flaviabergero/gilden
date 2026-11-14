// Mercado Pago llama acá cuando cambia un pago hecho en su pantalla (opción "Mercado Pago").
// No se confía en lo que llega: se consulta el pago directo a Mercado Pago con tu Access Token.
// Si está aprobado, te llega un email "PAGADO" con el mismo número de pedido.
import { avisar } from '../lib/aviso.mjs';

const ok = () => new Response('ok', { status: 200 });
const pesos = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');

export default async (req) => {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return ok();
  const u = new URL(req.url);
  let body = {};
  try { body = await req.json(); } catch {}
  const tipo = body.type || body.topic || u.searchParams.get('type') || u.searchParams.get('topic');
  const id = (body.data && body.data.id) || u.searchParams.get('data.id') || u.searchParams.get('id');
  if (tipo !== 'payment' || !/^\d+$/.test(String(id || ''))) return ok();

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null);
  if (!r || !r.ok) return ok();
  const pago = await r.json();
  if (pago.status !== 'approved') return ok();

  const ref = String(pago.external_reference || '');
  const items = (pago.additional_info && pago.additional_info.items) || [];
  const quien = [pago.payer?.first_name, pago.payer?.last_name].filter(Boolean).join(' ');
  await avisar({
    subject: `✅ PAGADO · Pedido ${ref || id}`,
    estado: `✅ PAGADO por Mercado Pago (pago n.º ${id})`,
    ref,
    nombre: quien,
    email: pago.payer?.email || '',
    detalle: items.map((i) => `${i.title} x${i.quantity}`).join(', ') || pago.description || '',
    total: pesos(pago.transaction_amount),
    notas: 'Los datos de envío están en el email anterior con este mismo número de pedido.'
  });
  return ok();
};

export const config = { path: '/api/mp-aviso' };
