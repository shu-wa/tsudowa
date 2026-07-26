# TSUDOWA Supabase設定手順

Version 0.11.0

## 現在の動作

- `.env` がない場合: 従来の端末内開発モードで起動します。
- 正しいSupabase設定がある場合: 最初にメール登録・ログイン画面が表示され、利用者ごとにローカルキャッシュを分離します。
- Supabase設定が不完全な場合でもアプリがクラッシュしないようにしてあります。

## 1. Supabaseプロジェクトを作る

1. https://supabase.com/dashboard へログインします。
2. New projectからTSUDOWA用プロジェクトを作成します。
3. 公開対象地域、データ保護方針、利用者との距離を考慮してリージョンを選びます。
4. Project Settings > API または Connect画面から次の2つを確認します。
   - Project URL
   - Publishable key（`sb_publishable_...`）

`service_role`、Secret key、データベースパスワードはアプリへ入れません。

## 2. アプリへ公開設定を入れる

`C:\dev\tsudowa\.env.example` を `.env` という名前でコピーし、次の値を書き換えます。

```env
EXPO_PUBLIC_SUPABASE_URL=https://実際のPROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=実際のsb_publishableキー
```

`.env` はGit対象外です。チャット、スクリーンショット、公開リポジトリへ載せないでください。

## 3. データベースを作る

推奨はSupabase CLIです。

```powershell
cd C:\dev\tsudowa
npx.cmd supabase@latest init
npx.cmd supabase@latest login
npx.cmd supabase@latest link --project-ref 実際のPROJECT_REF
npx.cmd supabase@latest db push --dry-run
npx.cmd supabase@latest db push
```

`init` は最初の1回だけ実行します。`link` の前にログインとProject Refの指定が必要です。まず `--dry-run` で適用対象を確認し、問題がない場合だけ実際の `db push` を実行してください。

適用されるファイルは `supabase/migrations/` 内のSQLすべてです。Version 0.13.0では、特に次のマイグレーションが追加されています。

```text
supabase/migrations/202607220006_chat_read_state.sql
supabase/migrations/202607220007_invite_preview.sql
supabase/migrations/202607220008_pgcrypto_function_schema.sql
supabase/migrations/202607260002_chat_images.sql
```

このSQLには次が含まれます。

- プロフィール、同意履歴
- イベント、参加者、役割、参加承認
- タイムフロー、集金、支払状態
- チャット、ブロック、通報
- 期限・回数・失効に対応したハッシュ化招待コード
- Row Level Securityによるイベント参加者単位のアクセス制御
- 主催者／共同主催者だけが編集できる権限
- アカウント単位のチャット既読位置
- 参加前にイベント名・日時だけを返す招待確認関数
- 写真付きチャットメッセージと、8MB・画像形式制限
- 非公開Storageバケット `chat-media` と、イベント参加者だけが閲覧できるRLS

チャット写真は公開URLにしません。アプリは参加中イベントの写真にだけ、有効期間1時間の署名付きURLを発行して表示します。送信者本人または主催者／共同主催者だけがStorage上の写真を削除できます。

## 4. アカウント削除・データ書き出し関数を公開する

```powershell
cd C:\dev\tsudowa
npx.cmd supabase@latest functions deploy delete-account
npx.cmd supabase@latest functions deploy export-account
```

Supabaseが自動提供する `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` をサーバー関数だけが使用します。Secret keyを`.env`へ追加する必要はありません。

## 5. 認証メールを設定する

Supabase DashboardのAuthenticationで以下を設定します。

- 本番のSite URL
- TSUDOWA用のメール差出人
- メール確認テンプレート
- パスワード再設定テンプレート
- 不正登録防止のレート制限とCAPTCHA
- 本番用ディープリンク／Universal Link

現在のアプリスキームは `tsudowa://` です。ストア公開前は、Webドメインを取得してUniversal Links / App Linksを追加してください。

## 6. 起動する

新しいネイティブ部品が追加されているため、キャッシュを消して起動します。

```powershell
cd C:\dev\tsudowa
npm.cmd run start -- --clear
```

## 7. 必ず行う確認

最低2つのテストアカウントで確認します。

1. アカウントAでイベントを作成
2. Aが招待コードを発行
3. アカウントBがコードを入力
4. 承認待ちになることを確認
5. Bが承認されるまでイベント内容を読めないことを確認
6. 承認後にチャット、予定、集金を確認
7. Bをブロックした時にメッセージが非表示になることを確認
8. データ書き出しに他人の非公開データが混ざらないことを確認
9. アカウント削除後にプロフィールと投稿が削除されることを確認
10. Aが8MB以下のJPEG／PNG／WebP／HEIC写真を送り、Bだけが表示できることを確認
11. イベントへ未参加のアカウントCから、写真の取得・署名URL発行・アップロードが拒否されることを確認
12. データ書き出しに、本人が投稿した写真の24時間有効なダウンロードURLが含まれることを確認
13. アカウント削除後に、本人が投稿したチャット写真もStorageから削除されることを確認

## 重要

この設定が完了するまで、Supabase側の実通信テストはできません。アプリ、SQL、サーバー関数は準備済みですが、公開前にRLSの自動テストと第三者によるセキュリティ確認を行ってください。
