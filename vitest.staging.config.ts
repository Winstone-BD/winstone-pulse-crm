import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Staging-only end-to-end suite. Never included in the normal test run. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/staging/**/*.staging.ts"], testTimeout: 60_000, fileParallelism: false },
});
