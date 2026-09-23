import type {
  Response,
} from "express";

import { z } from "zod";

import { pool } from "../config/db.js";
import type {
  AuthRequest,
} from "../middleware/auth.middleware.js";

const accountTypeSchema =
  z.enum([
    "CHECKING",
    "SAVINGS",
    "CREDIT",
    "CASH",
    "INVESTMENT",
    "OTHER",
  ]);

const createAccountSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Account name must be at least 2 characters"
      )
      .max(120),

    accountType:
      accountTypeSchema,

    initialBalance: z
      .number()
      .finite()
      .default(0),
  });

const updateAccountSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Account name must be at least 2 characters"
      )
      .max(120)
      .optional(),

    accountType:
      accountTypeSchema.optional(),

    initialBalance: z
      .number()
      .finite()
      .optional(),
  });

function parseAccountId(
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

export async function createAccount(
  req: AuthRequest,
  res: Response
) {
  const validation =
    createAccountSchema.safeParse(
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
          "Invalid account data",
      });
  }

  const {
    name,
    accountType,
    initialBalance,
  } = validation.data;

  try {
    const result =
      await pool.query(
        `
        INSERT INTO accounts (
          user_id,
          name,
          account_type,
          initial_balance
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          id,
          name,
          account_type,
          initial_balance::double precision
            AS initial_balance,
          created_at,
          updated_at
        `,
        [
          req.userId,
          name,
          accountType,
          initialBalance,
        ]
      );

    const account = {
      ...result.rows[0],

      current_balance:
        result.rows[0]
          .initial_balance,
    };

    return res
      .status(201)
      .json({
        success: true,
        account,
      });
  } catch (error) {
    console.error(
      "Create account error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to create account",
      });
  }
}

export async function getAccounts(
  req: AuthRequest,
  res: Response
) {
  try {
    const result =
      await pool.query(
        `
        SELECT
          a.id,
          a.name,
          a.account_type,

          a.initial_balance::double precision
            AS initial_balance,

          (
            a.initial_balance
            +
            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type = 'INCOME'
                    THEN t.amount
                  WHEN t.transaction_type = 'EXPENSE'
                    THEN -t.amount
                  ELSE 0
                END
              ),
              0
            )
          )::double precision
            AS current_balance,

          COUNT(t.id)::integer
            AS transaction_count,

          a.created_at,
          a.updated_at

        FROM accounts a

        LEFT JOIN transactions t
          ON t.account_id = a.id

        WHERE a.user_id = $1

        GROUP BY
          a.id

        ORDER BY
          a.created_at ASC
        `,
        [
          req.userId,
        ]
      );

    return res.json({
      success: true,
      accounts:
        result.rows,
    });
  } catch (error) {
    console.error(
      "Get accounts error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to load accounts",
      });
  }
}

export async function getAccountById(
  req: AuthRequest,
  res: Response
) {
  const accountId =
    parseAccountId(
      req.params.id
    );

  if (!accountId) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Invalid account id",
      });
  }

  try {
    const result =
      await pool.query(
        `
        SELECT
          a.id,
          a.name,
          a.account_type,

          a.initial_balance::double precision
            AS initial_balance,

          (
            a.initial_balance
            +
            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type = 'INCOME'
                    THEN t.amount
                  WHEN t.transaction_type = 'EXPENSE'
                    THEN -t.amount
                  ELSE 0
                END
              ),
              0
            )
          )::double precision
            AS current_balance,

          COUNT(t.id)::integer
            AS transaction_count,

          a.created_at,
          a.updated_at

        FROM accounts a

        LEFT JOIN transactions t
          ON t.account_id = a.id

        WHERE
          a.id = $1
          AND a.user_id = $2

        GROUP BY
          a.id
        `,
        [
          accountId,
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
            "Account not found",
        });
    }

    return res.json({
      success: true,
      account:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      "Get account error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to load account",
      });
  }
}

export async function updateAccount(
  req: AuthRequest,
  res: Response
) {
  const accountId =
    parseAccountId(
      req.params.id
    );

  if (!accountId) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Invalid account id",
      });
  }

  const validation =
    updateAccountSchema.safeParse(
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
          "Invalid account data",
      });
  }

  const {
    name,
    accountType,
    initialBalance,
  } = validation.data;

  if (
    name === undefined &&
    accountType === undefined &&
    initialBalance === undefined
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "At least one account field is required",
      });
  }

  const fields: string[] =
    [];

  const values: unknown[] =
    [];

  if (name !== undefined) {
    values.push(name);

    fields.push(
      `name = $${values.length}`
    );
  }

  if (
    accountType !== undefined
  ) {
    values.push(
      accountType
    );

    fields.push(
      `account_type = $${values.length}`
    );
  }

  if (
    initialBalance !==
    undefined
  ) {
    values.push(
      initialBalance
    );

    fields.push(
      `initial_balance = $${values.length}`
    );
  }

  fields.push(
    "updated_at = CURRENT_TIMESTAMP"
  );

  values.push(
    accountId
  );

  const accountIdIndex =
    values.length;

  values.push(
    req.userId
  );

  const userIdIndex =
    values.length;

  try {
    const result =
      await pool.query(
        `
        UPDATE accounts
        SET
          ${fields.join(", ")}

        WHERE
          id = $${accountIdIndex}
          AND user_id = $${userIdIndex}

        RETURNING
          id,
          name,
          account_type,
          initial_balance::double precision
            AS initial_balance,
          created_at,
          updated_at
        `,
        values
      );

    if (
      !result.rowCount
    ) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Account not found",
        });
    }

    return res.json({
      success: true,
      account:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      "Update account error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to update account",
      });
  }
}

export async function deleteAccount(
  req: AuthRequest,
  res: Response
) {
  const accountId =
    parseAccountId(
      req.params.id
    );

  if (!accountId) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Invalid account id",
      });
  }

  try {
    const result =
      await pool.query(
        `
        DELETE FROM accounts

        WHERE
          id = $1
          AND user_id = $2

        RETURNING id
        `,
        [
          accountId,
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
            "Account not found",
        });
    }

    return res.json({
      success: true,
      message:
        "Account deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete account error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to delete account",
      });
  }
}