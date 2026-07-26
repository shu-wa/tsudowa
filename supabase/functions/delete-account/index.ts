import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const userId = userData.user.id;

  // The user profile and owned events can reference private app-media objects.
  // Resolve those paths before deleting database rows so account deletion does
  // not leave user-generated images behind.
  const [{ data: profile, error: profileError }, { data: ownedEvents, error: ownedEventsError }] = await Promise.all([
    admin.from('profiles').select('avatar_path').eq('id', userId).maybeSingle(),
    admin.from('events').select('id, cover_image_path').eq('owner_id', userId),
  ]);
  if (profileError) return failure('profile_lookup_failed');
  if (ownedEventsError) return failure('owned_events_lookup_failed');
  const ownedEventIds = (ownedEvents ?? []).map((event) => event.id);
  const appMediaPaths = [
    profile?.avatar_path,
    ...(ownedEvents ?? []).map((event) => event.cover_image_path),
  ].filter(Boolean) as string[];

  const authoredMediaQuery = admin.from('messages').select('image_path').eq('author_id', userId).not('image_path', 'is', null);
  const ownedEventMediaQuery = ownedEventIds.length
    ? admin.from('messages').select('image_path').in('event_id', ownedEventIds).not('image_path', 'is', null)
    : Promise.resolve({ data: [], error: null });
  const [authoredMedia, ownedEventMedia] = await Promise.all([authoredMediaQuery, ownedEventMediaQuery]);
  if (authoredMedia.error || ownedEventMedia.error) return failure('media_lookup_failed');
  const mediaPaths = [...new Set([...(authoredMedia.data ?? []), ...(ownedEventMedia.data ?? [])].map((message) => message.image_path).filter(Boolean))] as string[];
  if (mediaPaths.length) {
    const { error: mediaDeleteError } = await admin.storage.from('chat-media').remove(mediaPaths);
    if (mediaDeleteError) return failure('media_delete_failed');
  }
  if (appMediaPaths.length) {
    const { error: appMediaDeleteError } = await admin.storage.from('app-media').remove([...new Set(appMediaPaths)]);
    if (appMediaDeleteError) return failure('app_media_delete_failed');
  }

  // Owned events cannot remain without their owner, so delete them and their
  // related database records before deleting the authentication user.
  if (ownedEventIds.length) {
    const { error: ownedEventDeleteError } = await admin.from('events').delete().in('id', ownedEventIds);
    if (ownedEventDeleteError) return failure('owned_events_delete_failed');
  }

  // 他のイベント内で本人が作成・立替した項目は、restrict外部キーを解消しつつ削除します。
  const cleanupResults = await Promise.all([
    admin.from('schedule_items').delete().eq('created_by', userId),
    admin.from('collections').delete().or(`created_by.eq.${userId},paid_by_user_id.eq.${userId}`),
    admin.from('date_candidates').delete().eq('created_by', userId),
  ]);
  if (cleanupResults.some(({ error }) => error)) return failure('related_data_delete_failed');

  // 残りのプロフィール、参加情報、メッセージ、通報、ブロック等は外部キーのcascadeで削除されます。
  const { error } = await admin.auth.admin.deleteUser(userId, false);
  if (error) return new Response(JSON.stringify({ error: 'deletion_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ deleted: true, deleted_owned_events: ownedEventIds.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  function failure(code: string) {
    return new Response(JSON.stringify({ error: code }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
