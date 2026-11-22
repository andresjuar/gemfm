const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
create table if not exists users (
  id integer primary key,
  name text not null,
  handle text not null unique,
  color text not null default '#F29AD3'
);
create table if not exists artists (
  id integer primary key,
  name text not null,
  genre text not null,
  city text not null default 'Guadalajara',
  bio text not null default '',
  spotify_url text not null default '',
  color text not null default '#6D2FB0',
  created_at text not null default (datetime('now'))
);
create table if not exists venues (
  id integer primary key,
  name text not null,
  area text not null
);
create table if not exists gigs (
  id integer primary key,
  artist_id integer not null references artists(id) on delete cascade,
  venue_id integer not null references venues(id),
  starts_at text not null,
  price_mxn integer not null default 0
);
create table if not exists swipes (
  user_id integer not null references users(id),
  artist_id integer not null references artists(id) on delete cascade,
  liked integer not null,
  created_at text not null default (datetime('now')),
  primary key (user_id, artist_id)
);
create table if not exists checkins (
  user_id integer not null references users(id),
  gig_id integer not null references gigs(id) on delete cascade,
  created_at text not null default (datetime('now')),
  primary key (user_id, gig_id)
);
create table if not exists follows (
  follower_id integer not null references users(id),
  followee_id integer not null references users(id),
  primary key (follower_id, followee_id)
);
create table if not exists recommendations (
  id integer primary key,
  user_id integer not null references users(id),
  artist_id integer not null references artists(id) on delete cascade,
  note text not null default '',
  created_at text not null default (datetime('now'))
);
`);

module.exports = db;
