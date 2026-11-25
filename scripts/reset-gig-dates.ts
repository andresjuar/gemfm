// Moves every gig into the next two weeks, starting today, so the Live tab
// looks alive on a demo day. Keeps each gig's artist, venue, price and hour.
// Today gets three shows, including a sponsored one (the Featured Night).
//
//   npm run gigs:reset-dates            (local database)
//   npm run gigs:reset-dates -- --yes   (required when DATABASE_URL is set)
import { getDb } from '../server/db';

const TZ = process.env.APP_TIMEZONE || 'America/Mexico_City';
// Day offset (from today) for the 1st, 2nd, 3rd… gig in order.
const DAYS = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

if (process.env.DATABASE_URL && !process.argv.includes('--yes')) {
  console.error('This changes the dates of every gig in the database at DATABASE_URL. Run again with --yes to go ahead.');
  process.exit(1);
}

const db = await getDb();
const gigs = await db.query<{ id: number; hour: number; minute: number; sponsored: boolean }>(`
  select g.id, extract(hour from g.starts_at at time zone '${TZ}')::int as hour,
    extract(minute from g.starts_at at time zone '${TZ}')::int as minute, v.sponsored
  from gigs g join venues v on v.id = g.venue_id order by g.starts_at, g.id`);

// Put the first sponsored gig tonight so the Featured Night is today.
const firstSponsored = gigs.findIndex((g) => g.sponsored);
if (firstSponsored > 2) gigs.splice(1, 0, ...gigs.splice(firstSponsored, 1));

const used = new Set<string>();
for (const [i, g] of gigs.entries()) {
  const day = DAYS[i] ?? DAYS[DAYS.length - 1] + (i - DAYS.length + 1);
  // Two shows on the same day never start at the same hour.
  let hour = g.hour;
  while (used.has(`${day}-${hour}`)) hour = hour >= 23 ? 18 : hour + 1;
  used.add(`${day}-${hour}`);
  await db.query(`
    update gigs set starts_at =
      (((now() at time zone '${TZ}')::date + $2::int) + make_time($3, $4, 0)) at time zone '${TZ}'
    where id = $1`, [g.id, day, hour, g.minute]);
}

const rows = await db.query<{ local: string; artist: string; venue: string; sponsored: boolean }>(`
  select to_char(g.starts_at at time zone '${TZ}', 'Dy DD Mon HH24:MI') local, a.name artist, v.name venue, v.sponsored
  from gigs g join artists a on a.id = g.artist_id join venues v on v.id = g.venue_id order by g.starts_at`);
console.log(`Moved ${rows.length} gigs (${db.kind}):`);
for (const r of rows) console.log(`  ${r.local}  ${r.artist} @ ${r.venue}${r.sponsored ? '  [sponsored]' : ''}`);
process.exit(0);
