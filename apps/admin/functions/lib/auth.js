// Password hashing and sessions. Native Web Crypto only — no external auth provider.
//
// Hash format: pbkdf2_sha256$<iterations>$<salt base64>$<hash base64>
// Iterations are stored per hash so they can be raised later without breaking old logins.
// (100,000 is also the current ceiling for PBKDF2 in the Workers runtime.)

export const PBKDF2_ITERATIONS = 100_000;
export const SESSION_COOKIE = '__Host-5r_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const MIN_PASSWORD_LENGTH = 10;

const enc = new TextEncoder();

function toB64(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toB64Url(bytes) {
  return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const hash = await derive(password, fromB64(parts[2]), iterations);
  return timingSafeEqual(hash, fromB64(parts[3]));
}

// A fixed hash to verify against when the email doesn't exist, so response time
// doesn't reveal which emails have accounts.
let dummyHash;
export async function verifyDummy(password) {
  dummyHash ??= await hashPassword('not-a-real-password');
  await verifyPassword(password, dummyHash);
  return false;
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 256) return 'Password is too long.';
  return null;
}

export function randomToken() {
  return toB64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(value) {
  return toB64Url(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

function sqlDate(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function expiresIn(seconds) {
  return sqlDate(new Date(Date.now() + seconds * 1000));
}

// Returns { token, statement }. The statement must be run (alone or in a batch).
export async function newSession(db, userId, request) {
  const token = randomToken();
  const statement = db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
    .bind(
      await sha256(token),
      userId,
      expiresIn(SESSION_TTL_SECONDS),
      request.headers.get('CF-Connecting-IP'),
      (request.headers.get('User-Agent') || '').slice(0, 300),
    );
  return { token, statement };
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

export async function getSessionUser(db, request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, s.id AS session_id
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > datetime('now') AND u.password_hash IS NOT NULL`,
    )
    .bind(await sha256(token))
    .first();
  return row || null;
}
