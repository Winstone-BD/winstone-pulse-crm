import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { FACT_CATEGORY_CODES, KNOWLEDGE_STATUSES, OBJECTION_CODES, PITCH_ACTIONS } from "@/lib/sales-intel-rules";

const Tok = { adminToken: z.string().nullable().optional() };
const uuid = z.string().uuid();
const Filters = z.object({
  q: z.string().max(120).nullable().optional(),
  leadId: uuid.nullable().optional(),
  agentId: uuid.nullable().optional(),
  objection: z.enum(OBJECTION_CODES).nullable().optional(),
  templateId: uuid.nullable().optional(),
  project: z.string().max(120).nullable().optional(),
  action: z.enum(PITCH_ACTIONS).nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  outcome: z.enum(["follow_up", "call", "site_visit", "booking"]).nullable().optional(),
  from: z.string().date().nullable().optional(),
  to: z.string().date().nullable().optional(),
});
const s = () => import("@/lib/sales-intel.server");

export const siWhoAmI = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object(Tok).parse(d))
  .handler(async ({ data }) => {
    try {
      const c = await (await s()).siCaller(data.adminToken);
      return { scope: c.scope, readOnly: c.readOnly };
    } catch {
      return { scope: "none" as const, readOnly: true };
    }
  });

export const siMyLeads = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, q: z.string().max(80).default("") }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.myLeads(await m.siCaller(data.adminToken), data.q);
  });

export const siBrief = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, leadId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    const b = await m.buildSalesBrief(await m.siCaller(data.adminToken), data.leadId);
    return { lead: b.lead, lines: b.lines };
  });

export const siRecommend = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, leadId: uuid, objection: z.enum(OBJECTION_CODES), note: z.string().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.recommendPitch(await m.siCaller(data.adminToken), data.leadId, data.objection, data.note ?? null);
  });

export const siRecordPitch = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      ...Tok,
      leadId: uuid,
      objection: z.enum(OBJECTION_CODES),
      action: z.enum(PITCH_ACTIONS),
      clientActionId: z.string().min(8).max(80),
      templateId: uuid.nullable(),
      generatedText: z.string().max(4000).nullable(),
      finalText: z.string().max(4000).nullable(),
      project: z.string().max(120).nullable(),
      factIds: z.array(uuid).max(20),
      grounded: z.boolean(),
      callId: uuid.nullable(),
      followUpId: uuid.nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const m = await s();
    const { adminToken, ...input } = data;
    return m.recordPitchEvent(await m.siCaller(adminToken), input);
  });

export const siPitchHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, filters: Filters, cursor: z.object({ at: z.string(), id: uuid }).nullable(), pageSize: z.number().int().min(10).max(200).default(50) }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.searchPitchEvents(await m.siCaller(data.adminToken), data.filters, data.cursor, data.pageSize);
  });

export const siExportPitches = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, filters: Filters }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    const c = await m.siCaller(data.adminToken);
    const rows = await m.exportPitchEvents(c, data.filters);
    return { rows, scope: c.scope === "authority" ? "Executive HQ / IT — all agents" : "Own assigned leads only", generatedAt: new Date().toISOString() };
  });

export const siEffectiveness = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, filters: Filters, windowDays: z.number().int().min(1).max(90).default(14) }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.effectiveness(await m.siCaller(data.adminToken), data.filters, data.windowDays);
  });

export const siFacts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, category: z.enum(FACT_CATEGORY_CODES).nullable().optional() }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    const c = await m.siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await m.listFacts(supabaseAdmin, { categories: data.category ? [data.category] : undefined, onlyAuthoritative: c.scope !== "authority" });
    const { factEligibility } = await import("@/lib/sales-intel-rules");
    return rows.map((f) => ({ ...f, eligibility: factEligibility(f) }));
  });

export const siSaveFact = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      ...Tok,
      id: uuid.nullable().optional(),
      category: z.enum(FACT_CATEGORY_CODES),
      geography: z.string().max(120).nullable(),
      metric: z.string().min(2).max(200),
      value: z.string().min(1).max(200),
      unit: z.string().max(40).nullable(),
      source_name: z.string().min(2).max(200),
      source_url: z.string().url().max(500).nullable(),
      effective_date: z.string().date(),
      review_date: z.string().date().nullable(),
      expiry_date: z.string().date().nullable(),
      notes: z.string().max(1000).nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const m = await s();
    const { adminToken, ...input } = data;
    return m.saveFact(await m.siCaller(adminToken), input);
  });

export const siFactStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, id: uuid, to: z.enum(KNOWLEDGE_STATUSES) }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.setFactStatus(await m.siCaller(data.adminToken), data.id, data.to);
  });

export const siTemplates = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object(Tok).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.listTemplates(await m.siCaller(data.adminToken));
  });

export const siSaveTemplate = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, id: uuid.nullable().optional(), objection_code: z.enum(OBJECTION_CODES), title: z.string().min(2).max(160), body: z.string().min(10).max(3000) }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    const { adminToken, ...input } = data;
    return m.saveTemplate(await m.siCaller(adminToken), input);
  });

export const siTemplateStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, id: uuid, to: z.enum(KNOWLEDGE_STATUSES) }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.setTemplateStatus(await m.siCaller(data.adminToken), data.id, data.to);
  });

export const siVersions = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, entityId: uuid.nullable().optional() }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.listVersions(await m.siCaller(data.adminToken), data.entityId ?? null);
  });
