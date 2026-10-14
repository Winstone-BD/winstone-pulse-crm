import { createFileRoute } from "@tanstack/react-router";
import { BUILD_INFO } from "@/lib/build-info";

export const Route = createFileRoute("/version")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            commit: BUILD_INFO.commit,
            builtAt: BUILD_INFO.builtAt,
            deploymentId: BUILD_INFO.deploymentId ?? "not provided by hosting",
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
