import {
    Router,
} from "express";

import {
    createAccount,
    deleteAccount,
    getAccountById,
    getAccounts,
    updateAccount,
} from "../controllers/account.controller.js";

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
    createAccount
);

router.get(
    "/",
    getAccounts
);

router.get(
    "/:id",
    getAccountById
);

router.patch(
    "/:id",
    updateAccount
);

router.delete(
    "/:id",
    deleteAccount
);

export default router;