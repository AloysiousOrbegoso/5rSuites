import { HttpError, cleanString, json } from '../../lib/http.js';

// SVG is excluded on purpose: it can carry script and is served from the public domain.
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const MAX_BYTES = 10 * 1024 * 1024;

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, r2_key, filename, content_type, size, width, height, alt, created_at FROM media ORDER BY id DESC',
  ).all();
  return json({ media: results });
}

// multipart/form-data: file, alt, width, height (dimensions measured by the browser).
export async function onRequestPost({ request, env, data }) {
  const form = await request.formData().catch(() => {
    throw new HttpError(400, 'Expected a file upload.');
  });
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'Choose a file to upload.');
  const ext = ALLOWED[file.type];
  if (!ext) throw new HttpError(400, 'Images must be JPEG, PNG, WebP, GIF or AVIF.');
  if (file.size > MAX_BYTES) throw new HttpError(400, 'Images must be 10 MB or smaller.');

  const dim = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
  };
  const key = `media/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const row = await env.DB.prepare(
    `INSERT INTO media (r2_key, filename, content_type, size, width, height, alt, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, r2_key, filename, content_type, size, width, height, alt, created_at`,
  )
    .bind(
      key,
      cleanString(file.name, { max: 200 }) || `upload.${ext}`,
      file.type,
      file.size,
      dim(form.get('width')),
      dim(form.get('height')),
      cleanString(form.get('alt'), { max: 300, label: 'Alt text' }),
      data.user.id,
    )
    .first();
  return json({ media: row }, { status: 201 });
}
