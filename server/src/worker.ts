import 'dotenv/config';
import { startImportWorker } from './jobs/imports.js';
import { pool } from './config/db.js';
import { redis } from './services/cache.js';
const stop = startImportWorker();
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, async () => {
  await stop(); redis?.disconnect(); await pool.end(); process.exit(0);
});
