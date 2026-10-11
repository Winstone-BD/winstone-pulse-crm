// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Load non-VITE_ env vars into process.env for server-side code only (email API keys,
// service role key). These are never injected into the client bundle.
const serverEnv = loadEnv(process.env["NODE_ENV"] || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

const BROWSER_ASYNC_HOOKS = path.resolve(
  import.meta.dirname,
  "src/lib/browser-async-hooks-stub.js",
);

// Replace node:async_hooks with a no-op store, but only for browser code. The
// server must keep the real implementation — TanStack Start stores the request
// context in it, so aliasing it there would break every server function.
function browserAsyncHooksStub() {
  return {
    name: "browser-async-hooks-stub",
    enforce: "pre",
    resolveId(id, _importer, options) {
      if (id === "node:async_hooks" && !options?.ssr) return BROWSER_ASYNC_HOOKS;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [mcpPlugin(), browserAsyncHooksStub()],
  vite: {
    // Root cause of "Failed to fetch dynamically imported module" / "Invalid server
    // function ID" after a restart: Vite discovered these deps late on every cold
    // start, re-optimized and force-reloaded, invalidating chunk hashes that open
    // tabs still referenced. Pre-bundling them up front removes that reload.
    optimizeDeps: {
      include: [
        "@tanstack/history",
        "@tanstack/router-core",
        "@tanstack/router-core/isServer",
        "@tanstack/router-core/ssr/client",
        "@tanstack/router-core/ssr/server",
        "h3-v2",
        "seroval",
        // The HTML shell hydrates through react-start's default-entry client.tsx,
        // which imports these directly. If any is discovered late, its pre-bundle
        // hash (?v=) changes mid-session and the open tab's entry import fails ->
        // blank screen. Only the /client subpath is browser code: the package root
        // also exports server utilities that must not enter the browser bundle.
        "@tanstack/react-start/client",
        "react",
        "react-dom/client",
      ],
      esbuildOptions: {
        // The dep pre-bundle runs through esbuild, not Vite's plugin container, so
        // the alias above has to be repeated here for it to take effect in dev.
        alias: { "node:async_hooks": BROWSER_ASYNC_HOOKS },
      },
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
