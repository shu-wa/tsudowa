-- Approval mode was previously implicit and could not be selected by an
-- organiser. Complete those existing invite joins after switching events to
-- automatic joining.

update public.event_members member
set status = 'approved',
    attendance_label = coalesce(member.attendance_label, '未定'),
    updated_at = now()
from public.events event
where event.id = member.event_id
  and event.join_policy = 'auto'
  and member.status = 'pending';
