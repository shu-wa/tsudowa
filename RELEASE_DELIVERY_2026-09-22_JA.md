# 配布作業記録（2026-09-22）

## 対象

- イベント日時の保存・失敗処理、作成後の説明編集、管理者権限、回帰テスト。
- 前回準備済みのFirebase File環境変数対応、プライバシー説明、申請・運用資料。
- 今回検出した依存ライブラリの脆弱性修正。

## セキュリティ更新

- browserslist 4.28.7、baseline-browser-mapping 2.11.0。
- @xmldom/xmldom は0.8系を0.8.15、0.9系を0.9.12へ更新し系列を維持。
- js-yamlは3系を3.15.2、4系を4.3.2へ更新。
- decode-uri-componentは公開修正版0.5.0がESM-onlyでquery-string 7のCommonJSとそのまま互換でないため、0.2.2へ上流の有界UTF-8走査方式を移植。再帰分割を除去し、旧APIのプラス記号処理を維持。`check:uri` でURL、Unicode、不正な長文入力、タイムアウトを検査。
- URIの監査除外は修正パッチを適用する特定GHSAのみ。既存のimage-sizeに関する2件の例外は維持しており「すべての脆弱性がゼロ」とは評価しない。

参照: https://github.com/browserslist/browserslist/releases/tag/4.28.7 、https://github.com/xmldom/xmldom/releases/tag/0.8.15 、https://github.com/xmldom/xmldom/releases/tag/0.9.12 、https://github.com/SamVerschueren/decode-uri-component/tree/v0.5.0

## 作業開始時の外部状態

- DB日時更新権限の修正は適用済み。
- App Store製品版1.0.0: 提出準備中、手動公開、選択ビルド3、スクリーンショット0枚。非公開審査情報は設定済み。
- TestFlight build14: VALID、内部・外部テスト中、外部テスト審査APPROVED。正式App Store審査とは別。
- EASの旧iOS build14はERRORED表記だが、Apple側への取込・TestFlight状態は上記のとおり確認。EAS表記だけを根拠に重複送信しない。
- Android旧ビルド11は今回のFirebase設定修正を含まない。

## 公開までに必要な実確認

- 新ビルドでの日時保存→再読込・再ログイン、説明編集、通知・地図等の実機検証。
- スクリーンショット原本とApple必須サイズ枠の画像。
- Android端末準備、Play Console初回アップロード・署名設定・テスト条件。
- ローカルrelease-checkの名称/法務運用承認フラグとMapsキーは未設定だったが、EAS本番環境では既存設定を使ったrelease-checkが合格。今回承認フラグを書き換えてはいない。これは設定検査の結果であり、新たな法務監査を実施した意味ではない。
- バックアップ復元・モデレーション運用・本番SMTP等は既存チェックリストの未確認事項を維持。

## 検証・Git反映

- アプリのコミット `caf90f2`、DBテスト準備修正 `40be05d` をmainへpush。
- ローカルの型チェック・Lint・15本の回帰テスト・Webバンドル生成が成功。
- 固定pnpm 10.34.5のfrozen installが成功。監査は未除外の報告0件（既存image-size 2件、修正済みURI 1件の限定例外あり）。
- EAS本番環境変数で `release-check` 合格。
- CI（コード検査・DBテスト）とCodeQLが合格。DBは5ファイル86項目成功、スキーマエラーなし。
- CI: https://github.com/shu-wa/tsudowa/actions/runs/35696581686
- CodeQL: https://github.com/shu-wa/tsudowa/actions/runs/35696581674

## 配布の対象

- iOS 1.0.0 (15): https://expo.dev/accounts/misosi/projects/tsudowa/builds/3cbfa957-8d92-4666-a46b-2429a9eb2130
- Android 1.0.0 (12): https://expo.dev/accounts/misosi/projects/tsudowa/builds/1d3adc80-4fc8-401e-861a-e9c6863b8d3b
- 両ビルドのアプリソースは `caf90f2`。後続の `40be05d` はDBテストのみでアプリコードに変更なし。
- iOS送信は `FINISHED`: https://expo.dev/accounts/misosi/projects/tsudowa/submissions/fc039fd8-5e63-40c0-8d85-d9170a86be6b
- 説明文同時送信はプラン非対応で受付前に失敗したため、同時送信オプションを外して上記の1件を送信。プランは変更していない。
- Google Play初回提出は手動アップロードが必要という既存EASエラーを確認。Android端末・Console準備が未確認のためクローズドテストを開始しない。

## 公開サイト

- tsudowa.appの配信JSに最新プライバシー版・SDK説明が含まれていないことを確認。
- Cloudflare CLI認証が利用できず、再ログインが必要。公開サイトは今回未更新。新しいアプリの説明と一致するサイト更新が残る。
- ブラウザサイドパネルは使用していない。本人が外部ブラウザで認証後、既存Pagesプロジェクトと対象ドメインを確認して更新する。

## 配布準備の最終結果

- iOS 1.0.0 (15) はAppleでVALID。
- `TSUDOWA external` グループに追加し、自動通知を有効化。テスト説明文を日本語で保存し、外部テスト審査は `WAITING_FOR_REVIEW`。承認済み・外部配信済みとはまだ扱わない。
- 正式App Store提出画面の選択ビルドを3から15へ更新。手動公開を維持し、正式審査には提出していない。
- 同一アプリの非公開本審査欄に既に保存されている審査アカウント・連絡先をTestFlightの非公開審査欄にも反映。資格情報はGit・ログ・この資料へ記載していない。
- Android 1.0.0 (12) はEASでFINISHED。AABをローカルの `outputs/delivery-20260922/TSUDOWA-1.0.0-android-build-12.aab` に保存。
- AAB SHA-256: `9C5D79A4662D715C007DC419318213B761FD09A257C9C6FED3B7754B49A2B0DA`。
- AAB内にFirebase app ID / sender IDリソースが含まれることを確認。ただし通知到達・地図表示・16KBページ等の実機適合確認を代替しない。

## 本人の操作／外部条件で残ること

1. TestFlightビルド15の実機確認。外部テスターはAppleの外部テスト審査承認後に更新。
2. 縮小されていないスクリーンショット原本と、Apple必須サイズの画像を用意。
3. 公開サイト更新のためCloudflareへ再ログイン。コマンド例: `npx.cmd --yes wrangler@4.117.0 login`。パスワード・APIトークンをチャットへ送らない。
4. Android端末・Play Console準備後、新しいAABの初回手動アップロードと実機試験。クローズドテストは未開始。
5. 画像・サイト・実機確認と残る運用項目が揃ってから、正式App Store審査／Google Play公開準備の最終判定をする。

一般公開は行っていない。全端末試験やすべての運用確認が完了したとは主張しない。
