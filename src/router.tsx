import { QueryClient, timeoutManager } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { resilientQueryDefaults } from "./lib/query-resilience";

// Static prerender imports the server bundle into the build process; React
// Query's GC/refetch timers would otherwise outlive the prerender pass and
// hold the build open after every page is written. Unref them during
// prerendering only — the live server and browser keep normal timers.
const isPrerendering =
  typeof process !== "undefined" && process.env.TSS_PRERENDERING === "true";
if (isPrerendering) {
  timeoutManager.setTimeoutProvider({
    setTimeout: (cb, ms) => {
      const id = setTimeout(cb, ms);
      (id as unknown as { unref?: () => void }).unref?.();
      return id;
    },
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (cb, ms) => {
      const id = setInterval(cb, ms);
      (id as unknown as { unref?: () => void }).unref?.();
      return id;
    },
    clearInterval: (id) => clearInterval(id),
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: resilientQueryDefaults,
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
