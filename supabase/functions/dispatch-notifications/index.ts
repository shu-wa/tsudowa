import { createClient } from 'jsr:@supabase/supabase-js@2';

type OutboxRow = {
  id: string;
  recipient_id: string;
  event_id?: string;
  kind: 'chat_message' | 'mention_or_reply' | 'event_update' | 'membership_update' | 'collection_update' | 'group_update' | 'announcement';
  title: string;
  body: string;
  route: string;
  attempt_count: number;
};

type PreferenceRow = {
  user_id: string;
  master_enabled: boolean;
  chat_messages: boolean;
  mentions_and_replies: boolean;
  event_updates: boolean;
  membership_updates: boolean;
  collection_updates: boolean;
  group_updates: boolean;
  announcements: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  time_zone: string;
};

type DeviceRow = {
  expo_push_token: string;
  user_id: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

const preferenceEnabled = (preference: PreferenceRow, kind: OutboxRow['kind']) => {
  if (!preference.master_enabled) return false;
  const fieldByKind = {
    chat_message: 'chat_messages',
    mention_or_reply: 'mentions_and_replies',
    event_update: 'event_updates',
    membership_update: 'membership_updates',
    collection_update: 'collection_updates',
    group_update: 'group_updates',
    announcement: 'announcements',
  } as const;
  return preference[fieldByKind[kind]];
};

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

const isQuietTime = (preference: PreferenceRow, now = new Date()) => {
  if (!preference.quiet_hours_enabled) return false;
  let currentMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: preference.time_zone || 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    currentMinutes = hour * 60 + minute;
  } catch {
    currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  }
  const start = timeToMinutes(preference.quiet_start);
  const end = timeToMinutes(preference.quiet_end);
  if (start === end) return true;
  return start < end
    ? currentMinutes >= start && currentMinutes < end
    : currentMinutes >= start || currentMinutes < end;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const expectedSecret = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  if (!expectedSecret) return json({ error: 'dispatch_not_configured' }, 503);
  if (request.headers.get('x-tsudowa-dispatch-secret') !== expectedSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const nowIso = new Date().toISOString();
  const workerToken = crypto.randomUUID();
  const { data: pending, error: pendingError } = await admin.rpc('claim_notification_outbox', {
    worker_token: workerToken,
    batch_size: 100,
  });
  if (pendingError) return json({ error: 'outbox_read_failed' }, 500);
  const rows = (pending ?? []) as OutboxRow[];
  if (!rows.length) return json({ processed: 0, sent: 0, delayed: 0 });

  const userIds = [...new Set(rows.map((row) => row.recipient_id))];
  const [{ data: preferences, error: preferenceError }, { data: devices, error: deviceError }] = await Promise.all([
    admin.from('notification_preferences').select('*').in('user_id', userIds),
    admin.from('push_devices').select('expo_push_token, user_id').in('user_id', userIds).eq('active', true),
  ]);
  if (preferenceError || deviceError) return json({ error: 'recipient_lookup_failed' }, 500);

  const preferenceByUser = new Map((preferences as PreferenceRow[] ?? []).map((row) => [row.user_id, row]));
  const devicesByUser = new Map<string, DeviceRow[]>();
  for (const device of (devices as DeviceRow[] ?? [])) {
    const current = devicesByUser.get(device.user_id) ?? [];
    current.push(device);
    devicesByUser.set(device.user_id, current);
  }

  const suppressedIds: string[] = [];
  const quietIds: string[] = [];
  const payloads: Array<{
    outboxId: string;
    token: string;
    payload: Record<string, unknown>;
  }> = [];
  for (const row of rows) {
    if (row.attempt_count >= 8) {
      suppressedIds.push(row.id);
      continue;
    }
    const preference = preferenceByUser.get(row.recipient_id);
    const userDevices = devicesByUser.get(row.recipient_id) ?? [];
    if (!preference || !preferenceEnabled(preference, row.kind) || !userDevices.length) {
      suppressedIds.push(row.id);
      continue;
    }
    if (isQuietTime(preference)) {
      quietIds.push(row.id);
      continue;
    }
    for (const device of userDevices) {
      payloads.push({
        outboxId: row.id,
        token: device.expo_push_token,
        payload: {
          to: device.expo_push_token,
          title: row.title,
          body: row.body,
          data: { url: row.route, eventId: row.event_id, kind: row.kind },
          sound: 'default',
          priority: 'high',
          channelId: 'event-reminders',
        },
      });
    }
  }

  if (suppressedIds.length) {
    await admin.from('notification_outbox')
      .update({
        processed_at: nowIso,
        claimed_at: null,
        claim_token: null,
        last_error: 'suppressed_by_preferences_or_no_device',
      })
      .eq('claim_token', workerToken)
      .in('id', suppressedIds);
  }
  if (quietIds.length) {
    await admin.from('notification_outbox')
      .update({
        available_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        claimed_at: null,
        claim_token: null,
      })
      .eq('claim_token', workerToken)
      .in('id', quietIds);
  }
  if (!payloads.length) {
    return json({ processed: suppressedIds.length, sent: 0, delayed: quietIds.length });
  }

  const expoHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoAccessToken) expoHeaders.Authorization = `Bearer ${expoAccessToken}`;

  const successfulOutboxIds = new Set<string>();
  const retryOutboxIds = new Set<string>();
  const deactivatedTokens: string[] = [];
  for (let start = 0; start < payloads.length; start += 100) {
    const batch = payloads.slice(start, start + 100);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: expoHeaders,
        body: JSON.stringify(batch.map((item) => item.payload)),
      });
      if (!response.ok) {
        batch.forEach((item) => retryOutboxIds.add(item.outboxId));
        continue;
      }
      const result = await response.json() as {
        data?: Array<{ status: 'ok' | 'error'; details?: { error?: string }; message?: string }>;
      };
      batch.forEach((item, index) => {
        const ticket = result.data?.[index];
        if (ticket?.status === 'ok') {
          successfulOutboxIds.add(item.outboxId);
          return;
        }
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          deactivatedTokens.push(item.token);
          successfulOutboxIds.add(item.outboxId);
          return;
        }
        retryOutboxIds.add(item.outboxId);
      });
    } catch {
      batch.forEach((item) => retryOutboxIds.add(item.outboxId));
    }
  }

  for (const id of retryOutboxIds) successfulOutboxIds.delete(id);
  if (deactivatedTokens.length) {
    await admin.from('push_devices').update({ active: false }).in('expo_push_token', deactivatedTokens);
  }
  if (successfulOutboxIds.size) {
    await admin.from('notification_outbox')
      .update({ processed_at: new Date().toISOString(), claimed_at: null, claim_token: null, last_error: null })
      .eq('claim_token', workerToken)
      .in('id', [...successfulOutboxIds]);
  }

  await admin.from('notification_outbox')
    .delete()
    .not('processed_at', 'is', null)
    .lt('processed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  if (retryOutboxIds.size) {
    for (const row of rows.filter((item) => retryOutboxIds.has(item.id))) {
      await admin.from('notification_outbox')
        .update({
          attempt_count: row.attempt_count + 1,
          available_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          claimed_at: null,
          claim_token: null,
          last_error: 'expo_delivery_failed',
        })
        .eq('claim_token', workerToken)
        .eq('id', row.id);
    }
  }

  return json({
    processed: suppressedIds.length + successfulOutboxIds.size,
    sent: successfulOutboxIds.size,
    delayed: quietIds.length,
    retrying: retryOutboxIds.size,
  });
});
