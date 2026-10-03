process.env.DATABASE_URL ||=
    "postgresql://finsight:finsight_password@127.0.0.1:5434/finsight_test";

process.env.JWT_SECRET =
    "finsight-automated-test-secret";

process.env.JWT_EXPIRES_IN =
    "1h";

process.env.CLIENT_URL =
    "http://localhost:5173";
process.env.REDIS_URL ||= "redis://127.0.0.1:6391";

if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) {
 throw new Error("Refusing destructive tests outside an isolated _test database");
}
