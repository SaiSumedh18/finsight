import fs from "node:fs/promises";

import pg from "pg";

const {
    Pool,
} = pg;

if (
    !process.env.DATABASE_URL
) {
    throw new Error(
        "DATABASE_URL is not defined"
    );
}

const pool =
    new Pool({
        connectionString:
            process.env.DATABASE_URL,
    });

async function initializeDatabase() {
    try {
        const result =
            await pool.query(`
        SELECT to_regclass(
          'public.users'
        ) AS users_table
      `);

        if (
            result.rows[0]
                .users_table
        ) {
            console.log(
                "Database schema already initialized"
            );

            return;
        }

        console.log(
            "Initializing FinSight database schema..."
        );

        const schema =
            await fs.readFile(
                new URL(
                    "../sql/schema.sql",
                    import.meta.url
                ),
                "utf8"
            );

        await pool.query(
            schema
        );

        console.log(
            "Database schema initialized successfully"
        );
    } finally {
        await pool.end();
    }
}

initializeDatabase().catch(
    (error) => {
        console.error(
            "Database initialization failed:",
            error
        );

        process.exit(1);
    }
);