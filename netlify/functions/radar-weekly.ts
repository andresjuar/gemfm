// Scheduled Netlify Function: every Monday it runs the emerging-artist radar.
// New finds wait as "pending" on the Artists page until someone approves them.
import type { Config } from '@netlify/functions';
import { getDb } from '../../server/db';
import { runRadar } from '../../server/lib/radar';

export default async () => {
  const result = await runRadar(await getDb());
  console.log(`Radar: seeds ${result.seeds.join(', ')}; scanned ${result.scanned}; added ${result.added.length}.`);
};

export const config: Config = { schedule: '0 15 * * 1' };
