import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { TeamSupportInbox } from "../../src/components/crm/TeamSupportInbox";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchInterval: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TeamSupportInbox />
  </QueryClientProvider>,
);
