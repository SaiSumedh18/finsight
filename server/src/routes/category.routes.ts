import {
    Router,
} from "express";

import {
    createCategory,
    deleteCategory,
    getCategories,
} from "../controllers/category.controller.js";

import {
    requireAuth,
} from "../middleware/auth.middleware.js";

const router =
    Router();

router.use(
    requireAuth
);

router.get(
    "/",
    getCategories
);

router.post(
    "/",
    createCategory
);

router.delete(
    "/:id",
    deleteCategory
);

export default router;