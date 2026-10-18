import { expect, it } from "vitest";
import { canRunDatabaseWriteTests } from "./helpers/database-test-safety";
it("credentials alone never authorize database write tests", () => {
  expect(canRunDatabaseWriteTests({ SUPABASE_URL: "https://isolated.example.test", SUPABASE_SERVICE_ROLE_KEY: "synthetic" })).toBe(false);
});
it("rejects the shared live backend even with explicit opt-in", () => {
  expect(canRunDatabaseWriteTests({ RUN_DATABASE_WRITE_TESTS: "1", STAGING_APP_URL: "https://staging.example.test", SUPABASE_URL: "https://siepfegeubbqwhodyxcg.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "synthetic" })).toBe(false);
});
it("permits an explicitly opted-in isolated staging backend", () => {
  expect(canRunDatabaseWriteTests({ RUN_DATABASE_WRITE_TESTS: "1", STAGING_APP_URL: "https://staging.example.test", SUPABASE_URL: "https://isolated.example.test", SUPABASE_SERVICE_ROLE_KEY: "synthetic" })).toBe(true);
});