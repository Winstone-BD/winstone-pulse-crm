import { createMiddleware } from "@tanstack/react-start";

/**
 * Same-origin guard for server-function calls — mirrors TanStack's built-in
 * createCsrfMiddleware defaults. Defined locally because importing the
 * built-in one from src/start.ts produced a circular server chunk that crashed
 * the live Worker at startup ("createCsrfMiddleware is not a function").
 */
function sameOrigin(request: Request): boolean | undefined {
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null) return fetchSite === "same-origin";
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if (origin !== null) return origin === requestOrigin;
  const referer = request.headers.get("Referer");
  if (referer === null) return undefined;
  if (referer === requestOrigin) return true;
  if (!referer.startsWith(requestOrigin)) return false;
  const next = referer.charAt(requestOrigin.length);
  return next === "" || next === "/" || next === "?" || next === "#";
}

export const csrfMiddleware = createMiddleware().server(async (ctx) => {
  const c = ctx as typeof ctx & { handlerType?: string; request: Request };
  if (c.handlerType !== "serverFn") return ctx.next();
  if (sameOrigin(c.request) === true) return ctx.next();
  return new Response("Forbidden", { status: 403 }) as never;
});
