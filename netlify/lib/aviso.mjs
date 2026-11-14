// Manda un aviso por email usando el mismo formulario "pedido" de Netlify Forms
// (te llega igual que los pedidos, a gildenprofumi@gmail.com).
export async function avisar(campos) {
  const sitio = process.env.URL;
  if (!sitio) return false;
  const p = new URLSearchParams({ 'form-name': 'pedido', ...campos });
  try {
    const r = await fetch(`${sitio}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString(),
      signal: AbortSignal.timeout(8000)
    });
    return r.ok;
  } catch (e) {
    console.error('Aviso', e.message);
    return false;
  }
}
