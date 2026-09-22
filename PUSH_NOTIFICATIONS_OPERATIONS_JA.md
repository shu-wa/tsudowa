# TSUDOWA プッシュ通知 運用手順

## 1. 構成

アプリはExpo Push Token、アプリ内で生成するinstallation ID、OS種別を端末からSupabaseへ登録する（FCM/APNsの生トークンをSupabaseへ直接登録する構成ではない）。最終登録時刻もサーバー側で保持する。通知本文はPostgreSQL triggerが `notification_outbox` へ書き込み、`dispatch-notifications` Edge FunctionがExpo Push Serviceへ送信する。クライアントへサービスロール鍵、配信用シークレット、他利用者のトークンを渡さない。

通知対象は次の7種類。

- チャットの新着
- メンション・返信
- 日時・場所・イベント名の変更
- 参加、参加申請、脱退申請、承認結果
- 集金項目、期限、支払状態の変更
- 継続グループへ新しいイベントが追加された時
- 主催者・共同主催者が固定したお知らせ

イベント開始と集金期限は既存の端末内リマインダーとして処理する。日時未定イベントはリマインダーを作らない。

## 2. 本番反映順序

確認前に実行しない。承認後、必ず次の順序で反映する。

1. `202608280001_recurring_event_groups.sql` をDBへ反映
2. `202608280002_push_notification_foundation.sql` をDBへ反映
3. `NOTIFICATION_DISPATCH_SECRET`をEdge Function secretsとSupabase Vaultへ同じ値で設定
4. `202608280003_notification_dispatch_schedule.sql`をDBへ反映
5. Edge Functionをデプロイ
6. iOS APNsとAndroid FCM V1のEAS資格情報を確認
7. Androidアプリ登録用`google-services.json`をEASのFile変数`GOOGLE_SERVICES_JSON`へ設定
8. 新しい実機ビルドで通知権限、受信、タップ遷移を試験

## 3. 必須シークレット

Supabase DashboardのEdge Functions secretsで設定する。

- `NOTIFICATION_DISPATCH_SECRET`: 32バイト以上の暗号学的乱数。Database Webhookだけが `x-tsudowa-dispatch-secret` ヘッダーへ設定する。
- `EXPO_ACCESS_TOKEN`: Expo Push Securityを有効にした場合だけ設定する。

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はSupabase Edge Functionsの組み込み環境変数を使う。値をリポジトリ、`.env`、手順書、画面キャプチャへ記録しない。

## 4. Edge Function

デプロイ対象は `supabase/functions/dispatch-notifications`。この関数はDatabase Webhookから呼ぶためJWT検証を無効にしているが、`NOTIFICATION_DISPATCH_SECRET` が一致しない要求は401、未設定時は503で拒否する。

関数はDBの`FOR UPDATE SKIP LOCKED`で一度に最大100件を排他的に確保する。処理が中断したclaimは5分後に再取得できる。Expo側の一時失敗は5分後に再試行し、8回失敗した通知は終了扱いにする。処理済みoutboxは30日後に削除し、`DeviceNotRegistered` を返したトークンは自動で無効化する。

## 5. 即時呼出しと定期呼出し

`202608280003_notification_dispatch_schedule.sql`が次を自動構成する。

- `notification_outbox`へのINSERT後、同一transactionにつき1回だけ非同期HTTP要求
- おやすみ時間、再試行、通信失敗の回収用に1分間隔のcron
- Vaultの`tsudowa_notification_dispatch_secret`を`x-tsudowa-dispatch-secret`へ設定

HTTP要求本文は信頼情報として使わず、Edge Functionはサービスロールで未処理行を排他的に再取得する。秘密値はGit、`.env`、SQL migrationへ書かず、Edge Function secretsとVaultだけへ置く。

## 6. 端末資格情報

- iOS: EASのAPNs Push Keyがproduction projectに関連付いていること
- Android: Firebase projectにAndroidアプリ`com.shuwa.tsudowa`を登録すること
- Android: FirebaseのFCM V1 service account keyをEAS Credentialsへ設定すること
- Android: アプリ登録用`google-services.json`をEAS productionのSecret File変数`GOOGLE_SERVICES_JSON`へ設定すること。FCM V1 service account keyとは別ファイルである
- `google-services.json`とservice account JSONはリポジトリへcommitしない。Expoが優先して読む`app.config.ts`から、EASのFile変数の一時パスを`android.googleServicesFile`へ渡す。2026-09-11に`.js`だけ対応し`.ts`で値が失われていた不備を修正した。`pnpm check:build-config`で実際のExpo設定解決を検査する。既存ビルドはこの修正で変わらないため、新しいAndroidビルドで反映・受信を確認する
- Expo GoではAndroidのremote pushを試験しない。SDK 54ではdevelopment buildまたはrelease buildが必要

## 7. 受入試験

送信側と受信側の2アカウントを別実機または別インストールで用意する。

1. 受信側で通知を許可し、通知設定を保存
2. チャット通常投稿を受信
3. `@表示ID` のメンションを受信
4. 返信を受信
5. 日時、場所の変更を受信
6. 参加・脱退申請と承認結果を受信
7. 集金項目と支払状態の変更を受信
8. グループへ追加された次回イベントを、参加状態の通知を重複させず1件で受信
9. 固定メッセージを「主催者からのお知らせ」として受信
10. 通知タップで対象画面へ遷移
11. 種類別オフ、イベント別オフ、おやすみ時間で抑止
12. ブロックした相手の通知が届かない
13. ログアウト後に前アカウントの通知が届かない

通知本文へメールアドレス、招待コード、支払方法、位置座標などの不要な個人情報を含めない。

## 8. 送信成功と端末への到達を区別する

現行dispatcherはExpoの送信ticketを確認するが、後続のpush receiptを取得する処理はない。`processed_at`は端末表示の証拠ではない。`DeviceNotRegistered`の無効化も現在はticketに返った場合の処理に限られる。試験では受信端末で確認し、将来のreceipt回収・監視を運用改善として検討する。既存ユーザー全員を対象に疎通試験をしない。
