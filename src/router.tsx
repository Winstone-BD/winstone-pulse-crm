import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { resilientQueryDefaults } from "./lib/query-resilience";

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
