-- Run manually in the intended project's SQL editor with operator privileges.
-- Read-only aggregates: no token, notification body, email, or secret output.
-- This file is NOT a migration and does NOT install monitoring or cron jobs.
begin read only;

select
  count(*) filter (where processed_at is null) as pending,
  count(*) filter (where processed_at is null and available_at < now() - interval '10 minutes') as overdue_10m,
  count(*) filter (where processed_at is null and attempt_count >= 8) as pending_at_retry_limit,
  max(created_at) as newest_queued_at,
  max(processed_at) as newest_processed_at
from public.notification_outbox;

select jobname, active, schedule
from cron.job
where jobname = 'tsudowa-dispatch-notifications';

select d.status, count(*) as runs, max(d.start_time) as latest_started_at
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'tsudowa-dispatch-notifications'
  and d.start_time > now() - interval '24 hours'
group by d.status;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('chat-media', 'app-media');

commit;
