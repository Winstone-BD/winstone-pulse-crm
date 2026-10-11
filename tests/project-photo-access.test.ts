/**
 * Project photos live in the private "project-photos" bucket.
 * Signed-out visitors must be refused every way in; signed-in CRM staff may read.
 * Read-only checks against the live bucket — nothing is written or deleted.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const staffToken = process.env["LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN"];
const BUCKET = "project-photos";
const FILE = "01_-_Winstone_Dream_Park_Winstone_10.jpg";

function client(bearer?: string) {
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
        else if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key!);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

describe("project photos: server code never leaks images to signed-out callers", () => {
  const src = readFileSync("src/lib/projects.functions.ts", "utf8");
  it("listProjects returns an empty list when the caller is not authenticated", () => {
    expect(src).toMatch(/if \(!c\) return \{ canEdit: false, projects: \[\]/);
  });
  it("photos are served only as short-lived signed links (≤ 1 hour)", () => {
    const m = src.match(/createSignedUrl\(path, (\d+)\)/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeLessThanOrEqual(3600);
    expect(src).not.toMatch(/getPublicUrl/);
  });
});

describe.runIf(url && key)("project photos: signed-out visitor is refused", () => {
  const anon = client();
  it("public URL does not serve the file", async () => {
    const res = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${FILE}`);
    expect(res.ok).toBe(false);
  });
  it("cannot download the file", async () => {
    const { data, error } = await anon.storage.from(BUCKET).download(FILE);
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
  it("cannot list the bucket", async () => {
    const { data } = await anon.storage.from(BUCKET).list();
    expect(data ?? []).toHaveLength(0);
  });
  it("cannot mint a signed link", async () => {
    const { data } = await anon.storage.from(BUCKET).createSignedUrl(FILE, 60);
    expect(data?.signedUrl ?? null).toBeNull();
  });
});

describe.runIf(url && key && staffToken)("project photos: signed-in CRM staff can read", () => {
  it("downloads the photo with a staff session", async () => {
    const { data, error } = await client(staffToken).storage.from(BUCKET).download(FILE);
    expect(error).toBeNull();
    expect(data && data.size).toBeGreaterThan(1000);
  });
});
