import type {
    Response,
} from "express";

import { z } from "zod";

import { pool } from "../config/db.js";

import type {
    AuthRequest,
} from "../middleware/auth.middleware.js";

const categoryTypeSchema =
    z.enum([
        "INCOME",
        "EXPENSE",
    ]);

const createCategorySchema =
    z.object({
        name: z
            .string()
            .trim()
            .min(
                2,
                "Category name must be at least 2 characters"
            )
            .max(100),

        categoryType:
            categoryTypeSchema,
    });

function parseCategoryId(
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

export async function getCategories(
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
          category_type,
          created_at

        FROM categories

        WHERE user_id = $1

        ORDER BY
          category_type ASC,
          name ASC
        `,
                [
                    req.userId,
                ]
            );

        return res.json({
            success: true,
            categories:
                result.rows,
        });
    } catch (error) {
        console.error(
            "Get categories error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to load categories",
            });
    }
}

export async function createCategory(
    req: AuthRequest,
    res: Response
) {
    const validation =
        createCategorySchema.safeParse(
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
                    "Invalid category data",
            });
    }

    const {
        name,
        categoryType,
    } = validation.data;

    try {
        const result =
            await pool.query(
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

        RETURNING
          id,
          name,
          category_type,
          created_at
        `,
                [
                    req.userId,
                    name,
                    categoryType,
                ]
            );

        return res
            .status(201)
            .json({
                success: true,
                category:
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
                        "This category already exists",
                });
        }

        console.error(
            "Create category error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to create category",
            });
    }
}

export async function deleteCategory(
    req: AuthRequest,
    res: Response
) {
    const categoryId =
        parseCategoryId(
            req.params.id
        );

    if (!categoryId) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Invalid category id",
            });
    }

    try {
        const result =
            await pool.query(
                `
        DELETE FROM categories

        WHERE
          id = $1
          AND user_id = $2

        RETURNING id
        `,
                [
                    categoryId,
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
                        "Category not found",
                });
        }

        return res.json({
            success: true,
            message:
                "Category deleted successfully",
        });
    } catch (error) {
        console.error(
            "Delete category error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Unable to delete category",
            });
    }
}