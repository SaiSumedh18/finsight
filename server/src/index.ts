import "dotenv/config";

import {
    app,
} from "./app.js";

import {
    pool,
} from "./config/db.js";

const PORT =
    Number(
        process.env.PORT
    ) || 4100;

async function startServer() {
    try {
        await pool.query(
            "SELECT 1"
        );

        console.log(
            "PostgreSQL connected successfully"
        );

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `FinSight API running on port ${PORT}`
                );
            }
        );
    } catch (error) {
        console.error(
            "Unable to start FinSight:",
            error
        );

        process.exit(1);
    }
}

startServer();