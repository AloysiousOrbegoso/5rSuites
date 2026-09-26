// Serves uploaded images to the admin UI (same files the public site serves at /media/…).
export async function onRequestGet({ env, params }) {
  const key = `media/${(params.path || []).join('/')}`;
  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
