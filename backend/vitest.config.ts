import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Sets required env vars (DB_PATH=:memory:, etc.) before any test file's
    // own imports run — config/env.ts and db/client.ts both read process.env
    // at module-load time, so this has to happen first, not inside a test.
    setupFiles: ["./src/test/env.setup.ts"],
  },
});
