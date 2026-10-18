import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type FollowUp = Database['public']['Tables']['follow_up_events'];
type WorkDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Views'> & { Views: Omit<Database['public']['Views'], 'active_follow_up_events' | 'current_follow_up_work_items'> & {
  active_follow_up_events: { Row: FollowUp['Row']; Relationships: FollowUp['Relationships'] };
  current_follow_up_work_items: { Row: FollowUp['Row']; Relationships: FollowUp['Relationships'] };
} } };

/** Both views SELECT f.* without joins: NOT NULL source columns remain NOT NULL. */
export function followUpWork(db: SupabaseClient<Database>, mode: 'active' | 'current' = 'active') {
  const typed = db as unknown as SupabaseClient<WorkDatabase>;
  return mode === 'active' ? typed.from('active_follow_up_events') : typed.from('current_follow_up_work_items');
}