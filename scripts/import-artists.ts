// Imports real artists from a CSV file (export your sheet as CSV).
//
//   npm run import:artists -- artists.csv
//   npm run import:artists -- artists.csv --replace --demo-gigs
//
// Columns (header row required, any order, English or Spanish names):
//   name/nombre (required), genre/genero, city/ciudad, bio/descripcion,
//   spotify_url/spotify, image_url/imagen, deezer_id
// Each artist is looked up on Deezer by exact name to get a photo, fan count
// and 30-second previews. Existing artists (same name) are updated.
//
// --replace    delete every current artist first (and their gigs, swipes, recs)
// --demo-gigs  create one upcoming gig per imported artist at the existing venues
import { readFile } from 'node:fs/promises';
import { getDb } from '../server/db';
import { randomColor } from '../server/lib/colors';
import { findArtistByName, getArtist, normalize, pictureOf } from '../server/lib/deezer';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npm run import:artists -- path/to/artists.csv [--replace] [--demo-gigs]');
  process.exit(1);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const ALIASES: Record<string, string> = {
  name: 'name', nombre: 'name', artista: 'name', artist: 'name',
  genre: 'genre', genero: 'genre',
  city: 'city', ciudad: 'city',
  bio: 'bio', descripcion: 'bio', description: 'bio',
  spotify_url: 'spotify_url', spotify: 'spotify_url',
  image_url: 'image_url', imagen: 'image_url', image: 'image_url', foto: 'image_url',
  deezer_id: 'deezer_id', deezer: 'deezer_id',
};

const [header, ...lines] = parseCsv((await readFile(file, 'utf8')).replace(/^﻿/, ''));
const cols = header.map((h) => ALIASES[normalize(h).replace(/ /g, '_')] ?? null);
if (!cols.includes('name')) {
  console.error(`No "name" column found. Header was: ${header.join(', ')}`);
  process.exit(1);
}
const records = lines.map((cells) => {
  const r: Record<string, string> = {};
  cols.forEach((k, i) => { if (k) r[k] = (cells[i] ?? '').trim(); });
  return r;
}).filter((r) => r.name);

const db = await getDb();
console.log(`Importing ${records.length} artists into ${db.kind === 'pglite' ? 'local PGlite (.pglite/)' : 'DATABASE_URL (Supabase)'}…`);
if (args.includes('--replace')) {
  await db.exec('truncate artists restart identity cascade');
  console.log('Removed existing artists.');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const imported: number[] = [];
for (const r of records) {
  let dz = null;
  try {
    dz = r.deezer_id ? await getArtist(Number(r.deezer_id)) : await findArtistByName(r.name);
  } catch { /* Deezer unreachable: import without it */ }
  await sleep(150); // stay well under Deezer's rate limit
  const spotify = /^https:\/\/open\.spotify\.com\//.test(r.spotify_url ?? '') ? r.spotify_url : '';
  const values = [r.name, r.genre ?? '', r.city || 'Guadalajara', r.bio ?? '', spotify,
    r.image_url || (dz ? pictureOf(dz) : ''), dz?.id ?? null, dz?.nb_fan ?? null];
  const [existing] = await db.query<{ id: number }>('select id from artists where lower(name) = lower($1)', [r.name]);
  let id: number;
  if (existing) {
    await db.query(`update artists set name = $2, genre = coalesce(nullif($3, ''), genre), city = $4, bio = coalesce(nullif($5, ''), bio),
      spotify_url = coalesce(nullif($6, ''), spotify_url), image_url = coalesce(nullif($7, ''), image_url),
      deezer_id = coalesce($8, deezer_id), external_fans = coalesce($9, external_fans), status = 'approved' where id = $1`,
      [existing.id, ...values]);
    id = existing.id;
  } else {
    const [row] = await db.query<{ id: number }>(`insert into artists
      (name, genre, city, bio, spotify_url, image_url, deezer_id, external_fans, source, status, color)
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'import', 'approved', $9)
      on conflict (deezer_id) do update set name = excluded.name returning id`, [...values, randomColor()]);
    id = row.id;
  }
  imported.push(id);
  console.log(`  ${dz ? '✓' : '·'} ${r.name}${dz ? ` (Deezer: ${dz.nb_fan?.toLocaleString() ?? '?'} fans)` : ' (not found on Deezer, no preview)'}`);
}

if (args.includes('--demo-gigs')) {
  const venues = await db.query<{ id: number }>('select id from venues order by id');
  if (!venues.length) await db.exec(`insert into venues (name, area) values ('Foro Independencia', 'Centro'),
    ('Bar Américas', 'Chapultepec'), ('C3 Stage', 'Zapopan'), ('Casa Loma Café', 'Providencia')`);
  const vs = venues.length ? venues : await db.query<{ id: number }>('select id from venues order by id');
  for (const [i, id] of imported.entries()) {
    await db.query(`insert into gigs (artist_id, venue_id, starts_at, price_mxn)
      values ($1, $2, (date_trunc('day', now() at time zone 'America/Mexico_City') + make_interval(days => $3, hours => $4))
        at time zone 'America/Mexico_City', $5)`,
      [id, vs[i % vs.length].id, 1 + (i % 14), 19 + (i % 4), [0, 100, 150, 200][i % 4]]);
  }
  console.log(`Created ${imported.length} demo gigs over the next two weeks.`);
}

console.log('Done.');
process.exit(0);
