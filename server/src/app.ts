import express from "express";
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
    express.json()
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