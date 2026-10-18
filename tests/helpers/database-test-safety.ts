/** Live credentials alone must never opt a normal test run into database writes. */
export function canRunDatabaseWriteTests(env: Record<string, string | undefined>): boolean {
  if (env["RUN_DATABASE_WRITE_TESTS"] !== "1" || !env["STAGING_APP_URL"]) return false;
  const url = env["SUPABASE_URL"];
  if (!url || !env["SUPABASE_SERVICE_ROLE_KEY"]) return false;
  try {
    const host = new URL(url).hostname;
    return !host.includes("siepfegeubbqwhodyxcg") && !new URL(env["STAGING_APP_URL"]).hostname.endsWith("winstonebd.com");
  } catch { return false; }
}