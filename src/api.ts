// Small fetch wrapper for the gem.fm API.

const store = {
  get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode */ }
  },
};

let userId: number | null = Number(store.get('gemfm:user')) || null;

export const session = {
  get userId() { return userId; },
  setUser(id: number | null) {
    userId = id;
    store.set('gemfm:user', id ? String(id) : null);
  },
  get adminKey() { return store.get('gemfm:admin-key') || ''; },
  setAdminKey(key: string) { store.set('gemfm:admin-key', key || null); },
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(userId ? { 'x-user-id': String(userId) } : {}),
      ...(session.adminKey ? { 'x-admin-key': session.adminKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Something went wrong. Try again.');
  return data as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
