# FinSight — engineering notes

## Cache and import design

```mermaid
flowchart LR
 React --> API[Express API / JWT authorization]
 API --> PG[(PostgreSQL: financial records + cache revisions + durable imports)]
 API --> Redis[(Redis: 60-second dashboard cache + BullMQ)]
 Redis --> Worker[CSV worker / concurrency 2]
 Worker --> PG
```

Dashboard keys contain the authenticated user ID, selected month, and a PostgreSQL revision. Database triggers bump that revision in the same transaction as account/category/budget/transaction writes, including direct SQL. Late readers cannot repopulate a current key with an old revision. Cache failures fall back to PostgreSQL. The cache still reads one small revision query per request; financial writes serialize on the user's revision row. Concurrent requests overlapping a write may see the previous state; subsequent reads use the new revision.

CSV imports accept up to 2 MB / 10,000 rows. The React transaction page uploads CSV and polls authenticated status. `POST /api/imports` accepts `{ "csv": "..." }` with an `Idempotency-Key` (1–128 alphanumeric/underscore/hyphen characters). `GET /api/imports/:id` returns status only for its owner. Headers: `accountId,categoryId,transactionType,amount,description,transactionDate,notes`; categoryId and notes are optional. Types are INCOME/EXPENSE, positive amounts, YYYY-MM-DD dates. All account/category references are checked again in the worker. The whole file commits atomically with completion under an import row lock. Reusing the same user/key/content returns the original import; different content gets 409. Separate keys intentionally represent separate imports; identical-looking legitimate transactions are not globally deduplicated. Keep the key when retrying an uncertain upload.

The database is a durable outbox: worker dispatch recovers accepted records if Redis enqueue failed. BullMQ retries transient failures with exponential backoff. Invalid CSV fails permanently without partial data. Completed/invalid files are cleared from the database while idempotency metadata remains. Pending files may contain sensitive data: encrypt database storage/backups and define retention before production. Failed transient jobs remain pending for dispatcher retries; operational alerts and bounded recovery policies remain future work. Do not expose Redis publicly.

### Setup and migration

- Local database-only workflow: keep the existing database Compose file, run Redis separately, set REDIS_URL, then run `npm run dev` and `npm run worker:dev` in server.
- Full stack: `docker compose -f docker-compose.full.yml up -d --build`; frontend is port 8080, API port 4101. New databases initialize automatically. Existing databases require applying `server/sql/schema.sql` after backup/staging verification. No original data was migrated during this upgrade.
- Isolated verification: `docker compose -p finsight-upgrade-verify -f compose.verify.yml up -d --wait`; run backend tests with DATABASE_URL pointing to `postgresql://finsight:local-test-only@127.0.0.1:5491/finsight_test`. Test setup refuses database names without `_test`. These containers are separate from the live database. Never point tests at live data.
- Full smoke stack: `docker compose -p finsight-upgrade-full -f compose.smoke.yml up -d --build --wait`, frontend 8091/API 4193, separate volumes.
- Builds: `npm ci` in server/client; `npm run build` in each; `npm run lint` in client.
- AWS preparation: see [deploy/README.md](../deploy/README.md). ECS/RDS/ElastiCache configuration exists but no AWS resources were created. S3 is not implemented or claimed.

### Measured local k6 comparison

| Mode | Transactions | Concurrent VUs | p50 ms | p95 ms | Requests/sec | Requests | HTTP error rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cache disabled | 10,000 | 10 | 11.964 | 18.8815 | 762.77 | 22,891 | 0% |
| Cache enabled, warm | 10,000 | 10 | 1.616 | 3.121 | 5,236.36 | 157,097 | 0% |

Method: k6 2.3.0, Node 24.11.0, native PostgreSQL 16 on a separate local cluster/benchmark database, Docker Redis 7, macOS arm64. `server/scripts/seed-benchmark.mjs` seeds one synthetic user/account and 10,000 transactions over May–October 2026; it refuses databases without `_benchmark`. No real records or credentials are used. Both API processes use the same seed, JWT, endpoint (`/api/dashboard/summary?month=2026-10-01`) and application build. Cache-disabled baseline ran first on port 4191; warm cached variant ran second on 4192 after 20 warmup requests. Each run uses constant 10 VUs for 30 seconds, no think time, and asserts HTTP 200 plus account count 1. Baseline includes initial connection overhead. Requests/sec is k6's aggregate `http_reqs.rate`; latency is HTTP request duration and excludes client connection setup. Raw summaries are in `benchmarks/results`. This is one local paired comparison, not cloud capacity or a production SLA; warm cache performance does not represent import-heavy workloads or cold starts.

Reproduce by initializing an isolated `_benchmark` database, setting a temporary JWT_SECRET, running the seed script (token written to a private temporary file), starting API with CACHE_ENABLED=false/true, and running `benchmarks/dashboard.js` with BASE_URL/TOKEN/VUS/DURATION/RESULT_FILE. Keep the temporary token out of git/logs. Definitions: [k6 metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/).

Verification: 19/19 backend integration tests pass against isolated Docker PostgreSQL + Redis. Backend/frontend builds and both Docker image builds pass. Full Compose smoke covers frontend proxy, authentication, accounts, background import and dashboard. Frontend lint exits successfully with three existing hook-dependency warnings. Workflow now includes Redis, integration tests, builds, lint, Compose validation and Docker builds; [GitHub Actions passed](https://github.com/SaiSumedh18/finsight/actions/runs/37158075091) for the implementation commit.
