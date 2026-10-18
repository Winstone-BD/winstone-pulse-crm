import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { toolShape, z } from "../schema";

import { crmDb, requireAllowedUser, text } from "../access";

export default defineTool({
  name: "create_lead",
  title: "Create a lead",
  description:
    "Add a new lead to the CRM. Optionally assign it to an agent by employee ID; otherwise it stays unassigned.",
  inputSchema: toolShape({
    name: z.string().trim().min(2).max(120),
    phone_number: z.string().trim().min(5).max(24),
    company: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
    source: z.string().trim().max(40).default("mcp"),
    employee_id: z.string().trim().min(2).max(32).optional(),
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (
    { name, phone_number, company, notes, source, employee_id }: {
      name?: string;
      phone_number?: string;
      company?: string;
      notes?: string;
      source?: string;
      employee_id?: string;
    },
    ctx,
  ) => {
    try {
      const email = await requireAllowedUser(ctx);
      if (!name || !phone_number) throw new ToolError("name and phone_number are required.");
      const db = await crmDb();

      let assignedTo: string | null = null;
      if (employee_id) {
        const { data: agent } = await db
          .from("profiles")
          .select("id")
          .eq("employee_id", employee_id)
          .maybeSingle();
        if (!agent) throw new ToolError(`No agent with employee ID ${employee_id}.`);
        assignedTo = agent.id;
      }

      const { intakeLead } = await import("@/lib/lead-intake.server");
      const result = await intakeLead({
        name,
        phoneNumber: phone_number,
        company: company ?? null,
        notes: notes
          ? `${notes}\n\n(added via agent integration by ${email})`
          : `Added via agent integration by ${email}`,
        source,
        ownerId: assignedTo,
      });
      const { data, error } = await db
        .from("leads")
        .select("id, name, phone_number, status, assigned_to, created_at")
        .eq("id", result.leadId)
        .single();
      if (error) throw new ToolError(error.message);

      return text({
        created: !result.duplicate,
        duplicate: result.duplicate,
        duplicate_reason: result.duplicateReason,
        lead: data,
      });
    } catch (error) {
      throw error instanceof ToolError ? error : new ToolError((error as Error).message);
    }
  },
});
