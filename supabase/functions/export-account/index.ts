import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigin = (origin: string | null) => !origin
  || origin === 'https://tsudowa.app'
  || origin === 'https://www.tsudowa.app'
  || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const responseHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigin(origin) ? origin : 'https://tsudowa.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Origin',
});

const recentlyAuthenticated = (lastSignInAt?: string) => {
  if (!lastSignInAt) return false;
  const elapsed = Date.now() - new Date(lastSignInAt).getTime();
  return elapsed >= -60_000 && elapsed <= 5 * 60_000;
};

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const headers = responseHeaders(origin);
  if (!allowedOrigin(origin)) return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length));
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (!recentlyAuthenticated(userData.user.last_sign_in_at)) return new Response(JSON.stringify({ error: 'reauthentication_required' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
  const userId = userData.user.id;
  const exportQueries = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    admin.from('consent_records').select('*').eq('user_id', userId),
    admin.from('event_members').select('*').eq('user_id', userId),
    admin.from('messages').select('*').eq('author_id', userId),
    admin.from('collection_shares').select('*').eq('user_id', userId),
    admin.from('safety_reports').select('*').eq('reporter_id', userId),
    admin.from('blocked_users').select('*').eq('blocker_id', userId),
    admin.from('events').select('*').eq('owner_id', userId),
    admin.from('schedule_items').select('*').eq('created_by', userId),
    admin.from('collections').select('*').or(`created_by.eq.${userId},paid_by_user_id.eq.${userId}`),
    admin.from('date_candidates').select('*').eq('created_by', userId),
    admin.from('date_candidate_votes').select('*').eq('user_id', userId),
    admin.from('event_leave_requests').select('*').eq('user_id', userId),
  ]);
  if (exportQueries.some(({ error }) => error)) {
    return new Response(JSON.stringify({ error: 'export_failed' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  const [profile, consents, memberships, messages, shares, reports, blocks, ownedEvents, scheduleItems, collections, dateCandidates, dateVotes, leaveRequests] = exportQueries;
  const eventIds = (memberships.data ?? []).map((membership) => membership.event_id);
  const { data: events } = eventIds.length ? await admin.from('events').select('*').in('id', eventIds) : { data: [] };
  const authoredPhotoPaths = (messages.data ?? []).map((message) => message.image_path).filter(Boolean) as string[];
  const photoLinkExpiresInSeconds = 15 * 60;
  const { data: authoredPhotoLinks, error: authoredPhotoLinksError } = authoredPhotoPaths.length
    ? await admin.storage.from('chat-media').createSignedUrls(authoredPhotoPaths, photoLinkExpiresInSeconds)
    : { data: [], error: null };
  if (authoredPhotoLinksError) {
    return new Response(JSON.stringify({ error: 'media_export_failed' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  const appMediaPaths = [
    profile.data?.avatar_path,
    ...(ownedEvents.data ?? []).map((event) => event.cover_image_path),
  ].filter(Boolean) as string[];
  const { data: appMediaLinks, error: appMediaLinksError } = appMediaPaths.length
    ? await admin.storage.from('app-media').createSignedUrls([...new Set(appMediaPaths)], photoLinkExpiresInSeconds)
    : { data: [], error: null };
  if (appMediaLinksError) {
    return new Response(JSON.stringify({ error: 'app_media_export_failed' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  const exportData = {
    exported_at: new Date().toISOString(),
    account: { id: userId, email: userData.user.email, created_at: userData.user.created_at },
    profile: profile.data,
    consent_records: consents.data ?? [],
    memberships: memberships.data ?? [],
    events: events ?? [],
    owned_events: ownedEvents.data ?? [],
    authored_messages: messages.data ?? [],
    authored_chat_photos: (authoredPhotoLinks ?? []).map((photo) => ({
      path: photo.path,
      download_url: photo.signedUrl,
      download_url_expires_at: new Date(Date.now() + photoLinkExpiresInSeconds * 1000).toISOString(),
    })),
    profile_and_owned_event_photos: (appMediaLinks ?? []).map((photo) => ({
      path: photo.path,
      download_url: photo.signedUrl,
      download_url_expires_at: new Date(Date.now() + photoLinkExpiresInSeconds * 1000).toISOString(),
    })),
    authored_schedule_items: scheduleItems.data ?? [],
    created_or_paid_collections: collections.data ?? [],
    collection_shares: shares.data ?? [],
    created_date_candidates: dateCandidates.data ?? [],
    date_candidate_votes: dateVotes.data ?? [],
    event_leave_requests: leaveRequests.data ?? [],
    submitted_reports: reports.data ?? [],
    blocked_users: blocks.data ?? [],
  };
  return new Response(JSON.stringify(exportData), { status: 200, headers: { ...headers, 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="tsudowa-export.json"' } });
});
