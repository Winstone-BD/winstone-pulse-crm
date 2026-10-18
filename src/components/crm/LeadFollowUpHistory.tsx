import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { leadFollowUpHistory } from '@/lib/lead-follow-up-history.functions';
import { useAdminToken } from '@/lib/local-session';
import { useLang } from '@/lib/i18n';

export function LeadFollowUpHistory({ leadId }: { leadId: string }) {
  const adminToken = useAdminToken();
  const lang = useLang();
  const get = useServerFn(leadFollowUpHistory);
  const res = useQuery({ queryKey: ['lead-follow-up-history', leadId, adminToken], queryFn: () => get({ data: { leadId, adminToken } }) });
  const labels: Record<string, string> = lang === 'bn' ? { created: 'ফলো-আপ তৈরি', completed: 'সম্পন্ন', rescheduled: 'সময় বদল', cancelled: 'বাতিল', missed: 'মিস হয়েছে', recovered: 'নতুন recovery follow-up তৈরি' } : { created: 'Follow-up created', completed: 'Completed', rescheduled: 'Rescheduled', cancelled: 'Cancelled', missed: 'Missed', recovered: 'Recovery follow-up created' };
  return <section className="space-y-3 border-y border-border py-4">
    <h3 className="text-sm font-semibold">{lang === 'bn' ? 'স্থায়ী ফলো-আপ ইতিহাস' : 'Permanent follow-up history'}</h3>
    {res.isPending ? <p role="status" className="text-xs text-muted-foreground">{lang === 'bn' ? 'লোড হচ্ছে…' : 'Loading…'}</p> : res.isError ? <p role="alert" className="text-xs text-destructive">{lang === 'bn' ? 'ইতিহাস লোড করা যায়নি' : 'Could not load history'}</p> : !res.data?.length ? <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'ফলো-আপের ইতিহাস নেই' : 'No follow-up history'}</p> : <ol className="space-y-3">{res.data.map(row => <li key={row.id} className="border-l-2 border-border pl-3">
      <p className="text-xs text-muted-foreground">{new Date(row.at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { timeZone: 'Asia/Dhaka' })}</p>
      <p className="text-sm font-semibold">{labels[row.action] || row.action}</p>
      {row.scheduledAt && <p className="text-xs text-muted-foreground">{new Date(row.scheduledAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { timeZone: 'Asia/Dhaka' })}</p>}
      {row.note && <p className="break-words text-sm">{row.note}</p>}
    </li>)}</ol>}
  </section>;
}