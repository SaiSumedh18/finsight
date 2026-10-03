# FinSight

[![FinSight CI](https://github.com/SaiSumedh18/finsight/actions/workflows/ci.yml/badge.svg)](https://github.com/SaiSumedh18/finsight/actions/workflows/ci.yml)

FinSight is a full-stack personal finance dashboard for managing accounts, transactions, monthly budgets, and cash-flow analytics.

The application uses a React + TypeScript frontend, a Node.js + Express API, and PostgreSQL. It includes JWT authentication, per-user financial data isolation, automated integration testing, Docker support, Nginx, and GitHub Actions CI.

## Screenshots

### Dashboard

![FinSight Dashboard](docs/screenshots/dashboard.png)

### Transactions

![FinSight Transactions](docs/screenshots/transactions.png)

### Accounts

![FinSight Accounts](docs/screenshots/accounts.png)

### Budgets

![FinSight Budgets](docs/screenshots/budgets.png)

### Login

![FinSight Login](docs/screenshots/login.png)

## Features

### Authentication

- User registration and login
- Password hashing with bcrypt
- JWT-based authentication
- Protected API routes
- Per-user data isolation

### Accounts

- Create, edit, and delete financial accounts
- Checking, savings, credit, cash, investment, and other account types
- Automatic current-balance calculation
- Transaction count per account

### Transactions

- Create, edit, and delete income and expense transactions
- Assign transactions to accounts and categories
- Search descriptions and notes
- Filter by transaction type
- Filter by account
- Filter by category
- Filter by date range

### Budgets

- Create monthly budgets by expense category
- Edit and delete budgets
- Track amount spent
- Calculate remaining budget
- Calculate percentage used
- Display progress bars
- Detect over-budget categories
- Switch between monthly periods

### Dashboard Analytics

- Total balance
- Monthly income
- Monthly expenses
- Net cash flow
- Six-month cash-flow trends
- Spending by category
- Budget progress
- Account balances
- Recent transactions

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, Axios |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt |
| Security | Helmet, CORS |
| Testing | Vitest, Supertest |
| Containers | Docker, Docker Compose, Nginx |
| CI/CD | GitHub Actions |

## Architecture

```text
Browser
   |
   v
React + TypeScript
   |
   | REST API + JWT
   v
Node.js + Express
   |
   v
PostgreSQL
```

The full Docker configuration uses Nginx as the frontend web server and reverse proxy:

```text
Browser
   |
   v
Nginx
   |-------------------------|
   |                         |
React static files          /api
                              |
                              v
                           Express
                              |
                              v
                         PostgreSQL
```

## Project Structure

```text
finsight/
├── .github/
│   └── workflows/
│       └── ci.yml
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── types.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── scripts/
│   ├── sql/
│   │   └── schema.sql
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── tests/
│   │   ├── api.test.ts
│   │   └── setup.ts
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── docs/
│   └── screenshots/
├── docker-compose.yml
├── docker-compose.full.yml
└── README.md
```

## Getting Started

### Prerequisites

Install:

- Node.js 24+
- npm
- Docker Desktop
- Git

### Clone the repository

```bash
git clone https://github.com/SaiSumedh18/finsight.git
cd finsight
```

### Start PostgreSQL

```bash
docker compose up -d postgres
```

The development PostgreSQL instance is exposed on:

```text
localhost:5434
```

### Initialize the development database

```bash
docker exec -i finsight-postgres \
  psql -U finsight -d finsight \
  < server/sql/schema.sql
```

### Configure the backend

Copy:

```text
server/.env.example
```

to:

```text
server/.env
```

Example:

```env
PORT=4100
DATABASE_URL=postgresql://finsight:finsight_password@127.0.0.1:5434/finsight
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### Start the backend

```bash
cd server
npm ci
npm run dev
```

The API runs at:

```text
http://localhost:4100
```

Health endpoint:

```text
http://localhost:4100/api/health
```

### Configure the frontend

Copy:

```text
client/.env.example
```

to:

```text
client/.env
```

Example:

```env
VITE_API_URL=http://localhost:4100/api
```

### Start the frontend

Open another terminal:

```bash
cd client
npm ci
npm run dev
```

Open:

```text
http://localhost:5173
```

## Automated Testing

FinSight uses Vitest and Supertest for backend integration testing.

The current test suite verifies:

- API health
- user registration and login
- JWT-protected routes
- account creation
- account balance calculations
- transaction filtering and search
- budget progress
- dashboard analytics

### Create the test database

With the development PostgreSQL container running:

```bash
docker exec finsight-postgres \
  psql -U finsight -d postgres \
  -c "CREATE DATABASE finsight_test;"
```

Then initialize its schema:

```bash
docker exec -i finsight-postgres \
  psql -U finsight -d finsight_test \
  < server/sql/schema.sql
```

### Run tests

```bash
cd server
npm test
```

Current automated suite:

```text
Test Files  1 passed
Tests       6 passed
```

The test database is separate from the normal development database so automated tests do not modify development data.

## Docker

FinSight includes a full production-style Docker configuration consisting of:

- PostgreSQL
- Express API
- React production build
- Nginx reverse proxy

Start the complete stack:

```bash
docker compose -f docker-compose.full.yml up --build -d
```

Open:

```text
http://localhost:8080
```

Services:

| Service | Port |
| --- | ---: |
| Frontend / Nginx | 8080 |
| Backend API | 4101 |
| PostgreSQL | 5435 |

Check status:

```bash
docker compose -f docker-compose.full.yml ps
```

Stop:

```bash
docker compose -f docker-compose.full.yml down
```

## Continuous Integration

GitHub Actions automatically runs on pushes and pull requests to `main`.

The CI workflow performs:

1. Backend dependency installation
2. PostgreSQL test database initialization
3. API integration tests
4. Backend TypeScript build
5. Frontend dependency installation
6. Frontend production build
7. Backend Docker image build
8. Frontend Docker image build

Workflow file:

```text
.github/workflows/ci.yml
```

The current CI pipeline validates:

```text
API integration tests       ✓
Backend TypeScript build    ✓
Frontend production build   ✓
Backend Docker image        ✓
Frontend Docker image       ✓
```

## API Overview

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Accounts

```text
POST   /api/accounts
GET    /api/accounts
GET    /api/accounts/:id
PATCH  /api/accounts/:id
DELETE /api/accounts/:id
```

### Categories

```text
POST   /api/categories
GET    /api/categories
DELETE /api/categories/:id
```

### Transactions

```text
POST   /api/transactions
GET    /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
```

Supported transaction filters include:

```text
accountId
categoryId
type
startDate
endDate
search
```

### Budgets

```text
POST   /api/budgets
GET    /api/budgets
PATCH  /api/budgets/:id
DELETE /api/budgets/:id
```

### Dashboard

```text
GET /api/dashboard/summary
```

## Database

FinSight uses five primary PostgreSQL tables:

```text
users
accounts
categories
transactions
budgets
```

Foreign keys enforce relationships between users, accounts, categories, transactions, and budgets.

Financial summaries are calculated from PostgreSQL queries rather than storing duplicated totals in frontend state.

## Security

The project includes:

- bcrypt password hashing
- JWT authentication
- protected API routes
- parameterized PostgreSQL queries
- Helmet HTTP security headers
- CORS configuration
- environment-based secrets
- `.env` files excluded from Git
- per-user database queries

Secrets and local environment files are not committed to the repository.

## Future Improvements

- Recurring transactions
- CSV transaction import
- Custom category management
- Savings goals
- Password reset flow
- Pagination for large transaction histories
- End-to-end browser testing
- Optional cloud deployment

## Author

**Sai Sumedh Kaveti**

GitHub: [SaiSumedh18](https://github.com/SaiSumedh18)
## Verified backend upgrade (2026-10-03)

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
- AWS preparation: see [deploy/README.md](deploy/README.md). ECS/RDS/ElastiCache configuration exists but no AWS resources were created. S3 is not implemented or claimed.

### Measured local k6 comparison

| Mode | Transactions | Concurrent VUs | p50 ms | p95 ms | Requests/sec | Requests | HTTP error rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cache disabled | 10,000 | 10 | 11.964 | 18.8815 | 762.77 | 22,891 | 0% |
| Cache enabled, warm | 10,000 | 10 | 1.616 | 3.121 | 5,236.36 | 157,097 | 0% |

Method: k6 2.3.0, Node 24.11.0, native PostgreSQL 16 on a separate local cluster/benchmark database, Docker Redis 7, macOS arm64. `server/scripts/seed-benchmark.mjs` seeds one synthetic user/account and 10,000 transactions over May–October 2026; it refuses databases without `_benchmark`. No real records or credentials are used. Both API processes use the same seed, JWT, endpoint (`/api/dashboard/summary?month=2026-10-01`) and application build. Cache-disabled baseline ran first on port 4191; warm cached variant ran second on 4192 after 20 warmup requests. Each run uses constant 10 VUs for 30 seconds, no think time, and asserts HTTP 200 plus account count 1. Baseline includes initial connection overhead. Requests/sec is k6's aggregate `http_reqs.rate`; latency is HTTP request duration and excludes client connection setup. Raw summaries are in `benchmarks/results`. This is one local paired comparison, not cloud capacity or a production SLA; warm cache performance does not represent import-heavy workloads or cold starts.

Reproduce by initializing an isolated `_benchmark` database, setting a temporary JWT_SECRET, running the seed script (token written to a private temporary file), starting API with CACHE_ENABLED=false/true, and running `benchmarks/dashboard.js` with BASE_URL/TOKEN/VUS/DURATION/RESULT_FILE. Keep the temporary token out of git/logs. Definitions: [k6 metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/).

Verification: 19/19 backend integration tests pass against isolated Docker PostgreSQL + Redis. Backend/frontend builds and both Docker image builds pass. Full Compose smoke covers frontend proxy, authentication, accounts, background import and dashboard. Frontend lint exits successfully with three existing hook-dependency warnings. Workflow now includes Redis, integration tests, builds, lint, Compose validation and Docker builds; remote GitHub Actions has not been run or claimed green.
