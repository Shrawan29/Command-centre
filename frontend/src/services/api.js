import { getSession } from './session.js';

const DEFAULT_BASE_URL = 'http://localhost:5000';

function getBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

async function readError(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null);
    const message = data?.message || data?.error || res.statusText;
    return { message, data };
  }

  const text = await res.text().catch(() => '');
  return { message: text || res.statusText, data: null };
}

export async function apiRequest(path, { method = 'GET', body, userId, signal } = {}) {
  const session = getSession();
  const headerUserId = userId || session?.userId;

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headerUserId ? { userId: headerUserId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const { message, data } = await readError(res);
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}
