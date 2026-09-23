import type {
    Response,
} from "express";

import { z } from "zod";

import { pool } from "../config/db.js";

import type {
    AuthRequest,
} from "../middleware/auth.middleware.js";

const monthStartSchema =
    z
        .string()
        .regex(
            /^\d{4}-\d{2}-01$/,
            "Month must use YYYY-MM-01 format"
        );

const createBudgetSchema =
    z.object({
        categoryId: z
            .number()
            .int()
            .positive(),

        monthStart:
            monthStartSchema,

        amount: z
            .number()
            .positive(
                "Budget amount must be greater than zero"
            )
            .finite(),
    });

const updateBudgetSchema =
    z.object({
        amount: z
            .number()
            .positive(
                "Budget amount must be greater than zero"
            )
            .finite(),
    });

function parseId(
    value:
        | string
        | string[]
        | undefined
) {
    const rawValue =
        Array.isArray(value)
            ? value[0]
            : value;

    if (!rawValue) {
        return null;
    }

    const id =
        Number(rawValue);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return null;
    }

    return id;
}

async function expenseCategoryBelongsToUser(
    categoryId: number,
    userId: number
) {
    const result =
        await pool.query(
            `
      SELECT id
      FROM categories

      WHERE
        id = $1
        AND user_id = $2
        AND category_type = 'EXPENSE'
      `,
            [
                categoryId,
                userId,
            ]
        );

    return Boolean(
        result.rowCount
    );
}

export async function createBudget(
    req: AuthRequest,
    res: Response
) {
    const validation =
        createBudgetSchema.safeParse(
            req.body
        );

    if (!validation.success) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    validation.error
                        .issues[0]
                        ?.message ??
                    "Invalid budget data",
            });
    }

    const {
        categoryId,
        monthStart,
        amount,
    } = validation.data;

    try {
        const validCategory =
            await expenseCategoryBelongsToUser(
                categoryId,
                req.userId!
            );

        if (!validCategory) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Budget category must be one of your expense categories",
                });
        }

        const result =
            await pool.query(
                `
        INSERT INTO budgets (
          user_id,
          category_id,
          month_start,
          amount
        )

        VALUES (
          $1,
          $2,
          $3,
          $4
        )

        RETURNING
          id,
          category_id,
          month_start,
          amount::double precision
            AS amount,
          created_at,
          updated_at
        `,
                [
                    req.userId,
                    categoryId,
                    monthStart,
                    amount,
                ]
            );

        return res
            .status(201)
            .json({
                success: true,
                budget:
                    result.rows[0],
            });
    } catch (error: any) {
        if (
            error?.code ===
            "23505"
        ) {
            return res
                .status(409)
                .json({
                    success: false,
                    message:
                        "A budget already exists for this category and month",
                });
        }

        console.error(
            "Create budget error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to create budget",
            });
    }
}

export async function getBudgets(
    req: AuthRequest,
    res: Response
) {
    const month =
        typeof req.query.month ===
            "string"
            ? req.query.month
            : null;

    if (month) {
        const validation =
            monthStartSchema.safeParse(
                month
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
    }

    const values: unknown[] =
        [
            req.userId,
        ];

    let monthCondition =
        "";

    if (month) {
        values.push(month);

        monthCondition =
            `AND b.month_start = $${values.length}`;
    }

    try {
        const result =
            await pool.query(
                `
        SELECT
          b.id,
          b.category_id,
          c.name
            AS category_name,

          b.month_start,

          b.amount::double precision
            AS amount,

          COALESCE(
            (
              SELECT
                SUM(t.amount)

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
            ),
            0
          )::double precision
            AS spent,

          (
            b.amount
            -
            COALESCE(
              (
                SELECT
                  SUM(t.amount)

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
              ),
              0
            )
          )::double precision
            AS remaining,

          CASE
            WHEN b.amount = 0
              THEN 0

            ELSE ROUND(
              (
                COALESCE(
                  (
                    SELECT
                      SUM(t.amount)

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
                  ),
                  0
                )
                /
                b.amount
              )
              * 100,
              2
            )
          END::double precision
            AS percent_used,

          b.created_at,
          b.updated_at

        FROM budgets b

        INNER JOIN categories c
          ON c.id =
          b.category_id

        WHERE
          b.user_id = $1
          ${monthCondition}

        ORDER BY
          b.month_start DESC,
          c.name ASC
        `,
                values
            );

        return res.json({
            success: true,
            budgets:
                result.rows,
        });
    } catch (error) {
        console.error(
            "Get budgets error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to load budgets",
            });
    }
}

export async function updateBudget(
    req: AuthRequest,
    res: Response
) {
    const budgetId =
        parseId(
            req.params.id
        );

    if (!budgetId) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Invalid budget id",
            });
    }

    const validation =
        updateBudgetSchema.safeParse(
            req.body
        );

    if (!validation.success) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    validation.error
                        .issues[0]
                        ?.message ??
                    "Invalid budget data",
            });
    }

    try {
        const result =
            await pool.query(
                `
        UPDATE budgets

        SET
          amount = $1,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = $2
          AND user_id = $3

        RETURNING
          id,
          category_id,
          month_start,
          amount::double precision
            AS amount,
          created_at,
          updated_at
        `,
                [
                    validation.data.amount,
                    budgetId,
                    req.userId,
                ]
            );

        if (
            !result.rowCount
        ) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Budget not found",
                });
        }

        return res.json({
            success: true,
            budget:
                result.rows[0],
        });
    } catch (error) {
        console.error(
            "Update budget error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to update budget",
            });
    }
}

export async function deleteBudget(
    req: AuthRequest,
    res: Response
) {
    const budgetId =
        parseId(
            req.params.id
        );

    if (!budgetId) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Invalid budget id",
            });
    }

    try {
        const result =
            await pool.query(
                `
        DELETE FROM budgets

        WHERE
          id = $1
          AND user_id = $2

        RETURNING id
        `,
                [
                    budgetId,
                    req.userId,
                ]
            );

        if (
            !result.rowCount
        ) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Budget not found",
                });
        }

        return res.json({
            success: true,
            message:
                "Budget deleted successfully",
        });
    } catch (error) {
        console.error(
            "Delete budget error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to delete budget",
            });
    }
}