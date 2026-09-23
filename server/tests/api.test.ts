import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import request from "supertest";

import type {
    Express,
} from "express";

import type {
    Pool,
} from "pg";

let app: Express;
let pool: Pool;

const testUser = {
    name:
        "FinSight Test User",

    email:
        "test@finsight.dev",

    password:
        "TestPassword123!",
};

async function clearDatabase() {
    await pool.query(`
    TRUNCATE TABLE
      budgets,
      transactions,
      categories,
      accounts,
      users
    RESTART IDENTITY
    CASCADE
  `);
}

async function registerUser() {
    const response =
        await request(app)
            .post(
                "/api/auth/register"
            )
            .send(
                testUser
            );

    expect(
        response.status
    ).toBe(201);

    expect(
        response.body.success
    ).toBe(true);

    expect(
        response.body.token
    ).toBeTruthy();

    return response.body
        .token as string;
}

async function getCategories(
    token: string
) {
    const response =
        await request(app)
            .get(
                "/api/categories"
            )
            .set(
                "Authorization",
                `Bearer ${token}`
            );

    expect(
        response.status
    ).toBe(200);

    return response.body
        .categories as Array<{
            id: number;
            name: string;
            category_type:
            | "INCOME"
            | "EXPENSE";
        }>;
}

async function createCheckingAccount(
    token: string
) {
    const response =
        await request(app)
            .post(
                "/api/accounts"
            )
            .set(
                "Authorization",
                `Bearer ${token}`
            )
            .send({
                name:
                    "Test Checking",

                accountType:
                    "CHECKING",

                initialBalance:
                    1000,
            });

    expect(
        response.status
    ).toBe(201);

    return response.body
        .account.id as number;
}

beforeAll(
    async () => {
        const appModule =
            await import(
                "../src/app.js"
            );

        const dbModule =
            await import(
                "../src/config/db.js"
            );

        app =
            appModule.app;

        pool =
            dbModule.pool;
    }
);

beforeEach(
    async () => {
        await clearDatabase();
    }
);

afterAll(
    async () => {
        await pool.end();
    }
);

describe(
    "FinSight API",
    {
        concurrent: false,
    },
    () => {
        it(
            "returns a healthy API status",
            async () => {
                const response =
                    await request(app)
                        .get(
                            "/api/health"
                        );

                expect(
                    response.status
                ).toBe(200);

                expect(
                    response.body
                ).toEqual({
                    success: true,

                    message:
                        "FinSight API is running",
                });
            }
        );

        it(
            "registers, logs in, and returns the authenticated user",
            async () => {
                const registerResponse =
                    await request(app)
                        .post(
                            "/api/auth/register"
                        )
                        .send(
                            testUser
                        );

                expect(
                    registerResponse.status
                ).toBe(201);

                expect(
                    registerResponse.body
                        .user.email
                ).toBe(
                    testUser.email
                );

                const loginResponse =
                    await request(app)
                        .post(
                            "/api/auth/login"
                        )
                        .send({
                            email:
                                testUser.email,

                            password:
                                testUser.password,
                        });

                expect(
                    loginResponse.status
                ).toBe(200);

                const token =
                    loginResponse.body
                        .token as string;

                expect(
                    token
                ).toBeTruthy();

                const meResponse =
                    await request(app)
                        .get(
                            "/api/auth/me"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    meResponse.status
                ).toBe(200);

                expect(
                    meResponse.body
                        .user.email
                ).toBe(
                    testUser.email
                );
            }
        );

        it(
            "rejects protected requests without a JWT",
            async () => {
                const response =
                    await request(app)
                        .get(
                            "/api/accounts"
                        );

                expect(
                    response.status
                ).toBe(401);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.message
                ).toBe(
                    "Authorization token is required"
                );
            }
        );

        it(
            "creates accounts and calculates balances from transactions",
            async () => {
                const token =
                    await registerUser();

                const categories =
                    await getCategories(
                        token
                    );

                const salary =
                    categories.find(
                        (category) =>
                            category.name ===
                            "Salary"
                    );

                const food =
                    categories.find(
                        (category) =>
                            category.name ===
                            "Food"
                    );

                expect(
                    salary
                ).toBeTruthy();

                expect(
                    food
                ).toBeTruthy();

                const accountId =
                    await createCheckingAccount(
                        token
                    );

                const salaryResponse =
                    await request(app)
                        .post(
                            "/api/transactions"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        )
                        .send({
                            accountId,

                            categoryId:
                                salary!.id,

                            transactionType:
                                "INCOME",

                            amount:
                                2000,

                            description:
                                "Test salary",

                            transactionDate:
                                "2026-09-22",
                        });

                expect(
                    salaryResponse.status
                ).toBe(201);

                const foodResponse =
                    await request(app)
                        .post(
                            "/api/transactions"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        )
                        .send({
                            accountId,

                            categoryId:
                                food!.id,

                            transactionType:
                                "EXPENSE",

                            amount:
                                150,

                            description:
                                "Test groceries",

                            transactionDate:
                                "2026-09-22",
                        });

                expect(
                    foodResponse.status
                ).toBe(201);

                const accountResponse =
                    await request(app)
                        .get(
                            `/api/accounts/${accountId}`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    accountResponse.status
                ).toBe(200);

                expect(
                    accountResponse.body
                        .account
                        .current_balance
                ).toBe(2850);

                expect(
                    accountResponse.body
                        .account
                        .transaction_count
                ).toBe(2);
            }
        );

        it(
            "filters transactions by type and search text",
            async () => {
                const token =
                    await registerUser();

                const categories =
                    await getCategories(
                        token
                    );

                const salary =
                    categories.find(
                        (category) =>
                            category.name ===
                            "Salary"
                    )!;

                const food =
                    categories.find(
                        (category) =>
                            category.name ===
                            "Food"
                    )!;

                const accountId =
                    await createCheckingAccount(
                        token
                    );

                await request(app)
                    .post(
                        "/api/transactions"
                    )
                    .set(
                        "Authorization",
                        `Bearer ${token}`
                    )
                    .send({
                        accountId,

                        categoryId:
                            salary.id,

                        transactionType:
                            "INCOME",

                        amount:
                            2500,

                        description:
                            "September salary",

                        transactionDate:
                            "2026-09-20",
                    });

                await request(app)
                    .post(
                        "/api/transactions"
                    )
                    .set(
                        "Authorization",
                        `Bearer ${token}`
                    )
                    .send({
                        accountId,

                        categoryId:
                            food.id,

                        transactionType:
                            "EXPENSE",

                        amount:
                            85,

                        description:
                            "Grocery store",

                        transactionDate:
                            "2026-09-21",
                    });

                const incomeResponse =
                    await request(app)
                        .get(
                            "/api/transactions?type=INCOME"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    incomeResponse.status
                ).toBe(200);

                expect(
                    incomeResponse.body
                        .transactions
                ).toHaveLength(1);

                expect(
                    incomeResponse.body
                        .transactions[0]
                        .transaction_type
                ).toBe(
                    "INCOME"
                );

                const searchResponse =
                    await request(app)
                        .get(
                            "/api/transactions?search=grocery"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    searchResponse.status
                ).toBe(200);

                expect(
                    searchResponse.body
                        .transactions
                ).toHaveLength(1);

                expect(
                    searchResponse.body
                        .transactions[0]
                        .description
                ).toBe(
                    "Grocery store"
                );
            }
        );

        it(
            "calculates budget progress and dashboard analytics",
            async () => {
                const token =
                    await registerUser();

                const categories =
                    await getCategories(
                        token
                    );

                const salary =
                    categories.find(
                        (category) =>
                            category.name ===
                            "Salary"
                    )!;

                const food =
                    categories.find(
                        (category) =>
                            category.name ===
                            "Food"
                    )!;

                const accountId =
                    await createCheckingAccount(
                        token
                    );

                await request(app)
                    .post(
                        "/api/transactions"
                    )
                    .set(
                        "Authorization",
                        `Bearer ${token}`
                    )
                    .send({
                        accountId,

                        categoryId:
                            salary.id,

                        transactionType:
                            "INCOME",

                        amount:
                            2000,

                        description:
                            "Monthly salary",

                        transactionDate:
                            "2026-09-10",
                    });

                await request(app)
                    .post(
                        "/api/transactions"
                    )
                    .set(
                        "Authorization",
                        `Bearer ${token}`
                    )
                    .send({
                        accountId,

                        categoryId:
                            food.id,

                        transactionType:
                            "EXPENSE",

                        amount:
                            150,

                        description:
                            "Groceries",

                        transactionDate:
                            "2026-09-15",
                    });

                const budgetResponse =
                    await request(app)
                        .post(
                            "/api/budgets"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        )
                        .send({
                            categoryId:
                                food.id,

                            monthStart:
                                "2026-09-01",

                            amount:
                                500,
                        });

                expect(
                    budgetResponse.status
                ).toBe(201);

                const budgetsResponse =
                    await request(app)
                        .get(
                            "/api/budgets?month=2026-09-01"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    budgetsResponse.status
                ).toBe(200);

                expect(
                    budgetsResponse.body
                        .budgets
                ).toHaveLength(1);

                expect(
                    budgetsResponse.body
                        .budgets[0]
                        .spent
                ).toBe(150);

                expect(
                    budgetsResponse.body
                        .budgets[0]
                        .remaining
                ).toBe(350);

                expect(
                    budgetsResponse.body
                        .budgets[0]
                        .percent_used
                ).toBe(30);

                const dashboardResponse =
                    await request(app)
                        .get(
                            "/api/dashboard/summary?month=2026-09-01"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    dashboardResponse.status
                ).toBe(200);

                expect(
                    dashboardResponse.body
                        .summary
                        .totalBalance
                ).toBe(2850);

                expect(
                    dashboardResponse.body
                        .summary
                        .monthlyIncome
                ).toBe(2000);

                expect(
                    dashboardResponse.body
                        .summary
                        .monthlyExpenses
                ).toBe(150);

                expect(
                    dashboardResponse.body
                        .summary
                        .netCashFlow
                ).toBe(1850);

                expect(
                    dashboardResponse.body
                        .summary
                        .budgetTotal
                ).toBe(500);

                expect(
                    dashboardResponse.body
                        .summary
                        .budgetSpent
                ).toBe(150);

                expect(
                    dashboardResponse.body
                        .summary
                        .budgetRemaining
                ).toBe(350);
            }
        );
    }
);