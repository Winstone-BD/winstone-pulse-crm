import "./lib/error-capture";
import serverEntry from "@tanstack/react-start/server-entry";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Static import: a dynamic import here split the framework into two circular server
// chunks, crashing the live Worker at startup ("createCsrfMiddleware is not a function").
let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = Promise.resolve(serverEntry as unknown as ServerEntry);
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/** Phone/device API paths that stay open while locked (sign-in and version checks). */
const DEVICE_OPEN = ["/api/public/agent/login", "/api/public/agent/version", "/api/public/config/"];

export async function deviceLockResponse(request: Request): Promise<Response | null> {
  if (!request.headers.get("x-device-token")) return null;
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/public/agent/") && !path.startsWith("/api/public/ingest/")) return null;
  if (DEVICE_OPEN.some((open) => path.startsWith(open))) return null;
  const m = await import("./lib/maintenance.server");
  if (!(await m.isLockedForOrdinaryUsers())) return null;
  return new Response(JSON.stringify({ error: m.LOCKED_MESSAGE, code: "maintenance_locked" }), {
    status: 423,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const locked = await deviceLockResponse(request);
      if (locked) return locked;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
