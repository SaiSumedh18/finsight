import "dotenv/config";

import {
    app,
} from "./app.js";

import {
    pool,
} from "./config/db.js";

import { startImportWorker } from "./jobs/imports.js";
import { redis } from "./services/cache.js";

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

        const stopWorker = process.env.RUN_IMPORT_WORKER === "true" ? startImportWorker() : undefined;
        const server = app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `FinSight API running on port ${PORT}`
                );
            }
        );
        for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
            const deadline = setTimeout(() => process.exit(1), 25000);
            deadline.unref();
            server.close(async () => {
                await stopWorker?.();
                redis?.disconnect();
                await pool.end();
                clearTimeout(deadline);
                process.exit(0);
            });
        });
    } catch (error) {
        console.error(
            "Unable to start FinSight:",
            error
        );

        process.exit(1);
    }
}

startServer();