import { env } from 'cloudflare:workers';

// Public images from R2. Only the media/ prefix is exposed — careers attachments live under
// attachments/ and are only downloadable from the admin.
export async function GET({ params }) {
  const key = `media/${params.key}`;
  if (key.includes('..')) return new Response('Not found', { status: 404 });
  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      // Keys are unique per upload, so files never change.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ETag: obj.httpEtag,
    },
  });
}
