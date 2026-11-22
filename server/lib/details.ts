// Fills in an artist's genre, language and hometown automatically.
// - Genre: Deezer album genres of their most-played songs.
// - Language: guessed from the words in their song and album titles.
// - Hometown: MusicBrainz (free, but slow and sometimes busy), best effort.
import { albumGenres, normalize, topTracks } from './deezer';

export interface ArtistDetails {
  genre: string;
  language: string;
  city: string;
}

// ---------- Genre (Deezer) ----------
const IGNORED_GENRES = new Set(['All', 'Films/Games', 'Kids']);

export async function deezerDetails(deezerId: number): Promise<{ genre: string; language: string }> {
  const tracks = await topTracks(deezerId, 10).catch(() => []);
  const albumIds = [...new Set(tracks.map((t) => t.album?.id).filter(Boolean))].slice(0, 3);
  const genreLists = await Promise.all(albumIds.map((id) => albumGenres(id).catch(() => [])));
  // Most frequent genres across their albums, keeping Deezer's order on ties.
  const score = new Map<string, number>();
  genreLists.flat().forEach((g, i) => {
    if (!IGNORED_GENRES.has(g)) score.set(g, (score.get(g) ?? 0) + 100 - i);
  });
  const genre = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g).join(' / ');
  const titles = tracks.flatMap((t) => [t.title, t.album?.title ?? '']);
  return { genre, language: detectLanguage(titles) };
}

// ---------- Language (from titles) ----------
const MARKERS: Record<string, string[]> = {
  Spanish: ['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'mi', 'mis', 'tu', 'tus', 'te', 'me', 'se', 'un', 'una', 'por', 'para',
    'con', 'sin', 'como', 'mas', 'yo', 'eres', 'soy', 'quiero', 'siempre', 'nunca', 'noche', 'vida', 'amor', 'corazon', 'cuando', 'donde',
    'todo', 'nada', 'otra', 'vez', 'ya', 'hoy', 'aqui', 'esta', 'estoy', 'contigo', 'sola', 'solo', 'dia', 'cielo', 'mundo', 'nos', 'lo', 'al'],
  English: ['the', 'you', 'your', 'my', 'me', 'i', 'im', 'and', 'of', 'in', 'to', 'it', 'is', 'on', 'all', 'we', 'be', 'dont', 'love',
    'night', 'baby', 'with', 'for', 'this', 'that', 'what', 'just', 'like', 'never', 'feel', 'heart', 'time', 'way', 'go', 'back', 'out'],
  Portuguese: ['nao', 'voce', 'eu', 'meu', 'minha', 'com', 'pra', 'uma', 'saudade', 'coracao', 'tudo', 'mais', 'ela', 'ele', 'sem', 'nos', 'do', 'da'],
  French: ['le', 'les', 'je', 'pas', 'mon', 'ma', 'toi', 'moi', 'est', 'cest', 'et', 'des', 'du', 'pour', 'avec', 'amour', 'nuit', 'sur', 'qui'],
};

export function detectLanguage(texts: string[]): string {
  const raw = texts.join(' ').toLowerCase();
  const words = normalize(raw.replace(/['’]/g, '')).split(' ').filter(Boolean);
  if (words.length < 2) return '';
  const scores = Object.entries(MARKERS).map(([lang, list]) => {
    const set = new Set(list);
    let s = words.filter((w) => set.has(w)).length;
    if (lang === 'Spanish') s += (raw.match(/[ñ¿¡]/g)?.length ?? 0) * 2 + (raw.match(/[áíóú]/g)?.length ?? 0);
    if (lang === 'Portuguese') s += (raw.match(/[ãõç]|ção|ões/g)?.length ?? 0) * 2;
    if (lang === 'French') s += (raw.match(/[èêàç]|ç|œ/g)?.length ?? 0);
    return { lang, s };
  }).sort((a, b) => b.s - a.s);
  const [best, second] = scores;
  // Needs a few hits and a clear lead (or two hits and no competition); otherwise we don't guess.
  const clear = (best.s >= 3 && best.s >= second.s * 1.5) || (best.s >= 2 && second.s === 0);
  return clear ? best.lang : '';
}

// ---------- Hometown (MusicBrainz, best effort) ----------
const MB = 'https://musicbrainz.org/ws/2';
const USER_AGENT = `gemfm-mvp/2.0 (${process.env.MUSICBRAINZ_CONTACT || 'student project'})`;
let lastCall = 0;

async function mbGet<T>(pathname: string): Promise<T | null> {
  // MusicBrainz allows about one request per second.
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const res = await fetch(MB + pathname, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as T & { error?: string };
    return body.error ? null : body; // "server is busy": give up quietly
  } catch {
    return null;
  }
}

interface MbArtist {
  name: string;
  score: number;
  country?: string;
  area?: { name: string; type?: string };
  'begin-area'?: { name: string };
}

const regionName = (code?: string) => {
  try { return code ? new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? '' : ''; } catch { return ''; }
};

/** "Guadalajara, Mexico", "Mexico", or '' when MusicBrainz doesn't know (or is busy). */
export async function musicBrainzHometown(name: string): Promise<string> {
  const q = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
  const r = await mbGet<{ artists?: MbArtist[] }>(`/artist?query=${q}&fmt=json&limit=5`);
  const want = normalize(name);
  const exact = (r?.artists ?? []).filter((a) => a.score >= 90 && normalize(a.name) === want);
  // Several artists with this exact name: we can't tell which one, so don't guess.
  if (exact.length !== 1) return '';
  const a = exact[0];
  // "begin-area" is where they started; "country"/"area" is where they're based now and may be
  // a different country (an artist from Bucaramanga living in Mexico), so never mix the two.
  if (a['begin-area']?.name) return a['begin-area'].name;
  const country = regionName(a.country) || (a.area?.type === 'Country' ? a.area.name : '');
  const city = a.area && a.area.type !== 'Country' ? a.area.name : '';
  return [city, country].filter((x, i, all) => x && all.indexOf(x) === i).join(', ');
}

/** Everything we can find, for the fields that are still empty. */
export async function findDetails(a: { name: string; deezerId: number | null; need?: Partial<Record<keyof ArtistDetails, boolean>> }): Promise<ArtistDetails> {
  const need = { genre: true, language: true, city: true, ...a.need };
  const dz = a.deezerId && (need.genre || need.language) ? await deezerDetails(a.deezerId) : { genre: '', language: '' };
  const city = need.city ? await musicBrainzHometown(a.name) : '';
  return { genre: dz.genre, language: dz.language, city };
}

/** Runs fn over items with at most `limit` running at once; results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}
