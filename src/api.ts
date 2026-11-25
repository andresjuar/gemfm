import { t } from './i18n';

// Small fetch wrapper for the gem.fm API. The session lives in an httpOnly
// cookie that the browser sends on its own (same origin).

const store = {
  get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode */ }
  },
};

export const session = {
  get adminKey() { return store.get('gemfm:admin-key') || ''; },
  setAdminKey(key: string) { store.set('gemfm:admin-key', key || null); },
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(session.adminKey ? { 'x-admin-key': session.adminKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, t(data?.error || 'Something went wrong. Try again.'));
  return data as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
