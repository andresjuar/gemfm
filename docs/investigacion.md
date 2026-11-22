# Investigación: login con Spotify / Apple Music, radar de emergentes y costos

Investigado en noviembre de 2026. Las reglas de Spotify cambiaron dos veces este año, así que confirma en los links antes de decidir.

## Resumen

| Tema | Dificultad técnica | Bloqueo real | Recomendación para el MVP |
|---|---|---|---|
| Login con Spotify | Baja (1–2 días) | En *Development Mode* solo 5 usuarios, agregados a mano, y el dueño de la app necesita Premium | Hacerlo solo para la demo con el equipo (≤ 5 cuentas) |
| Login con Apple Music | Media (2–3 días) | Apple Developer Program: 99 USD al año; el usuario necesita suscripción a Apple Music | Dejarlo fuera del MVP |
| Radar de emergentes | Ya está hecho | Deezer no da la ciudad del artista | Usar el que ya está, aprobando a mano |
| Backend en Netlify | Ya está listo | 300 créditos/mes; cada deploy a producción cuesta 15 | Sí, gratis para la presentación |

## 1. Login con Spotify

**Cómo funciona.** OAuth 2.0 *Authorization Code with PKCE*: el usuario da permiso en spotify.com, regresa a gem.fm con un código y el backend lo cambia por un token. Con los scopes `user-top-read`, `user-follow-read` y `user-read-recently-played` puedes leer:

- `GET /me/top/artists`: sus artistas más escuchados (para saber sus gustos desde el primer día).
- `GET /me/following?type=artist`: a quién sigue.
- `GET /me/player/recently-played`: lo último que escuchó.

Con eso se podría arrancar el radar desde los gustos de cada persona en lugar de los de toda la app.

**Lo que lo complica (2026).**

- **Febrero 2026:** las apps en *Development Mode* (todas las nuevas) solo permiten **5 usuarios**, que tienes que agregar por correo en el dashboard, y el **dueño de la app debe tener Spotify Premium**. Antes eran 25.
- En esa misma actualización se **quitaron los campos `popularity` y `followers`** de los artistas y varios endpoints (top tracks de un artista, consultas de varios artistas a la vez, etc.), y la búsqueda bajó a máximo 10 resultados. O sea: Spotify ya no sirve para medir qué tan "emergente" es alguien.
- **Julio 2026:** ahora puedes tener hasta 25 apps por cuenta, pero el límite de 5 usuarios por app sigue igual.
- Para salir de ese límite (*Extended Quota*) Spotify solo acepta empresas registradas con unos 250 000 usuarios activos al mes. Para un proyecto escolar no es opción.

**Conclusión.** Técnicamente es fácil. Sirve para la demo si las cuentas que lo usan son tuyas y de tu equipo (máximo 5). No sirve para abrir la app al público. Si lo quieres, el plan sería: botón "Conectar Spotify", importar tus top artists, marcarlos como "ya te gustan" y usarlos como semillas del radar.

## 2. Login con Apple Music

**Cómo funciona.** En la web se usa **MusicKit JS**:

1. Con una cuenta del **Apple Developer Program (99 USD/año)** creas una llave de MusicKit.
2. El backend firma con esa llave un *developer token* (JWT ES256, dura hasta 6 meses).
3. En el navegador, `music.authorize()` abre la ventana de Apple y regresa un *Music User Token*.
4. Con los dos tokens puedes leer `/v1/me/recent/played`, `/v1/me/library/artists` y `/v1/me/history/heavy-rotation`.

**Lo que lo complica.**

- El costo anual del programa de desarrollador.
- El usuario necesita una suscripción activa de Apple Music para que haya datos.
- "Sign in with Apple" es otra cosa: solo da identidad (nombre/correo), no datos de música.
- Hay reportes de tokens que dejan de funcionar cuando el usuario cambia su contraseña de Apple ID.

**Conclusión.** Es factible, sin límite de 5 usuarios como Spotify, pero cuesta dinero y en México hay muchos menos usuarios de Apple Music que de Spotify. Lo dejaría fuera del MVP.

**Alternativa barata:** Last.fm. La API es gratis con una llave y los datos de escucha de un usuario son públicos con solo su nombre de usuario (si usa *scrobbling*). El problema es que poca gente lo usa.

## 3. Artistas emergentes casi automáticos (ya implementado)

`server/lib/radar.ts`, usando la **API pública de Deezer** (sin llave, sin login):

1. **Semillas**: los artistas que más guardan los usuarios de gem.fm (si hay al menos 3 vinculados a Deezer), o los nombres que escribas en `/artists`, o `RADAR_SEEDS`.
2. Pide a Deezer los **artistas relacionados** de cada semilla y luego los relacionados de los más pequeños (2 saltos).
3. Se queda con los que tienen **entre 200 y 60 000 fans en Deezer** (ajustable) y que no estén ya en la base.
4. Los guarda como **pendientes**. Tú los apruebas o rechazas en `/artists` (con preview para escucharlos) y solo entonces aparecen en Discover.
5. Corre solo **cada lunes** (Netlify Scheduled Function) y también con un botón o con `npm run radar`.

En las pruebas, partiendo de Ed Maverick, Silvana Estrada, Girl Ultra, Little Jesus y Kevin Kaarl, revisó 152 artistas en ~1 segundo y propuso 12.

**Limitaciones y mejoras posibles:**

- Los fans de Deezer no son oyentes de Spotify: Deezer es chico en México, así que los números se ven bajos. Por eso el umbral se puede mover.
- Deezer no dice de qué ciudad es un artista. Para filtrar "de Guadalajara" se podría cruzar con MusicBrainz (tiene el campo `area`), aunque muchos artistas chicos no están ahí.
- Para tocadas reales: Bandsintown y Songkick tienen APIs, pero piden ser socio. Por ahora las tocadas se capturan a mano en `/artists`.
- Siempre conviene que una persona apruebe: el grafo de Deezer a veces mezcla homónimos o artistas que no son emergentes.

## 4. ¿Netlify gratis también para el backend?

**Sí.** El backend corre como **Netlify Functions**, que están incluidas en el plan Free:

- El plan Free da **300 créditos al mes** con tope duro: si se acaban, el sitio se pausa hasta el siguiente mes, **pero nunca te cobran**.
- Las funciones cuestan ~10 créditos por GB-hora de cómputo y las peticiones 2 créditos por cada 10 000. Una presentación con todo el salón usando la app gasta menos de 1 crédito.
- **Ojo: cada deploy a producción cuesta 15 créditos**, así que solo te alcanzan unos 20 deploys al mes. Los *deploy previews* y *branch deploys* son gratis. Trabaja en ramas y haz merge a `main` pocas veces, o pausa los deploys automáticos mientras desarrollas.
- Las funciones tienen un límite de ~10 s por petición en el plan gratis. El radar tarda 1–3 s.
- Si tu cuenta de Netlify es de antes de septiembre de 2025, puede que tengas el plan "legacy Starter" (125 000 invocaciones y 300 minutos de build al mes), que también alcanza de sobra.

**Supabase Free** también alcanza (500 MB de base de datos). El detalle: **pausa los proyectos después de una semana sin actividad**. Entra al dashboard y reactívalo unos días antes de presentar.

## Fuentes

- Spotify, cuota de Development Mode (julio 2026): https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates
- Spotify, guía de migración de febrero 2026: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- TechCrunch, Premium y límite de usuarios: https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/
- Spotify, Get Artist (popularity/followers deprecados): https://developer.spotify.com/documentation/web-api/reference/get-an-artist
- Apple, MusicKit en la web: https://js-cdn.music.apple.com/musickit/v1/index.html
- Apple, autenticación de usuario para MusicKit: https://developer.apple.com/tutorials/data/documentation/applemusicapi/user-authentication-for-musickit.md
- Apple, recently played: https://developer.apple.com/tutorials/data/documentation/applemusicapi/get-v1-me-recent-played-tracks.md
- Netlify, planes con créditos: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Netlify Free en 2026 (resumen de terceros): https://netli.fyi/blog/netlify-free-plan-limits-2026
- Last.fm, geo.getTopArtists: https://www.last.fm/api/show/geo.getTopArtists
