import { ValidationError } from '@5rsuites/blocks';
import { getSessionUser } from '../lib/auth.js';
import { HttpError, errorResponse } from '../lib/http.js';

// Routes reachable without a session.
const PUBLIC_ROUTES = new Set(['/api/auth/login', '/api/auth/forgot', '/api/auth/reset', '/api/auth/token']);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // CSRF: SameSite=Lax already blocks cross-site POSTs carrying the cookie; also require
    // that state-changing requests come from this origin.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return errorResponse(403, 'Cross-origin request blocked.');
    }

    if (!PUBLIC_ROUTES.has(url.pathname)) {
      const user = await getSessionUser(env.DB, request);
      if (!user) return errorResponse(401, 'Please sign in.');
      context.data.user = user;
    }

    return await context.next();
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.message);
    if (err instanceof ValidationError) return errorResponse(400, err.message);
    if (String(err?.message).includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'That value is already in use.');
    }
    console.error('[api]', request.method, url.pathname, err);
    return errorResponse(500, 'Something went wrong. Please try again.');
  }
}
