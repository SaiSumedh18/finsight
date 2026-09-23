import type {
    Response,
} from "express";

import { z } from "zod";

import { pool } from "../config/db.js";

import type {
    AuthRequest,
} from "../middleware/auth.middleware.js";

const transactionTypeSchema =
    z.enum([
        "INCOME",
        "EXPENSE",
    ]);

const dateSchema =
    z
        .string()
        .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must use YYYY-MM-DD format"
        )
        .refine(
            (value) => {
                const date =
                    new Date(
                        `${value}T00:00:00Z`
                    );

                return (
                    !Number.isNaN(
                        date.getTime()
                    ) &&
                    date
                        .toISOString()
                        .startsWith(
                            value
                        )
                );
            },
            "Invalid transaction date"
        );

const createTransactionSchema =
    z.object({
        accountId: z
            .number()
            .int()
            .positive(),

        categoryId: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),

        transactionType:
            transactionTypeSchema,

        amount: z
            .number()
            .positive(
                "Amount must be greater than zero"
            )
            .finite(),

        description: z
            .string()
            .trim()
            .min(
                2,
                "Description must be at least 2 characters"
            )
            .max(200),

        transactionDate:
            dateSchema,

        notes: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .optional(),
    });

const updateTransactionSchema =
    z.object({
        accountId: z
            .number()
            .int()
            .positive()
            .optional(),

        categoryId: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),

        transactionType:
            transactionTypeSchema
                .optional(),

        amount: z
            .number()
            .positive(
                "Amount must be greater than zero"
            )
            .finite()
            .optional(),

        description: z
            .string()
            .trim()
            .min(
                2,
                "Description must be at least 2 characters"
            )
            .max(200)
            .optional(),

        transactionDate:
            dateSchema.optional(),

        notes: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .optional(),
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

async function accountBelongsToUser(
    accountId: number,
    userId: number
) {
    const result =
        await pool.query(
            `
      SELECT id
      FROM accounts

      WHERE
        id = $1
        AND user_id = $2
      `,
            [
                accountId,
                userId,
            ]
        );

    return Boolean(
        result.rowCount
    );
}

async function categoryIsValid(
    categoryId: number,
    userId: number,
    transactionType:
        | "INCOME"
        | "EXPENSE"
) {
    const result =
        await pool.query(
            `
      SELECT id
      FROM categories

      WHERE
        id = $1
        AND user_id = $2
        AND category_type = $3
      `,
            [
                categoryId,
                userId,
                transactionType,
            ]
        );

    return Boolean(
        result.rowCount
    );
}

export async function createTransaction(
    req: AuthRequest,
    res: Response
) {
    const validation =
        createTransactionSchema.safeParse(
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
                    "Invalid transaction data",
            });
    }

    const {
        accountId,
        categoryId,
        transactionType,
        amount,
        description,
        transactionDate,
        notes,
    } = validation.data;

    try {
        const ownsAccount =
            await accountBelongsToUser(
                accountId,
                req.userId!
            );

        if (!ownsAccount) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Account not found",
                });
        }

        if (
            categoryId !==
            undefined &&
            categoryId !==
            null
        ) {
            const validCategory =
                await categoryIsValid(
                    categoryId,
                    req.userId!,
                    transactionType
                );

            if (!validCategory) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Category does not belong to this user or does not match the transaction type",
                    });
            }
        }

        const result =
            await pool.query(
                `
        INSERT INTO transactions (
          account_id,
          category_id,
          transaction_type,
          amount,
          description,
          transaction_date,
          notes
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )

        RETURNING
          id,
          account_id,
          category_id,
          transaction_type,
          amount::double precision
            AS amount,
          description,
          transaction_date,
          notes,
          created_at,
          updated_at
        `,
                [
                    accountId,
                    categoryId ?? null,
                    transactionType,
                    amount,
                    description,
                    transactionDate,
                    notes ?? null,
                ]
            );

        return res
            .status(201)
            .json({
                success: true,
                transaction:
                    result.rows[0],
            });
    } catch (error) {
        console.error(
            "Create transaction error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to create transaction",
            });
    }
}

export async function getTransactions(
    req: AuthRequest,
    res: Response
) {
    const values: unknown[] =
        [
            req.userId,
        ];

    const conditions: string[] =
        [
            "a.user_id = $1",
        ];

    const accountId =
        req.query.accountId;

    const categoryId =
        req.query.categoryId;

    const type =
        req.query.type;

    const startDate =
        req.query.startDate;

    const endDate =
        req.query.endDate;

    const search =
        req.query.search;

    if (
        typeof accountId ===
        "string"
    ) {
        const parsed =
            Number(accountId);

        if (
            !Number.isInteger(
                parsed
            ) ||
            parsed <= 0
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid account filter",
                });
        }

        values.push(parsed);

        conditions.push(
            `t.account_id = $${values.length}`
        );
    }

    if (
        typeof categoryId ===
        "string"
    ) {
        const parsed =
            Number(categoryId);

        if (
            !Number.isInteger(
                parsed
            ) ||
            parsed <= 0
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid category filter",
                });
        }

        values.push(parsed);

        conditions.push(
            `t.category_id = $${values.length}`
        );
    }

    if (
        typeof type ===
        "string"
    ) {
        if (
            type !== "INCOME" &&
            type !== "EXPENSE"
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid transaction type filter",
                });
        }

        values.push(type);

        conditions.push(
            `t.transaction_type = $${values.length}`
        );
    }

    if (
        typeof startDate ===
        "string"
    ) {
        const validation =
            dateSchema.safeParse(
                startDate
            );

        if (!validation.success) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid start date",
                });
        }

        values.push(startDate);

        conditions.push(
            `t.transaction_date >= $${values.length}`
        );
    }

    if (
        typeof endDate ===
        "string"
    ) {
        const validation =
            dateSchema.safeParse(
                endDate
            );

        if (!validation.success) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid end date",
                });
        }

        values.push(endDate);

        conditions.push(
            `t.transaction_date <= $${values.length}`
        );
    }

    if (
        typeof search ===
        "string" &&
        search.trim() !== ""
    ) {
        values.push(
            `%${search.trim()}%`
        );

        conditions.push(
            `(
        t.description ILIKE $${values.length}
        OR
        COALESCE(t.notes, '') ILIKE $${values.length}
      )`
        );
    }

    try {
        const result =
            await pool.query(
                `
        SELECT
          t.id,
          t.account_id,
          a.name
            AS account_name,

          t.category_id,
          c.name
            AS category_name,

          t.transaction_type,

          t.amount::double precision
            AS amount,

          t.description,
          t.transaction_date,
          t.notes,
          t.created_at,
          t.updated_at

        FROM transactions t

        INNER JOIN accounts a
          ON a.id =
          t.account_id

        LEFT JOIN categories c
          ON c.id =
          t.category_id

        WHERE
          ${conditions.join(
                    " AND "
                )}

        ORDER BY
          t.transaction_date DESC,
          t.created_at DESC
        `,
                values
            );

        return res.json({
            success: true,
            transactions:
                result.rows,
        });
    } catch (error) {
        console.error(
            "Get transactions error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to load transactions",
            });
    }
}

export async function getTransactionById(
    req: AuthRequest,
    res: Response
) {
    const transactionId =
        parseId(
            req.params.id
        );

    if (!transactionId) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Invalid transaction id",
            });
    }

    try {
        const result =
            await pool.query(
                `
        SELECT
          t.id,
          t.account_id,
          a.name
            AS account_name,

          t.category_id,
          c.name
            AS category_name,

          t.transaction_type,

          t.amount::double precision
            AS amount,

          t.description,
          t.transaction_date,
          t.notes,
          t.created_at,
          t.updated_at

        FROM transactions t

        INNER JOIN accounts a
          ON a.id =
          t.account_id

        LEFT JOIN categories c
          ON c.id =
          t.category_id

        WHERE
          t.id = $1
          AND a.user_id = $2
        `,
                [
                    transactionId,
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
                        "Transaction not found",
                });
        }

        return res.json({
            success: true,
            transaction:
                result.rows[0],
        });
    } catch (error) {
        console.error(
            "Get transaction error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to load transaction",
            });
    }
}

export async function updateTransaction(
    req: AuthRequest,
    res: Response
) {
    const transactionId =
        parseId(
            req.params.id
        );

    if (!transactionId) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Invalid transaction id",
            });
    }

    const validation =
        updateTransactionSchema.safeParse(
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
                    "Invalid transaction data",
            });
    }

    if (
        Object.keys(
            validation.data
        ).length === 0
    ) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "At least one transaction field is required",
            });
    }

    try {
        const existingResult =
            await pool.query(
                `
        SELECT
          t.id,
          t.account_id,
          t.category_id,
          t.transaction_type

        FROM transactions t

        INNER JOIN accounts a
          ON a.id =
          t.account_id

        WHERE
          t.id = $1
          AND a.user_id = $2
        `,
                [
                    transactionId,
                    req.userId,
                ]
            );

        if (
            !existingResult.rowCount
        ) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Transaction not found",
                });
        }

        const existing =
            existingResult.rows[0];

        const accountId =
            validation.data
                .accountId ??
            existing.account_id;

        const transactionType =
            validation.data
                .transactionType ??
            existing.transaction_type;

        const categoryId =
            validation.data
                .categoryId !==
                undefined
                ? validation.data
                    .categoryId
                : existing.category_id;

        const ownsAccount =
            await accountBelongsToUser(
                accountId,
                req.userId!
            );

        if (!ownsAccount) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Account not found",
                });
        }

        if (
            categoryId !== null
        ) {
            const validCategory =
                await categoryIsValid(
                    categoryId,
                    req.userId!,
                    transactionType
                );

            if (!validCategory) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Category does not belong to this user or does not match the transaction type",
                    });
            }
        }

        const fields: string[] =
            [];

        const values: unknown[] =
            [];

        const {
            amount,
            description,
            transactionDate,
            notes,
        } = validation.data;

        if (
            validation.data
                .accountId !==
            undefined
        ) {
            values.push(
                accountId
            );

            fields.push(
                `account_id = $${values.length}`
            );
        }

        if (
            validation.data
                .categoryId !==
            undefined
        ) {
            values.push(
                categoryId
            );

            fields.push(
                `category_id = $${values.length}`
            );
        }

        if (
            validation.data
                .transactionType !==
            undefined
        ) {
            values.push(
                transactionType
            );

            fields.push(
                `transaction_type = $${values.length}`
            );
        }

        if (
            amount !== undefined
        ) {
            values.push(
                amount
            );

            fields.push(
                `amount = $${values.length}`
            );
        }

        if (
            description !==
            undefined
        ) {
            values.push(
                description
            );

            fields.push(
                `description = $${values.length}`
            );
        }

        if (
            transactionDate !==
            undefined
        ) {
            values.push(
                transactionDate
            );

            fields.push(
                `transaction_date = $${values.length}`
            );
        }

        if (
            notes !== undefined
        ) {
            values.push(
                notes
            );

            fields.push(
                `notes = $${values.length}`
            );
        }

        fields.push(
            "updated_at = CURRENT_TIMESTAMP"
        );

        values.push(
            transactionId
        );

        const transactionIdIndex =
            values.length;

        values.push(
            req.userId
        );

        const userIdIndex =
            values.length;

        const result =
            await pool.query(
                `
        UPDATE transactions t

        SET
          ${fields.join(", ")}

        FROM accounts a

        WHERE
          t.id =
          $${transactionIdIndex}
          AND
          t.account_id =
          a.id
          AND
          a.user_id =
          $${userIdIndex}

        RETURNING
          t.id,
          t.account_id,
          t.category_id,
          t.transaction_type,
          t.amount::double precision
            AS amount,
          t.description,
          t.transaction_date,
          t.notes,
          t.created_at,
          t.updated_at
        `,
                values
            );

        return res.json({
            success: true,
            transaction:
                result.rows[0],
        });
    } catch (error) {
        console.error(
            "Update transaction error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to update transaction",
            });
    }
}

export async function deleteTransaction(
    req: AuthRequest,
    res: Response
) {
    const transactionId =
        parseId(
            req.params.id
        );

    if (!transactionId) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Invalid transaction id",
            });
    }

    try {
        const result =
            await pool.query(
                `
        DELETE FROM transactions t

        USING accounts a

        WHERE
          t.id = $1
          AND t.account_id =
            a.id
          AND a.user_id =
            $2

        RETURNING
          t.id
        `,
                [
                    transactionId,
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
                        "Transaction not found",
                });
        }

        return res.json({
            success: true,
            message:
                "Transaction deleted successfully",
        });
    } catch (error) {
        console.error(
            "Delete transaction error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to delete transaction",
            });
    }
}