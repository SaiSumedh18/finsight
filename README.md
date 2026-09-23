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