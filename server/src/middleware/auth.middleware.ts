import type {
    NextFunction,
    Request,
    Response,
} from "express";

import { verifyToken } from "../utils/jwt.js";

export interface AuthRequest
    extends Request {
    userId?: number;
}

export function requireAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const authorization =
        req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            success: false,
            message:
                "Authorization token is required",
        });
    }

    const parts =
        authorization.split(" ");

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {
        return res.status(401).json({
            success: false,
            message:
                "Invalid authorization format",
        });
    }

    try {
        const payload =
            verifyToken(parts[1]);

        req.userId =
            payload.userId;

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired token",
        });
    }
}
