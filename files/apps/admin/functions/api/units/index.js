import { isSafeUrl } from '@5rsuites/blocks';
import { published } from '../../lib/content.js';
import { HttpError, cleanString, json, readJson } from '../../lib/http.js';

export function cleanUnit(body) {
  const num = (v, label, { min = 0, max = 50, step = 1 } = {}) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n < min || n > max || Math.round(n / step) * step !== n) {
      throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
    }
    return n;
  };
  const bookingUrl = cleanString(body.booking_url, { max: 500, label: 'Booking link' });
  if (!isSafeUrl(bookingUrl)) throw new HttpError(400, 'Booking link must start with https://');
  const imageId = body.image_id == null || body.image_id === '' ? null : Number(body.image_id);
  if (imageId !== null && !Number.isInteger(imageId)) throw new HttpError(400, 'Invalid image.');
  return {
    name: cleanString(body.name, { max: 120, required: true, label: 'Name' }),
    city: cleanString(body.city, { max: 80, label: 'City' }),
    neighborhood: cleanString(body.neighborhood, { max: 80, label: 'Neighborhood' }),
    bedrooms: num(body.bedrooms, 'Bedrooms', { max: 20 }),
    bathrooms: num(body.bathrooms, 'Bathrooms', { max: 20, step: 0.5 }),
    sleeps: num(body.sleeps, 'Sleeps', { min: 1, max: 40 }),
    description: cleanString(body.description, { max: 2000, label: 'Description' }),
    image_id: imageId,
    booking_url: bookingUrl,
    is_active: body.is_active === false || body.is_active === 0 ? 0 : 1,
    position: num(body.position, 'Sort order', { min: -1000, max: 1000 }),
  };
}

const COLUMNS = ['name', 'city', 'neighborhood', 'bedrooms', 'bathrooms', 'sleeps', 'description', 'image_id', 'booking_url', 'is_active', 'position'];

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT u.*, m.r2_key AS image_key FROM units u LEFT JOIN media m ON m.id = u.image_id ORDER BY u.position, u.name`,
  ).all();
  return json({ units: results });
}

export async function onRequestPost({ request, env }) {
  const u = cleanUnit(await readJson(request));
  const row = await env.DB.prepare(
    `INSERT INTO units (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')}) RETURNING *`,
  )
    .bind(...COLUMNS.map((c) => u[c]))
    .first();
  return published(env, ['units'], { unit: row }, { status: 201 });
}

export { COLUMNS };
