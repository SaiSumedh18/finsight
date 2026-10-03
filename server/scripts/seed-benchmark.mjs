import pg from 'pg';
import { writeFileSync } from 'node:fs';
const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_benchmark')) throw new Error('Use an isolated _benchmark database');
const pool = new pg.Pool({connectionString:url});
await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
const user=(await pool.query("INSERT INTO users(name,email,password_hash) VALUES('Benchmark','benchmark@example.invalid','no-login') RETURNING id")).rows[0].id;
const account=(await pool.query("INSERT INTO accounts(user_id,name,account_type,initial_balance) VALUES($1,'Benchmark','CHECKING',1000) RETURNING id",[user])).rows[0].id;
await pool.query(`INSERT INTO transactions(account_id,transaction_type,amount,description,transaction_date)
SELECT $1,CASE WHEN n%5=0 THEN 'INCOME' ELSE 'EXPENSE' END,10+n%100,'Synthetic transaction '||n,
DATE '2026-05-01'+(n%180) FROM generate_series(1,10000) n`,[account]);
const jwt=await import('jsonwebtoken');
const token=jwt.default.sign({userId:user},process.env.JWT_SECRET,{expiresIn:'1h'});
// Temporary benchmark credential, excluded from git. Never included in reports.
writeFileSync(process.env.TOKEN_FILE || '/private/tmp/finsight-benchmark-token',token,{mode:0o600});
await pool.query('ANALYZE'); await pool.end();
console.log('Seeded 10,000 synthetic transactions over six months');
