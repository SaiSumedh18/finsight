import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { redis, dashboardCacheKey, storeSummary } from '../src/services/cache.js';
import { processImport, closeImportQueue, startImportWorker } from '../src/jobs/imports.js';
let token: string, other: string, account: number, category: number, user: number;
const csv = () => `accountId,categoryId,transactionType,amount,description,transactionDate\n${account},${category},EXPENSE,25,Groceries,2026-10-01\n`;
const get = () => request(app).get('/api/dashboard/summary?month=2026-10-01').auth(token,{type:'bearer'});
const submit = (key = randomUUID(), content = csv(), auth = token) => request(app).post('/api/imports').auth(auth,{type:'bearer'}).set('Idempotency-Key',key).send({csv:content});
beforeAll(async () => { await pool.query('SELECT 1'); await redis!.ping(); });
beforeEach(async () => {
 await pool.query('TRUNCATE users RESTART IDENTITY CASCADE'); await redis!.flushdb();
 const first = await request(app).post('/api/auth/register').send({name:'Cache User',email:'cache@example.com',password:'TestPassword123!'});
 token=first.body.token;
 const second = await request(app).post('/api/auth/register').send({name:'Other User',email:'other@example.com',password:'TestPassword123!'});
 other=second.body.token;
 const a=await request(app).post('/api/accounts').auth(token,{type:'bearer'}).send({name:'Checking',accountType:'CHECKING',initialBalance:100});
 account=a.body.account.id; user=(await pool.query('SELECT user_id FROM accounts WHERE id=$1',[account])).rows[0].user_id;
 const c=await request(app).get('/api/categories').auth(token,{type:'bearer'});
 category=c.body.categories.find((x: any)=>x.category_type==='EXPENSE').id;
});
afterAll(async()=>{ await closeImportQueue(); redis?.disconnect(); await pool.end(); });
it('caches identical month responses and isolates users and months', async()=>{
 const first=await get(); expect(first.status).toBe(200); expect(first.headers['x-cache']).toBe('MISS');
 const hit=await get(); expect(hit.headers['x-cache']).toBe('HIT'); expect(hit.body).toEqual(first.body);
 const isolated=await request(app).get('/api/dashboard/summary?month=2026-10-01').auth(other,{type:'bearer'});
 expect(isolated.headers['x-cache']).toBe('MISS'); expect(isolated.body.summary.totalBalance).toBe(0);
 expect((await request(app).get('/api/dashboard/summary?month=2026-09-01').auth(token,{type:'bearer'})).headers['x-cache']).toBe('MISS');
});
it('invalidates on create, update, delete transaction',async()=>{
 await get(); const t=await request(app).post('/api/transactions').auth(token,{type:'bearer'}).send({accountId:account,categoryId:category,transactionType:'EXPENSE',amount:25,description:'Food',transactionDate:'2026-10-01'});
 expect(t.status).toBe(201); expect((await get()).body.summary.monthlyExpenses).toBe(25);
 await request(app).patch(`/api/transactions/${t.body.transaction.id}`).auth(token,{type:'bearer'}).send({amount:50});
 expect((await get()).body.summary.monthlyExpenses).toBe(50);
 await request(app).delete(`/api/transactions/${t.body.transaction.id}`).auth(token,{type:'bearer'});
 expect((await get()).body.summary.monthlyExpenses).toBe(0);
});
it('invalidates accounts, categories and budgets including SQL writes',async()=>{
 await get(); await pool.query('UPDATE accounts SET initial_balance=200 WHERE id=$1',[account]);
 expect((await get()).body.summary.totalBalance).toBe(200);
 await pool.query('INSERT INTO budgets(user_id,category_id,month_start,amount) VALUES($1,$2,$3,100)',[user,category,'2026-10-01']);
 expect((await get()).body.summary.budgetTotal).toBe(100);
 await pool.query('UPDATE categories SET name=$2 WHERE id=$1',[category,'Renamed']);
 expect((await get()).headers['x-cache']).toBe('MISS');
 await pool.query('DELETE FROM budgets WHERE user_id=$1',[user]); expect((await get()).body.summary.budgetTotal).toBe(0);
 await pool.query('DELETE FROM accounts WHERE id=$1',[account]); expect((await get()).body.summary.totalBalance).toBe(0);
});
it('late cache fills cannot resurrect stale revisions',async()=>{
 const oldKey=await dashboardCacheKey(user,'2026-10-01'); const old=(await get()).body;
 await pool.query('UPDATE accounts SET initial_balance=300 WHERE id=$1',[account]);
 await storeSummary(oldKey,old); expect((await get()).body.summary.totalBalance).toBe(300);
});
it('imports are atomic and concurrent retries insert exactly once',async()=>{
 await get(); const accepted=await submit(); expect(accepted.status).toBe(202);
 await Promise.all([processImport(accepted.body.import.id),processImport(accepted.body.import.id)]);
 await processImport(accepted.body.import.id);
 expect(Number((await pool.query('SELECT count(*) FROM transactions')).rows[0].count)).toBe(1);
 expect((await get()).body.summary.monthlyExpenses).toBe(25);
 const status=await request(app).get(`/api/imports/${accepted.body.import.id}`).auth(token,{type:'bearer'});
 expect(status.body.import.status).toBe('completed'); expect(status.body.import.rowCount).toBe(1);
});
it('deduplicates submissions and rejects key reuse with different content',async()=>{
 const key=randomUUID(); const a=await submit(key); const b=await submit(key);
 expect(a.body.import.id).toBe(b.body.import.id); expect((await submit(key,csv().replace('25','26'))).status).toBe(409);
});
it('rejects foreign accounts and hides other users import status',async()=>{
 const accepted=await submit(randomUUID(),csv(),other);
 await expect(processImport(accepted.body.import.id)).rejects.toThrow('unauthorized');
 expect(Number((await pool.query('SELECT count(*) FROM transactions')).rows[0].count)).toBe(0);
 expect((await request(app).get(`/api/imports/${accepted.body.import.id}`).auth(token,{type:'bearer'})).status).toBe(404);
});
it('invalid rows fail the whole file without partial transactions',async()=>{
 const accepted=await submit(randomUUID(),csv()+`${account},${category},EXPENSE,-1,Bad,2026-10-01\n`);
 await expect(processImport(accepted.body.import.id)).rejects.toThrow('Invalid CSV');
 expect(Number((await pool.query('SELECT count(*) FROM transactions')).rows[0].count)).toBe(0);
});
it('runs imports through a real Redis-backed BullMQ worker',async()=>{
 const stop=startImportWorker();
 try {
  const accepted=await submit();
  for(let i=0;i<100;i++) {
   const record=(await pool.query('SELECT status FROM transaction_imports WHERE id=$1',[accepted.body.import.id])).rows[0];
   if(record.status==='completed') break;
   await new Promise(r=>setTimeout(r,50));
  }
  expect((await pool.query('SELECT status FROM transaction_imports WHERE id=$1',[accepted.body.import.id])).rows[0].status).toBe('completed');
 } finally { await stop(); }
});
it('requires authentication and bounded CSV input',async()=>{
 expect((await request(app).post('/api/imports').send({csv:csv()})).status).toBe(401);
 expect((await request(app).post('/api/imports').auth(token,{type:'bearer'}).send({csv:csv()})).status).toBe(400);
});
it('rolls back a failed database write then safely retries the import',async()=>{
 const accepted=await submit();
 await pool.query(`CREATE OR REPLACE FUNCTION fail_import_test() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END; $$ LANGUAGE plpgsql;
 CREATE TRIGGER fail_import_test BEFORE INSERT ON transactions FOR EACH STATEMENT EXECUTE FUNCTION fail_import_test();`);
 try {
  await expect(processImport(accepted.body.import.id)).rejects.toThrow('injected failure');
  expect(Number((await pool.query('SELECT count(*) FROM transactions')).rows[0].count)).toBe(0);
  expect((await pool.query('SELECT status FROM transaction_imports WHERE id=$1',[accepted.body.import.id])).rows[0].status).toBe('pending');
 } finally {await pool.query('DROP TRIGGER fail_import_test ON transactions; DROP FUNCTION fail_import_test()');}
 await processImport(accepted.body.import.id); await processImport(accepted.body.import.id);
 expect(Number((await pool.query('SELECT count(*) FROM transactions')).rows[0].count)).toBe(1);
});
it('rejects cross-user transaction reads and mutations',async()=>{
 const accepted=await submit(); await processImport(accepted.body.import.id);
 const id=(await pool.query('SELECT id FROM transactions')).rows[0].id;
 expect((await request(app).get(`/api/transactions/${id}`).auth(other,{type:'bearer'})).status).toBe(404);
 expect((await request(app).patch(`/api/transactions/${id}`).auth(other,{type:'bearer'}).send({amount:1})).status).toBe(404);
 expect((await request(app).delete(`/api/transactions/${id}`).auth(other,{type:'bearer'})).status).toBe(404);
 expect((await request(app).get('/api/transactions').auth(other,{type:'bearer'})).body.transactions).toEqual([]);
});
it('ignores corrupt Redis cache entries and returns authoritative analytics',async()=>{
 const key=await dashboardCacheKey(user,'2026-10-01'); await redis!.set(key!,'bad-json');
 const response=await get();expect(response.status).toBe(200);expect(response.body.summary.totalBalance).toBe(100);
});
