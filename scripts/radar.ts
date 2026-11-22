// Runs the emerging-artist radar from the terminal.
//   npm run radar                       seeds = most-saved artists (or RADAR_SEEDS)
//   npm run radar -- "Ed Maverick" "Girl Ultra"
import { getDb } from '../server/db';
import { runRadar } from '../server/lib/radar';

const seeds = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const r = await runRadar(await getDb(), { seeds });
console.log(`Seeds: ${r.seeds.join(', ') || '(none found)'}`);
console.log(`Looked at ${r.scanned} related artists, added ${r.added.length} as pending:`);
for (const a of r.added) console.log(`  ${a.name} (${a.external_fans?.toLocaleString() ?? '?'} Deezer fans)`);
console.log('Approve them on the Artists page (/artists).');
process.exit(0);
