// Seeds demo data. Runs automatically on first start; `npm run reset` wipes and reseeds.
const db = require('./db');

function seed({ force = false } = {}) {
  const count = db.prepare('select count(*) n from users').get().n;
  if (count && !force) return;

  db.exec(`delete from recommendations; delete from follows; delete from checkins; delete from swipes;
           delete from gigs; delete from venues; delete from artists; delete from users;`);

  const users = [
    ['Andrés', 'andres', '#F29AD3'],
    ['Ximena', 'ximena', '#8FD3F2'],
    ['Diego', 'diego', '#F2C38F'],
    ['Sofía', 'sofia', '#A7F28F'],
    ['Mateo', 'mateo', '#C9A7F2'],
    ['Valeria', 'valeria', '#F28F8F'],
  ];
  const insUser = db.prepare('insert into users (id, name, handle, color) values (?, ?, ?, ?)');
  users.forEach((u, i) => insUser.run(i + 1, ...u));

  // Demo artists are fictional. Paste real Spotify links from the Artists page (/artists.html).
  const artists = [
    ['Luna Satélite', 'Dream pop', 'Guadalajara', 'Bedroom dream pop recorded in a Chapalita apartment.', '#6D2FB0'],
    ['Los Faros del Norte', 'Indie rock', 'Zapopan', 'Four friends, loud guitars and songs about the Periférico.', '#B0442F'],
    ['MIEL', 'Alt R&B', 'Guadalajara', 'Soft vocals over late-night beats.', '#B08A2F'],
    ['Cumbia Cósmica', 'Electro cumbia', 'Tlaquepaque', 'Cumbia rhythms meet analog synths.', '#2F8FB0'],
    ['Ana Ríos', 'Folk', 'Tapalpa', 'Acoustic songs written in the mountains of Jalisco.', '#4F7A3A'],
    ['Neón Tapatío', 'Synthwave', 'Guadalajara', 'Retro synths for driving down Avenida Chapultepec.', '#C2479C'],
    ['Pájaro Azul', 'Indie folk', 'Zapopan', 'Harmonies, banjo and a lot of heart.', '#2F5FB0'],
    ['Kora', 'Hip hop', 'Guadalajara', 'Bars about growing up in the city.', '#7A3A3A'],
    ['Las Jacarandas', 'Shoegaze', 'Guadalajara', 'Walls of guitar noise, named after the spring trees.', '#8A5FC2'],
    ['Tezcatl', 'Experimental', 'Tonalá', 'Pre-Hispanic instruments through effect pedals.', '#3A7A6E'],
  ];
  const insArtist = db.prepare('insert into artists (id, name, genre, city, bio, color) values (?, ?, ?, ?, ?, ?)');
  artists.forEach((a, i) => insArtist.run(i + 1, ...a));

  const venues = [
    ['Foro Independencia', 'Centro'],
    ['Bar Américas', 'Chapultepec'],
    ['C3 Stage', 'Zapopan'],
    ['Casa Loma Café', 'Providencia'],
  ];
  const insVenue = db.prepare('insert into venues (id, name, area) values (?, ?, ?)');
  venues.forEach((v, i) => insVenue.run(i + 1, ...v));

  const day = (d, h) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    t.setHours(h, 0, 0, 0);
    return t.toISOString().replace('T', ' ').slice(0, 19);
  };
  const gigs = [
    [1, 4, day(0, 21), 0], [2, 1, day(1, 22), 150], [3, 2, day(2, 21), 120],
    [4, 3, day(3, 20), 200], [5, 4, day(4, 19), 0], [6, 2, day(5, 22), 100],
    [7, 1, day(6, 21), 150], [8, 3, day(8, 21), 180], [9, 2, day(10, 22), 120],
    [10, 4, day(12, 20), 80],
  ];
  const insGig = db.prepare('insert into gigs (artist_id, venue_id, starts_at, price_mxn) values (?, ?, ?, ?)');
  gigs.forEach((g) => insGig.run(...g));

  // Social graph and activity so the Friends tab isn't empty.
  const insFollow = db.prepare('insert into follows values (?, ?)');
  [[1, 2], [1, 3], [1, 4], [2, 1], [2, 5], [3, 1], [4, 6]].forEach((f) => insFollow.run(...f));

  const insSwipe = db.prepare("insert into swipes (user_id, artist_id, liked, created_at) values (?, ?, ?, datetime('now', ?))");
  [[2, 3, 1, '-2 hours'], [2, 6, 1, '-1 day'], [3, 2, 1, '-5 hours'], [3, 8, 1, '-3 hours'],
   [4, 5, 1, '-1 day'], [4, 9, 1, '-30 minutes'], [5, 1, 1, '-2 days'], [6, 4, 1, '-6 hours']]
    .forEach((s) => insSwipe.run(...s));

  const insRec = db.prepare("insert into recommendations (user_id, artist_id, note, created_at) values (?, ?, ?, datetime('now', ?))");
  [[2, 3, 'Perfect for studying at night.', '-1 hours'],
   [3, 2, 'Saw them at a house party, they are LOUD.', '-4 hours'],
   [4, 9, 'If you like Slowdive, go listen now.', '-20 minutes']]
    .forEach((r) => insRec.run(...r));

  const insCheck = db.prepare("insert into checkins (user_id, gig_id, created_at) values (?, ?, datetime('now', ?))");
  insCheck.run(3, 1, '-10 minutes');
}

module.exports = seed;

if (require.main === module) {
  seed({ force: process.argv.includes('--force') });
  console.log('Seeded demo data.');
}
