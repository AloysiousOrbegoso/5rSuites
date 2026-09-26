import { env } from 'cloudflare:workers';

// Called by the admin after every content save. Authorized with a shared secret.
export async function POST({ request }) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.PURGE_SECRET || !(await safeEqual(auth, `Bearer ${env.PURGE_SECRET}`))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tags;
  try {
    ({ tags } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(tags) || !tags.length || !tags.every((t) => typeof t === 'string' && /^[a-z0-9-]{1,64}$/.test(t))) {
    return Response.json({ error: 'Invalid tags' }, { status: 400 });
  }

  const { cache } = await import('cloudflare:workers');
  if (typeof cache?.purge !== 'function') {
    // Local dev (no edge cache) — nothing to purge.
    return Response.json({ ok: true, purged: [], note: 'No edge cache in this environment.' });
  }
  await cache.purge({ tags });
  return Response.json({ ok: true, purged: tags });
}

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
