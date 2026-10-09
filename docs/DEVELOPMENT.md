# FinSight — development guide

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

Original suite at the time of writing (see the README for the current suite):

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
