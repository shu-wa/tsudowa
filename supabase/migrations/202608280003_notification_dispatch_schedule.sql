-- Invoke the notification dispatcher immediately after enqueueing and every
-- minute as a recovery path for quiet hours, transient errors, and webhooks.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.invoke_notification_dispatch()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  dispatch_secret text;
  request_id bigint;
begin
  select secret.decrypted_secret into dispatch_secret
  from vault.decrypted_secrets secret
  where secret.name = 'tsudowa_notification_dispatch_secret'
  order by secret.created_at desc
  limit 1;

  -- Local/CI databases intentionally have no production secret.
  if dispatch_secret is null then return null; end if;

  select net.http_post(
    url := 'https://jwgynxnkjjyoqiirqwus.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tsudowa-dispatch-secret', dispatch_secret
    ),
    body := jsonb_build_object('source', 'database'),
    timeout_milliseconds := 5000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.invoke_notification_dispatch() from public, anon, authenticated;

create or replace function private.request_notification_dispatch()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Notification triggers may enqueue many recipient rows in one transaction.
  -- Queue only one HTTP request for that transaction.
  if current_setting('tsudowa.dispatch_requested', true) = 'on' then return new; end if;
  perform set_config('tsudowa.dispatch_requested', 'on', true);
  perform private.invoke_notification_dispatch();
  return new;
end;
$$;
revoke all on function private.request_notification_dispatch() from public, anon, authenticated;

create trigger notification_outbox_request_dispatch
after insert on public.notification_outbox
for each row execute function private.request_notification_dispatch();

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'tsudowa-dispatch-notifications' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'tsudowa-dispatch-notifications',
    '* * * * *',
    'select private.invoke_notification_dispatch()'
  );
end;
$$;
