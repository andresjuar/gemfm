# gem.fm

De la primera escucha a la primera fila: descubre artistas emergentes, ve a sus tocadas y compártelos con tus amigos.

- **Gustos**: al entrar por primera vez eliges los estilos que te gustan (Indie, Rock, Folk, Cumbia…). Se cambian desde tu perfil.
- **Discover**: desliza tarjetas de artistas (Save / Skip). Primero salen los que coinciden con tus gustos ("Because you like Folk"). Reto diario de 5 artistas, luego ronda bonus.
- **Live**: tocadas en Guadalajara. Hacer check-in te da un sello de *early fan* con tu número de fan.
- **Cuentas**: registro e inicio de sesión con correo o usuario y contraseña. Los botones de Spotify, Apple Music y Deezer aparecen como *Soon*.
- **Friends**: feed estilo Instagram con publicaciones altas (foto del artista), likes (también con doble toque), comentarios, guardar al artista, escucharlo y seguir a gente desde el feed o desde *Suggested for you*.
- **/admin**: administración: agregar artistas, tocadas y venues, revisar el **radar de artistas emergentes**, patrocinios y las solicitudes que llegan de las landings.
- **/artist** y **/venues**: landings para artistas (promoción) y venues (aparecer en Live), con formulario. Las solicitudes se guardan y se ven en `/admin`.
- **Venues patrocinados**: su noche aparece hasta arriba de Live como *Featured night*, siempre con la etiqueta **Sponsored** (dorada).
- **Menú oculto**: toca el logo 5 veces seguidas (o mantenlo presionado) para abrir *gem.fm for business* con links a `/artist`, `/venues` y `/admin`. No hay otros links a esas páginas.

## Stack

| Parte | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript (`src/`) |
| Backend | [Hono](https://hono.dev) + TypeScript (`server/`). Corre igual en local y como Netlify Function |
| Base de datos | Postgres: Supabase en producción, [PGlite](https://pglite.dev) (Postgres local, sin instalar nada) en desarrollo |
| Música | Embeds de Spotify y previews de 30 s de la API pública de Deezer |
| Deploy | Netlify (sitio estático + Functions) |

```
src/                 App de React (screens/, components/)
server/app.ts        Todas las rutas de la API (/api/*)
server/db.ts         Conexión: Supabase (DATABASE_URL) o PGlite local
server/lib/radar.ts  Radar de artistas emergentes (Deezer)
shared/types.ts      Tipos compartidos entre frontend y backend
netlify/functions/   api.ts (la API) y radar-weekly.ts (radar cada lunes)
supabase/            schema.sql y seed.sql
scripts/             Importar artistas, correr el radar, reiniciar la BD
docs/investigacion.md  Spotify, Apple Music, radar y costos de Netlify
```

## Correrlo en tu compu

Necesitas Node 20 o más nuevo.

```bash
npm install
npm run dev
```

Abre http://localhost:5173 y crea una cuenta. La primera vez se crea una base de datos local en `.pglite/` con datos demo; no necesitas Supabase para desarrollar.

> Si tu `.env` tiene `DATABASE_URL`, `npm run dev` usa Supabase (datos reales). Déjala vacía para usar la base local.

En tu celular (misma red Wi-Fi) abre la dirección **Network** que imprime Vite, por ejemplo `http://192.168.x.x:5173`.

Otros comandos:

```bash
npm run db:reset                        # borra la BD local y recarga los datos demo
npm run import:artists -- artistas.csv  # importa artistas reales (ver abajo)
npm run radar                           # busca artistas emergentes desde la terminal
npm run gigs:reset-dates                # mueve las tocadas a las próximas dos semanas (con DATABASE_URL: agrega -- --yes)
npm run build                           # revisa tipos y genera dist/
```

> Si npm te dice que bloqueó scripts de instalación (`allowScripts`), ya están aprobados en `package.json` los que hacen falta (`esbuild`).

## Base de datos en Supabase

1. Crea un proyecto en https://supabase.com (plan Free). Región: la más cercana (por ejemplo `us-east` o `us-west`).
2. **SQL Editor › New query**: pega todo `supabase/schema.sql` y dale **Run**.
3. Otra query: pega `supabase/seed.sql` y **Run** (carga usuarios, artistas, venues y tocadas demo; las fechas quedan relativas a hoy, así que vuelve a correrlo antes de presentar).
4. **Connect** (botón arriba) › **Connection string** › **Transaction pooler** (puerto `6543`). Copia la URL y cambia `[YOUR-PASSWORD]` por la contraseña de la base.
5. Para usarla desde tu compu: copia `.env.example` a `.env` y pega la URL en `DATABASE_URL`.

Las tablas tienen RLS activado sin políticas: nadie puede leerlas con la llave pública de Supabase; solo el backend, que se conecta con la URL de la base.

## Gustos (etiquetas)

Las etiquetas viven en la tabla `tags` (`supabase/schema.sql`). Cada una tiene un patrón (regex) que se compara con el **género** del artista: "Indie folk" queda con *indie* y *folk*. Un trigger de Postgres recalcula las etiquetas del artista cada vez que cambia su género, así que solo tienes que escribir bien el género.

Para agregar o ajustar etiquetas, edita el `insert into tags` de `schema.sql` y vuelve a correrlo (es seguro correrlo varias veces).

## Género, procedencia e idioma automáticos

Cuando un artista entra sin estos datos (radar, alta en `/admin` o importación), gem.fm los busca solo:

| Dato | De dónde sale | Qué tan confiable |
|---|---|---|
| **Género** | Géneros de Deezer de los álbumes de sus canciones más escuchadas (p. ej. "Alternative / Indie Rock") | Alta, si está en Deezer |
| **Idioma** | Palabras de los títulos de sus canciones y álbumes (Spanish, English, Portuguese, French). Si no es claro, lo deja vacío | Buena; falla con artistas de 1–2 canciones con títulos cortos |
| **Procedencia** | MusicBrainz (ciudad donde empezó o país). Solo si hay un único artista con ese nombre | Baja para artistas pequeños; a veces el servicio está saturado |

En `/admin`:
- **Auto-fill** en cada artista llena lo que falte (no borra lo que escribiste).
- **Auto-fill all** lo hace para todos los pendientes o aprobados, de 5 en 5 (MusicBrainz permite una consulta por segundo).
- En *Join as an artist* basta con el nombre (mejor si pegas el link de Spotify de una canción): género, idioma, foto y preview se llenan solos.

El idioma aparece en las tarjetas de Discover ("Sings in Spanish"). Del género salen las etiquetas de gustos.

Opcional: `MUSICBRAINZ_CONTACT` (correo o URL) en las variables de entorno; MusicBrainz pide que las apps se identifiquen y responde mejor así.

## Fotos de artistas

Se buscan solas, sin llaves de API:

1. **Link de artista de Spotify** (`open.spotify.com/artist/...`): la foto del artista vía oEmbed de Spotify.
2. **Deezer**: si el nombre coincide exactamente.
3. Link de canción o álbum de Spotify: la portada.

En `/admin` puedes pegar el link de Spotify, pegar el link de una imagen a mano (sección *Photo*), buscar la foto de un artista o usar **Find photos** para todos los que no tienen.

## Importar artistas reales

Exporta tu tabla como CSV. Columnas (en inglés o español, en cualquier orden; solo el nombre es obligatorio):

```csv
nombre,genero,ciudad,descripcion,spotify
Ed Maverick,Folk,Chihuahua,Canciones íntimas desde Chihuahua,https://open.spotify.com/artist/...
```

```bash
npm run import:artists -- data/artists.csv --replace --demo-gigs --demo-activity
```

`data/artists.csv` tiene los 18 artistas reales que ya están cargados en Supabase.

- Los artistas repetidos (por ejemplo, una fila por día) se importan una sola vez. La columna del link puede llamarse `spotify`, `spotify_url`, `link` o `enlace`.
- Con un link de **canción** de Spotify, busca esa misma canción en Deezer para encontrar al artista correcto (aunque haya otros con el mismo nombre): de ahí salen foto y número de fans. Sin link, busca el nombre exacto. Si no está en Deezer, usa la foto del link de Spotify (foto del artista o portada).
- La descripción queda como *Start with “nombre de la canción”* si no traes una.
- Escribe bien el género: de ahí salen las etiquetas de gustos.
- `--replace` borra los artistas demo (y sus tocadas, swipes y recomendaciones).
- `--demo-gigs` crea una tocada próxima por artista en los venues existentes (la primera, hoy en la noche), para que la pestaña Live no quede vacía.
- `--demo-activity` hace que los amigos demo guarden y recomienden a los artistas importados, para que el feed de Friends tenga actividad.
- Escribe en Supabase si `.env` tiene `DATABASE_URL`; si no, en la BD local.

## Deploy en Netlify

1. Sube el repo a GitHub.
2. En Netlify: **Add new project › Import an existing project** › elige el repo. La configuración ya está en `netlify.toml` (build `npm run build`, publica `dist/`, funciones en `netlify/functions/`).
3. **Project configuration › Environment variables**:
   - `DATABASE_URL`: la URL del Transaction pooler de Supabase.
   - `ADMIN_KEY`: una contraseña cualquiera para la página `/admin` (escríbela ahí en el campo *Admin key*).
   - `DEMO_LOGIN` (opcional): ponla en `off` para quitar el acceso demo y volver a correo + contraseña.
4. Deploy. La API queda en `https://tu-sitio.netlify.app/api/...` y el radar corre solo cada lunes.

## API

La sesión va en una cookie httpOnly (`gemfm_session`) que pone `/api/auth/*`. Las rutas marcadas con 🔑 piden `x-admin-key` si `ADMIN_KEY` está configurada.

| Método | Ruta | |
|---|---|---|
| GET | /api/health | Estado y tipo de base de datos |
| POST | /api/auth/signup | `{ name, handle, email, password }` crea la cuenta e inicia sesión |
| POST | /api/auth/login | `{ login, password }` (login = correo o usuario) |
| POST | /api/auth/logout | Cierra la sesión |
| GET | /api/auth/mode | `{ demo }`: si la app muestra el acceso demo |
| POST | /api/auth/demo | `{ username }` entra o crea una cuenta demo (solo con `DEMO_LOGIN` activo) |
| GET | /api/me | Usuario actual, gustos, puntos, progreso del día |
| GET | /api/tags | Etiquetas de gustos y cuántos artistas tiene cada una |
| PUT | /api/me/tags | `{ tags: ["indie", "folk"] }` guarda los gustos |
| GET | /api/users/:id | Perfil: stats, badges, sellos, guardados |
| GET | /api/people?q= | Buscar personas |
| POST/DELETE | /api/follows/:id | Seguir / dejar de seguir |
| GET | /api/discover | Siguientes artistas sin deslizar, primero los de tus gustos |
| POST | /api/swipes | `{ artistId, liked }` |
| GET | /api/artists/:id/preview | Preview de 30 s (Deezer) |
| GET | /api/gigs?saved=1 | Próximas tocadas (sin `saved`: todas, las usa el calendario) |
| POST | /api/gigs/:id/checkin | Check-in, regresa número de fan |
| GET | /api/feed | Publicaciones (recomendaciones, guardados, check-ins) con likes y comentarios; `following` separa tu feed de las sugeridas |
| GET | /api/people/suggested | Gente que todavía no sigues |
| POST/DELETE | /api/posts/:key/like | Like / quitar like |
| GET/POST | /api/posts/:key/comments | Ver / escribir comentarios (`{ body }`) |
| POST | /api/recommendations | `{ artistId, note }` |
| GET | /api/artists?status= | `approved` (default), `pending`, `rejected` |
| POST 🔑 | /api/artists | Nuevo artista (se vincula a Deezer si el nombre coincide) |
| PATCH 🔑 | /api/artists/:id | `spotify_url`, `image_url`, `status`, `genre`, `city`, `bio` |
| POST 🔑 | /api/artists/:id/photo | Busca y guarda la foto del artista |
| POST 🔑 | /api/artists/photos | Busca fotos para los que no tienen (20 por vez) |
| GET / POST 🔑 | /api/venues | Venues |
| POST 🔑 | /api/gigs | `{ artistId, venueId, startsAt, price }` |
| POST 🔑 | /api/radar | `{ seeds?, maxFans? }` busca artistas emergentes |

## Cuentas demo

Los usuarios de `seed.sql` (Andrés, Ximena, Diego, Sofía, Mateo, Valeria) no tienen correo ni contraseña: **nadie puede entrar con ellos**. Solo existen como gente a la que seguir, con publicaciones, likes y comentarios para que el feed no esté vacío.

Las contraseñas se guardan con scrypt (nunca en texto) y la sesión dura 30 días.

## Modo demo (día de presentación)

Mientras `DEMO_LOGIN` no sea `off`, la app abre con un acceso de **solo nombre de usuario**, marcado como *Demo*, para que un auditorio la pruebe rápido:

- Escribes un usuario (por ejemplo "Ana López" → `@ana_lopez`) y entras. Si no existe se crea una cuenta demo (`users.demo = true`, sin correo ni contraseña).
- Quien escriba el mismo usuario entra a la misma cuenta demo. Las cuentas con contraseña y los usuarios de `seed.sql` no se pueden tomar así.
- El encabezado y el perfil muestran la etiqueta **Demo**. El formulario de correo y contraseña sigue a un toque ("Entra con tu correo").
- Para borrar las cuentas demo después: `delete from users where demo;` en el SQL Editor de Supabase (borra también sus swipes, check-ins y comentarios).

Antes de presentar, `npm run gigs:reset-dates -- --yes` pone tres tocadas hoy (una patrocinada, para la Noche destacada) y reparte el resto en las dos semanas siguientes.

## Idioma

Perfil › ⚙️ Configuración › Idioma cambia la app entre inglés y español al instante y se recuerda en ese navegador. La primera vez usa el idioma del teléfono. Los textos están en `src/i18n-es.ts` (llave = texto en inglés). Las páginas `/admin`, `/artist` y `/venues` siguen en inglés.

## Reglas del demo

- Puntos: skip +1, save +3, reto diario +10, recomendación +5, check-in +25.
- Badges: First save, Daily digger, Front row, Tastemaker (3 recomendaciones).
- El check-in funciona en cualquier momento. Una versión real verificaría ubicación o un QR en el venue.

## Todavía no está en el MVP

Login con Spotify / Apple Music / Deezer (ver `docs/investigacion.md`), recuperar contraseña y verificar correo, límite de intentos de login, check-ins verificados, venta de boletos, panel para venues, ranking más fino (hoy Discover prioriza por etiquetas coincidentes y luego es aleatorio).

## Para negocios (artistas y venues)

- **`/artist`**: landing para artistas emergentes. Explica cómo funciona gem.fm para ellos (Discover → saves → gigs → early-fan stamps), la promoción *siempre etiquetada* y tiene un formulario de solicitud.
- **`/venues`**: landing para bares, foros y cafés: por qué unirse, cómo funciona, planes (Listing gratis, Sponsored nights, Ticketing próximamente) y formulario para inscribir su venue.
- Los formularios guardan la solicitud en la tabla `applications`; se ven en `/admin › Applications`, donde puedes marcarlas como contactadas o archivarlas.
- **Venues patrocinados**: en `/admin › Venues and sponsorship` activas *Make sponsored* y escribes el beneficio (p. ej. "2x1 drinks when you show your early-fan stamp"). Su próxima noche aparece hasta arriba de Live como *Featured night* con la etiqueta dorada **Sponsored**, también en *From my saves*. El demo trae uno ficticio: **El Sótano Sonoro**.
- Las tres páginas solo se abren desde el **menú oculto** (5 toques al logo o mantenerlo presionado, en la app o en la pantalla de login) o escribiendo la URL.
