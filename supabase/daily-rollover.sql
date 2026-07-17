-- Agenda o fechamento operacional diario.
-- Supabase pg_cron usa UTC; 09:00 UTC equivale a 06:00 em America/Sao_Paulo.

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'daily-operational-rollover'
  ) then
    perform cron.unschedule('daily-operational-rollover');
  end if;
end;
$$;

select cron.schedule(
  'daily-operational-rollover',
  '0 9 * * *',
  $$select public.close_operational_day(now());$$
);
