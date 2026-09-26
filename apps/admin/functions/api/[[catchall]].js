import { errorResponse } from '../lib/http.js';

// Unknown /api paths get a JSON 404 instead of falling through to the SPA's index.html.
export function onRequest() {
  return errorResponse(404, 'Not found.');
}
