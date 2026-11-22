// Local API server. `npm run dev` starts this and Vite together;
// Vite forwards /api/* here (see vite.config.ts).
import { serve } from '@hono/node-server';
import { app } from './app';
import { getDb } from './db';

const port = Number(process.env.API_PORT || 8787);

const db = await getDb();
serve({ fetch: app.fetch, port }, () => {
  console.log(`gem.fm API on http://localhost:${port}/api (database: ${db.kind === 'pglite' ? 'local PGlite in .pglite/' : 'DATABASE_URL'})`);
});
