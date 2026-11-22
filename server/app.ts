// gem.fm API (Hono). The same app runs locally (server/dev.ts) and on
// Netlify Functions (netlify/functions/api.ts).
import { Hono, type Context, type Next } from 'hono';
import type {
  Artist, DiscoverArtist, FeedItem, Gig, Person, Preview, Stamp, Stats, Tag, User, Venue,
} from '../shared/types';
import { getDb } from './db';
import { randomColor } from './lib/colors';
import { findArtistByName, pictureOf, topTrack } from './lib/deezer';
import { findPhoto, spotifyThumbnail } from './lib/photos';
import { runRadar } from './lib/radar';

const DAILY_GOAL = 5;
const USER_COLS = 'id, name, handle, color, tags';
// "Today" for the daily challenge, in the city the app is about.
const TZ = process.env.APP_TIMEZONE || 'America/Mexico_City';

type Env = { Variables: { user: User } };
export const app = new Hono<Env>().basePath('/api');

class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404, message: string) { super(message); }
}
function fail(status: 400 | 401 | 403 | 404, message: string): never {
  throw new HttpError(status, message);
}

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong on the server. Try again.' }, 500);
});
app.notFound((c) => c.json({ error: 'Not found.' }, 404));

const toId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fail(400, 'Invalid id.');
};

// Demo auth: the client sends the chosen demo user's id.
async function auth(c: Context<Env>, next: Next) {
  const id = Number(c.req.header('x-user-id'));
  const db = await getDb();
  const [user] = id ? await db.query<User>(`select ${USER_COLS} from users where id = $1`, [id]) : [];
  if (!user) fail(401, 'Pick a demo user first.');
  c.set('user', user);
  await next();
}

// Artist-side writes. Open if ADMIN_KEY isn't set (local dev); otherwise the
// Artists page must send the same key.
async function admin(c: Context<Env>, next: Next) {
  const key = process.env.ADMIN_KEY;
  if (key && c.req.header('x-admin-key') !== key) fail(403, 'Wrong or missing admin key. Enter it at the top of the Artists page.');
  await next();
}

const TODAY = `(created_at at time zone '${TZ}')::date = (now() at time zone '${TZ}')::date`;

async function todayCount(userId: number) {
  const db = await getDb();
  const [r] = await db.query<{ n: number }>(`select count(*)::int n from swipes where user_id = $1 and ${TODAY}`, [userId]);
  return r.n;
}

async function stats(userId: number): Promise<Stats> {
  const db = await getDb();
  const [s] = await db.query<Omit<Stats, 'points' | 'badges'>>(`
    select
      (select count(*)::int from swipes where user_id = $1) swipes,
      (select count(*)::int from swipes where user_id = $1 and liked) saves,
      (select count(*)::int from checkins where user_id = $1) checkins,
      (select count(*)::int from recommendations where user_id = $1) recs,
      (select count(*)::int from (
         select (created_at at time zone '${TZ}')::date from swipes where user_id = $1
         group by 1 having count(*) >= ${DAILY_GOAL}) d) challenges,
      (select count(*)::int from follows where follower_id = $1) following,
      (select count(*)::int from follows where followee_id = $1) followers`, [userId]);
  return {
    ...s,
    // skip +1, save +3, daily challenge +10, recommendation +5, check-in +25
    points: s.swipes + s.saves * 2 + s.checkins * 25 + s.challenges * 10 + s.recs * 5,
    badges: [
      { id: 'first-save', name: 'First save', earned: s.saves >= 1, hint: 'Save an artist' },
      { id: 'daily', name: 'Daily digger', earned: s.challenges >= 1, hint: `Finish a daily challenge (${DAILY_GOAL} artists)` },
      { id: 'front-row', name: 'Front row', earned: s.checkins >= 1, hint: 'Check in at a gig' },
      { id: 'tastemaker', name: 'Tastemaker', earned: s.recs >= 3, hint: 'Share 3 recommendations' },
    ],
  };
}

const ARTIST_SAVES = '(select count(*)::int from swipes s where s.artist_id = a.id and s.liked) saves';
const UPCOMING = "g.starts_at >= now() - interval '6 hours'";

// ---------- Users ----------
app.get('/health', async (c) => {
  const db = await getDb();
  await db.query('select 1');
  return c.json({ ok: true, db: db.kind });
});

app.get('/users', async (c) => {
  const db = await getDb();
  return c.json(await db.query<User>(`select ${USER_COLS} from users order by id`));
});

app.get('/me', auth, async (c) => {
  const user = c.get('user');
  return c.json({ ...user, stats: await stats(user.id), today: await todayCount(user.id), goal: DAILY_GOAL });
});

// ---------- Taste tags ----------
app.get('/tags', async (c) => {
  const db = await getDb();
  return c.json(await db.query<Tag>(`
    select t.slug, t.label, (select count(*)::int from artists a where a.status = 'approved' and t.slug = any(a.tags)) artists
    from tags t order by t.sort`));
});

app.put('/me/tags', auth, async (c) => {
  const { tags } = await c.req.json<{ tags?: unknown }>();
  if (!Array.isArray(tags) || !tags.length) fail(400, 'Pick at least one style you like.');
  const db = await getDb();
  const valid = await db.query<{ slug: string }>('select slug from tags where slug = any($1::text[]) order by sort', [tags]);
  if (!valid.length) fail(400, 'Pick at least one style you like.');
  const [user] = await db.query<User>(`update users set tags = $2::text[] where id = $1 returning ${USER_COLS}`,
    [c.get('user').id, valid.map((t) => t.slug)]);
  return c.json(user);
});

app.get('/users/:id', auth, async (c) => {
  const db = await getDb();
  const me = c.get('user');
  const [user] = await db.query<User>(`select ${USER_COLS} from users where id = $1`, [toId(c.req.param('id'))]);
  if (!user) fail(404, 'User not found.');
  const [stamps, saved, following] = await Promise.all([
    db.query<Stamp>(`
      select c.created_at, a.name artist, a.color, v.name venue,
        (select count(*)::int from checkins c2 join gigs g2 on g2.id = c2.gig_id
          where g2.artist_id = g.artist_id and c2.created_at <= c.created_at) fan_number
      from checkins c join gigs g on g.id = c.gig_id
      join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id
      where c.user_id = $1 order by c.created_at desc`, [user.id]),
    db.query<Artist>(`select a.*, ${ARTIST_SAVES} from swipes sw join artists a on a.id = sw.artist_id
      where sw.user_id = $1 and sw.liked order by sw.created_at desc`, [user.id]),
    db.query('select 1 from follows where follower_id = $1 and followee_id = $2', [me.id, user.id]),
  ]);
  return c.json({ ...user, stats: await stats(user.id), stamps, saved, isFollowing: following.length > 0 });
});

app.get('/people', auth, async (c) => {
  const db = await getDb();
  const q = `%${(c.req.query('q') || '').trim()}%`;
  return c.json(await db.query<Person>(`
    select u.id, u.name, u.handle, u.color, u.tags,
      exists(select 1 from follows f where f.follower_id = $1 and f.followee_id = u.id) following
    from users u where u.id <> $1 and (u.name ilike $2 or u.handle ilike $2) order by u.name`, [c.get('user').id, q]));
});

app.post('/follows/:id', auth, async (c) => {
  const id = toId(c.req.param('id'));
  if (id === c.get('user').id) fail(400, 'You can’t follow yourself.');
  const db = await getDb();
  await db.query('insert into follows (follower_id, followee_id) values ($1, $2) on conflict do nothing', [c.get('user').id, id]);
  return c.json({ ok: true });
});

app.delete('/follows/:id', auth, async (c) => {
  const db = await getDb();
  await db.query('delete from follows where follower_id = $1 and followee_id = $2', [c.get('user').id, toId(c.req.param('id'))]);
  return c.json({ ok: true });
});

// ---------- Discover ----------
app.get('/discover', auth, async (c) => {
  const db = await getDb();
  const user = c.get('user');
  const today = await todayCount(user.id);
  const left = Math.max(0, DAILY_GOAL - today);
  // Artists that share a tag with the user's tastes come first (most shared
  // tags first); the rest fill in so the deck never runs dry.
  const artists = await db.query<DiscoverArtist>(`
    select * from (
      select a.*, ${ARTIST_SAVES},
        (select g.starts_at from gigs g where g.artist_id = a.id and ${UPCOMING} order by g.starts_at limit 1) next_gig,
        array(select t.label from tags t where t.slug = any(a.tags) and t.slug = any($3::text[]) order by t.sort) matched
      from artists a
      where a.status = 'approved' and a.id not in (select artist_id from swipes where user_id = $1)
    ) x
    order by cardinality(matched) desc, random() limit $2`, [user.id, left || 10, user.tags ?? []]);
  return c.json({ artists, today, goal: DAILY_GOAL, bonus: left === 0 });
});

app.post('/swipes', auth, async (c) => {
  const { artistId, liked } = await c.req.json<{ artistId: number; liked: boolean }>();
  const db = await getDb();
  const user = c.get('user');
  const [artist] = await db.query('select 1 from artists where id = $1', [toId(artistId)]);
  if (!artist) fail(404, 'Artist not found.');
  await db.query(`insert into swipes (user_id, artist_id, liked) values ($1, $2, $3)
    on conflict (user_id, artist_id) do update set liked = excluded.liked, created_at = now()`, [user.id, artistId, !!liked]);
  const today = await todayCount(user.id);
  return c.json({ today, goal: DAILY_GOAL, completed: today === DAILY_GOAL, stats: await stats(user.id) });
});

// 30-second preview from Deezer, so cards play music even without a Spotify link.
const previewCache = new Map<number, { at: number; value: Preview | null }>();
app.get('/artists/:id/preview', async (c) => {
  const db = await getDb();
  const [a] = await db.query<{ deezer_id: string | null }>('select deezer_id from artists where id = $1', [toId(c.req.param('id'))]);
  if (!a?.deezer_id) return c.json(null);
  const deezerId = Number(a.deezer_id);
  const hit = previewCache.get(deezerId);
  // Deezer preview links are signed and expire, so don't cache them for long.
  if (hit && Date.now() - hit.at < 10 * 60_000) return c.json(hit.value);
  const t = await topTrack(deezerId).catch(() => null);
  const value = t ? { title: t.title, preview: t.preview, link: t.link } : null;
  previewCache.set(deezerId, { at: Date.now(), value });
  return c.json(value);
});

// ---------- Live ----------
app.get('/gigs', auth, async (c) => {
  const db = await getDb();
  const onlySaved = c.req.query('saved') === '1';
  return c.json(await db.query<Gig>(`
    select * from (
      select g.*, a.name artist, a.genre, a.color, a.image_url, a.spotify_url, v.name venue, v.area,
        exists(select 1 from swipes s where s.user_id = $1 and s.artist_id = a.id and s.liked) saved,
        exists(select 1 from checkins c where c.user_id = $1 and c.gig_id = g.id) checked_in,
        (select count(*)::int from checkins c where c.gig_id = g.id) attendees,
        (select string_agg(u.name, ', ') from checkins c join users u on u.id = c.user_id
          join follows f on f.followee_id = u.id and f.follower_id = $1 where c.gig_id = g.id) friends_there
      from gigs g join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id
      where ${UPCOMING} and a.status = 'approved'
    ) x ${onlySaved ? 'where saved' : ''}
    order by starts_at`, [c.get('user').id]));
});

app.post('/gigs/:id/checkin', auth, async (c) => {
  const db = await getDb();
  const user = c.get('user');
  const [gig] = await db.query<{ id: number; artist_id: number }>('select id, artist_id from gigs where id = $1', [toId(c.req.param('id'))]);
  if (!gig) fail(404, 'Gig not found.');
  await db.query('insert into checkins (user_id, gig_id) values ($1, $2) on conflict do nothing', [user.id, gig.id]);
  // Fan number = position of this check-in among everyone who checked in to any gig of this artist.
  const [{ n }] = await db.query<{ n: number }>(`
    select count(*)::int n from checkins c join gigs g on g.id = c.gig_id
    where g.artist_id = $1 and c.created_at <= (select created_at from checkins where user_id = $2 and gig_id = $3)`,
    [gig.artist_id, user.id, gig.id]);
  return c.json({ fanNumber: n, stats: await stats(user.id) });
});

// ---------- Friends ----------
app.get('/feed', auth, async (c) => {
  const db = await getDb();
  return c.json(await db.query<FeedItem>(`
    with circle as (select followee_id id from follows where follower_id = $1 union select $1::int)
    select * from (
      select 'rec' as type, r.created_at at, u.id user_id, u.name "user", u.color user_color,
        a.id artist_id, a.name artist, a.genre, a.color, a.image_url, a.spotify_url, a.deezer_id, r.note, null::text venue
      from recommendations r join users u on u.id = r.user_id join artists a on a.id = r.artist_id
      where r.user_id in (select id from circle)
      union all
      select 'save', s.created_at, u.id, u.name, u.color, a.id, a.name, a.genre, a.color, a.image_url, a.spotify_url, a.deezer_id, null, null
      from swipes s join users u on u.id = s.user_id join artists a on a.id = s.artist_id
      where s.liked and s.user_id in (select id from circle)
      union all
      select 'checkin', c.created_at, u.id, u.name, u.color, a.id, a.name, a.genre, a.color, a.image_url, a.spotify_url, a.deezer_id, null, v.name
      from checkins c join users u on u.id = c.user_id join gigs g on g.id = c.gig_id
      join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id
      where c.user_id in (select id from circle)
    ) feed order by at desc limit 50`, [c.get('user').id]));
});

app.post('/recommendations', auth, async (c) => {
  const { artistId, note } = await c.req.json<{ artistId: number; note?: string }>();
  const db = await getDb();
  const user = c.get('user');
  const [artist] = artistId ? await db.query('select 1 from artists where id = $1', [toId(artistId)]) : [];
  if (!artist) fail(404, 'Pick an artist to recommend.');
  await db.query('insert into recommendations (user_id, artist_id, note) values ($1, $2, $3)',
    [user.id, artistId, String(note || '').slice(0, 200)]);
  return c.json({ ok: true, stats: await stats(user.id) });
});

// ---------- Artists, venues, gigs (artist side) ----------
const SPOTIFY_RE = /^https:\/\/open\.spotify\.com\/(intl-[a-z]+\/)?(track|album|artist|playlist)\/[A-Za-z0-9]+/;
const checkSpotify = (url?: string) => {
  if (url && !SPOTIFY_RE.test(url)) fail(400, 'Paste a Spotify share link, like https://open.spotify.com/track/…');
};

app.get('/artists', async (c) => {
  const db = await getDb();
  const status = c.req.query('status') || 'approved';
  if (!['approved', 'pending', 'rejected'].includes(status)) fail(400, 'Unknown status.');
  return c.json(await db.query<Artist>(`select a.*, ${ARTIST_SAVES} from artists a where a.status = $1
    order by ${status === 'pending' ? 'a.external_fans desc nulls last' : 'a.name'}`, [status]));
});

app.post('/artists', admin, async (c) => {
  const b = await c.req.json<{ name?: string; genre?: string; city?: string; bio?: string; spotify_url?: string }>();
  const name = b.name?.trim();
  if (!name || !b.genre?.trim()) fail(400, 'Name and genre are required.');
  checkSpotify(b.spotify_url);
  // Link to Deezer when the name matches exactly: gives a photo and a preview.
  const spotify = b.spotify_url?.trim() || '';
  const dz = await findArtistByName(name!).catch(() => null);
  // Photo: Deezer's, or else the one behind the Spotify link.
  const image = (dz && pictureOf(dz)) || (spotify ? await spotifyThumbnail(spotify) : null) || '';
  const db = await getDb();
  const [row] = await db.query<{ id: number }>(`
    insert into artists (name, genre, city, bio, spotify_url, image_url, deezer_id, external_fans, color)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (deezer_id) do nothing returning id`,
    [name, b.genre!.trim(), b.city?.trim() || 'Guadalajara', b.bio?.trim() || '', spotify,
      image, dz?.id ?? null, dz?.nb_fan ?? null, randomColor()]);
  if (!row) fail(400, 'That artist is already on gem.fm.');
  return c.json({ id: row.id, deezer: !!dz, photo: !!image });
});

const EDITABLE = ['spotify_url', 'status', 'genre', 'city', 'bio', 'image_url'] as const;
type ArtistPatch = Partial<Pick<Artist, (typeof EDITABLE)[number]>>;

app.patch('/artists/:id', admin, async (c) => {
  const id = toId(c.req.param('id'));
  const b = await c.req.json<ArtistPatch>();
  checkSpotify(b.spotify_url);
  if (b.status && !['approved', 'pending', 'rejected'].includes(b.status)) fail(400, 'Unknown status.');
  if (b.image_url && !/^https:\/\/\S+$/.test(b.image_url.trim())) fail(400, 'The photo must be an https:// image link.');
  const fields = EDITABLE.filter((k) => b[k] !== undefined);
  if (!fields.length) fail(400, 'Nothing to update.');
  const db = await getDb();
  const [row] = await db.query<{ spotify_url: string; image_url: string }>(
    `update artists set ${fields.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning spotify_url, image_url`,
    [id, ...fields.map((k) => String(b[k]).trim())]);
  if (!row) fail(404, 'Artist not found.');
  // A new Spotify link on an artist without a photo: use the link's picture.
  let image_url = row.image_url;
  if (b.spotify_url && !image_url) {
    image_url = (await spotifyThumbnail(row.spotify_url)) || '';
    if (image_url) await db.query('update artists set image_url = $2 where id = $1', [id, image_url]);
  }
  return c.json({ ok: true, image_url });
});

// Looks up a photo (Spotify link, then Deezer) and saves it.
async function refreshPhoto(a: { id: number; name: string; spotify_url: string; deezer_id: number | string | null }) {
  const found = await findPhoto(a);
  if (!found) return null;
  const db = await getDb();
  await db.query(`update artists set image_url = $2,
      deezer_id = coalesce(deezer_id, $3), external_fans = coalesce(external_fans, $4)
    where id = $1 and not exists (select 1 from artists o where o.deezer_id = $3 and o.id <> $1)`,
    [a.id, found.image_url, found.deezer?.id ?? null, found.deezer?.fans ?? null]);
  return found;
}

app.post('/artists/:id/photo', admin, async (c) => {
  const db = await getDb();
  const [a] = await db.query<Artist>('select * from artists where id = $1', [toId(c.req.param('id'))]);
  if (!a) fail(404, 'Artist not found.');
  const found = await refreshPhoto(a);
  if (!found) fail(404, `No photo found for ${a.name}. Add a Spotify artist link or paste an image link.`);
  return c.json(found);
});

// Fills in photos for every approved artist that has none (e.g. after an import).
app.post('/artists/photos', admin, async (c) => {
  const db = await getDb();
  const missing = await db.query<Artist>("select * from artists where image_url = '' and status = 'approved' order by id limit 20");
  const results = await Promise.all(missing.map((a) => refreshPhoto(a).catch(() => null)));
  const found = results.filter(Boolean).length;
  return c.json({ checked: missing.length, found });
});

app.get('/venues', async (c) => {
  const db = await getDb();
  return c.json(await db.query<Venue>('select * from venues order by name'));
});

app.post('/venues', admin, async (c) => {
  const { name, area } = await c.req.json<{ name?: string; area?: string }>();
  if (!name?.trim()) fail(400, 'Venue name is required.');
  const db = await getDb();
  const [row] = await db.query<{ id: number }>('insert into venues (name, area) values ($1, $2) returning id', [name!.trim(), area?.trim() || '']);
  return c.json({ id: row.id });
});

app.post('/gigs', admin, async (c) => {
  const { artistId, venueId, startsAt, price } = await c.req.json<{ artistId?: number; venueId?: number; startsAt?: string; price?: number }>();
  if (!artistId || !venueId || !startsAt) fail(400, 'Artist, venue and date are required.');
  const db = await getDb();
  // startsAt comes from <input type="datetime-local"> (no zone): read it as local time in TZ.
  await db.query(`insert into gigs (artist_id, venue_id, starts_at, price_mxn) values ($1, $2, $3::timestamp at time zone '${TZ}', $4)`,
    [toId(artistId), toId(venueId), startsAt, Math.max(0, Math.round(Number(price) || 0))]);
  return c.json({ ok: true });
});

// ---------- Emerging-artist radar ----------
app.post('/radar', admin, async (c) => {
  const b = await c.req.json<{ seeds?: string[] | string; minFans?: number; maxFans?: number }>().catch(() => ({}) as never);
  const seeds = (Array.isArray(b.seeds) ? b.seeds : String(b.seeds || '').split(',')).map((s) => s.trim()).filter(Boolean);
  return c.json(await runRadar(await getDb(), { seeds, minFans: b.minFans, maxFans: b.maxFans }));
});
