// Wipes the database and reloads supabase/schema.sql + seed.sql.
// Uses DATABASE_URL if set (careful: that's your Supabase data), otherwise ./.pglite.
import { resetLocalDb } from '../server/db';

if (process.env.DATABASE_URL && !process.argv.includes('--yes')) {
  console.error('DATABASE_URL is set, so this would wipe your Supabase data. Re-run with: npm run db:reset -- --yes');
  process.exit(1);
}
const kind = await resetLocalDb();
console.log(`Reset ${kind === 'pglite' ? 'local PGlite database (.pglite/)' : 'Supabase database'} with demo data.`);
process.exit(0);
