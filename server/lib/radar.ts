// Emerging-artist radar.
// Starts from "seed" artists (the ones gem.fm users save most, or names you
// pass in), walks Deezer's related-artists graph two steps out, and keeps the
// artists whose fan count is small. They are stored as status = 'pending' so
// a person approves them on the Artists page before they reach Discover.
import type { Artist, RadarResult } from '../../shared/types';
import type { Db } from '../db';
import { findArtistByName, normalize, pictureOf, relatedArtists, searchArtists, type DeezerArtist } from './deezer';
import { randomColor } from './colors';
import { deezerDetails, mapLimit } from './details';

export interface RadarOptions {
  seeds?: string[];
  minFans?: number;
  maxFans?: number;
  limit?: number;
}

const DEFAULT_SEEDS = (process.env.RADAR_SEEDS || 'Ed Maverick, Silvana Estrada, Girl Ultra, Little Jesus, Kevin Kaarl')
  .split(',').map((s) => s.trim()).filter(Boolean);

interface Seed { deezerId: number; name: string; genre: string }

async function resolveSeeds(db: Db, names?: string[]): Promise<Seed[]> {
  if (names?.length) {
    const found = await Promise.all(names.slice(0, 6).map(async (n) => {
      const hit = (await findArtistByName(n)) ?? (await searchArtists(n, 1))[0];
      return hit ? { deezerId: hit.id, name: hit.name, genre: '' } : null;
    }));
    return found.filter((s): s is Seed => !!s);
  }
  // The artists gem.fm users like most are the best signal of taste.
  const fromDb = await db.query<{ deezer_id: string; name: string; genre: string }>(`
    select a.deezer_id, a.name, a.genre
    from artists a left join swipes s on s.artist_id = a.id and s.liked
    where a.deezer_id is not null and a.status = 'approved'
    group by a.id order by count(s.user_id) desc, random() limit 6`);
  if (fromDb.length >= 3) return fromDb.map((r) => ({ deezerId: Number(r.deezer_id), name: r.name, genre: r.genre }));
  return resolveSeeds(db, DEFAULT_SEEDS);
}

export async function runRadar(db: Db, opts: RadarOptions = {}): Promise<RadarResult> {
  const minFans = opts.minFans ?? 200;
  const maxFans = opts.maxFans ?? 60_000;
  const limit = Math.min(opts.limit ?? 12, 30);

  const seeds = await resolveSeeds(db, opts.seeds);
  if (!seeds.length) return { seeds: [], scanned: 0, added: [] };

  const seen = new Map<number, { artist: DeezerArtist; seed: Seed }>();
  const collect = (list: DeezerArtist[], seed: Seed) => {
    for (const a of list) if (!seen.has(a.id)) seen.set(a.id, { artist: a, seed });
  };

  // Step 1: artists related to each seed.
  const level1 = await Promise.all(seeds.map((s) => relatedArtists(s.deezerId).catch(() => [])));
  level1.forEach((list, i) => collect(list, seeds[i]));

  // Step 2: from the smallest of those, go one step further (smaller artists
  // tend to sit next to other small artists in the graph).
  const nextHop = [...seen.values()]
    .filter(({ artist }) => (artist.nb_fan ?? 0) <= maxFans * 4)
    .sort((a, b) => (a.artist.nb_fan ?? 0) - (b.artist.nb_fan ?? 0))
    .slice(0, 6);
  const level2 = await Promise.all(nextHop.map((n) => relatedArtists(n.artist.id).catch(() => [])));
  level2.forEach((list, i) => collect(list, nextHop[i].seed));

  const existing = await db.query<{ deezer_id: string | null; name: string }>('select deezer_id, name from artists');
  const knownIds = new Set(existing.map((r) => Number(r.deezer_id)).filter(Boolean));
  const knownNames = new Set(existing.map((r) => normalize(r.name)));
  const seedIds = new Set(seeds.map((s) => s.deezerId));

  const picks = [...seen.values()]
    .filter(({ artist: a }) =>
      !seedIds.has(a.id) && !knownIds.has(a.id) && !knownNames.has(normalize(a.name)) &&
      (a.nb_fan ?? 0) >= minFans && (a.nb_fan ?? 0) <= maxFans && (a.nb_album ?? 1) >= 1)
    .sort((a, b) => (b.artist.nb_fan ?? 0) - (a.artist.nb_fan ?? 0))
    .slice(0, limit);

  // Genre and language from Deezer, a few artists at a time (Deezer allows ~50 requests / 5 s).
  const details = await mapLimit(picks, 3, ({ artist }) => deezerDetails(artist.id).catch(() => ({ genre: '', language: '' })));

  const added: Artist[] = [];
  for (const [i, { artist: a, seed }] of picks.entries()) {
    const rows = await db.query<Artist>(
      `insert into artists (name, genre, language, bio, image_url, deezer_id, external_fans, source, status, color)
       values ($1, $2, $3, $4, $5, $6, $7, 'radar', 'pending', $8)
       on conflict (deezer_id) do nothing
       returning *, 0 as saves`,
      [a.name, details[i].genre || seed.genre, details[i].language, `Fans of ${seed.name} also listen to them.`,
        pictureOf(a), a.id, a.nb_fan ?? null, randomColor()],
    );
    added.push(...rows);
  }
  return { seeds: seeds.map((s) => s.name), scanned: seen.size, added };
}
