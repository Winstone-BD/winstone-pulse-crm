import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { staffAccessToken } from './fixtures/staff-session';
import { leadOwner } from '@/lib/lead-owner';

const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
const token = staffAccessToken();
describe.runIf(Boolean(url && key && token))('assigned-lead API scope (read-only, real staff session)', () => {
  async function clientAndOwner() {
    if (!url || !key || !token) throw new Error('Staff session unavailable');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: user, error: authError } = await db.auth.getUser(token);
    expect(authError).toBeNull();
    if (!user.user) throw new Error('Staff session invalid');
    const { data: profile, error } = await db.from('profiles').select('id, role').eq('user_id', user.user.id).single();
    expect(error).toBeNull();
    if (!profile || profile.role === 'admin') throw new Error('An agent-scoped session is required');
    const { data: leads, error: leadError } = await db.from('leads').select('id, assigned_to, assigned_agent_id').limit(10000);
    expect(leadError).toBeNull();
    expect((leads ?? []).length).toBeGreaterThan(0);
    for (const lead of leads ?? []) expect(leadOwner(lead)).toBe(profile.id);
    return { db, ids: new Set((leads ?? []).map(lead => lead.id)) };
  }
  for (const table of ['follow_up_events', 'call_reports', 'call_recordings', 'crm_activities', 'lead_events', 'whatsapp_interactions'] as const) {
    it(`${table} never exposes activity outside current assignment`, async () => {
      const { db, ids } = await clientAndOwner();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from(table).select('id, lead_id').order('id').range(from, from + 999);
        expect(error).toBeNull();
        for (const row of data ?? []) expect(Boolean(row.lead_id && ids.has(row.lead_id))).toBe(true);
        if (!data || data.length < 1000) break;
      }
    });
  }
});