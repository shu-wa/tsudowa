# 配布・検証記録（2026-09-25）

## 確認できた結果

- アプリソース `72c32ad` をmainへpush済み。場所保存を非同期で確認してから画面状態へ反映し、失敗時の入力保持、二重保存防止、古い住所検索結果の破棄を追加した。
- 型チェック、Lint、15本のアプリ回帰スクリプト、Webエクスポートが成功。
- DB試験5ファイル92項目がローカルとCIで成功。DBスキーマ検査はエラーなし。
- CI: https://github.com/shu-wa/tsudowa/actions/runs/36098139768
- CodeQL: https://github.com/shu-wa/tsudowa/actions/runs/36098139741
- EAS本番環境のrelease-checkと本番の匿名RPC/RLSスモーク検査に合格。利用者レコードを変更する試験ではない。
- 本番DBの最新dry-runはログイン用ロール初期化で停滞し中断。今回新規マイグレーションはないが、本番のマイグレーション一覧を新たに確認できたとは扱わない。日時更新権限のマイグレーションは9/22に本番適用を確認済み。

## ビルドと配布

| 対象 | 状態 |
|---|---|
| iOS 1.0.0 (16) | ビルド完了、Apple取込VALID、内部・外部TestFlightテスト中、外部テスト審査APPROVED |
| Android 1.0.0 (13) | ビルド完了、AAB保管済み。Google Play初回アップロードは未実施 |
| 正式App Store版 | 選択ビルド16、PREPARE_FOR_SUBMISSION、手動公開。正式審査未提出 |

- iOS: https://expo.dev/accounts/misosi/projects/tsudowa/builds/936327ef-fe70-4f2e-8081-8dea9faabcc6
- Apple送信: https://expo.dev/accounts/misosi/projects/tsudowa/submissions/a6e15bc9-5683-4fc3-9c50-888c2a4e0a4f
- Android: https://expo.dev/accounts/misosi/projects/tsudowa/builds/5ebc485a-6677-4564-b460-3ebe74cc4fe1
- 両方のアプリソースは `72c32ad`。後続のPages配信補助・文書・CI変更のためのネイティブ再ビルドは不要。
- 外部グループ `TSUDOWA external` に16を追加し、自動通知と日本語テスト説明を設定。公開招待リンクは有効化していない。
- AABファイル名: `TSUDOWA-1.0.0-android-build-13.aab`
- AAB SHA-256: `6C93E93A2948016BFD758B3DAE45E3151E0E4512606DCF0ED175F2F8070B4A92`

## 公開サイト

- Cloudflareへの本人による再認証後、既存Pagesプロジェクトを更新した。
- 配信: https://tsudowa.app / デプロイ: https://564f0f82.tsudowa.pages.dev
- Expoの出力にはフォントがnode_modules配下にあり、そのままではPagesアップロード対象から除外された。`scripts/prepare-pages.mjs` で出力を別フォルダへ複製し、アセットのURLを平坦化。元のエクスポートやアセット内容は保持する。
- 42ファイル・38アセットを配信。公開ドメインから全42ファイルを取得し、ローカル配信物とのSHA-256一致を確認。フォントのContent-Typeもfont/ttfであることを確認した。単なるHTTP 200によるSPAフォールバックの誤判定を避けている。
- 配信JSはプライバシー版2026-09-11.1とFirebase説明を含む。ブラウザの描画確認・実機試験を代替しない。
- `node scripts/pages-regression-check.mjs` をCIへ追加。URL置換、バイナリ保持、元出力保持、上書き・入れ子出力の拒否を確認する。
- 次回の配信ではExpo export後、`node scripts/prepare-pages.mjs <export-directory> <new-pages-directory>` を実行し、生成先をPagesへデプロイする。生成先は毎回新しいディレクトリを使う。

## Docker障害と復旧の限界

- Docker Desktop 4.88.1 / Engine 29.7.2。Windowsのランタイムソケットにエラー1920が発生し、起動に失敗した。
- 該当はローカルAppDataの `Docker/run/sailor-ingest.sock` と `docker-secrets-engine/engine.sock`。停止を確認した関連プロセスと、ソケットだけが入っていることを確認したランタイム親ディレクトリに限定して対処した。
- 親ディレクトリを退避して新しい空ディレクトリを作り、Desktopを起動して復旧した。Dockerデータ、WSLディストリビューション、DBボリュームは削除していない。退避物は残してある。
- DB開始時はローカルの古いバックアップに日時権限マイグレーションがなく一度失敗した。未適用分をローカルへ適用して再試験し、92項目合格を確認した。
- 試験後はSupabaseを停止しバックアップを保持。Dockerの通常再起動でソケット障害が再発したため、同じ限定的対処で再復旧。現在はEngine応答を確認できているが、恒久解決とは言わない。
- 再発時はまず `docker version`、`docker desktop status` とログを確認する。動作中のDockerに対してランタイムディレクトリを操作しない。未知の内容がある場合は退避も実行せず確認する。`wsl --unregister`、ボリューム削除、Factory resetはこの復旧方法に含めない。
- 次の起動でも失敗する場合はログとバージョンを添えてDocker側の修正状況を確認する。関連報告: https://github.com/docker/for-win/issues/15064

## 画像と残る公開条件

- 原本5枚を受領し、4枚を日本語の6.3インチ枠へ登録。処理完了を確認。
- 必須大型枠は未登録。本人から「画像加工はせず保留する」と指示があり、加工・大型枠の画像追加・正式審査提出は保留する。
- Google Playは初回AABアップロードとAndroid端末での本人確認が未完了との本人回答。クローズドテストは開始していない。
- 新ビルドで日時保存→再読込・再ログイン、説明・場所編集、通知、地図、写真、権限の実機受け入れ確認が必要。
- バックアップ復元、モデレーション運用、本番SMTP等の未確認事項は `RELEASE_OPERATIONS_JA.md` に従って残す。自動試験合格だけで運用・全端末試験完了とはしない。
- Appleの審査資格情報・署名キー・トークンは本資料やGitへ記録しない。

一般公開は行っていない。Apple正式審査承認とTestFlight承認を混同しない。
