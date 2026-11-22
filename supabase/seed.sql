-- gem.fm demo data. Run AFTER schema.sql.
-- WARNING: this wipes every table and reloads the demo data.
-- Gig dates are relative to today (Guadalajara time), so re-run it before a
-- presentation to get fresh upcoming gigs.

truncate recommendations, follows, checkins, swipes, gigs, venues, artists, users restart identity cascade;

insert into users (id, name, handle, color) overriding system value values
  (1, 'Andrés',  'andres',  '#F29AD3'),
  (2, 'Ximena',  'ximena',  '#8FD3F2'),
  (3, 'Diego',   'diego',   '#F2C38F'),
  (4, 'Sofía',   'sofia',   '#A7F28F'),
  (5, 'Mateo',   'mateo',   '#C9A7F2'),
  (6, 'Valeria', 'valeria', '#F28F8F');

-- Demo artists are fictional. Replace them with real ones using
-- `npm run import:artists -- artists.csv` (see README).
insert into artists (id, name, genre, city, bio, color) overriding system value values
  (1,  'Luna Satélite',       'Dream pop',      'Guadalajara', 'Bedroom dream pop recorded in a Chapalita apartment.', '#6D2FB0'),
  (2,  'Los Faros del Norte', 'Indie rock',     'Zapopan',     'Four friends, loud guitars and songs about the Periférico.', '#B0442F'),
  (3,  'MIEL',                'Alt R&B',        'Guadalajara', 'Soft vocals over late-night beats.', '#B08A2F'),
  (4,  'Cumbia Cósmica',      'Electro cumbia', 'Tlaquepaque', 'Cumbia rhythms meet analog synths.', '#2F8FB0'),
  (5,  'Ana Ríos',            'Folk',           'Tapalpa',     'Acoustic songs written in the mountains of Jalisco.', '#4F7A3A'),
  (6,  'Neón Tapatío',        'Synthwave',      'Guadalajara', 'Retro synths for driving down Avenida Chapultepec.', '#C2479C'),
  (7,  'Pájaro Azul',         'Indie folk',     'Zapopan',     'Harmonies, banjo and a lot of heart.', '#2F5FB0'),
  (8,  'Kora',                'Hip hop',        'Guadalajara', 'Bars about growing up in the city.', '#7A3A3A'),
  (9,  'Las Jacarandas',      'Shoegaze',       'Guadalajara', 'Walls of guitar noise, named after the spring trees.', '#8A5FC2'),
  (10, 'Tezcatl',             'Experimental',   'Tonalá',      'Pre-Hispanic instruments through effect pedals.', '#3A7A6E');

insert into venues (id, name, area) overriding system value values
  (1, 'Foro Independencia', 'Centro'),
  (2, 'Bar Américas',       'Chapultepec'),
  (3, 'C3 Stage',           'Zapopan'),
  (4, 'Casa Loma Café',     'Providencia');

-- (artist, venue, days from today, hour, price)
insert into gigs (artist_id, venue_id, starts_at, price_mxn)
select a, v, (date_trunc('day', now() at time zone 'America/Mexico_City') + make_interval(days => d, hours => h))
             at time zone 'America/Mexico_City', p
from (values
  (1, 4, 0, 21, 0),   (2, 1, 1, 22, 150), (3, 2, 2, 21, 120),
  (4, 3, 3, 20, 200), (5, 4, 4, 19, 0),   (6, 2, 5, 22, 100),
  (7, 1, 6, 21, 150), (8, 3, 8, 21, 180), (9, 2, 10, 22, 120),
  (10, 4, 12, 20, 80)
) as t(a, v, d, h, p);

-- Social graph and activity so the Friends tab isn't empty.
insert into follows (follower_id, followee_id) values
  (1, 2), (1, 3), (1, 4), (2, 1), (2, 5), (3, 1), (4, 6);

insert into swipes (user_id, artist_id, liked, created_at) values
  (2, 3, true, now() - interval '2 hours'),
  (2, 6, true, now() - interval '1 day'),
  (3, 2, true, now() - interval '5 hours'),
  (3, 8, true, now() - interval '3 hours'),
  (4, 5, true, now() - interval '1 day'),
  (4, 9, true, now() - interval '30 minutes'),
  (5, 1, true, now() - interval '2 days'),
  (6, 4, true, now() - interval '6 hours');

insert into recommendations (user_id, artist_id, note, created_at) values
  (2, 3, 'Perfect for studying at night.', now() - interval '1 hour'),
  (3, 2, 'Saw them at a house party, they are LOUD.', now() - interval '4 hours'),
  (4, 9, 'If you like Slowdive, go listen now.', now() - interval '20 minutes');

insert into checkins (user_id, gig_id, created_at) values
  (3, 1, now() - interval '10 minutes');

-- Keep the id sequences ahead of the explicit ids above.
select setval(pg_get_serial_sequence('users', 'id'),   (select max(id) from users));
select setval(pg_get_serial_sequence('artists', 'id'), (select max(id) from artists));
select setval(pg_get_serial_sequence('venues', 'id'),  (select max(id) from venues));
