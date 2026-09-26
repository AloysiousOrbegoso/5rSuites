// Small helpers shared by every API route.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(status, message) {
  return json({ error: message }, { status });
}

export async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected a JSON body.');
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

export function intParam(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}.`);
  return n;
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export function requireOwner(user) {
  if (user?.role !== 'owner') throw new HttpError(403, 'Only the owner can do that.');
}

export function cleanString(value, { max = 200, required = false, label = 'Value' } = {}) {
  const v = value == null ? '' : String(value).trim();
  if (required && !v) throw new HttpError(400, `${label} is required.`);
  if (v.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return v;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
// Paths the public site uses for its own routes; pages can't take these slugs.
export const RESERVED_SLUGS = new Set(['api', 'media', 'sitemap.xml', 'robots.txt', '_astro', '_internal', 'admin']);

export function cleanSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
    throw new HttpError(400, 'Slug must be lowercase letters, numbers and hyphens (and not a reserved word).');
  }
  return slug;
}
