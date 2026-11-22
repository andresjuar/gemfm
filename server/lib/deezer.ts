// Deezer's public API: no key, no login. Used for artist photos, 30-second
// previews, fan counts and "related artists" (the emerging-artist radar).
// Deezer sends no CORS headers, so the browser can't call it directly.

const BASE = 'https://api.deezer.com';

export interface DeezerArtist {
  id: number;
  name: string;
  link: string;
  picture_big?: string;
  picture_xl?: string;
  nb_fan?: number;
  nb_album?: number;
}

export interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  link: string;
}

async function get<T>(pathname: string): Promise<T> {
  const res = await fetch(BASE + pathname, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Deezer ${res.status} for ${pathname}`);
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    throw new Error(`Deezer: ${body.error.message ?? 'error'}`);
  }
  return body;
}

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function searchArtists(q: string, limit = 5) {
  const r = await get<{ data: DeezerArtist[] }>(`/search/artist?q=${encodeURIComponent(q)}&limit=${limit}`);
  return r.data ?? [];
}

/** The Deezer artist whose name matches exactly (ignoring case and accents), or null. */
export async function findArtistByName(name: string) {
  const want = normalize(name);
  const hits = await searchArtists(name, 10);
  return hits.find((a) => normalize(a.name) === want) ?? null;
}

export const getArtist = (id: number) => get<DeezerArtist>(`/artist/${id}`);

export async function relatedArtists(id: number, limit = 25) {
  const r = await get<{ data: DeezerArtist[] }>(`/artist/${id}/related?limit=${limit}`);
  return r.data ?? [];
}

export async function topTrack(id: number) {
  const r = await get<{ data: DeezerTrack[] }>(`/artist/${id}/top?limit=5`);
  return (r.data ?? []).find((t) => t.preview) ?? null;
}

export const pictureOf = (a: DeezerArtist) => a.picture_xl || a.picture_big || '';
