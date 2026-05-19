require('dotenv').config();

const path = require('path');
const { openDb, promisifyDb } = require('./lib/db');
const { ensureDatabaseExists, runMigrations } = require('./lib/migrations');

async function main() {
  const DB_PATH = process.env.DATABASE_PATH || './database/app.db';
  await ensureDatabaseExists();

  let rawDb;
  let db;
  try {
    rawDb = openDb(path.resolve(__dirname, DB_PATH));
    db = promisifyDb(rawDb);
  } catch (e) {
    const msg = String(e?.message || e);
    if (/Unknown database/i.test(msg) || e?.code === 'ER_BAD_DB_ERROR') {
      throw new Error(
        "Database belum ada. Set `ALLOW_DB_CREATE=1` di `server/.env` lalu jalankan `npm --prefix server run migrate`, atau buat database-nya manual dulu."
      );
    }
    throw e;
  }

  try {
    const schemaPath = path.resolve(__dirname, 'database', 'schema.sql');
    try {
      await runMigrations(db, schemaPath);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/Unknown database/i.test(msg) || e?.code === 'ER_BAD_DB_ERROR') {
        throw new Error(
          "Database belum ada. Set `ALLOW_DB_CREATE=1` di `server/.env` lalu jalankan `npm --prefix server run migrate`, atau buat database-nya manual dulu."
        );
      }
      throw e;
    }
    // eslint-disable-next-line no-console
    console.log('Migrate OK');
  } finally {
    try {
      await rawDb.destroy?.();
    } catch (_) {}
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  const msg = String(e?.message || e);
  if (/Unknown database/i.test(msg) || e?.code === 'ER_BAD_DB_ERROR') {
    console.error(
      'Migrate failed: Database belum ada. Set `ALLOW_DB_CREATE=1` di `server/.env` lalu jalankan `npm --prefix server run migrate`, atau buat database-nya manual dulu.'
    );
    process.exit(1);
  }
  console.error('Migrate failed:', e);
  process.exit(1);
});
