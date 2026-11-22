# gem.fm

De la primera escucha a la primera fila: descubre artistas emergentes, ve a sus tocadas y compártelos con tus amigos.

- **Gustos**: al entrar por primera vez eliges los estilos que te gustan (Indie, Rock, Folk, Cumbia…). Se cambian desde tu perfil.
- **Discover**: desliza tarjetas de artistas (Save / Skip). Primero salen los que coinciden con tus gustos ("Because you like Folk"). Reto diario de 5 artistas, luego ronda bonus.
- **Live**: tocadas en Guadalajara. Hacer check-in te da un sello de *early fan* con tu número de fan.
- **Friends**: feed de lo que guardan, recomiendan y a dónde van tus amigos.
- **/artists**: lado del artista: agregar artistas, tocadas, links de Spotify y revisar lo que encontró el **radar de artistas emergentes**.

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

Abre http://localhost:5173. La primera vez se crea una base de datos local en `.pglite/` con datos demo; no necesitas Supabase para desarrollar.

En tu celular (misma red Wi-Fi) abre la dirección **Network** que imprime Vite, por ejemplo `http://192.168.x.x:5173`.

Otros comandos:

```bash
npm run db:reset                        # borra la BD local y recarga los datos demo
npm run import:artists -- artistas.csv  # importa artistas reales (ver abajo)
npm run radar                           # busca artistas emergentes desde la terminal
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

## Fotos de artistas

Se buscan solas, sin llaves de API:

1. **Link de artista de Spotify** (`open.spotify.com/artist/...`): la foto del artista vía oEmbed de Spotify.
2. **Deezer**: si el nombre coincide exactamente.
3. Link de canción o álbum de Spotify: la portada.

En `/artists` puedes pegar el link de Spotify, pegar el link de una imagen a mano (sección *Photo*), buscar la foto de un artista o usar **Find photos** para todos los que no tienen.

## Importar artistas reales

Exporta tu tabla como CSV. Columnas (en inglés o español, en cualquier orden; solo el nombre es obligatorio):

```csv
nombre,genero,ciudad,descripcion,spotify
Ed Maverick,Folk,Chihuahua,Canciones íntimas desde Chihuahua,https://open.spotify.com/artist/...
```

```bash
npm run import:artists -- artistas.csv --replace --demo-gigs
```

- Busca cada nombre en Deezer: si coincide, agrega foto, número de fans y preview de 30 s. Si no, toma la foto del link de Spotify.
- Escribe bien el género: de ahí salen las etiquetas de gustos.
- `--replace` borra los artistas demo (y sus tocadas, swipes y recomendaciones).
- `--demo-gigs` crea una tocada próxima por artista en los venues existentes, para que la pestaña Live no quede vacía.
- Escribe en Supabase si `.env` tiene `DATABASE_URL`; si no, en la BD local.

## Deploy en Netlify

1. Sube el repo a GitHub.
2. En Netlify: **Add new project › Import an existing project** › elige el repo. La configuración ya está en `netlify.toml` (build `npm run build`, publica `dist/`, funciones en `netlify/functions/`).
3. **Project configuration › Environment variables**:
   - `DATABASE_URL`: la URL del Transaction pooler de Supabase.
   - `ADMIN_KEY`: una contraseña cualquiera para la página `/artists` (escríbela ahí en el campo *Admin key*).
4. Deploy. La API queda en `https://tu-sitio.netlify.app/api/...` y el radar corre solo cada lunes.

## API

Header `x-user-id` = usuario demo. Las rutas marcadas con 🔑 piden `x-admin-key` si `ADMIN_KEY` está configurada.

| Método | Ruta | |
|---|---|---|
| GET | /api/health | Estado y tipo de base de datos |
| GET | /api/users | Cuentas demo |
| GET | /api/me | Usuario actual, gustos, puntos, progreso del día |
| GET | /api/tags | Etiquetas de gustos y cuántos artistas tiene cada una |
| PUT | /api/me/tags | `{ tags: ["indie", "folk"] }` guarda los gustos |
| GET | /api/users/:id | Perfil: stats, badges, sellos, guardados |
| GET | /api/people?q= | Buscar personas |
| POST/DELETE | /api/follows/:id | Seguir / dejar de seguir |
| GET | /api/discover | Siguientes artistas sin deslizar, primero los de tus gustos |
| POST | /api/swipes | `{ artistId, liked }` |
| GET | /api/artists/:id/preview | Preview de 30 s (Deezer) |
| GET | /api/gigs?saved=1 | Próximas tocadas |
| POST | /api/gigs/:id/checkin | Check-in, regresa número de fan |
| GET | /api/feed | Actividad de amigos |
| POST | /api/recommendations | `{ artistId, note }` |
| GET | /api/artists?status= | `approved` (default), `pending`, `rejected` |
| POST 🔑 | /api/artists | Nuevo artista (se vincula a Deezer si el nombre coincide) |
| PATCH 🔑 | /api/artists/:id | `spotify_url`, `image_url`, `status`, `genre`, `city`, `bio` |
| POST 🔑 | /api/artists/:id/photo | Busca y guarda la foto del artista |
| POST 🔑 | /api/artists/photos | Busca fotos para los que no tienen (20 por vez) |
| GET / POST 🔑 | /api/venues | Venues |
| POST 🔑 | /api/gigs | `{ artistId, venueId, startsAt, price }` |
| POST 🔑 | /api/radar | `{ seeds?, maxFans? }` busca artistas emergentes |

## Reglas del demo

- Puntos: skip +1, save +3, reto diario +10, recomendación +5, check-in +25.
- Badges: First save, Daily digger, Front row, Tastemaker (3 recomendaciones).
- El check-in funciona en cualquier momento. Una versión real verificaría ubicación o un QR en el venue.

## Todavía no está en el MVP

Cuentas reales (login con Spotify / Apple Music, ver `docs/investigacion.md`), check-ins verificados, venta de boletos, panel para venues, ranking más fino (hoy Discover prioriza por etiquetas coincidentes y luego es aleatorio).
