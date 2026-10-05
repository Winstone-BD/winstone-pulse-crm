import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { crmDb, requireAllowedUser, text } from "../access";

export default defineTool({
  name: "list_public_property_facts",
  title: "List verified property facts",
  description: "Read verified, currently publishable Winstone project and property facts.",
  inputSchema: {
    geography: z.string().trim().min(2).max(100).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ geography, limit }, ctx) => {
    try {
      await requireAllowedUser(ctx);
      const db = await crmDb();
      let query = db
        .from("market_facts")
        .select(
          "id, category, metric, value, unit, geography, source_name, source_url, effective_date, review_date, expiry_date, version",
        )
        .eq("category", "project_property")
        .eq("status", "approved")
        .not("verified_at", "is", null)
        .order("effective_date", { ascending: false })
        .limit(limit);
      if (geography) query = query.ilike("geography", `%${geography}%`);
      const { data, error } = await query;
      if (error) throw new ToolError(error.message);
      return text({ count: data?.length ?? 0, facts: data ?? [] });
    } catch (error) {
      throw error instanceof ToolError ? error : new ToolError((error as Error).message);
    }
  },
});