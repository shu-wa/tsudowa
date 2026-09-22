# TSUDOWA ストア申請情報（2026-07-31）

この文書は App Store Connect と Google Play Console へ転記するための申請原稿です。実際の申告では、申請時点の実装と各ストア画面の質問文を優先してください。

最終更新: 2026-09-11。以下の8月の同期記録は履歴であり、この原稿の最新版がストアへ反映済みという意味ではありません。現状と残作業は `RELEASE_READINESS_2026-09-11_JA.md` を参照してください。

実装/SDKとの照合根拠と未確定事項: `PRIVACY_DATA_INVENTORY_JA.md`。審査用アカウントと操作案内: `REVIEW_PREPARATION_JA.md`。公開前にプライバシーポリシー `2026-09-11.1` をアプリ・公開サイトへ反映する必要があります。

## App Store Connect同期記録（2026-08-01）

- `store.config.json` をEAS公式スキーマで検証し、App Store Connectへ同期済み。
- リリース方法は審査承認後の手動公開に設定。
- カテゴリはソーシャルネットワーキング、セカンダリはライフスタイル。
- 年齢質問では、年齢確認、メッセージ／チャット、ユーザー生成コンテンツを実装どおり申告。
- 審査用アカウントのIDとパスワードはリポジトリへ保存せず、App Store Connectへ直接入力する。

## 基本情報

- アプリ名: TSUDOWA
- Bundle ID / Package name: `com.shuwa.tsudowa`
- バージョン: 1.0.0
- 提供国: 日本のみ
- 既定言語: 日本語
- 運営者: 玉木 秀杷（タマキ シュウワ）
- サポートメール: `support@tsudowa.app`
- サポートURL: `https://tsudowa.app/support`
- プライバシーポリシーURL: `https://tsudowa.app/privacy`
- アカウント削除URL: `https://tsudowa.app/account-deletion`
- マーケティングURL: `https://tsudowa.app/`

## App Store用原稿

### サブタイトル（30文字以内）

イベントの予定・会話・集金をひとつに

### プロモーションテキスト

招待コードで気軽に集合。日時、場所、タイムフロー、参加者、チャット、立替・集金状況まで、イベントに必要な情報をひとつにまとめられます。

### 説明

TSUDOWAは、イベントごとに必要な連絡と情報をひとつにまとめるコミュニケーションアプリです。

LINEなどで毎回グループを作ったり、初対面の参加者を友だち登録したりする必要はありません。主催者が発行した招待コードを確認し、イベント名と日時を見てから参加できます。

主な機能

- 開始日時または開始・終了時間を設定したイベント作成
- 地図検索と現在地を利用した場所設定
- 複数日に対応したタイムフロー
- 参加者一覧、参加・未定・不参加の回答
- イベント参加者限定のチャット、写真共有、返信、リアクション、検索
- 参加費、食事代、交通費、宿泊費など複数の集金記録
- 主催者による集金項目と支払状態の管理
- 日程候補の作成と参加可否の投票
- 端末カレンダーへの予定追加と種類別の通知設定
- 同じメンバーで次回イベントを続けられるグループ
- 開催後のイベントを思い出として残すアーカイブ
- 通報、ブロック、データ書き出し、アカウント削除

TSUDOWAは実際の送金や決済を行いません。現金、PayPayなど、当事者間で行った支払いの状態だけを記録します。

### キーワード（100文字以内）

イベント,予定,スケジュール,グループ,チャット,集金,旅行,幹事,出欠,招待

### カテゴリ案

- プライマリ: ソーシャルネットワーキング
- セカンダリ: ライフスタイル
- 年齢設定: アプリの利用条件は16歳以上。ストアの年齢質問へ実装どおり回答し、地域別の最終表示を確認する。Apple原稿では16+への上書きを設定済みだが、Googleの対象年齢・コンテンツレーティングとは別の設定。

## Google Play用原稿

### 簡単な説明（80文字以内）

イベントの日時・場所・予定・参加者・チャット・集金状況をひとつにまとめるアプリ

### 詳しい説明

TSUDOWAは、イベント単位で必要な情報とコミュニケーションをまとめるアプリです。

招待コードを入力すると、参加前にイベント名と日時を確認できます。参加後は、場所、参加者、タイムフロー、チャット、写真、集金状況をイベント内で共有できます。

主催者は参加費、食事代、交通費、宿泊費などを複数登録でき、主催者だけが集金項目と参加者ごとの支払状態を変更できます。TSUDOWA自体は送金や決済を行いません。

チャットの返信・リアクション・検索、日程候補への投票、端末カレンダーへの予定追加、種類別の通知設定、イベント終了後のアーカイブにも対応しています。グループを作成すると、同じメンバーで次回のイベントを計画し、過去のイベントも振り返れます。安全機能として、通報、ブロック、データ書き出し、アプリ内アカウント削除を備えています。

## Apple App Privacy回答案

すべて「トラッキングには使用しない」。広告、第三者広告、行動ターゲティング、データ販売はありません。

| データ種別 | ユーザーに関連付け | 主な目的 | 備考 |
| --- | --- | --- | --- |
| Email Address | はい | App Functionality | ログイン、本人確認、パスワード再設定 |
| Name | はい | App Functionality | 表示名、表示ID |
| User ID | はい | App Functionality | Supabase Authのアカウント識別子 |
| Device ID | はい | App Functionality | 通知送信先を管理するインストール識別子・プッシュ通知トークン。広告追跡の有無とは別に収集を申告 |
| Precise Location | はい（保存した場合） | App Functionality | 現在地・地図検索からイベント場所を設定した場合 |
| Coarse Location | はい（収集する場合） | App Functionality | 市区町村、SDK等による概算位置は下記の確認事項を参照 |
| Photos or Videos | はい | App Functionality | プロフィール、イベントカバー、チャットへの任意投稿 |
| Emails or Text Messages | はい | App Functionality | イベント参加者間のアプリ内チャット |
| Other User Content | はい | App Functionality | イベント、グループ、予定、出欠、日程投票、通報内容 |
| Other Financial Info | はい | App Functionality | 費用・立替・支払状態のみ。カード・銀行・決済情報は取得しない |
| Other Data Types | はい | App Functionality | 生年月日、規約等への同意履歴、ブロック・モデレーション情報 |

上表は申告候補であり、SDKを含む最終監査済み回答ではありません。広告追跡をしないこととDevice IDを収集しないことは別です。Maps等のSDKによる診断・利用情報も含めて最終回答してください。

位置情報は、利用者自身の位置と任意のイベント会場を区別します。イベントの座標があるだけで常に利用者の現在地を収集しているとは判定しません。位置権限拒否時・現在地を保存しない場合の端末外送信、SDKの収集、ログの保持状況を確認し、Precise/Coarse Locationの収集・関連付け・目的を確定してください。

## Google Play Data safety回答案

- アプリはユーザーデータを収集する: はい
- データは転送中に暗号化される: はい
- ユーザーはデータ削除をリクエストできる: はい
- 削除手段: アプリ内「マイページ → プライバシーセンター」と公開削除ページ
- 第三者への広告目的の共有: いいえ
- データ販売: いいえ
- 任意データ: 市区町村、プロフィール写真、イベント画像、チャット写真、現在地利用
- 必須データ: メールアドレス、表示名、表示ID、生年月日、規約等への同意
- 収集目的: アプリ機能、アカウント管理、不正防止、セキュリティ、法令対応

申告対象候補:

- Personal info: Name、Email address、User IDs、Address（イベント場所として入力された場合）、Other info（生年月日・同意履歴）
- Financial info: Other financial info（費用・立替・支払状態。決済情報ではない）
- Location: Approximate location、Precise location
- Photos and videos: Photos
- Messages: Other in-app messages
- App activity: Other user-generated content / Other actions（日程投票、出欠回答）
- Device or other IDs: 通知用インストール識別子、プッシュ通知トークン、Firebase Installation ID等（SDKを含めて確認）
- App info and performance: Crash logs / Diagnostics（Android Maps SDKの診断情報を確認）
- App activity: App interactions（Android Maps SDKの機能に応じた地図操作情報を確認）

Android MapsのSDK情報は、アプリ機能だけでなく提供者による品質改善・分析目的も照合すること。Google MapsのAndroid向け項目を、そのSDKを使っていないiOSへそのまま転記しない。最新版SDKの開示資料と実配布ビルドの依存バージョンは別に確認する。

通知をアプリ内で任意にしていても、Firebase SDKの初期化時に識別子が自動収集される可能性があります。したがってDevice or other IDsを一律に「任意」と決めず、配布ビルドの自動初期化設定・実際の送信とFirebase公式開示資料を照合して必須／任意を確定してください。取得目的は通知配信などのアプリ機能であり、広告追跡とは区別します。

Supabase等、アプリ提供のためにデータを処理するサービス事業者の扱いは、Play Console上の「共有」の定義と例外説明を読んだうえで最終回答すること。

## 審査担当者向けメモ案

TSUDOWAはログインが必要なイベントコミュニケーションアプリです。審査用アカウントと、主催者・参加者が登録されたサンプルイベントを用意してください。

確認導線:

1. 審査用メールアドレスとパスワードでログイン
2. ホーム画面からサンプルイベントを開く
3. 日時、場所、参加者、概要、タイムフロー、集金、チャットを確認
4. マイページからプロフィール編集、プライバシーセンター、アカウント削除を確認
5. サンプルグループで過去・今後のイベントとイベント追加を確認
6. 通知設定を確認。通知を拒否しても基本機能を利用できることを確認

補足:

- 実際の送金・決済機能はありません。
- 位置情報はイベント場所を現在地から探す操作を選んだ場合だけ使用します。
- 写真ライブラリは利用者がプロフィール、イベント、チャットへ写真を設定する場合だけ使用します。
- カレンダーは利用者がイベントを端末カレンダーへ追加する場合だけ使用します。
- イベントとチャットは招待された参加者だけが閲覧できます。投稿前の禁止表現フィルター、利用者・メッセージ・イベント内容の通報、利用者ブロック、モデレーターによる非表示・削除とアカウント停止を実装しています。
- 安全上の通報は重大性に応じて確認し、重大な脅迫、児童の性的搾取、個人情報の無断公開などへ優先的に対応します。公開連絡先は support@tsudowa.app です。

## 提出前に人の操作が必要な項目

- AppleとGoogle用の専用審査アカウントを作成する。個人アカウントのパスワードは共有しない。
- 審査用メールアドレスは名称だけではログインできない。アプリのAuthに実際に登録し、メール確認・プロフィール登録を完了する。審査時に運営者によるメール転送や追加承認が不要な状態で、ログアウトからのログインを確認する。認証情報は各ストアの非公開審査欄へ入力し、公開説明やGitへ記載しない。
- 審査アカウントで確認できるサンプルイベントを作成する。
- App Store Connectでアプリレコード、税務・契約、App Privacy、年齢区分、輸出コンプライアンスを入力する。
- Google Play Consoleでアプリレコード、Data safety、App access、コンテンツレーティング、広告、対象年齢、削除URLを入力する。
- 2023年11月13日以降に作成した個人Google Play開発者アカウントでは、12人以上のテスターが14日間連続で参加する閉鎖テストを完了し、製品版へのアクセスを申請する。
- スクリーンショットは実際の1.0.0ビルドから取得し、実在する個人情報・招待コード・メールアドレスを写さない。

## 公式資料

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple App Privacy管理: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Playアカウント削除要件: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Playテスト設定: https://support.google.com/googleplay/android-developer/answer/9845334
- Google Play個人アカウントのテスト要件: https://support.google.com/googleplay/android-developer/answer/14151465
- Firebase SDKのデータ開示: https://firebase.google.com/docs/android/play-data-disclosure
- Google Maps Android SDKのデータ開示: https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure
