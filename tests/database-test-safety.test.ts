import { expect, it } from "vitest";
import { canRunDatabaseWriteTests } from "./helpers/database-test-safety";
it("credentials alone never authorize database write tests", () => {
  expect(canRunDatabaseWriteTests({ SUPABASE_URL: "https://isolated.example.test", SUPABASE_SERVICE_ROLE_KEY: "synthetic" })).toBe(false);
});
it("rejects the shared live backend even with explicit opt-in", () => {
  expect(canRunDatabaseWriteTests({ RUN_DATABASE_WRITE_TESTS: "1", STAGING_APP_URL: "https://staging.example.test", SUPABASE_URL: "https://siepfegeubbqwhodyxcg.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "synthetic" })).toBe(false);
});
it("permits an explicitly opted-in isolated staging backend", () => {
  expect(canRunDatabaseWriteTests({ RUN_DATABASE_WRITE_TESTS: "1", STAGING_APP_URL: "http://127.0.0.1:8081", SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "synthetic" })).toBe(true);
});
it("does not treat a preview alias as isolation", () => {
 expect(canRunDatabaseWriteTests({ RUN_DATABASE_WRITE_TESTS:"1", STAGING_APP_URL:"https://preview.example.test", SUPABASE_URL:"https://preview-proxy.example.test", SUPABASE_SERVICE_ROLE_KEY:"synthetic" })).toBe(false);
});