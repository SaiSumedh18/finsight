import { Redis } from 'ioredis';
import { pool } from '../config/db.js';

export const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 1, connectTimeout: 1000, commandTimeout: 1000,
  retryStrategy: attempts => Math.min(attempts * 200, 2000),
}) : null;
redis?.on('error', () => { /* Cache is optional; requests fall back to PostgreSQL. */ });

// The revision changes in the SAME PostgreSQL transaction as every financial write.
// Old readers can populate an old key, but future readers never use that revision.
export async function dashboardCacheKey(userId: number, month: string) {
  if (!redis || process.env.CACHE_ENABLED === 'false') return null;
  const result = await pool.query('SELECT dashboard_version FROM users WHERE id=$1', [userId]);
  if (!result.rowCount) return null;
  return `dashboard:v1:${userId}:${result.rows[0].dashboard_version}:${month}`;
}
export async function cachedSummary(key: string | null) {
  if (!key || !redis) return null;
  try { const value = await redis.get(key); return value ? JSON.parse(value) : null; }
  catch { return null; }
}
export async function storeSummary(key: string | null, value: unknown) {
  if (!key || !redis) return;
  try { await redis.set(key, JSON.stringify(value), 'EX', 60); } catch { /* fail open */ }
}
