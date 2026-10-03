import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { enqueueImport } from '../jobs/imports.js';

const router = Router();
router.use(requireAuth);
router.post('/', async (req: AuthRequest, res) => {
  const key = req.get('Idempotency-Key');
  const csv = req.body.csv;
  if (!key || !/^[a-zA-Z0-9_-]{1,128}$/.test(key) || typeof csv !== 'string' || !csv.length || Buffer.byteLength(csv) > 2_000_000) {
    return res.status(400).json({ success: false, message: 'Provide Idempotency-Key and csv string (maximum 2 MB)' });
  }
  if (!process.env.REDIS_URL) return res.status(503).json({ success: false, message: 'Imports are not configured' });
  try {
    const hash = createHash('sha256').update(csv).digest('hex');
    await pool.query(`INSERT INTO transaction_imports(id,user_id,idempotency_key,content_hash,csv)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,idempotency_key) DO NOTHING`, [randomUUID(),req.userId,key,hash,csv]);
    const result = await pool.query('SELECT id,status,content_hash,row_count FROM transaction_imports WHERE user_id=$1 AND idempotency_key=$2', [req.userId,key]);
    const record = result.rows[0];
    if (record.content_hash !== hash) return res.status(409).json({ success: false, message: 'Idempotency key was already used for different content' });
    if (record.status === 'pending') {
      try { await enqueueImport(record.id); } catch { /* Worker outbox dispatcher retries later. */ }
    }
    return res.status(202).json({ success: true, import: { id: record.id, status: record.status, rowCount: record.row_count } });
  } catch { return res.status(500).json({ success: false, message: 'Unable to accept import' }); }
});
router.get('/:id', async (req: AuthRequest, res) => {
  if (!/^[0-9a-f-]{36}$/.test(String(req.params.id))) return res.status(400).json({ success: false, message: 'Invalid import id' });
  try {
    const result = await pool.query('SELECT id,status,row_count AS "rowCount",error,created_at,completed_at FROM transaction_imports WHERE id=$1 AND user_id=$2', [req.params.id,req.userId]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Import not found' });
    return res.json({ success: true, import: result.rows[0] });
  } catch { return res.status(500).json({ success: false, message: 'Unable to read import' }); }
});
export default router;
