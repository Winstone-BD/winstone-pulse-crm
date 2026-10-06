-- lovable-cron-fallback-reviewed: 1 run/month; saves previous Dhaka month's call/follow-up summary PDF to Drive
select cron.unschedule('winstone-monthly-summary')
where exists (select 1 from cron.job where jobname = 'winstone-monthly-summary');

select cron.schedule(
  'winstone-monthly-summary',
  '30 0 1 * *',
  $$
  select net.http_post(
    url := 'https://crm1.winstonebd.com/api/public/hooks/monthly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value->>'secret' from public.system_settings where key = 'shift_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);