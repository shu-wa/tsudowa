const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('.');
const failures = [];
const passes = [];

// `.env` contains commit-safe placeholders while `.env.local` contains the
// local public production metadata. Keep explicitly supplied CI/EAS values,
// but let valid local values replace placeholders during developer checks.
const localEnvPath = path.join(root, '.env.local');
if (fs.existsSync(localEnvPath)) {
  for (const line of fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const match = /^([^#=]+)=(.*)$/.exec(line);
    if (!match) continue;
    const name = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[name] || /YOUR_|正式名称|example\.com/i.test(process.env[name])) process.env[name] = value;
  }
}

function fail(message) { failures.push(message); }
function pass(message) { passes.push(message); }
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }
function exists(relativePath) { return fs.existsSync(path.join(root, relativePath)); }

function requirePublicValue(name, validate) {
  const value = process.env[name]?.trim();
  if (!value || /YOUR_|正式名称|example\.com/i.test(value)) {
    fail(`${name} が本番値に設定されていません`);
    return;
  }
  if (validate && !validate(value)) {
    fail(`${name} の形式が正しくありません`);
    return;
  }
  pass(`${name} を確認`);
}

requirePublicValue('EXPO_PUBLIC_SUPABASE_URL', (value) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value));
requirePublicValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', (value) => value.startsWith('sb_publishable_') || value.startsWith('eyJ'));
requirePublicValue('EXPO_PUBLIC_OPERATOR_NAME', (value) => value.length >= 2);
requirePublicValue('EXPO_PUBLIC_SUPPORT_EMAIL', (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
requirePublicValue('EXPO_PUBLIC_PUBLIC_BASE_URL', (value) => {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
});
requirePublicValue('GOOGLE_MAPS_API_KEY', (value) => value.length >= 20);

if (process.env.RELEASE_BRAND_APPROVED !== 'true') {
  fail('RELEASE_BRAND_APPROVED=true がありません（正式な名称・商標確認後に設定）');
} else {
  pass('名称・商標確認の完了フラグを確認');
}

if (process.env.RELEASE_GLOBAL_COMPLIANCE_APPROVED !== 'true') {
  fail('RELEASE_GLOBAL_COMPLIANCE_APPROVED=true がありません（提供予定国の法務・運用確認後に設定）');
} else {
  pass('提供予定国の法務・運用確認フラグを確認');
}

const appConfig = JSON.parse(read('app.json')).expo;
if (appConfig.name === 'TSUDOWA' && appConfig.slug === 'tsudowa' && appConfig.scheme === 'tsudowa') {
  pass('TSUDOWAのアプリ名・slug・URLスキームを確認');
} else {
  fail('app.json の名称、slug、URLスキームをTSUDOWAへ統一してください');
}
if (appConfig.icon === './assets/images/brand-icon.png') pass('独自アプリアイコンを参照');
else fail('app.json が独自アプリアイコンを参照していません');
if (appConfig.ios?.bundleIdentifier === 'com.shuwa.tsudowa' && appConfig.android?.package === 'com.shuwa.tsudowa') {
  pass('TSUDOWAのiOS/AndroidアプリIDを確認');
} else {
  fail('iOS/AndroidアプリIDを com.shuwa.tsudowa へ統一してください');
}
const storeConfig = JSON.parse(read('store.config.json'));
if (appConfig.version === '1.0.0' && packageJsonVersion() === appConfig.version && storeConfig.apple?.version === appConfig.version) {
  pass('アプリとストアの正式版1.0.0を確認');
} else {
  fail('app.json、package.json、store.config.jsonのバージョンを正式版1.0.0へ統一してください');
}
if (
  storeConfig.apple?.release?.automaticRelease === false
  && storeConfig.apple?.advisory?.messagingAndChat === true
  && storeConfig.apple?.advisory?.userGeneratedContent === true
  && storeConfig.apple?.advisory?.ageRatingOverrideV2 === 'SIXTEEN_PLUS'
) {
  pass('App Storeの手動公開、16+、UGC申告を確認');
} else {
  fail('App Storeの手動公開、16+、チャット、ユーザー生成コンテンツ申告を確認してください');
}
const storeDescription = storeConfig.apple?.info?.ja?.description ?? '';
if (/主催者による集金項目と支払状態の管理/.test(storeDescription) && !/共同主催者による支払状態/.test(storeDescription)) {
  pass('App Store説明の集金権限が主催者限定であることを確認');
} else {
  fail('App Store説明の集金権限を現行仕様の主催者限定へ更新してください');
}
if (appConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false) pass('iOS暗号化申告設定を確認');
else fail('ITSAppUsesNonExemptEncryption の設定を確認してください');
const imagePickerPlugin = appConfig.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
);
if (imagePickerPlugin?.[1]?.photosPermission && imagePickerPlugin[1].cameraPermission === false) {
  pass('写真選択の用途説明と不要なカメラ権限の無効化を確認');
} else {
  fail('expo-image-pickerの写真用途説明、または不要なカメラ権限の無効化が不足しています');
}
if (appConfig.extra?.eas?.projectId) pass('EAS projectIdを確認');
else fail('EAS projectId が未設定です。eas init でプロジェクトをリンクしてください');

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.['expo-image-picker'] === '~17.0.11') pass('Expo SDK 54対応の写真選択依存を確認');
else fail('expo-image-pickerをExpo SDK 54対応版へ固定してください');

function packageJsonVersion() {
  return JSON.parse(read('package.json')).version;
}

[
  'assets/images/brand-icon.png',
  'assets/images/brand-icon-foreground.png',
  'assets/images/brand-icon-monochrome.png',
  'assets/images/brand-favicon.png',
  'app.config.js',
  'app/privacy.tsx',
  'app/terms.tsx',
  'app/community-guidelines.tsx',
  'app/account-deletion.tsx',
  'app/support.tsx',
  'app/acknowledgements.tsx',
  'constants/legal.ts',
  'supabase/functions/delete-account/index.ts',
  'supabase/functions/export-account/index.ts',
  'supabase/migrations/202607260002_chat_images.sql',
  'supabase/migrations/202607260006_media_leave_archive.sql',
  'supabase/migrations/202607260007_preserve_attendance_on_rejoin.sql',
  'supabase/migrations/202607310001_security_hardening.sql',
  'supabase/migrations/202608010001_content_moderation.sql',
  'supabase/migrations/202608270001_chat_foundation.sql',
  'supabase/migrations/202608280001_recurring_event_groups.sql',
  'supabase/migrations/202608280002_push_notification_foundation.sql',
  'supabase/migrations/202608280003_notification_dispatch_schedule.sql',
  'supabase/migrations/202608280004_restrict_internal_event_trigger.sql',
  'supabase/migrations/202608280005_fix_group_creation_ambiguity.sql',
  'supabase/functions/dispatch-notifications/index.ts',
  'PUSH_NOTIFICATIONS_OPERATIONS_JA.md',
  'MODERATION_OPERATIONS_JA.md',
  'store.config.json',
  'store-assets/google-play/icon-512.png',
  'store-assets/google-play/feature-graphic.png',
].forEach((file) => exists(file) ? pass(`${file} を確認`) : fail(`${file} がありません`));

const eventContextSource = read('context/event-context.tsx');
const moderationMigration = read('supabase/migrations/202608010001_content_moderation.sql');
if (
  /validateUserContent\(normalizedText\)/.test(eventContextSource)
  && /messages_content_safety/.test(moderationMigration)
  && /private\.is_moderator\(\)/.test(moderationMigration)
) {
  pass('投稿フィルターとモデレーター権限を確認');
} else {
  fail('クライアントとDBの投稿安全対策が接続されていません');
}

const dynamicAppConfig = read('app.config.js');
if (/GOOGLE_MAPS_API_KEY/.test(dynamicAppConfig) && /googleMaps:\s*\{\s*apiKey/.test(dynamicAppConfig)) {
  pass('AndroidビルドへGoogle Maps APIキーを渡す設定を確認');
} else {
  fail('AndroidビルドへGoogle Maps APIキーを渡す設定が不足しています');
}
if (/GOOGLE_SERVICES_JSON/.test(dynamicAppConfig) && /googleServicesFile/.test(dynamicAppConfig)) {
  pass('AndroidビルドへFirebase設定ファイルを安全に渡す設定を確認');
} else {
  fail('AndroidビルドへFirebase設定ファイルを渡す設定が不足しています');
}

const deleteAccountSource = read('supabase/functions/delete-account/index.ts');
if (
  /from\('chat-media'\)\.remove/.test(deleteAccountSource)
  && /from\('app-media'\)\.remove/.test(deleteAccountSource)
  && /auth\.admin\.deleteUser/.test(deleteAccountSource)
) {
  pass('アカウント削除APIのチャット・プロフィール・イベント画像削除を確認');
} else {
  fail('アカウント削除APIで関連画像を削除する処理が不足しています');
}

const privacyCopy = read('constants/legal.ts');
if (/写真ライブラリ/.test(privacyCopy) && /期限付きURL/.test(privacyCopy) && /共有写真/.test(privacyCopy)) {
  pass('写真共有のプライバシー説明を確認');
} else {
  fail('写真共有、非公開保存、削除に関するプライバシー説明を確認してください');
}

const userFacingSource = [
  'app',
  'components',
  'constants',
].flatMap((directory) => walk(path.join(root, directory)));
const forbiddenCopy = /(公開版では|TSUDOWA運営|[0-9０-９]+人オンライン|サンプルデータ|ダミーデータ|ハッシュで保存)/;
for (const file of userFacingSource) {
  const content = fs.readFileSync(file, 'utf8');
  if (forbiddenCopy.test(content)) fail(`未完成または開発者向け文言を検出: ${path.relative(root, file)}`);
}
if (!failures.some((item) => item.includes('未完成または開発者向け文言'))) pass('利用者画面の未完成文言を確認');

const chatMigration = read('supabase/migrations/202608270001_chat_foundation.sql');
if (
  /message_reactions_read_members/.test(chatMigration)
  && /private\.is_event_member\(private\.realtime_chat_event_id/.test(chatMigration)
  && /send_event_message_v2/.test(chatMigration)
  && /delete_window_expired/.test(chatMigration)
) {
  pass('強化チャットのRLS、private Realtime、送信取消制限を確認');
} else {
  fail('強化チャットのDB権限または送信取消制限が不足しています');
}

const groupsMigration = read('supabase/migrations/202608280001_recurring_event_groups.sql');
if (
  /create table(?: if not exists)? public\.event_groups/.test(groupsMigration)
  && /create table(?: if not exists)? public\.event_group_members/.test(groupsMigration)
  && /create or replace function public\.create_group_from_event/.test(groupsMigration)
  && /create or replace function public\.create_group_event/.test(groupsMigration)
  && /revoke all on public\.event_groups, public\.event_group_members from public, anon, authenticated/.test(groupsMigration)
) {
  pass('継続グループのDB、権限、作成RPCを確認');
} else {
  fail('継続グループのDB構造または権限制御が不足しています');
}

const notificationsMigration = read('supabase/migrations/202608280002_push_notification_foundation.sql');
const notificationDispatcher = read('supabase/functions/dispatch-notifications/index.ts');
if (
  /create table(?: if not exists)? public\.notification_preferences/.test(notificationsMigration)
  && /create table(?: if not exists)? public\.push_devices/.test(notificationsMigration)
  && /create table(?: if not exists)? public\.notification_outbox/.test(notificationsMigration)
  && /alter table public\.notification_outbox enable row level security/.test(notificationsMigration)
  && /revoke all on public\.notification_outbox from public, anon, authenticated/.test(notificationsMigration)
  && !/grant select on public\.push_devices to authenticated/.test(notificationsMigration)
  && /push_token_in_use/.test(notificationsMigration)
  && /notify_group_event_created/.test(notificationsMigration)
  && /claim_notification_outbox/.test(notificationsMigration)
  && /for update skip locked/.test(notificationsMigration)
  && /group_update/.test(notificationDispatcher)
  && /NOTIFICATION_DISPATCH_SECRET/.test(notificationDispatcher)
  && /https:\/\/exp\.host\/--\/api\/v2\/push\/send/.test(notificationDispatcher)
  && /data:\s*\{\s*url:\s*row\.route/.test(notificationDispatcher)
) {
  pass('通知設定、端末登録、配信キュー、共有シークレットを確認');
} else {
  fail('プッシュ通知のDB権限または安全な配信処理が不足しています');
}

if (
  /Expo Push Service/.test(privacyCopy)
  && /Apple Push Notification service/.test(privacyCopy)
  && /Google Firebase Cloud Messaging/.test(privacyCopy)
  && /通知設定/.test(privacyCopy)
) {
  pass('プッシュ通知に関するプライバシー説明を確認');
} else {
  fail('プッシュ通知の外部送信先、目的、設定方法に関する説明が不足しています');
}

const legacyBrandPattern = new RegExp('do' + '[ _-]?' + 'eventer', 'i');
const legacyBrandFiles = [
  ...walk(path.join(root, 'app')),
  ...walk(path.join(root, 'components')),
  ...walk(path.join(root, 'constants')),
  ...walk(path.join(root, 'context')),
  ...walk(path.join(root, 'lib')),
  ...walk(path.join(root, 'scripts')),
  ...walk(path.join(root, 'supabase')),
  path.join(root, 'app.json'),
  path.join(root, 'package.json'),
].filter((file) => fs.existsSync(file));
for (const file of legacyBrandFiles) {
  if (legacyBrandPattern.test(fs.readFileSync(file, 'utf8'))) {
    fail(`旧ブランド名を検出: ${path.relative(root, file)}`);
  }
}
if (!failures.some((item) => item.includes('旧ブランド名を検出'))) pass('旧ブランド名が残っていないことを確認');

const clientSource = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components')), ...walk(path.join(root, 'lib'))]
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(clientSource)) fail('クライアントコードに管理者キー名を検出');
else pass('クライアントコードに管理者キーがないことを確認');

console.log('\nRelease checks passed:');
passes.forEach((message) => console.log(`  ✓ ${message}`));
if (failures.length) {
  console.error('\nRelease blockers:');
  failures.forEach((message) => console.error(`  ✗ ${message}`));
  process.exit(1);
}
console.log('\nリリース前自動チェックに合格しました。');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(ts|tsx|js|json)$/.test(entry.name) ? [fullPath] : [];
  });
}
