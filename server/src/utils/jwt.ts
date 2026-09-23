import jwt from "jsonwebtoken";

interface TokenPayload {
    userId: number;
}

function getJwtSecret() {
    const secret =
        process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            "JWT_SECRET is not defined"
        );
    }

    return secret;
}

export function generateToken(
    userId: number
) {
    const expiresIn =
        process.env.JWT_EXPIRES_IN ??
        "7d";

    return jwt.sign(
        {
            userId,
        },
        getJwtSecret(),
        {
            expiresIn:
                expiresIn as jwt.SignOptions["expiresIn"],
        }
    );
}

export function verifyToken(
    token: string
): TokenPayload {
    return jwt.verify(
        token,
        getJwtSecret()
    ) as TokenPayload;
}