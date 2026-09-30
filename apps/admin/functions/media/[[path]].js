// Serves uploaded images to the admin UI (same files the public site serves at /media/…).
export async function onRequestGet({ request, env, params }) {
  // "/media" by itself is the Media Library screen of the admin app, not a file: hand it to
  // the app (otherwise reloading that screen showed "Not found").
  if (!params.path || params.path.length === 0) return env.ASSETS.fetch(new URL('/', request.url));
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
