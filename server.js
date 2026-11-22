const path = require('path');
const express = require('express');
const db = require('./db');
const seed = require('./seed');

seed();

const DAILY_GOAL = 5;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Demo auth: the client sends the chosen seeded user's id.
function auth(req, res, next) {
  const id = Number(req.get('x-user-id'));
  const user = id && db.prepare('select * from users where id = ?').get(id);
  if (!user) return res.status(401).json({ error: 'Pick a demo user first.' });
  req.user = user;
  next();
}

const todayCount = (userId) =>
  db.prepare("select count(*) n from swipes where user_id = ? and date(created_at, 'localtime') = date('now', 'localtime')").get(userId).n;

function stats(userId) {
  const s = db.prepare(`
    select
      (select count(*) from swipes where user_id = @u) swipes,
      (select count(*) from swipes where user_id = @u and liked = 1) saves,
      (select count(*) from checkins where user_id = @u) checkins,
      (select count(*) from recommendations where user_id = @u) recs,
      (select count(*) from (select date(created_at, 'localtime') d from swipes where user_id = @u
         group by d having count(*) >= ${DAILY_GOAL})) challenges,
      (select count(*) from follows where follower_id = @u) following,
      (select count(*) from follows where followee_id = @u) followers
  `).get({ u: userId });
  s.points = s.swipes + s.saves * 2 + s.checkins * 25 + s.challenges * 10 + s.recs * 5;
  s.badges = [
    { id: 'first-save', name: 'First save', earned: s.saves >= 1, hint: 'Save an artist' },
    { id: 'daily', name: 'Daily digger', earned: s.challenges >= 1, hint: `Finish a daily challenge (${DAILY_GOAL} artists)` },
    { id: 'front-row', name: 'Front row', earned: s.checkins >= 1, hint: 'Check in at a gig' },
    { id: 'tastemaker', name: 'Tastemaker', earned: s.recs >= 3, hint: 'Share 3 recommendations' },
  ];
  return s;
}

// ---------- Users ----------
app.get('/api/users', (req, res) => {
  res.json(db.prepare('select * from users order by id').all());
});

app.get('/api/me', auth, (req, res) => {
  res.json({ ...req.user, stats: stats(req.user.id), today: todayCount(req.user.id), goal: DAILY_GOAL });
});

app.get('/api/users/:id', auth, (req, res) => {
  const user = db.prepare('select * from users where id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const stamps = db.prepare(`
    select c.created_at, a.name artist, a.color, v.name venue,
      (select count(*) from checkins c2 join gigs g2 on g2.id = c2.gig_id
        where g2.artist_id = g.artist_id and c2.created_at <= c.created_at) fan_number
    from checkins c join gigs g on g.id = c.gig_id
    join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id
    where c.user_id = ? order by c.created_at desc`).all(user.id);
  const saved = db.prepare(`select a.* from swipes s join artists a on a.id = s.artist_id
    where s.user_id = ? and s.liked = 1 order by s.created_at desc`).all(user.id);
  const isFollowing = !!db.prepare('select 1 from follows where follower_id = ? and followee_id = ?').get(req.user.id, user.id);
  res.json({ ...user, stats: stats(user.id), stamps, saved, isFollowing });
});

app.get('/api/people', auth, (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  res.json(db.prepare(`
    select u.*, exists(select 1 from follows f where f.follower_id = @me and f.followee_id = u.id) following
    from users u where u.id != @me and (u.name like @q or u.handle like @q) order by u.name`).all({ me: req.user.id, q }));
});

app.post('/api/follows/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You can’t follow yourself.' });
  db.prepare('insert or ignore into follows values (?, ?)').run(req.user.id, id);
  res.json({ ok: true });
});

app.delete('/api/follows/:id', auth, (req, res) => {
  db.prepare('delete from follows where follower_id = ? and followee_id = ?').run(req.user.id, req.params.id);
  res.json({ ok: true });
});

// ---------- Discover ----------
app.get('/api/discover', auth, (req, res) => {
  const left = Math.max(0, DAILY_GOAL - todayCount(req.user.id));
  const artists = db.prepare(`
    select a.*, (select count(*) from swipes s where s.artist_id = a.id and s.liked = 1) saves,
      (select g.starts_at from gigs g where g.artist_id = a.id and g.starts_at >= datetime('now', '-6 hours')
        order by g.starts_at limit 1) next_gig
    from artists a
    where a.id not in (select artist_id from swipes where user_id = ?)
    order by random() limit ?`).all(req.user.id, left || 10);
  res.json({ artists, today: todayCount(req.user.id), goal: DAILY_GOAL, bonus: left === 0 });
});

app.post('/api/swipes', auth, (req, res) => {
  const { artistId, liked } = req.body;
  if (!db.prepare('select 1 from artists where id = ?').get(artistId)) return res.status(404).json({ error: 'Artist not found.' });
  db.prepare('insert or replace into swipes (user_id, artist_id, liked) values (?, ?, ?)').run(req.user.id, artistId, liked ? 1 : 0);
  const today = todayCount(req.user.id);
  res.json({ today, goal: DAILY_GOAL, completed: today === DAILY_GOAL, stats: stats(req.user.id) });
});

// ---------- Live ----------
app.get('/api/gigs', auth, (req, res) => {
  const onlySaved = req.query.saved === '1';
  res.json(db.prepare(`
    select g.*, a.name artist, a.genre, a.color, a.spotify_url, v.name venue, v.area,
      exists(select 1 from swipes s where s.user_id = @u and s.artist_id = a.id and s.liked = 1) saved,
      exists(select 1 from checkins c where c.user_id = @u and c.gig_id = g.id) checked_in,
      (select count(*) from checkins c where c.gig_id = g.id) attendees,
      (select group_concat(u.name, ', ') from checkins c join users u on u.id = c.user_id
        join follows f on f.followee_id = u.id and f.follower_id = @u where c.gig_id = g.id) friends_there
    from gigs g join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id
    where g.starts_at >= datetime('now', '-6 hours') ${onlySaved ? 'and saved = 1' : ''}
    order by g.starts_at`).all({ u: req.user.id }));
});

app.post('/api/gigs/:id/checkin', auth, (req, res) => {
  const gig = db.prepare('select * from gigs where id = ?').get(req.params.id);
  if (!gig) return res.status(404).json({ error: 'Gig not found.' });
  db.prepare('insert or ignore into checkins (user_id, gig_id) values (?, ?)').run(req.user.id, gig.id);
  const fan = db.prepare(`select count(*) n from checkins c join gigs g on g.id = c.gig_id where g.artist_id = ?`).get(gig.artist_id).n;
  res.json({ fanNumber: fan, stats: stats(req.user.id) });
});

// ---------- Friends ----------
app.get('/api/feed', auth, (req, res) => {
  res.json(db.prepare(`
    with circle as (select followee_id id from follows where follower_id = @u union select @u)
    select * from (
      select 'rec' type, r.created_at at, u.id user_id, u.name user, u.color user_color,
        a.id artist_id, a.name artist, a.genre, a.color, a.spotify_url, r.note, null venue
      from recommendations r join users u on u.id = r.user_id join artists a on a.id = r.artist_id
      where r.user_id in (select id from circle)
      union all
      select 'save', s.created_at, u.id, u.name, u.color, a.id, a.name, a.genre, a.color, a.spotify_url, null, null
      from swipes s join users u on u.id = s.user_id join artists a on a.id = s.artist_id
      where s.liked = 1 and s.user_id in (select id from circle)
      union all
      select 'checkin', c.created_at, u.id, u.name, u.color, a.id, a.name, a.genre, a.color, a.spotify_url, null, v.name
      from checkins c join users u on u.id = c.user_id join gigs g on g.id = c.gig_id
      join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id
      where c.user_id in (select id from circle)
    ) order by at desc limit 50`).all({ u: req.user.id }));
});

app.post('/api/recommendations', auth, (req, res) => {
  const { artistId, note } = req.body;
  if (!db.prepare('select 1 from artists where id = ?').get(artistId)) return res.status(404).json({ error: 'Pick an artist to recommend.' });
  db.prepare('insert into recommendations (user_id, artist_id, note) values (?, ?, ?)').run(req.user.id, artistId, String(note || '').slice(0, 200));
  res.json({ ok: true, stats: stats(req.user.id) });
});

// ---------- Artists & venues (artist side) ----------
app.get('/api/artists', (req, res) => {
  res.json(db.prepare(`select a.*, (select count(*) from swipes s where s.artist_id = a.id and s.liked = 1) saves
    from artists a order by a.name`).all());
});

const isSpotify = (url) => !url || /^https:\/\/open\.spotify\.com\/(intl-[a-z]+\/)?(track|album|artist|playlist)\/[A-Za-z0-9]+/.test(url);

app.post('/api/artists', (req, res) => {
  const { name, genre, city, bio, spotify_url } = req.body;
  if (!name || !genre) return res.status(400).json({ error: 'Name and genre are required.' });
  if (!isSpotify(spotify_url)) return res.status(400).json({ error: 'Paste a Spotify share link, like https://open.spotify.com/track/…' });
  const colors = ['#6D2FB0', '#B0442F', '#2F8FB0', '#C2479C', '#4F7A3A', '#B08A2F'];
  const r = db.prepare('insert into artists (name, genre, city, bio, spotify_url, color) values (?, ?, ?, ?, ?, ?)')
    .run(name, genre, city || 'Guadalajara', bio || '', spotify_url || '', colors[Math.floor(Math.random() * colors.length)]);
  res.json({ id: r.lastInsertRowid });
});

app.patch('/api/artists/:id', (req, res) => {
  const { spotify_url } = req.body;
  if (!isSpotify(spotify_url)) return res.status(400).json({ error: 'Paste a Spotify share link, like https://open.spotify.com/track/…' });
  db.prepare('update artists set spotify_url = ? where id = ?').run(spotify_url || '', req.params.id);
  res.json({ ok: true });
});

app.get('/api/venues', (req, res) => res.json(db.prepare('select * from venues order by name').all()));

app.post('/api/gigs', (req, res) => {
  const { artistId, venueId, startsAt, price } = req.body;
  if (!artistId || !venueId || !startsAt) return res.status(400).json({ error: 'Artist, venue and date are required.' });
  db.prepare('insert into gigs (artist_id, venue_id, starts_at, price_mxn) values (?, ?, ?, ?)')
    .run(artistId, venueId, new Date(startsAt).toISOString().replace('T', ' ').slice(0, 19), Number(price) || 0);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`gem.fm running on http://localhost:${PORT}`));
