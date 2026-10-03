import { Queue, Worker, UnrecoverableError } from 'bullmq';
import { Redis } from 'ioredis';
import { parse } from 'csv-parse/sync';
import { pool } from '../config/db.js';
import { createTransactionSchema } from '../controllers/transaction.controller.js';

export const queueName = 'finsight-imports';
export function queueConnection(worker = false) {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for imports');
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: worker ? null : 1 });
  connection.on('error', () => {});
  return connection;
}
let queue: Queue | undefined;
let producerConnection: Redis | undefined;
export function importQueue() {
  return queue ??= new Queue(queueName, { connection: producerConnection = queueConnection(), defaultJobOptions: {
    attempts: 5, backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 },
  }});
}
export async function enqueueImport(id: string) {
  await importQueue().add('csv', { id }, { jobId: id });
}
export async function closeImportQueue() {
  if (queue) { await queue.close(); producerConnection?.disconnect(); queue = undefined; }
}

export async function processImport(id: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM transaction_imports WHERE id=$1 FOR UPDATE', [id]);
    const record = result.rows[0];
    if (!record || record.status !== 'pending') { await client.query('COMMIT'); return; }
    let rows;
    try {
      rows = parse(record.csv, { columns: true, skip_empty_lines: true, bom: true, max_record_size: 10000 }) as Record<string, string>[];
      if (!rows.length || rows.length > 10000) throw new Error('CSV must contain 1–10,000 rows');
      rows = rows.map((row: Record<string, string>) => createTransactionSchema.parse({
        accountId: Number(row.accountId), categoryId: row.categoryId ? Number(row.categoryId) : null,
        transactionType: row.transactionType, amount: Number(row.amount), description: row.description,
        transactionDate: row.transactionDate, notes: row.notes || null,
      }));
    } catch { throw new UnrecoverableError('Invalid CSV: check headers, row limit, dates, amounts, and descriptions'); }
    // Lock referenced records against deletion or ownership changes until commit.
    const accounts = await client.query('SELECT id FROM accounts WHERE user_id=$1 FOR SHARE', [record.user_id]);
    const categories = await client.query('SELECT id,category_type FROM categories WHERE user_id=$1 FOR SHARE', [record.user_id]);
    const owned = new Set(accounts.rows.map(a => a.id));
    for (const row of rows) {
      if (!owned.has(row.accountId) || (row.categoryId && !categories.rows.some(c => c.id === row.categoryId && c.category_type === row.transactionType))) {
        throw new UnrecoverableError('CSV contains an unauthorized account or invalid category');
      }
    }
    // One set-based insert avoids 10,000 round trips. Commit data and completion together.
    await client.query(`INSERT INTO transactions(account_id,category_id,transaction_type,amount,description,transaction_date,notes)
      SELECT (r->>'accountId')::int,(r->>'categoryId')::int,r->>'transactionType',
      (r->>'amount')::numeric,r->>'description',(r->>'transactionDate')::date,r->>'notes'
      FROM jsonb_array_elements($1::jsonb) r`, [JSON.stringify(rows)]);
    await client.query("UPDATE transaction_imports SET status='completed',row_count=$2,csv=NULL,completed_at=now() WHERE id=$1", [id, rows.length]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof UnrecoverableError) {
      await pool.query("UPDATE transaction_imports SET status='failed',error=$2,csv=NULL WHERE id=$1 AND status='pending'", [id, error.message]);
    }
    throw error;
  } finally { client.release(); }
}

export function startImportWorker() {
  const connection = queueConnection(true);
  const worker = new Worker(queueName, job => processImport(job.data.id), { connection, concurrency: 2 });
  worker.on('error', () => console.error('Import worker connection failure'));
  worker.on('failed', () => console.error('Import job failed; inspect authenticated import status'));
  // Durable outbox recovery: if enqueue failed after DB commit, it is retried here.
  let dispatching = false;
  const dispatch = async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      const result = await pool.query("SELECT id FROM transaction_imports WHERE status='pending' ORDER BY created_at LIMIT 100");
      for (const row of result.rows) {
        const job = await importQueue().getJob(row.id);
        if (job && await job.getState() === 'failed') await job.retry();
        else if (!job) await enqueueImport(row.id);
      }
    } catch { console.error('Import dispatch unavailable; durable pending records will be retried'); }
    finally { dispatching = false; }
  };
  const timer = setInterval(dispatch, 5000);
  void dispatch();
  return async () => { clearInterval(timer); await worker.close(); connection.disconnect(); await closeImportQueue(); };
}
