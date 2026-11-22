# gem.fm MVP

From first listen to front row: discover emerging artists, go to their gigs, share with friends.

## Run it

```bash
npm install
npm start          # http://localhost:3000
npm run reset      # wipe and reseed demo data
```

Needs Node 18+. The database (`data.sqlite`) is created and seeded on first start.

**Show it on your phone in class:** run it on your laptop, connect the phone to the same Wi-Fi, and open `http://<your-laptop-IP>:3000`. To get a public link, deploy to Render or Railway (build: `npm install`, start: `npm start`). On free tiers the disk resets on each deploy, and the demo data reseeds itself.

## Add real music

Open `/artists.html`. For each artist, paste a Spotify share link (in Spotify: Share › Copy link) and save. The swipe cards and recommendations then play it inline. You can also add new artists and gigs there.

## Structure

```
server.js           Express API + static files
db.js               SQLite schema (better-sqlite3)
seed.js             Demo users, artists, venues, gigs, activity
public/index.html   App shell (Discover / Live / Friends + profile)
public/app.js       Frontend logic (vanilla JS)
public/styles.css   Styles
public/artists.html Artist side: add artists, gigs, Spotify links
```

## Data model

| Table | Purpose |
|---|---|
| users | Demo listeners (no passwords; pick one at start) |
| artists | Emerging artists, with `spotify_url` |
| venues, gigs | Local venues and upcoming shows |
| swipes | Save (liked = 1) or skip per user + artist |
| checkins | User at a gig = early-fan stamp; fan # = order of check-in for that artist |
| follows | Who follows whom |
| recommendations | A user's shared artist + note |

## Rules in the demo

- Daily challenge: 5 artists per day. Then a bonus round.
- Points: skip +1, save +3, daily challenge +10, recommendation +5, check-in +25.
- Badges: First save, Daily digger, Front row, Tastemaker (3 recommendations).
- Check-in works anytime. A real version would verify location or scan a QR code at the venue.

## API

`x-user-id` header = demo login.

| Method | Path | |
|---|---|---|
| GET | /api/users | Demo accounts |
| GET | /api/me | Current user, points, today's progress |
| GET | /api/users/:id | Profile: stats, badges, stamps, saved artists |
| GET | /api/people?q= | Search people |
| POST/DELETE | /api/follows/:id | Follow / unfollow |
| GET | /api/discover | Next unswiped artists |
| POST | /api/swipes | `{ artistId, liked }` |
| GET | /api/gigs?saved=1 | Upcoming gigs (optionally only saved artists) |
| POST | /api/gigs/:id/checkin | Check in, returns fan number |
| GET | /api/feed | Friends' saves, recommendations and stamps |
| POST | /api/recommendations | `{ artistId, note }` |
| GET/POST/PATCH | /api/artists | Artist side |
| GET | /api/venues | Venues |
| POST | /api/gigs | `{ artistId, venueId, startsAt, price }` |

## Not in the MVP yet

Real accounts, location-verified check-ins, ticket sales, venue dashboard, taste-based ranking (Discover is random for now).
