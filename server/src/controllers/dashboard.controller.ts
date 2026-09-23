import type {
    Response,
} from "express";

import { z } from "zod";

import { pool } from "../config/db.js";

import type {
    AuthRequest,
} from "../middleware/auth.middleware.js";

const monthSchema =
    z
        .string()
        .regex(
            /^\d{4}-\d{2}-01$/,
            "Month must use YYYY-MM-01 format"
        );

function currentMonthStart() {
    const now =
        new Date();

    const year =
        now.getUTCFullYear();

    const month =
        String(
            now.getUTCMonth() + 1
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-01`;
}

export async function getDashboardSummary(
    req: AuthRequest,
    res: Response
) {
    const requestedMonth =
        typeof req.query.month ===
            "string"
            ? req.query.month
            : currentMonthStart();

    const validation =
        monthSchema.safeParse(
            requestedMonth
        );

    if (!validation.success) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Month must use YYYY-MM-01 format",
            });
    }

    const monthStart =
        validation.data;

    try {
        const [
            balanceResult,
            monthResult,
            budgetResult,
            spendingResult,
            recentResult,
            trendResult,
        ] =
            await Promise.all([
                pool.query(
                    `
          SELECT
            COALESCE(
              SUM(
                a.initial_balance
                +
                COALESCE(
                  (
                    SELECT
                      SUM(
                        CASE
                          WHEN t.transaction_type =
                            'INCOME'
                            THEN t.amount

                          WHEN t.transaction_type =
                            'EXPENSE'
                            THEN -t.amount

                          ELSE 0
                        END
                      )

                    FROM transactions t

                    WHERE
                      t.account_id =
                      a.id
                  ),
                  0
                )
              ),
              0
            )::double precision
              AS total_balance,

            COUNT(a.id)::integer
              AS account_count

          FROM accounts a

          WHERE
            a.user_id = $1
          `,
                    [
                        req.userId,
                    ]
                ),

                pool.query(
                    `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type =
                    'INCOME'
                    THEN t.amount
                  ELSE 0
                END
              ),
              0
            )::double precision
              AS income,

            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type =
                    'EXPENSE'
                    THEN t.amount
                  ELSE 0
                END
              ),
              0
            )::double precision
              AS expenses,

            COUNT(t.id)::integer
              AS transaction_count

          FROM transactions t

          INNER JOIN accounts a
            ON a.id =
            t.account_id

          WHERE
            a.user_id = $1
            AND
            t.transaction_date >=
              $2::date
            AND
            t.transaction_date <
              (
                $2::date
                + INTERVAL '1 month'
              )
          `,
                    [
                        req.userId,
                        monthStart,
                    ]
                ),

                pool.query(
                    `
          SELECT
            COALESCE(
              SUM(b.amount),
              0
            )::double precision
              AS budget_total,

            COALESCE(
              SUM(
                (
                  SELECT
                    COALESCE(
                      SUM(t.amount),
                      0
                    )

                  FROM transactions t

                  INNER JOIN accounts a
                    ON a.id =
                    t.account_id

                  WHERE
                    a.user_id =
                    b.user_id
                    AND
                    t.category_id =
                    b.category_id
                    AND
                    t.transaction_type =
                    'EXPENSE'
                    AND
                    t.transaction_date >=
                    b.month_start
                    AND
                    t.transaction_date <
                    (
                      b.month_start
                      + INTERVAL '1 month'
                    )
                )
              ),
              0
            )::double precision
              AS budget_spent

          FROM budgets b

          WHERE
            b.user_id = $1
            AND
            b.month_start =
              $2::date
          `,
                    [
                        req.userId,
                        monthStart,
                    ]
                ),

                pool.query(
                    `
          SELECT
            COALESCE(
              c.name,
              'Uncategorized'
            ) AS category_name,

            SUM(
              t.amount
            )::double precision
              AS amount

          FROM transactions t

          INNER JOIN accounts a
            ON a.id =
            t.account_id

          LEFT JOIN categories c
            ON c.id =
            t.category_id

          WHERE
            a.user_id = $1
            AND
            t.transaction_type =
              'EXPENSE'
            AND
            t.transaction_date >=
              $2::date
            AND
            t.transaction_date <
              (
                $2::date
                + INTERVAL '1 month'
              )

          GROUP BY
            COALESCE(
              c.name,
              'Uncategorized'
            )

          ORDER BY
            amount DESC
          `,
                    [
                        req.userId,
                        monthStart,
                    ]
                ),

                pool.query(
                    `
          SELECT
            t.id,
            t.transaction_type,

            t.amount::double precision
              AS amount,

            t.description,
            t.transaction_date,

            a.name
              AS account_name,

            c.name
              AS category_name

          FROM transactions t

          INNER JOIN accounts a
            ON a.id =
            t.account_id

          LEFT JOIN categories c
            ON c.id =
            t.category_id

          WHERE
            a.user_id = $1

          ORDER BY
            t.transaction_date DESC,
            t.created_at DESC

          LIMIT 5
          `,
                    [
                        req.userId,
                    ]
                ),

                pool.query(
                    `
          WITH months AS (
            SELECT
              generate_series(
                date_trunc(
                  'month',
                  $2::date
                )
                - INTERVAL '5 months',

                date_trunc(
                  'month',
                  $2::date
                ),

                INTERVAL '1 month'
              )::date
                AS month_start
          )

          SELECT
            m.month_start,

            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type =
                    'INCOME'
                    THEN t.amount
                  ELSE 0
                END
              ),
              0
            )::double precision
              AS income,

            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type =
                    'EXPENSE'
                    THEN t.amount
                  ELSE 0
                END
              ),
              0
            )::double precision
              AS expenses

          FROM months m

          LEFT JOIN accounts a
            ON a.user_id = $1

          LEFT JOIN transactions t
            ON t.account_id =
            a.id
            AND
            t.transaction_date >=
              m.month_start
            AND
            t.transaction_date <
              (
                m.month_start
                + INTERVAL '1 month'
              )

          GROUP BY
            m.month_start

          ORDER BY
            m.month_start ASC
          `,
                    [
                        req.userId,
                        monthStart,
                    ]
                ),
            ]);

        const balance =
            balanceResult.rows[0];

        const month =
            monthResult.rows[0];

        const budget =
            budgetResult.rows[0];

        const income =
            month.income ?? 0;

        const expenses =
            month.expenses ?? 0;

        return res.json({
            success: true,

            month:
                monthStart,

            summary: {
                totalBalance:
                    balance.total_balance ??
                    0,

                accountCount:
                    balance.account_count ??
                    0,

                monthlyIncome:
                    income,

                monthlyExpenses:
                    expenses,

                netCashFlow:
                    income -
                    expenses,

                transactionCount:
                    month.transaction_count ??
                    0,

                budgetTotal:
                    budget.budget_total ??
                    0,

                budgetSpent:
                    budget.budget_spent ??
                    0,

                budgetRemaining:
                    (
                        budget.budget_total ??
                        0
                    ) -
                    (
                        budget.budget_spent ??
                        0
                    ),
            },

            spendingByCategory:
                spendingResult.rows,

            recentTransactions:
                recentResult.rows,

            monthlyTrend:
                trendResult.rows,
        });
    } catch (error) {
        console.error(
            "Dashboard summary error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to load dashboard summary",
            });
    }
}