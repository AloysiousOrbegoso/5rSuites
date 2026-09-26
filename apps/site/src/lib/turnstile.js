// Server-side Cloudflare Turnstile verification. Fails closed: no secret, no submission.
export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not set');
    return false;
  }
  if (!token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const out = await res.json();
    return out.success === true;
  } catch (err) {
    console.error('[turnstile] verify failed', err);
    return false;
  }
}
