import type {
    Request,
    Response,
} from "express";

import bcrypt from "bcrypt";
import { z } from "zod";

import { pool } from "../config/db.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { generateToken } from "../utils/jwt.js";

const registerSchema =
    z.object({
        name: z
            .string()
            .trim()
            .min(
                2,
                "Name must be at least 2 characters"
            )
            .max(100),

        email: z
            .string()
            .trim()
            .email(
                "A valid email address is required"
            )
            .transform((email) =>
                email.toLowerCase()
            ),

        password: z
            .string()
            .min(
                8,
                "Password must be at least 8 characters"
            )
            .max(100),
    });

const loginSchema =
    z.object({
        email: z
            .string()
            .trim()
            .email(
                "A valid email address is required"
            )
            .transform((email) =>
                email.toLowerCase()
            ),

        password: z
            .string()
            .min(
                1,
                "Password is required"
            ),
    });

const defaultCategories = [
    {
        name: "Salary",
        type: "INCOME",
    },
    {
        name: "Freelance",
        type: "INCOME",
    },
    {
        name: "Other Income",
        type: "INCOME",
    },

    {
        name: "Housing",
        type: "EXPENSE",
    },
    {
        name: "Food",
        type: "EXPENSE",
    },
    {
        name: "Transportation",
        type: "EXPENSE",
    },
    {
        name: "Utilities",
        type: "EXPENSE",
    },
    {
        name: "Entertainment",
        type: "EXPENSE",
    },
    {
        name: "Healthcare",
        type: "EXPENSE",
    },
    {
        name: "Shopping",
        type: "EXPENSE",
    },
    {
        name: "Education",
        type: "EXPENSE",
    },
    {
        name: "Other Expense",
        type: "EXPENSE",
    },
] as const;

export async function register(
    req: Request,
    res: Response
) {
    const validation =
        registerSchema.safeParse(
            req.body
        );

    if (!validation.success) {
        return res.status(400).json({
            success: false,
            message:
                validation.error.issues[0]
                    ?.message ??
                "Invalid registration data",
        });
    }

    const {
        name,
        email,
        password,
    } = validation.data;

    const client =
        await pool.connect();

    try {
        const existingUser =
            await client.query(
                `
        SELECT id
        FROM users
        WHERE email = $1
        `,
                [email]
            );

        if (
            existingUser.rowCount &&
            existingUser.rowCount > 0
        ) {
            return res
                .status(409)
                .json({
                    success: false,
                    message:
                        "An account with this email already exists",
                });
        }

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );

        await client.query(
            "BEGIN"
        );

        const userResult =
            await client.query(
                `
        INSERT INTO users (
          name,
          email,
          password_hash
        )
        VALUES (
          $1,
          $2,
          $3
        )
        RETURNING
          id,
          name,
          email,
          created_at
        `,
                [
                    name,
                    email,
                    passwordHash,
                ]
            );

        const user =
            userResult.rows[0];

        for (
            const category
            of defaultCategories
        ) {
            await client.query(
                `
        INSERT INTO categories (
          user_id,
          name,
          category_type
        )
        VALUES (
          $1,
          $2,
          $3
        )
        `,
                [
                    user.id,
                    category.name,
                    category.type,
                ]
            );
        }

        await client.query(
            "COMMIT"
        );

        const token =
            generateToken(
                user.id
            );

        return res
            .status(201)
            .json({
                success: true,
                user,
                token,
            });
    } catch (error) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Registration error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to create account",
            });
    } finally {
        client.release();
    }
}

export async function login(
    req: Request,
    res: Response
) {
    const validation =
        loginSchema.safeParse(
            req.body
        );

    if (!validation.success) {
        return res.status(400).json({
            success: false,
            message:
                validation.error.issues[0]
                    ?.message ??
                "Invalid login data",
        });
    }

    const {
        email,
        password,
    } = validation.data;

    try {
        const result =
            await pool.query(
                `
        SELECT
          id,
          name,
          email,
          password_hash
        FROM users
        WHERE email = $1
        `,
                [email]
            );

        if (
            !result.rowCount
        ) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Invalid email or password",
                });
        }

        const user =
            result.rows[0];

        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (
            !passwordMatches
        ) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Invalid email or password",
                });
        }

        const token =
            generateToken(
                user.id
            );

        return res.json({
            success: true,

            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },

            token,
        });
    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to log in",
            });
    }
}

export async function getCurrentUser(
    req: AuthRequest,
    res: Response
) {
    try {
        const result =
            await pool.query(
                `
        SELECT
          id,
          name,
          email,
          created_at
        FROM users
        WHERE id = $1
        `,
                [
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
                        "User not found",
                });
        }

        return res.json({
            success: true,
            user:
                result.rows[0],
        });
    } catch (error) {
        console.error(
            "Current user error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to load user",
            });
    }
}