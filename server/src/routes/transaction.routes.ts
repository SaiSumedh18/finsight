import {
    Router,
} from "express";

import {
    createTransaction,
    deleteTransaction,
    getTransactionById,
    getTransactions,
    updateTransaction,
} from "../controllers/transaction.controller.js";

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
    createTransaction
);

router.get(
    "/",
    getTransactions
);

router.get(
    "/:id",
    getTransactionById
);

router.patch(
    "/:id",
    updateTransaction
);

router.delete(
    "/:id",
    deleteTransaction
);

export default router;