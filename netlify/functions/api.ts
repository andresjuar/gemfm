// Netlify Function that serves the whole API under /api/*.
import type { Config } from '@netlify/functions';
import { app } from '../../server/app';

export default (req: Request) => app.fetch(req);

export const config: Config = { path: '/api/*' };
