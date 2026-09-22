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
- ローカルrelease-checkの名称/法務運用承認フラグは未設定。完了を装うために自動設定しない。MapsキーはEAS側の設定と区別する。
- バックアップ復元・モデレーション運用・本番SMTP等は既存チェックリストの未確認事項を維持。

ビルド・送信・CIの最終結果は作業完了時に追記する。一般公開を自動実行しない。
