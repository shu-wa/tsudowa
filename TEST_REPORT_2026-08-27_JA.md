# TSUDOWA 総合試験記録 2026-08-27

最終更新: 2026-08-28

## 1. 対象

- アプリ: TSUDOWA 1.0.0
- 基準コミット: `dc7ef78`
- 対象差分: iOS時間spinner可視性修正、強化チャット、Expo SDK 54パッチ更新
- 実施端末: Windows開発PC
- 本番反映: Supabase migrationと`export-account` Edge Functionのみ実施。アプリのGit push、EAS build、submissionは未実施

## 2. 自動試験結果

| 試験 | 結果 | 内容 |
|---|---|---|
| Date regression | 合格 | ローカル日付、月間カレンダー、1970年回帰 |
| Time regression | 合格 | 時刻正規化、spinner制御値、iOS文字色 |
| Onboarding regression | 合格 | 初回登録、クラウド復元、端末保存失敗時の扱い |
| Secure storage regression | 合格 | 暗号化保存、chunk、世代管理 |
| Auth redirect regression | 合格 | 確認メール、scheme、許可route |
| Collection regression | 合格 | 金額分割、未払い初期値、主催者限定編集 |
| Chat regression | 合格 | 返信、検索、リアクション、編集・取消期限、pin、RLS記述 |
| TypeScript | 合格 | `tsc --noEmit` |
| ESLint | 合格 | error 0、warning 0 |
| Expo Doctor | 合格 | 18/18 |
| Web export | 合格 | 957 modules |
| iOS export | 合格 | 1369 modules、Hermes bundle生成 |
| Android export | 合格 | 1375 modules、Hermes bundle生成 |
| Production dependency audit | 合格 | 未除外脆弱性0件。2件は`pnpm-workspace.yaml`記載のExpo/Metro build-time例外 |
| Git whitespace | 合格 | `git diff --check` |
| Linked DB lint | 合格 | 適用前・適用後ともschema error 0件 |
| Remote anonymous security smoke | 合格 | 未認証の送信・編集・取消・reaction・pin RPCとreaction読取を拒否 |
| Linked DB pgTAP | 合格 | 構造・権限30件＋3役行動24件、合計54/54。全テストrollback |

## 3. 自動試験で行った修正

- `expo`をSDK 54推奨の`~54.0.37`へ更新。
- `expo-constants`を`~18.0.14`へ更新。
- `nanoid` overrideを脆弱性修正版`3.3.18`へ更新。
- CIへ`check:chat`を追加。
- release checkへ強化チャットのRLS・private Realtime・送信取消検証を追加。
- App Store説明の集金権限を「主催者のみ」へ修正。
- Privacy Policyへ返信、リアクション、既読、オンライン、入力中状態を追記。

## 4. Supabase状態

2026-08-27にDashboardからResumeし、CLIでproject ref `jwgynxnkjjyoqiirqwus`が`ACTIVE_HEALTHY`であることを確認した。次の順で本番反映を行った。

```powershell
cd C:\dev\tsudowa
npx.cmd --yes supabase@2.109.1 login
npx.cmd --yes supabase@2.109.1 link --project-ref jwgynxnkjjyoqiirqwus
npx.cmd --yes supabase@2.109.1 db push --dry-run
npx.cmd --yes supabase@2.109.1 db lint --linked --level warning
npx.cmd --yes supabase@2.109.1 db push
```

dry-runに`202608270001_chat_foundation.sql`だけが表示されることを確認してから適用した。適用後のdry-runは`Remote database is up to date`、linked DB lintはschema error 0件。`export-account`を再デプロイし、`delete-account`とともに`ACTIVE`、`verify_jwt=true`を確認した。

## 5. DB試験

`supabase/tests/202608270001_chat_security.test.sql`は次を確認する30 assertionで構成する。

- message reaction RLS
- messagesへの直接update禁止
- anonの全チャットRPC実行禁止
- authenticatedの検証RPCだけを許可
- reply外部キー
- deleted/pinned整合constraint
- アーカイブ後のreaction拒否trigger
- Realtime publication
- private Realtime read/write policy

さらに`supabase/tests/202608280001_chat_behavior.test.sql`で、rollback専用の主催者・参加者・部外者を作り、次の24 assertionを実行する。

- 主催者と参加者の送信・返信
- 部外者の送信・閲覧・reaction拒否
- 参加者のRLS読取とreaction toggle
- reaction allowlist
- 主催者限定pin、他者投稿の管理削除
- 投稿者限定編集
- 削除済み投稿への返信拒否
- アーカイブ後の送信・reaction・編集・pin拒否

Docker Desktop 4.88.1 / Linux Engine 29.7.2を導入し、2026-08-28に本番linked DBへ次を実行した。

```powershell
npx.cmd --yes supabase@2.109.1 test db --linked supabase/tests
```

結果は`Files=2, Tests=54, Result: PASS`。両ファイルとも`BEGIN`〜`ROLLBACK`で完結し、一時利用者・イベント・メッセージ・権限変更を本番へ残さない。実行前には`db lint --linked`とmigration dry-runを行った。

同じCLI 2.109.1で空の隔離ローカルDBを起動し、全migration適用、pgTAP 54/54、local schema lint 0件も確認した。`.github/workflows/ci.yml`へ秘密情報不要の`database-tests` jobを追加し、pull requestと`main` pushごとにこの手順を再実行する。`supabase/setup-cli`はv2.1.1のcommit SHAへ固定した。

Dockerなしで実行できる補完試験として`scripts/remote-security-smoke.mjs`を本番公開APIへ実行し、未認証者の全強化チャットRPCとリアクション読取が拒否されることを確認した。この試験は書込みに成功した場合を失敗とする。

## 6. 3アカウント実結合試験

DB/RPC/RLS層は上記24件で自動化済み。以下は端末UI、Storage署名URL、WebSocket Presence/Broadcast、ネットワーク切断時の表示を確認するための実機試験として残す。

必要役割:

- A: イベント主催者
- B: 共同主催者または一般参加者
- C: イベント未参加者

秘密情報をCodexへ共有しない。各利用者が自身の端末でログインし、次を確認する。

1. Aがイベントを作成しBを招待する。
2. Bが参加後、A/B間で本文、写真、返信、リアクションを相互送信する。
3. A/B両方がチャット表示中のときだけオンライン2人と入力中が表示される。
4. Bが退出または通信切断するとオンライン人数が減る。
5. AのメッセージにBの既読が反映される。
6. 投稿者は15分以内に編集でき、期限後はDBが拒否する。
7. 投稿者は24時間以内に送信取消でき、期限後はDBが拒否する。
8. A/cohostはpinと他者投稿削除ができ、memberはできない。
9. Cはevent、messages、reactions、Storage署名URL、private Realtimeへ接続できない。
10. アーカイブ後は返信、reaction、編集、取消、pinがすべて拒否される。
11. ブロック対象投稿は表示と未読から除外される。
12. 通報対象のevent/message/user整合性をDBが検証する。

## 7. 実機マトリクス

最低限、次の端末試験が残る。

- iPhone 15 / iOS 26.5.2 / 次build: spinner文字、開始・終了・タイムフロー時刻
- iPhone 15 Pro / iOS 26.6 / 次build: 同上
- Android実機 / production相当build: 時刻、写真、戻る、キーボード
- Web: reply、reaction、search、edit、unsend、pin、mention
- Wi-Fi、モバイル、低速、オフライン、復帰、セッション期限切れ
- 写真権限の許可、拒否、設定からの変更
- 文字サイズ最大、VoiceOver/TalkBack

## 8. リリース設定試験

ローカルの`release:check`で、公開情報と実装検査は合格した。ローカルファイルには秘密値と承認フラグを保存しないため3件のゲートが残るが、EASの読み取り専用確認ではproductionに次が存在した。

- `GOOGLE_MAPS_API_KEY`: preview/productionともSensitive、値は表示せず存在を確認済み。
- `RELEASE_BRAND_APPROVED=true`: productionで確認済み。
- `RELEASE_GLOBAL_COMPLIANCE_APPROVED=true`: productionで確認済み。

したがってEAS production環境のリリース設定ゲートは合格。これらをGitへcommitしてはならない。
