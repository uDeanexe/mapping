// Always prefer same-origin API (relative /api/*).
// - Unified dev / production: UI + API are served from the same host/port.
// - Split dev: Vite dev server proxies `/api` and `/uploads` to the backend.
// You can still override with VITE_API_BASE_URL if you explicitly need it.
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function request(path, options) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...options, headers });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    const msg = data && typeof data === 'object' ? data.error || 'Request gagal' : 'Request gagal';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function apiGet(path) {
  return request(path, { method: 'GET' });
}

export function apiDelete(path) {
  return request(path, { method: 'DELETE' });
}

export function apiPostJson(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function apiPutJson(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function apiPatchJson(path, body) {
  return request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function apiPostForm(path, formData, method = 'POST') {
  return request(path, { method, body: formData });
}

export async function apiDownload(path, filename) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = localStorage.getItem('auth_token');
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    const msg = data && typeof data === 'object' ? data.error || 'Request gagal' : 'Request gagal';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  const blob = await res.blob();
  const urlObject = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = urlObject;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(urlObject);
}
