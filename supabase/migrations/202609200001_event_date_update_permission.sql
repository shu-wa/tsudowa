-- date_status was added after events switched to column-scoped UPDATE grants.
-- Date saves write this column even for already-scheduled events.
-- Preserve manager-only RLS and the archived-event mutation trigger.
grant update (date_status) on public.events to authenticated;
