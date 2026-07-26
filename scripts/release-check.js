const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('.');
const failures = [];
const passes = [];

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
if (appConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false) pass('iOS暗号化申告設定を確認');
else fail('ITSAppUsesNonExemptEncryption の設定を確認してください');
if (appConfig.extra?.eas?.projectId) pass('EAS projectIdを確認');
else fail('EAS projectId が未設定です。eas init でプロジェクトをリンクしてください');

[
  'assets/images/brand-icon.png',
  'assets/images/brand-icon-foreground.png',
  'assets/images/brand-icon-monochrome.png',
  'assets/images/brand-favicon.png',
  'app/privacy.tsx',
  'app/terms.tsx',
  'app/community-guidelines.tsx',
  'app/account-deletion.tsx',
  'app/support.tsx',
  'app/acknowledgements.tsx',
  'constants/legal.ts',
  'supabase/functions/delete-account/index.ts',
  'supabase/functions/export-account/index.ts',
].forEach((file) => exists(file) ? pass(`${file} を確認`) : fail(`${file} がありません`));

const userFacingSource = [
  'app',
  'components',
  'constants',
].flatMap((directory) => walk(path.join(root, directory)));
const forbiddenCopy = /(公開版では|TSUDOWA運営|人オンライン|サンプルデータ|ダミーデータ|ハッシュで保存)/;
for (const file of userFacingSource) {
  const content = fs.readFileSync(file, 'utf8');
  if (forbiddenCopy.test(content)) fail(`未完成または開発者向け文言を検出: ${path.relative(root, file)}`);
}
if (!failures.some((item) => item.includes('未完成または開発者向け文言'))) pass('利用者画面の未完成文言を確認');

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
