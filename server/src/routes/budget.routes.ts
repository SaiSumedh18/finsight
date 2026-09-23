import {
    Router,
} from "express";

import {
    createBudget,
    deleteBudget,
    getBudgets,
    updateBudget,
} from "../controllers/budget.controller.js";

import {
    requireAuth,
} from "../middleware/auth.middleware.js";

const router =
    Router();

router.use(
    requireAuth
);

router.post(
    "/",
    createBudget
);

router.get(
    "/",
    getBudgets
);

router.patch(
    "/:id",
    updateBudget
);

router.delete(
    "/:id",
    deleteBudget
);

export default router;