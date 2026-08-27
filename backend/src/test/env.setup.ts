// Runs before any test file's own imports — see vitest.config.ts. Every
// value here just needs to satisfy config/env.ts's schema; none of it is
// meant to resemble a real deployment.
process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.COOKIE_SECURE = "false";
