# リリース監査（2026-07-26）

この文書は、Do Eventerの実装と公開準備をApple、Google、日本の公式情報に照らして整理したものです。法的助言や商標登録可能性の保証ではありません。最終的な名称・規約・事業者表示は、必要に応じて弁護士・弁理士へ確認してください。

## 結論

アプリの主要機能、認証、同意、UGC通報・ブロック、アカウント削除、データ書き出し、公開用の規約ページ、独自アイコン、端末標準の日付・時刻選択は実装済みです。

ただし、次の項目は運営者本人の情報・外部アカウント・実機が必要なため、完了するまでストアへ提出しません。

1. 「Do Eventer」の名称を継続するか決定し、J-PlatPatの詳細検索と必要な専門家確認を完了する
2. 公開専用の運営者正式名称、サポートメール、Webドメインを `.env` に設定する
3. `/privacy`、`/terms`、`/community-guidelines`、`/account-deletion`、`/support` をHTTPSで公開する
4. EASプロジェクトを `eas init` でリンクし、`extra.eas.projectId` を設定する
5. AndroidのGoogle Maps APIキーを、パッケージ名とリリース署名SHA-1で制限して設定する
6. TestFlightとGoogle Play内部テストで、実機の権限、地図、削除、招待、通報を確認する
7. App Store ConnectとPlay Consoleの申告、スクリーンショット、審査用アカウントを登録する

`pnpm release:check` は、上記の設定不足をリリース阻害項目として検出します。

## Appleの設計・審査要件との対応

- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Privacy: https://developer.apple.com/design/human-interface-guidelines/privacy/
- Modality: https://developer.apple.com/design/human-interface-guidelines/modality
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Age Rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/

対応内容:

- 日付はカレンダー、時刻は端末標準の選択UIを利用
- カメラ、位置情報、カレンダー、通知は必要な場面でのみ許可を要求
- 位置情報を拒否しても施設名・住所を手入力可能
- モーダルには戻る操作または明確な完了操作を用意
- 小さすぎた本文・補助テキストを引き上げ、React Native標準の文字サイズ拡大を許容
- アプリのロゴにはSF SymbolsやIoniconsを使用せず、独自画像を使用
- UGCについて利用規約、通報、ブロック、モデレーション方針を用意
- アプリ内からアカウントを削除可能
- 審査用アカウントと、招待・チャット・通報を確認する審査メモが必要

初回リリースはスマートフォン向けとし、iPad対応は無効にしています。iPadへ対応する場合は、分割表示、横幅、キーボード、全画面モーダルを別途検証します。

## Google Play要件との対応

- User Generated Content: https://support.google.com/googleplay/android-developer/answer/9876937
- UGC moderation: https://support.google.com/googleplay/android-developer/answer/12923286
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Child Safety Standards: https://support.google.com/googleplay/android-developer/answer/14747720
- Families policy: https://support.google.com/googleplay/android-developer/answer/9893335
- Android accessibility: https://developer.android.com/guide/topics/ui/accessibility/principles

対応内容:

- 利用者とメッセージの通報、利用者のブロックを別の操作として提供
- ブロック状態をSupabaseへ同期
- 児童の性的搾取、グルーミング、CSAMを公開ガイドラインで明確に禁止
- 児童保護を含む連絡先をサポートページへ表示
- アプリ内削除に加え、公開Webの `/account-deletion` から削除を依頼可能
- 広告SDK、行動分析SDK、実決済SDKは未使用
- 通信はHTTPS、アカウント削除とデータ書き出しを提供

Play Consoleでは主目的に合う「イベント」カテゴリを検討します。チャット機能を隠さず、コンテンツレーティングでは利用者間の交流とUGCを正確に申告します。対象年齢は16歳以上とし、子どもをターゲットにしません。

## 知的財産権の一次監査

### サービス名

「Eventer」という名称で、同じイベント領域の既存アプリ・事業者が複数確認されました。特に「Eventer - Unforgettable Events」は、招待、イベント参加、イベントチャットなど本サービスに近い機能を提供しています。そのため「Do Eventer」は、完全一致が見つからないだけでは安全と判断できず、主要語「Eventer」の類似性による商標・ストア審査・ブランド混同のリスクがあります。

公開前に、J-PlatPatで文字、称呼、類似群コードを使い、少なくとも第9類（アプリ）、第38類（通信・チャット）、第41類（イベント）、第42類（SaaS）と、提供方法に応じて第35類を確認します。

- J-PlatPat: https://www.j-platpat.inpit.go.jp/s0100
- 特許庁の商標検索案内: https://www.jpo.go.jp/support/startup/shohyo_search.html
- 類似群コード: https://www.jpo.go.jp/system/trademark/gaiyo/bunrui/ruijigun_cord_reidai.html

名称の採用判断が終わるまで `RELEASE_BRAND_APPROVED=true` にしません。改名する場合も、候補名ごとに同じ検索を行います。

### アイコンと画面内素材

- Expoテンプレートの既定アイコン参照を廃止し、独自のアプリアイコンへ差し替え
- Apple Design Resourcesはアプリ素材へ転用していない
- SF Symbolsはアプリアイコン、ロゴ、商標に使用していない
- 画面内のIoniconsはMIT Licenseに従ってUIアイコンとして使用し、第三者ソフトウェア画面へ表示
- 地図はApple MapsまたはGoogle Mapsの表示・権利表記を維持

### ソースコードと依存ライセンス

`pnpm licenses list --prod` の監査では、MIT、ISC、BSD、Apache-2.0、MPL-2.0、CC-BY-4.0などを確認し、不明ライセンスは検出されませんでした。アプリ独自コードは `LICENSE` でAll rights reservedとし、第三者部分は各ライセンスに従います。依存関係を追加・更新した場合は再監査します。

## ストアのプライバシー申告案

実際のビルド、SDK、運用が変わった場合は必ず更新します。

### Apple App Privacy

収集あり、利用者に関連付け、トラッキングなし:

- Contact Info: Email Address
- Identifiers: User ID
- User Content: Emails or Text Messages、Other User Content
- Precise Location: 現在地をイベント場所として保存した場合
- Other Data: 表示名、表示ID、生年月日、地域、参加状況、同意履歴
- Financial Info / Other Financial Info: 集金額、立替者、支払状態。カード・銀行・決済情報は収集しない

利用目的はApp Functionality、Fraud Prevention / Security、必要に応じてCustomer Supportです。広告、第三者広告、トラッキングには使用しません。

### Google Play Data safety

収集するデータ:

- Personal info: Name、Email address、User IDs、Date of birth
- Location: Precise location（利用者が現在地を場所として選んだ場合）
- Messages: In-app messages
- Financial info: 共有費用と支払状態。決済認証情報は収集しない
- App activity / Other user-generated content: イベント、参加、予定、通報、ブロック

主な目的はApp functionality、Account management、Fraud prevention / Security、Developer communicationsです。サービス提供者による委託処理を除き販売・広告共有は行いません。転送時暗号化あり、削除請求あり、と申告します。

## モデレーション運用

コード上の通報機能だけでは不十分です。運営では次を継続します。

1. 通報キューを毎日確認する
2. 生命・身体・児童の安全に関する通報を最優先で確認する
3. 違反メッセージを `moderation_state` で非表示または削除する
4. 反復・重大な違反アカウントを停止する
5. 証拠と対応理由を必要な期間だけ記録する
6. 法令上必要な場合は警察その他の関係機関へ連絡する
7. 誤判定の問い合わせをサポートメールで受け付ける

運営者がこの対応を継続できない段階では、一般公開せず内部テストに限定します。

## 提出前テスト

- iPhoneの最小対応OSと最新OS
- Android 7相当、主要な現行Android、最新Android
- 小画面、標準画面、文字サイズ最大付近
- 新規登録、メール確認、ログイン、パスワード再設定
- 16歳未満の登録拒否と16歳境界日
- イベント作成、複数日、開始時刻のみ、時間帯
- 位置権限の許可・拒否、住所手入力、Androidリリース版の地図
- 招待コードの確認画面、承認制参加、期限切れ、使用上限
- チャット未読、通報、ブロック、別端末でのブロック同期
- 複数集金、初期未払い、支払状態、期日なし
- データ書き出し、一般参加者の削除、主催者の削除
- オフライン、タイムアウト、セッション切れ、サーバーエラー
- VoiceOver、TalkBack、外付けキーボードの主要導線

## 審査メモのひな型

App Review / Google Play review notes:

```text
Do Eventer is an event-scoped coordination app. It does not process payments.
The collection feature only records whether a participant has paid outside the app.

Review account:
Email: <REVIEW_ACCOUNT_EMAIL>
Password: <REVIEW_ACCOUNT_PASSWORD>

Review event:
Invite code: <ACTIVE_REVIEW_INVITE_CODE>

Suggested flow:
1. Sign in with the review account.
2. Open the review event.
3. Check event date, location, participants, timeline and collection status.
4. Open group chat. Use the menu beside another user's message to access separate Report and Block controls.
5. Open My Page > Privacy Center to test data export and account deletion.

Location, camera, calendar and notification permissions are requested only when the corresponding feature is used.
If location access is denied, venue and address can still be entered manually.
```

