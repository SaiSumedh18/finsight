import importRoutes from './routes/import.routes.js';
import express from "express";
import { resolve } from "node:path";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

export const app =
    express();

const allowedOrigins = [
    "http://localhost:5173",
    process.env.CLIENT_URL,
].filter(
    (origin): origin is string =>
        Boolean(origin)
);

app.use(
    helmet()
);

app.use(
    cors({
        origin:
            allowedOrigins,
        credentials: true,
    })
);

app.use(
    express.json({ limit: "3mb" })
);

app.get(
    "/api/health",
    (_req, res) => {
        res.status(200).json({
            success: true,
            message:
                "FinSight API is running",
        });
    }
);

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/accounts",
    accountRoutes
);

app.use(
    "/api/categories",
    categoryRoutes
);

app.use(
    "/api/transactions",
    transactionRoutes
);

app.use(
    "/api/budgets",
    budgetRoutes
);

app.use(
    "/api/dashboard",
    dashboardRoutes
);
app.use("/api/imports", importRoutes);

// Optional same-origin web bundle for the free public demo.
if (process.env.STATIC_DIR) {
    const directory = resolve(process.env.STATIC_DIR);
    app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
    app.use(express.static(directory));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(directory, 'index.html')));
}
