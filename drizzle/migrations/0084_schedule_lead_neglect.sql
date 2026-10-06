-- lovable-cron-fallback-reviewed: 1 run/day at 08:55 Dhaka; warns/recalls neglected leads before 09:10 distribution
select cron.unschedule('winstone-lead-neglect') where exists (select 1 from cron.job where jobname = 'winstone-lead-neglect');
select cron.schedule('winstone-lead-neglect', '55 2 * * *', $$
  select net.http_post(
    url := 'https://crm1.winstonebd.com/api/public/hooks/lead-neglect',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value->>'secret' from public.system_settings where key='shift_cron_secret')),
    body := '{}'::jsonb);
$$);