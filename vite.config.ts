// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Load non-VITE_ env vars into process.env for server-side code only (email API keys,
// service role key). These are never injected into the client bundle.
const serverEnv = loadEnv(process.env["NODE_ENV"] || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Build-tool guard: refuse to start the preview/build on anything but the pinned
// version (2.26.x crashes the live Worker; drifts to 2.25.3 have blanked previews).
{
  const PINNED_BUILD_TOOL = "2.25.2";
  const installed = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, "node_modules/@lovable.dev/vite-tanstack-config/package.json"), "utf8"),
  ).version as string;
  if (installed !== PINNED_BUILD_TOOL) {
    throw new Error(
      `[build-tool guard] @lovable.dev/vite-tanstack-config is ${installed}, but only ${PINNED_BUILD_TOOL} is supported. ` +
        `Set it back to ${PINNED_BUILD_TOOL} in package.json and reinstall. Preview start refused.`,
    );
  }
}

const BROWSER_ASYNC_HOOKS = path.resolve(
  import.meta.dirname,
  "src/lib/browser-async-hooks-stub.js",
);
const BROWSER_ASYNC_HOOKS_SRC = fs.readFileSync(BROWSER_ASYNC_HOOKS, "utf8");

// TanStack Start's storage context runs `new AsyncLocalStorage()` at module load.
// Vite externalises node:async_hooks for the browser to an empty warning proxy, so
// the constructor is undefined: the throw "AsyncLocalStorage is not a constructor"
// kills the server-function client before it can read the session, and every page
// silently renders signed out with no boards or widgets. Serve a no-op store to
// browser code only — the server keeps the real implementation, which stores the
// request context every server function depends on.
const asyncHooksStub: { name: string; setup(build: any): void } = {
  name: "browser-async-hooks-stub",
  setup(build: any) {
    build.onResolve({ filter: /^node:async_hooks$/ }, () => ({
      path: "node:async_hooks",
      namespace: "async-hooks-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "async-hooks-stub" }, () => ({
      contents: BROWSER_ASYNC_HOOKS_SRC,
      loader: "js",
    }));
  },
};

// Same swap for the client build, which goes through Vite's plugin container
// rather than esbuild. `options.ssr` keeps the server on the real module.
function browserAsyncHooksStub() {
  return {
    name: "browser-async-hooks-stub",
    enforce: "pre",
    resolveId(id: string, _importer: string | undefined, options?: { ssr?: boolean }) {
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
    //
    // react-start's /client entry is deliberately NOT listed: pre-bundling it drags
    // the storage-context module (and its node:async_hooks import) into a browser
    // chunk, where the shim above is the only thing keeping it alive.
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "@tanstack/react-router",
        "@tanstack/history",
        "@tanstack/router-core",
        "@tanstack/router-core/isServer",
        "@tanstack/router-core/ssr/client",
        "@tanstack/router-core/ssr/server",
        "h3-v2",
        "seroval",
      ],
      esbuildOptions: {
        plugins: [asyncHooksStub],
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
    // Split each route into its own chunk so heavy code (charts, HQ dashboards)
    // loads only when that page is visited, not on the homepage.
    autoCodeSplitting: true,
  },
});
