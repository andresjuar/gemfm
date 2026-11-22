// Postgres access. One SQL dialect everywhere:
// - DATABASE_URL set (Supabase, production): node-postgres pool.
// - Not set (local dev): PGlite, an in-process Postgres stored in ./.pglite,
//   created from supabase/schema.sql + seed.sql on first run.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  kind: 'postgres' | 'pglite';
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= connect().catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

const sqlFile = (name: string) => readFile(path.join(process.cwd(), 'supabase', name), 'utf8');

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      // Supabase requires TLS; its pooler certificate isn't in Node's default CA list.
      ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX) || 3,
      idleTimeoutMillis: 10_000,
    });
    return {
      kind: 'postgres',
      async query(sql, params) {
        return (await pool.query(sql, params as unknown[])).rows;
      },
      async exec(sql) {
        await pool.query(sql);
      },
    };
  }

  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error('DATABASE_URL is not set. Add your Supabase connection string in Netlify › Site configuration › Environment variables.');
  }

  // Kept out of the production bundle on purpose (the specifier isn't static).
  const pgliteModule = '@electric-sql/pglite';
  const { PGlite } = await import(pgliteModule);
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), '.pglite');
  const lite = new PGlite(dataDir);
  await lite.waitReady;
  const db: Db = {
    kind: 'pglite',
    async query(sql, params) {
      return (await lite.query(sql, params as unknown[])).rows as never;
    },
    async exec(sql) {
      await lite.exec(sql);
    },
  };
  const [{ exists }] = await db.query<{ exists: boolean }>("select to_regclass('public.users') is not null as exists");
  // schema.sql is safe to re-run, so local databases pick up schema changes on start.
  await db.exec(await sqlFile('schema.sql'));
  if (!exists) {
    await db.exec(await sqlFile('seed.sql'));
    console.log(`Created local database in ${dataDir} with demo data.`);
  }
  return db;
}

export async function resetLocalDb() {
  const db = await getDb();
  await db.exec(await sqlFile('schema.sql'));
  await db.exec(await sqlFile('seed.sql'));
  return db.kind;
}
