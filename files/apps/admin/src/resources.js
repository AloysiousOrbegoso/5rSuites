// The admin's whole server API, one object per resource. Views call these instead of
// building URLs and request bodies themselves, so an endpoint change is a one-file edit.
// Every method returns the parsed JSON response (or throws ApiError); see api.js.

import { api } from './api.js';

const send = (method, path, body) => api(path, { method, body });

export const auth = {
  me: () => api('/auth/me'),
  login: (email, password) => send('POST', '/auth/login', { email, password }),
  logout: () => send('POST', '/auth/logout'),
  forgot: (email) => send('POST', '/auth/forgot', { email }),
  tokenInfo: (token) => api(`/auth/token?token=${encodeURIComponent(token)}`),
  reset: (token, password) => send('POST', '/auth/reset', { token, password }),
};

export const account = {
  rename: (name) => send('PATCH', '/account', { name }),
  changePassword: (current, password) => send('POST', '/account/password', { current, password }),
};

export const dashboard = { get: () => api('/dashboard') };

export const analytics = { get: (days) => api(`/analytics?days=${days}`) };

export const pages = {
  list: () => api('/pages'),
  get: (id) => api(`/pages/${id}`),
  create: (body) => send('POST', '/pages', body),
  update: (id, body) => send('PATCH', `/pages/${id}`, body),
  remove: (id) => send('DELETE', `/pages/${id}`),
  revisions: (id) => api(`/pages/${id}/revisions`),
  revision: (id, revisionId) => api(`/pages/${id}/revisions/${revisionId}`),
  restore: (id, revisionId) => send('POST', `/pages/${id}/revisions/${revisionId}/restore`),
};

export const sections = {
  add: (pageId, type, data) => send('POST', `/pages/${pageId}/sections`, { type, data }),
  save: (pageId, id, data) => send('PUT', `/pages/${pageId}/sections/${id}`, { data }),
  remove: (pageId, id) => send('DELETE', `/pages/${pageId}/sections/${id}`),
  reorder: (pageId, order) => send('POST', `/pages/${pageId}/sections/reorder`, { order }),
};

export const media = {
  list: () => api('/media'),
  upload: (form) => api('/media', { method: 'POST', form }),
  setAlt: (id, alt) => send('PATCH', `/media/${id}`, { alt }),
  remove: (id) => send('DELETE', `/media/${id}`),
};

export const faq = {
  list: () => api('/faq'),
  save: (id, body) => (id ? send('PUT', `/faq/${id}`, body) : send('POST', '/faq', body)),
  remove: (id) => send('DELETE', `/faq/${id}`),
  reorder: (order) => send('POST', '/faq/reorder', { order }),
};

export const units = {
  list: () => api('/units'),
  save: (id, body) => (id ? send('PUT', `/units/${id}`, body) : send('POST', '/units', body)),
  remove: (id) => send('DELETE', `/units/${id}`),
};

// `filters` is { type?, status?, page? }; empty values are left out of the query.
const query = (filters) => new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]));

export const submissions = {
  list: (filters) => api(`/submissions?${query(filters)}`),
  get: (id) => api(`/submissions/${id}`),
  setStatus: (id, status) => send('PATCH', `/submissions/${id}`, { status }),
  // Plain links: the browser downloads these itself.
  exportUrl: ({ type, status }) => `/api/submissions/export?${query({ type, status })}`,
  attachmentUrl: (id) => `/api/submissions/${id}/attachment`,
};

export const users = {
  list: () => api('/users'),
  invite: (body) => send('POST', '/users', body),
  remove: (id) => send('DELETE', `/users/${id}`),
};

export const settings = {
  get: () => api('/settings'),
  save: (values) => send('PUT', '/settings', values),
};
