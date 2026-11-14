// Precio en pesos = precio en dólares x dólar vendedor (billete) del Banco Nación.
// Variables de entorno en Netlify (todas opcionales):
//   PRECIO_USD       precio de cada perfume en dólares (por defecto 140)
//   REDONDEO_ARS     redondea el precio en pesos hacia arriba a este múltiplo (por defecto 100)
//   DOLAR_RESPALDO   cotización a usar si no se puede leer la del BNA
//   PRECIO_ARS       si lo cargás, se usa este precio fijo en pesos y se ignora el dólar

let cache = null;
const VIGENCIA = 15 * 60 * 1000; // vuelve a consultar el BNA cada 15 minutos

const numero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const razonable = (v) => Number.isFinite(v) && v > 100 && v < 100000;

async function dolarBNA() {
  const r = await fetch('https://www.bna.com.ar/Personas', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GildenBot/1.0)' },
    signal: AbortSignal.timeout(6000)
  });
  if (!r.ok) throw new Error(`BNA ${r.status}`);
  const html = await r.text();
  // La primera tabla es "Billetes": Dolar U.S.A | compra | venta
  const m = html.match(/Dolar U\.S\.A\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/i);
  const venta = m && numero(m[2]);
  if (!razonable(venta)) throw new Error('BNA sin cotización');
  return { venta, fuente: 'BNA' };
}

async function dolarRespaldoApi() {
  const r = await fetch('https://dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`dolarapi ${r.status}`);
  const d = await r.json();
  if (!razonable(Number(d.venta))) throw new Error('dolarapi sin cotización');
  return { venta: Number(d.venta), fuente: 'oficial' };
}

export async function cotizacionDolar() {
  if (cache && Date.now() - cache.t < VIGENCIA) return cache;
  let c = null;
  for (const intento of [dolarBNA, dolarRespaldoApi]) {
    try { c = await intento(); break; } catch (e) { console.error('Cotización', e.message); }
  }
  if (!c && razonable(Number(process.env.DOLAR_RESPALDO))) c = { venta: Number(process.env.DOLAR_RESPALDO), fuente: 'respaldo' };
  if (!c && cache) return cache; // última cotización conocida
  if (!c) return null;
  cache = { ...c, t: Date.now() };
  return cache;
}

// Devuelve { precio, usd, dolar, fuente } o null si no hay cotización.
export async function precioActual() {
  const fijo = Number(process.env.PRECIO_ARS || 0);
  const usd = Number(process.env.PRECIO_USD || 140);
  if (fijo > 0) return { precio: fijo, usd, dolar: null, fuente: 'fijo' };
  const c = await cotizacionDolar();
  if (!c) return null;
  const paso = Math.max(1, Number(process.env.REDONDEO_ARS || 100));
  return { precio: Math.ceil((usd * c.venta) / paso) * paso, usd, dolar: c.venta, fuente: c.fuente };
}
