import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const leadFollowUpHistory = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ leadId: z.string().uuid(), adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await (await import('@/lib/access.server')).resolveCaller(data.adminToken ?? null);
    if (caller.scope === 'none') throw new Error('Sign in required');
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const { data: lead } = await db.from('leads').select('assigned_to, assigned_agent_id').eq('id', data.leadId).maybeSingle();
    if (!lead || (caller.scope !== 'authority' && (lead.assigned_to ?? lead.assigned_agent_id) !== caller.profile?.id)) throw new Error('This lead is not assigned to you');
    const rows: { id: string; action: string; note: string | null; at: string; scheduledAt: string | null; followUpId: string; correlationId: string }[] = [];
    for (let from = 0; ; from += 1000) {
      let q = db.from('follow_up_changes').select('id, action, note, changed_at, new_scheduled_at, follow_up_id, correlation_id, follow_up_events!inner(agent_id)')
        .eq('lead_id', data.leadId).order('changed_at', { ascending: false }).order('id').range(from, from + 999);
      if (caller.scope !== 'authority') q = q.eq('follow_up_events.agent_id', caller.profile?.id ?? '');
      const { data: page, error } = await q;
      if (error) throw new Error(error.message);
      rows.push(...(page ?? []).map(c => ({ id: c.id, action: c.action, note: c.note, at: c.changed_at, scheduledAt: c.new_scheduled_at, followUpId: c.follow_up_id, correlationId: c.correlation_id })));
      if (!page || page.length < 1000) break;
    }
    return rows;
  });