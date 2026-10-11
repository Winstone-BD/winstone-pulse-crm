/**
 * Project photos live in the private "project-photos" bucket.
 * Signed-out visitors must be refused every way in; signed-in CRM staff may read.
 * Read-only checks against the live bucket — nothing is written or deleted.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { staffAccessToken } from "./fixtures/staff-session";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const staffToken = staffAccessToken();
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

function tokenLifetime(signedUrl: string): number {
  const t = new URL(signedUrl).searchParams.get("token") ?? "";
  const p = JSON.parse(Buffer.from(t.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  return p.exp - p.iat;
}

describe.runIf(url && key && staffToken)("project photos: signed-in CRM staff", () => {
  const staff = client(staffToken!);
  it("can download the photo", async () => {
    const { data, error } = await staff.storage.from(BUCKET).download(FILE);
    expect(error).toBeNull();
    expect(data && data.size).toBeGreaterThan(1000);
  });
  it("a one-hour link is signed for exactly 3600 seconds", async () => {
    const { data, error } = await staff.storage.from(BUCKET).createSignedUrl(FILE, 3600);
    expect(error).toBeNull();
    expect(tokenLifetime(data!.signedUrl)).toBe(3600);
  });
  it("a link stops working after it expires", async () => {
    const { data, error } = await staff.storage.from(BUCKET).createSignedUrl(FILE, 2);
    expect(error).toBeNull();
    const before = await fetch(data!.signedUrl);
    expect(before.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 4000));
    const after = await fetch(data!.signedUrl);
    expect(after.ok).toBe(false);
  }, 15_000);
});

describe("project photo views are recorded for HQ", () => {
  const src = readFileSync("src/lib/projects.functions.ts", "utf8");
  it("listProjects writes a project_photos_viewed audit row with viewer and time", () => {
    expect(src).toMatch(/logPhotoView\(supabaseAdmin, c,/);
    expect(src).toMatch(/action: "project_photos_viewed"/);
    expect(src).toMatch(/actorProfileId: c\.agentId, actorLabel: c\.actor/);
  });
});
