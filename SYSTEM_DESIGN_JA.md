# TSUDOWA 統合システム設計書

文書版: 1.3
基準日: 2026-08-28
対象アプリ版: 1.0.0
対象ソース: 2026-08-28のリリース候補（継続グループ・強化チャット・通知基盤を含む）
正式名称: TSUDOWA（ツドワ）
提供予定地域: 日本
運営者: 玉木 秀杷（タマキ シュウワ）
サポート: `support@tsudowa.app`
Bundle ID / Android package: `com.shuwa.tsudowa`

## 1. この文書の目的と正本

この文書は、TSUDOWAの製品要件、画面、データ、権限、バックエンド、セキュリティ、ビルド、運用を一つにまとめた実装仕様である。第三者がこの文書と記載した依存バージョンを使い、同等のアプリを再構築できる粒度を目標とする。

仕様が矛盾した場合の優先順位は次のとおりとする。

1. 適用済みの最新Supabaseマイグレーション
2. `context/`、`lib/`、`app/` の現行コード
3. 本設計書
4. README、過去の監査・リリース文書

過去の文書には、現在の実装と異なる「終了24時間後の自動アーカイブ」「共同主催者による集金編集」などの記述が残る場合がある。現行仕様は、終了後の手動アーカイブ、集金管理は主催者限定である。

`202608270001_chat_foundation.sql`は2026-08-27にdry-runとlinked DB lintを通過後、本番Supabaseへ適用済みである。適用後のdry-runは「Remote database is up to date」、schema lintは0件、`export-account` Edge Functionはversion 6 / ACTIVE / JWT検証有効であることを確認した。

## 2. 製品定義

### 2.1 解決する課題

イベントのたびにSNSでグループを作成し、初対面の相手を友だち登録し、日時・場所・当日の流れ・参加者・集金状況を複数の投稿へ分散して伝える手間をなくす。

### 2.2 提供価値

- 招待コードだけでイベント単位につながる。
- 参加前にイベント名と日時だけを確認できる。
- 日時、場所、参加者、タイムフロー、チャット、写真、集金状況を一画面系統に集約する。
- イベント終了後は、変更不能な思い出として手動でアーカイブできる。
- 現金、PayPay、銀行振込など外部で行った支払いの状態だけを記録する。

### 2.3 明示的な非機能・非対象

- アプリ内送金、決済、金銭保管、返金、精算仲介は行わない。
- 連絡先一覧を取得しない。
- 広告SDK、行動ターゲティング、任意分析SDKは使用しない。
- 16歳未満を対象としない。
- 初回リリースは日本語、日本、JPY、`Asia/Tokyo`を基本とする。
- iPadを正式対応対象にしない。
- Web版は開発・補助確認用であり、主製品はiOS／Androidアプリとする。

## 3. 利用者と権限ロール

### 3.1 アカウント状態

| 状態 | 条件 | 利用可能範囲 |
|---|---|---|
| 未認証 | Supabaseセッションなし | 認証、規約、サポート、削除案内のみ |
| 認証済み・登録未完了 | セッションあり、必須プロフィールまたは3文書同意なし | オンボーディングのみ |
| 登録完了 | 表示名、生年月日、規約・プライバシー・ガイドライン同意あり | 通常機能 |
| モデレーター | JWT `app_metadata.role` が `moderator` または `admin` | 通報確認、メッセージ非表示・削除 |

### 3.2 イベントロール

| ロール | DB値 | 説明 |
|---|---|---|
| 主催者 | `host` | イベント所有者。イベント削除、共同主催者設定、集金管理を含む全管理権限 |
| 共同主催者 | `cohost` | イベント情報、写真、タイムフロー、候補日、招待、参加・脱退申請、アーカイブを管理 |
| 参加者 | `member` | 閲覧、チャット、写真投稿、出欠回答、候補日投票、脱退申請、通報・ブロック |

### 3.3 最終権限表

| 操作 | 主催者 | 共同主催者 | 参加者 | 未参加者 |
|---|:---:|:---:|:---:|:---:|
| イベント内容閲覧 | ○ | ○ | ○ | × |
| 招待前プレビュー（名称・日時のみ） | ○ | ○ | ○ | 有効コードがあれば○ |
| 日時・場所・基本情報変更 | ○ | ○ | × | × |
| イベント写真変更 | ○ | ○ | × | × |
| 招待コード発行 | ○ | ○ | × | × |
| タイムフロー追加・編集・削除 | ○ | ○ | × | × |
| 候補日追加・正式日程確定 | ○ | ○ | × | × |
| 候補日投票 | ○ | ○ | ○ | × |
| 自分の出欠変更 | ○ | ○ | ○ | × |
| 参加・脱退申請の審査 | ○ | ○ | × | × |
| 共同主催者の任命・解除 | ○ | × | × | × |
| 集金追加・編集・削除 | ○ | × | × | × |
| 支払済み状態の変更 | ○ | × | × | × |
| チャット送信・写真送信 | ○ | ○ | ○ | × |
| イベントをアーカイブ | ○ | ○ | × | × |
| イベントを完全削除 | ○ | × | × | × |
| 脱退申請 | 不可 | ○ | ○ | × |
| 通報・ブロック | 自分以外○ | 自分以外○ | 自分以外○ | × |

アーカイブ後は全ロールで閲覧専用となる。サービスロールによる運用処理を除き、イベント本体、参加者、予定、集金、支払状態、メッセージ、招待、候補日、投票、脱退申請、イベント画像を変更できない。

## 4. 技術構成

### 4.1 クライアント

| 項目 | 採用技術・バージョン |
|---|---|
| フレームワーク | Expo SDK `~54.0.35` |
| UIランタイム | React Native `0.81.5`、React `19.1.0` |
| 言語 | TypeScript `~5.9.2` |
| ルーティング | Expo Router `~6.0.24` |
| ナビゲーション | React Navigation 7 |
| 日付・時刻 | `@react-native-community/datetimepicker` `8.4.4` |
| 地図 | `react-native-maps` `1.20.1`、WebはOpenStreetMap iframe |
| 画像 | Expo Image Picker、Expo Image |
| 通知 | Expo Notifications（端末内通知） |
| カメラ | Expo Camera（QRコード） |
| 位置情報 | Expo Location |
| 端末カレンダー | Expo Calendar |
| ローカル保存 | Expo SecureStore、AsyncStorage |
| パッケージ管理 | pnpm `10.34.5`（`package.json`を正とする） |

### 4.2 バックエンド

| 項目 | 採用技術 |
|---|---|
| 認証 | Supabase Auth、メール＋パスワード、PKCE |
| API | Supabase Data API、PostgreSQL RPC |
| DB | Supabase PostgreSQL、RLS必須 |
| リアルタイム | Supabase Realtime |
| ファイル | Supabase Storageの非公開バケット |
| サーバー処理 | Supabase Edge Functions / Deno |
| 公開Web | `https://tsudowa.app` |

### 4.3 配布

- Expo owner: `misosi`
- EAS project ID: `f04675d6-63b1-4df9-838f-fdc0e08a2084`
- App Store Connect app ID: `6796740157`
- バージョン: `1.0.0`
- 本番ビルド番号はEAS remote sourceで管理し、productionで自動増分する。
- App Store公開は手動公開とする。

## 5. 論理アーキテクチャ

```text
iOS / Android / Web
  ├─ Expo Router画面
  ├─ AuthContext: セッション、認証、コールバック
  ├─ EventContext: 画面用集約状態、楽観更新、同期
  ├─ Platform components
  │    ├─ native: UIDatePicker / Android DatePicker・Clock / Native Maps
  │    └─ web: input[type=date/time] / OpenStreetMap
  └─ Supabase client（publishable keyのみ）
       ├─ Auth
       ├─ PostgreSQL + RLS
       ├─ checked RPC
       ├─ Realtime
       ├─ private Storage
       └─ Edge Functions（service roleは関数内のみ）
```

クライアントの権限表示は利用性のための第一層であり、セキュリティ境界ではない。最終認可はRLS、列権限、RPC、DBトリガー、Storage policyで行う。

## 6. ディレクトリ設計

```text
app/                         Expo Routerの画面
  (tabs)/                    ホーム、予定、マイページ、思い出
  event/[id]/                イベント配下の詳細機能
components/                  画面共通部品、OS別部品
constants/                   色、集金カテゴリ、法務文書、安全ルール
context/auth-context.tsx     認証状態と認証操作
context/event-context.tsx    アプリの集約状態とユースケース
lib/cloud-events.ts          イベントDB・RPC・Storage変換
lib/cloud-profile.ts         プロフィール・同意同期
lib/cloud-media.ts           アプリ画像アップロードと署名URL
lib/auth-storage.ts          ネイティブ暗号化保存アダプタ
lib/date-values.ts           日付の正規化
lib/time-values.ts           時刻の正規化
supabase/migrations/         DBの唯一の変更履歴
supabase/functions/          削除・書き出しAPI
scripts/                     回帰・リリース検査
types/event.ts               クライアントドメイン型
store-assets/                ストア提出用素材
```

## 7. 画面・ルート仕様

### 7.1 起動ガード

`app/_layout.tsx` は次の順に遷移を制御する。

1. ローカル状態と認証状態の復元完了を待つ。
2. Supabase設定済みで未ログインなら `/auth` へ送る。
3. ログイン済みで初期登録未完了なら `/onboarding` へ送る。
4. 登録完了済みでオンボーディングを開いた場合は `/` へ戻す。
5. 規約、プライバシー、ガイドライン、削除案内、サポート、第三者ソフトウェアは未認証でも閲覧可能とする。
6. パスワード再設定コールバックは未認証ガードの対象外とする。

### 7.2 タブ

| ルート | 名称 | 主な仕様 |
|---|---|---|
| `/(tabs)` | ホーム | 次のイベント、この先の予定、過去の予定、最新チャットと実未読件数、作成・参加導線 |
| `/(tabs)/calendar` | 予定 | 月間カレンダー、イベント日ドット、当月イベント一覧 |
| `/(tabs)/groups` | グループ | 継続グループ一覧、同一メンバー、次回予定、思い出件数 |
| `/(tabs)/profile` | マイページ | プロフィール、参加・主催・つながり数、通知、規約、安全、削除、ログアウト |
| `/(tabs)/archive` | 思い出 | アーカイブ日を示す月間カレンダー、選択日のイベント、直近3件 |

### 7.3 認証・登録

| ルート | 入力・処理 |
|---|---|
| `/auth` | 新規登録／ログイン切替。メール形式、8文字以上、登録時パスワード2回一致を検証。再設定メール送信 |
| `/onboarding` | 紹介→表示名・メール・生年月日→3文書同意。生年月日は1900-01-01以上かつ16歳以上 |
| `/reset-password` | メールリンクで復元したセッションを確認し、8文字以上の新パスワードを2回入力 |

メール確認後のネイティブ遷移先は `tsudowa://onboarding`、再設定は `tsudowa://reset-password`。コールバックは許可済みscheme・routeだけを受け入れ、code、token hash、旧式tokenを長さ制限付きで解析する。

### 7.4 イベント作成・参加

#### `/create`

入力項目:

- イベント名: 必須
- 写真: 任意、16:9トリミング、品質0.85、最大8MBをバックエンドでも制限
- 開始日・終了日: 独自月間カレンダーで範囲選択
- 時間: 開始のみ、または開始～終了。5分単位
- 場所: 名称、住所、任意の緯度経度
- 説明: 任意
- 1人あたり参加費: 任意、0より大きい場合に初期集金を作る

同日かつ時間帯指定の場合、終了時刻は開始時刻より後でなければならない。作成時に主催者を参加済みで追加し、開始時刻の「イベント開始」予定を1件作成する。初期参加費は主催者も未払いで作成し、後から参加した承認済み参加者にも同額を未払いで自動付与する。

#### `/join`

1. コードを大文字化して入力する。
2. `preview_event_invite` で名称と日時だけを取得する。
3. 利用者が「参加する」を押す。
4. `join_event_by_invite` を呼び、現在仕様では即時 `approved`、出欠は「参加」とする。
5. 同じコードの再入力は冪等で、後から変更した出欠を上書きしない。
6. 成功後にクラウドを再取得して詳細へ移動する。取得だけ失敗した場合は参加済みとしてホーム再読込を案内する。

QRコードは任意文字列またはURLの `code` クエリを取り出し、同じ確認画面へ渡す。QR読取だけで参加を確定しない。

### 7.5 イベント詳細 `/event/[id]`

- ヒーロー: イベント写真または年月日、カテゴリ、状態、主催者
- クイック操作: チャット、招待、端末カレンダー追加
- タブ: 概要、タイムフロー、集金
- 概要: 日時、候補日投票、場所、参加者、説明、招待コード
- タイムフロー: 日付・時刻順。管理者は編集画面へ移動
- 集金: 回収額、合計額、進捗、項目一覧
- 主催者: イベント削除
- 共同主催者・参加者: 脱退申請
- 主催者以外: イベント内容の通報
- アーカイブ後: チャット、招待、編集、削除、脱退を隠し、閲覧専用表示

端末カレンダーへは、開始日時と終了日時を追加する。開始のみの場合は1時間の予定として登録する。

### 7.6 日時・場所

- `/event/[id]/edit-date`: 作成画面と同じ範囲カレンダー、時間選択、同日終了時刻検証
- `/event/[id]/edit-location`: 施設名・住所検索、現在地、地図タップ、ドラッグ可能なピン、表示名編集

iOSはApple Maps、AndroidはGoogle Mapsを使用する。AndroidのAPIキーはアプリID `com.shuwa.tsudowa` と本番SHA-1へ制限する。WebはOpenStreetMap iframeでプレビューし、地図上の直接選択ではなく入力・現在地を中心とする。

### 7.7 参加者 `/event/[id]/participants`

- 全参加者数と「参加」回答数を表示する。
- 自分は参加／未定／不参加を変更できる。
- 主催者・共同主催者は参加申請、脱退申請を審査できる。
- 主催者だけが参加者を共同主催者へ任命・解除できる。
- 自分自身の通報、ブロック、脱退審査はできない。
- 検索は表示名の部分一致とする。

### 7.8 タイムフロー

- `/event/[id]/schedule`: イベント期間内の月間カレンダーと選択日の予定一覧
- `/event/[id]/schedule/new`: 追加・編集共通画面
- 日付はイベント開始日～終了日に制限する。
- 時刻は5分単位のOS標準UIを使う。
- 種類は `move`、`activity`、`food`、`stay`。
- 主催者・共同主催者だけが追加・編集・削除できる。
- 保存時は日付とローカル時刻をISO日時へ変換してDBへ保存する。

### 7.9 候補日

- 管理者が候補日、開始時刻、240文字以内のメモを追加する。
- 承認済み参加者は各候補へ `yes`（○）、`maybe`（△）、`no`（×）を1件保存する。
- 管理者が候補を確定すると、イベントを単日・開始時刻のみへ原子的に更新する。

### 7.10 集金

#### モデル

1イベントに複数の集金項目を持てる。カテゴリは参加費、食事代、宿泊費、交通費、チケット、その他。各項目は立替者、対象者、分け方、期限、メモ、参加者別金額、支払状態を持つ。

#### 分け方

- 均等割り: 合計を対象人数で整数除算し、端数を先頭対象者へ加算
- 個別指定: 個人額の合計が総額と一致すること
- 1人あたり: 現在の全参加者を対象とし、新規参加者にも同額を未払いで自動追加

#### 権限・更新

- 追加、改名、カテゴリ、金額、立替者、期限、メモ、分け方、対象者、削除、支払状態変更は主催者だけ。
- 一般参加者と共同主催者は閲覧のみ。
- 支払状態の初期値は必ず未払い。
- 集金編集RPCは項目と対象者一覧を1トランザクションで更新する。
- 既存対象者の支払済み状態は金額編集後も保持する。
- 新規対象者は未払い、削除対象者のshareは削除する。
- 実決済は行わない。

### 7.11 チャット

- 承認済みイベント参加者だけが閲覧・送信できる。
- 本文は0～2000文字。ただし本文なしの場合は写真必須。
- 写真はJPEG、PNG、WebP、HEIC、HEIF、最大8MB、幅・高さ1～20000。
- 本文はクライアントとDBトリガーの両方で禁止表現を検査する。
- 自分以外のメッセージから通報画面へ移動できる。
- ブロックした相手のメッセージは端末表示から除外し、未読にも数えない。
- 写真は全画面プレビューできる。
- メッセージは作成日時順。日付区切りとローカル時刻を表示する。
- チャット画面を開くと最終メッセージ日時を既読位置として保存する。
- 未読数は「自分以外」「ブロック対象外」「既読位置より新しい」メッセージだけを数える。
- メッセージへ返信でき、返信元の送信者と本文または写真を引用表示する。
- リアクションは`👍 ❤️ 😂 😮 😢 🙏`の許可リストだけを使用し、同じ利用者・メッセージ・絵文字の組合せを一意とする。
- 本文と送信者名を端末内で検索できる。取り消し済みメッセージは検索結果から除外する。
- 自分の本文は送信後15分以内だけ編集でき、DBも期限を検証する。写真そのものは編集しない。
- 自分のメッセージは24時間以内に全員の画面から送信取消できる。主催者・共同主催者は安全管理のため他者投稿も削除できる。
- 削除はDB行を残すsoft deleteとし、本文・画像metadata・リアクション・ピンを消去して返信関係を維持する。
- 主催者・共同主催者は重要メッセージをピン留めできる。
- 自分の送信メッセージには、`event_members.chat_read_at`が送信日時以降の他参加者数を既読人数として表示する。
- `@`入力中は参加者候補を表示し、表示名を本文へ挿入できる。
- オンライン人数と入力中表示はprivate Realtime Presence/Broadcastに接続できた場合だけ表示し、固定値・推測値を使用しない。

### 7.12 アーカイブ

- 終了判定は終了日と、時間帯指定なら終了時刻、開始のみなら終了日の23:59を使う。
- 終了時刻を過ぎたイベントはホームの「過去の予定」へ移る。
- 主催者・共同主催者が警告ダイアログで「はい」を選ぶと手動アーカイブする。
- サーバーもイベント終了前のアーカイブを拒否する。
- アーカイブ日時を保存し、以降のイベント配下更新をDBトリガーで拒否する。
- 思い出画面ではイベント開催日に印を付け、選択日の詳細とアーカイブ日時順の最新3件を表示する。
- 現行実装に「終了24時間後の自動アーカイブ」はない。

### 7.13 プロフィール、プライバシー、安全

- プロフィール: 表示名、`@`付き表示ID、任意地域、色、正方形トリミング写真
- 表示ID: 英数字と `_` の2～30文字、DBで一意
- データ書き出しと削除: 現在のパスワードで再認証してから実行
- 通報理由: 嫌がらせ、ヘイト、性的内容・児童安全、暴力、スパム、プライバシー、その他
- ブロックは相手へ通知しない。
- 公開サポートは一般、安全・児童保護、プライバシー、違法コンテンツ、異議申立てを受け付ける。

## 8. クライアントドメインモデル

### 8.1 EventItem

`EventItem` は画面が直接利用する集約モデルである。

| フィールド | 型 | 意味 |
|---|---|---|
| `id` | string | UUIDまたはローカルID |
| `title` | string | イベント名 |
| `category` | string | 現在は `EVENT` |
| `tagline` | string | 補助文。空を許可 |
| `host` | string | 主催者表示名 |
| `startDate`,`endDate` | `YYYY-MM-DD` | ローカル日付キー |
| `startTime`,`endTime` | `HH:mm` | ローカル時刻 |
| `timeMode` | `start` / `range` | 開始のみ／時間帯 |
| `dateLabel`,`timeLabel` | string | 表示用派生値 |
| `location`,`address` | string | 場所表示名、住所 |
| `latitude`,`longitude` | number? | 任意座標 |
| `description` | string | 説明 |
| `coverColor`,`accentColor` | hex | 画像なし時とアクセント |
| `coverImageUri`,`coverImagePath` | string? | 署名URL／Storage path |
| `status` | 開催中／予定／終了 | 表示状態 |
| `inviteCode` | string | 生コードは発行時のクライアントだけが保持 |
| `capacity` | number | 現在は実質10000 |
| `participants` | Participant[] | 承認済み参加者 |
| `joinRequests`,`leaveRequests` | array | 保留中申請 |
| `dateCandidates` | array | 候補日と投票 |
| `schedule` | array | タイムフロー |
| `collections` | array | 集金項目 |
| `messages` | array | チャット |
| `chatLastReadAt` | ISO string? | 自分の既読位置 |
| `archivedAt` | ISO string? | アーカイブ日時 |

### 8.2 金額

クライアントでは日本円の整数として扱う。DBは将来の小数通貨を考慮して `numeric(14,2)`、通貨は現在 `JPY` 固定。異なる通貨の混在合計は未実装。

### 8.3 日付・時刻の不変条件

- 日付文字列は厳密な `YYYY-MM-DD`。
- `Date` への変換はローカル正午を使い、UTC変換による前日化を防ぐ。
- イベント日付は2000-01-01以降。不正値は今日へ正規化する。
- 生年月日は1900-01-01以上、現在日から16年前以前。
- 時刻は0:00～23:59を `HH:mm` へ正規化。不正値は09:00。
- 時刻ピッカー用Dateは2000-01-01へ固定し、年月の影響を排除する。

## 9. PostgreSQLデータ設計

すべての利用者データテーブルでRLSを有効にする。`anon` へテーブル権限を付与しない。

### 9.1 Enum

- `event_member_role`: `host | cohost | member`
- `membership_status`: `pending | approved | declined | removed`
- `event_time_mode`: `start | range`
- `collection_split_method`: `equal | custom`
- `report_status`: `received | reviewing | resolved | dismissed`

### 9.2 profiles

| 列 | 制約 |
|---|---|
| `id uuid PK` | `auth.users`へFK、cascade |
| `display_name text` | 1～80文字 |
| `handle text unique` | `^@[A-Za-z0-9_]{2,30}$` |
| `city text` | 120文字以下、任意 |
| `date_of_birth date` | 1900-01-01以上、16歳以上、設定後nullへ戻せない |
| `age_verified_at timestamptz` | 生年月日設定・変更時にサーバー設定 |
| `avatar_color text` | 6桁hex |
| `avatar_path text` | 500文字以下、任意 |
| `locale`,`time_zone` | 既定 `ja-JP`、`Asia/Tokyo` |
| `created_at`,`updated_at` | サーバー時刻 |

新規Auth user作成時にプロフィールを自動作成する。初期表示名は内部上「新しいメンバー」だが、登録完了条件には使えない。

### 9.3 consent_records

`id`、`user_id`、`document`、`version`、`accepted`、`recorded_at`、`source`。文書はterms、privacy、community、analytics、crash_reports。クライアントから直接追加・更新・削除せず、`record_legal_consents`だけを使う。

### 9.4 events

主要列: `id`、`owner_id`、`title`、`category`、`tagline`、`description`、開始・終了日、開始・終了時刻、`time_mode`、`time_zone`、場所、座標、`capacity`、`status`、`join_policy`、色、`cover_image_path`、`archived_at`、監査日時。

制約:

- 終了日は開始日以降。
- 緯度-90～90、経度-180～180。
- `time_mode=start`なら終了時刻null、`range`なら終了時刻必須。
- 現在の`join_policy`既定値は`auto`。
- イベント作成は1ユーザー1時間20件、1日100件まで。
- 作成トリガーで所有者をhost・approved・参加として追加する。

### 9.5 event_members

複合PK `(event_id,user_id)`。ロール、membership status、出欠ラベル、`chat_read_at`、参加・更新日時を保持する。承認済みへの遷移時、auto assign対象の集金shareを未払いで自動追加する。

### 9.6 schedule_items

`id`、`event_id`、`starts_at`、任意`ends_at`、`title`、`note`、`item_type`、`sort_order`、`created_by`、監査日時。タイトル1～180、note 2000以下。

### 9.7 collections / collection_shares

`collections`: イベント、名称、カテゴリ、立替者、総額、通貨、分割方式、期限、メモ、作成者、`auto_assign_new_members`、`default_share_amount`、監査日時。

`collection_shares`: `(collection_id,user_id)`、金額、paid、paid_at、confirmed_by、updated_at。

主催者だけが管理可能。編集は`update_collection_details`を使い、総額をshare合計から再計算する。

### 9.8 messages

`id`、`event_id`、`author_id`、本文、`moderation_state`、作成・編集日時、画像path/MIME/width/height、`reply_to_id`、`deleted_at/deleted_by`、`pinned_at/pinned_by`。一般クライアントから直接insert/updateできず、旧版は`send_event_message`、強化版は後方互換用の別RPC `send_event_message_v2`を使う。

`message_reactions`は`(message_id,user_id,emoji)`をPKとし、承認済みイベント参加者だけが読める。書込みは直接許可せず`toggle_message_reaction`だけを使う。アーカイブ後は専用triggerで変更を拒否する。

### 9.9 event_invites

`id`、`event_id`、`token_hash`、`created_by`、`expires_at`、`max_uses`、`use_count`、`revoked_at`、`created_at`。生トークンは10バイト乱数を16進大文字化し、DBにはSHA-256だけを保存する。既定有効期限7日、50回。許容範囲は1時間～30日、1～1000回。発行は1ユーザー1時間20件まで。

### 9.10 date_candidates / date_candidate_votes

候補はイベント、日付、開始時刻、メモ、作成者を持ち、イベント内の日付＋時刻を一意とする。投票は候補＋利用者をPKとし、choiceはyes/maybe/no。

### 9.11 event_leave_requests

イベント＋利用者をPKとし、pending/approved/declined/cancelled、申請日時、審査日時、審査者を保持する。

### 9.12 blocked_users / safety_reports

ブロックはblocker＋blockedの複合PKで、自己ブロックをCHECKで禁止する。通報は対象イベント、メッセージ、利用者、理由、詳細、状態、解決記録、担当者を保持し、自己通報をCHECKとRPCの両方で禁止する。

## 10. RPC契約

| RPC | 呼出者 | 主な保証 |
|---|---|---|
| `record_legal_consents` | 本人 | 3必須文書をサーバー時刻で追記 |
| `create_event_invite` | host/cohost | 乱数、hash、有効期限、回数、rate limit |
| `preview_event_invite` | 認証済み | 参加前は名称・日時だけ返す |
| `join_event_by_invite` | 認証済み | row lock、期限・回数・定員、冪等参加、出欠参加 |
| `set_my_attendance` | 承認済み本人 | 参加／未定／不参加のみ |
| `review_event_join_request` | host/cohost | pending申請のみ審査 |
| `set_event_member_role` | owner | host以外をcohost/memberへ変更 |
| `mark_event_chat_read` | 承認済み本人 | 既読時刻を後退させない |
| `send_event_message` | 承認済み本人 | 本文・画像path検証、1分30件・1日1000件 |
| `send_event_message_v2` | 承認済み本人 | 旧保証＋同一イベント内の有効な返信先検証 |
| `edit_event_message` | 投稿者 | 本文のみ、15分以内、禁止表現・アーカイブ検証 |
| `delete_event_message` | 投稿者/host/cohost | 本人24時間以内、管理者モデレーション、soft delete |
| `toggle_message_reaction` | 承認済み本人 | 絵文字allowlist、冪等toggle、アーカイブ拒否 |
| `set_message_pin` | host/cohost | ピン日時・実行者を原子的更新 |
| `set_collection_share_paid` | owner | 対象shareのpaidと監査列を原子的更新 |
| `update_collection_details` | owner | 項目とsharesを検証・一括更新 |
| `confirm_event_date_candidate` | host/cohost | 候補を正式日程へ反映 |
| `request_event_leave` | cohost/member | host禁止、upsert |
| `cancel_event_leave_request` | 申請者 | pendingだけ取消 |
| `review_event_leave_request` | host/cohost | 自己審査禁止、承認時memberをremoved |
| `archive_event` | host/cohost | 終了済みだけ、冪等、completed化 |
| `delete_owned_event` | owner | 所有イベントだけ完全削除 |
| `submit_safety_report` | 認証済み | 対象整合、自己通報禁止、1時間10・1日30 |
| `moderate_message` | moderator/admin | visible/hidden/removed、通報解決記録 |

## 11. RLS・DB防御

- プロフィールは本人、同じ承認済みイベントの参加者、審査対象者を管理者だけが読める。
- イベントと配下情報は承認済み参加者だけが読める。
- event ownership、membership status、roleは一般table updateで変更できない。
- eventsの更新可能列を列単位GRANTで限定し、owner_idと監査列を変更できない。
- messages、invites、consents、reportsは直接書込権限を剥奪し、検証RPCだけを使う。
- アーカイブ済みイベントは各配下テーブルのbefore triggerで変更を拒否する。
- security definer関数は`search_path=''`とし、参照先をschema修飾する。
- 招待、参加、集金編集など競合し得る処理はrow lockまたはadvisory lockを使う。

## 12. Storage設計

### 12.1 chat-media

- 非公開、最大8MB。
- path: `{eventId}/{uploaderUserId}/{messageId}.{ext}`
- 読取: 承認済みイベント参加者。
- upload: pathの利用者本人、イベント参加者、quota内、非アーカイブ。
- delete: uploader本人またはイベント管理者、非アーカイブ。
- 表示URL: 1時間の署名URL。

### 12.2 app-media

- 非公開、最大8MB。
- profile path: `profiles/{userId}/{randomUuid}.{ext}`
- event cover path: `events/{eventId}/cover/{randomUuid}.{ext}`
- profile読取: 本人または同じイベントの参加者。
- event cover読取: イベント参加者。
- profile upload/delete: 本人。
- event cover upload/delete: host/cohost、非アーカイブ。
- unique pathを使い、in-place updateは許可しない。

### 12.3 quota

各バケット・利用者につき、500オブジェクト未満かつ保存済みmetadata合計200MiB未満をupload条件とする。

## 13. 認証・ローカル保存

### 13.1 Supabase設定時

- セッション永続化、auto refresh、PKCEを使う。
- ネイティブはSecureStoreを使用し、`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`で保護する。
- SecureStoreの1値サイズを避けるため1800文字×最大64chunkで世代管理する。
- manifestを最後に切り替え、旧世代を削除することで中断時の破損を抑える。
- 旧AsyncStorageデータは一度だけSecureStoreへ移行する。
- クラウドイベント・チャットは平文ローカルキャッシュへ保存しない。
- 保存するローカル状態はプロフィール、設定、同意履歴に限定する。

### 13.2 Supabase未設定時

開発用ローカルモードとして、イベント、プロフィール、設定、通報、同意、ブロックをAsyncStorageへ保存する。ローカル参加コードは6文字の疑似乱数であり、本番セキュリティモデルではない。

### 13.3 Web

ブラウザではAsyncStorage相当を利用する。静的レンダリング時はセッションを保存しない。Webは本番主製品ではないため、機密端末での長期セッション利用を前提にしない。

## 14. 同期・リアルタイム・再取得

- 初回ログイン時にクラウドのプロフィール、同意履歴、イベントを取得する。
- 旧端末にだけ登録完了証拠がある場合、クラウドプロフィールと同意を修復する。
- Postgres Changes対象: messages、message_reactions、event_members、date_candidates、votes、events、collections、shares、leave_requests、profiles、blocked_users。
- オンライン・入力中状態は`event:{eventUuid}:chat` private channelを使う。`realtime.messages`のselect/insert policyがtopicからevent UUIDを安全に抽出し、承認済み参加者だけにPresence/Broadcastを許可する。
- 変更通知を受けると、RLS下でイベント集約を再取得する。
- `RefreshableScrollView`を使う縦スクロール画面はpull-to-refreshでプロフィールとイベントを再取得する。
- 作成・編集の多くは楽観更新し、通信失敗時に直前状態へrollbackする。
- 日時・場所更新は現在fire-and-forgetで、失敗時UI通知・rollbackがない。公開前に改善対象とする。

## 15. 日付・時刻UIのプラットフォーム仕様

### 15.1 イベント日付

作成・編集は42セルの月間カレンダーを使用し、1回目で開始日、2回目で終了日を選ぶ。開始日前を2回目に選ぶと、その日を新しい開始日とする。

### 15.2 生年月日・期限・候補日

- iOS: `UIDatePicker`
- Android: `DateTimePickerAndroid`、日付はcalendar表示
- Web: `<input type="date">`

### 15.3 時刻

- iOS: `UIDatePickerStyleWheels`相当のspinnerを下部モーダルへ表示
- Android: clock表示
- Web: `<input type="time" step="300">`
- 5分単位、24時間値として保存

iOSのホイールはcontrolled componentとして、すべてのwheel eventを`draftDate`へ反映し、同時に`latestDate` refへ保持する。「完了」がReact描画より早く押されても最新値を確定できる。`value`を初期値へ固定してはならない。

iOS 26.5.2ではspinner文字が背景と同化する事例があるため、`themeVariant="light"`に加えて`textColor={palette.ink}`を必須とする。モーダルは高さ216、下部SafeArea、明示的な「キャンセル」「完了」を持つ。この可視性修正は次回TestFlightビルドで実機確認する。

## 16. 通知

- イベント開始は、可能なら24時間前、過ぎていれば1時間前に1件登録する。
- 未払いがある集金は期限前日09:00に登録する。
- 日時未定イベントには端末リマインダーを登録しない。
- remote pushは、チャット、メンション・返信、イベント情報変更、参加・脱退、集金変更、グループの新規イベント、固定された主催者のお知らせの7種類。
- 利用者は種類別、おやすみ時間、イベント別ミュートを設定できる。
- 端末はExpo Push Tokenとランダムなinstallation IDだけを登録し、他利用者のtokenを読めない。
- DB triggerは通知をserver-onlyの`notification_outbox`へ積み、Edge FunctionがExpo Push Serviceへ送る。
- ブロックした相手がactorの通知はoutbox作成前に破棄する。
- 通知タップdataには許可済みのevent/chat/participants/collection routeだけを入れる。
- Android channelは`event-reminders`、HIGHとし、通知音はOSと利用者の端末設定に従う。foreground表示では音とbadgeを付けない。
- 再同期時は`tsudowa-`および旧prefixの既存通知を削除して再作成する。
- 配信関数は共有シークレット必須、`FOR UPDATE SKIP LOCKED`による100件単位の排他claim、5分のclaim失効、最大8回再試行、無効token停止、処理済み30日保持とする。Supabase Vaultの共有シークレットを使い、outbox INSERT後の非同期即時呼出しと、遅延・再試行用の1分cronをDB migrationで構成する。

## 16.1 継続グループ

- 終了済みかつ未アーカイブのイベントだけをグループ化できる。
- グループ化は主催者・共同主催者だけが実行でき、グループ名を必須とする。
- 元イベントをグループへ関連付け、承認済みメンバーとroleを`event_group_members`へコピーする。
- 同時に同メンバーの次回イベントを`date_status = undecided`で作成する。
- 次回イベント追加時は各メンバーへ`group_update`を1件だけ積み、メンバー一括コピーによる参加通知は抑止する。
- 次回イベントへチャット、写真、集金、タイムフロー、候補日、招待コードはコピーしない。
- 日時未定中のDB日付列は旧クライアント互換のplaceholderであり、表示、終了判定、並び替え、カレンダー、通知では必ず`date_status`を優先する。
- 月間カレンダーまたは候補日確定で日時を保存すると`date_status = scheduled`へ遷移する。
- グループ詳細には、これからのイベント、今までのイベント、メンバー、管理者向けイベント追加を表示する。

## 17. 法務・プライバシー仕様

- 必須同意: 利用規約、プライバシーポリシー、コミュニティガイドライン。
- 文書版: terms `2026-07-26.2`、privacy `2026-08-28.1`、community `2026-07-26`。
- 生年月日は年齢確認にのみ使い、プロフィールへ公開しない。
- 取得情報、目的、委託先、国外処理、保存期間、権利、16歳制限をポリシーへ記載する。
- カメラ、写真、位置、カレンダー、通知は該当操作時だけ要求する。
- 拒否時はコード、場所手入力、写真なし利用などの代替手段を残す。
- App Store申告はUGC・チャット・16+・トラッキングなし・広告なしと実装を一致させる。
- 集金額と支払状態は決済情報ではなく、共有費用・支払記録として正確に申告する。

## 18. モデレーション

- クライアント送信前とDB insert前の二層で、脅迫、性的搾取、児童搾取など明白な表現を拒否する。
- フィルターだけに依存せず、通報、ブロック、モデレーター非表示、アカウント停止を併用する。
- 通常ユーザーは自分の通報だけ、moderator/adminは通報と非表示メッセージを確認できる。
- `moderate_message`でhidden/removedにすると、通常参加者のselect結果から消える。
- 緊急・児童安全は即時、重大案件24時間、一般案件72時間を初動目標とする。
- 管理アカウントは一般アカウントと分離し、MFAを必須運用とする。

## 19. アカウント書き出し・削除

### 19.1 共通防御

- クライアントで現在パスワードを再入力する。
- Edge Functionでも`last_sign_in_at`が5分以内か検証する。
- `Authorization: Bearer`を検証する。
- CORS originはtsudowa.app、www、localhostだけ。
- responseは`no-store`、`nosniff`。

### 19.2 書き出し

プロフィール、同意、membership、参加イベント、所有イベント、本人のメッセージ、集金share、作成した予定・集金・候補、投票、脱退申請、通報、ブロックをJSON化する。本人投稿チャット写真とプロフィール・所有イベント写真には15分の署名URLを付ける。

### 19.3 削除

1. profile画像と所有イベントcover pathを取得。
2. 本人投稿写真と所有イベント内写真をStorageから削除。
3. 所有イベントを関連データごと削除。
4. 他人のイベント内で本人が作成・立替したrestrict参照を削除。
5. Auth userを削除し、cascadeでプロフィール、membership、メッセージ等を削除。
6. 端末セッションとローカル状態を消去。

## 20. デザインシステム

### 20.1 方針

- パステル調、過度なグラデーション、浮遊カードを避ける。
- 深い緑、生成り、濃い墨色、赤茶の限定色でスタイリッシュに統一する。
- 角丸は主に4～12px。影は原則使わず、細い境界線と余白で階層を作る。
- OS標準の操作体系、明確な戻る・完了・キャンセルを優先する。

### 20.2 色

| token | 値 | 用途 |
|---|---|---|
| canvas | `#F3F3F0` | 画面背景 |
| surface | `#FCFCFA` | カード、モーダル |
| ink | `#151816` | 主文、iOS picker文字 |
| muted | `#626762` | 補助文 |
| line | `#D7D8D3` | 境界線 |
| primary | `#173E33` | 主操作、選択 |
| primarySoft | `#E8E9E6` | 選択補助背景 |
| accent | `#A8442F` | 注意、アクセント |
| danger | `#A63832` | 破壊操作、未払い強調 |

### 20.3 アクセシビリティ

- タップ対象はおおむね44pt以上を確保する。
- アイコンだけのボタンにはaccessibilityLabelを付ける。
- 選択UIはrole/stateを付ける。
- 色だけで状態を表さず、文字・アイコンを併記する。
- React Native標準の文字拡大を妨げない。
- VoiceOver、TalkBack、最大文字サイズは実機受入試験に含める。

## 21. 環境変数

| 変数 | 公開可否 | 用途 |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | 公開可 | Project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 公開可 | RLS前提のpublishable key |
| `EXPO_PUBLIC_OPERATOR_NAME` | 公開 | 規約上の運営者名 |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | 公開 | サポート窓口 |
| `EXPO_PUBLIC_PUBLIC_BASE_URL` | 公開 | HTTPS公開サイト |
| `GOOGLE_MAPS_API_KEY` | アプリ内組込 | Android app/SHA-1/API制限必須 |
| `RELEASE_BRAND_APPROVED` | 公開可 | 名称確認ゲート |
| `RELEASE_GLOBAL_COMPLIANCE_APPROVED` | 公開可 | 提供地域法務確認ゲート |

`SUPABASE_SERVICE_ROLE_KEY`、DB password、Apple/Google署名鍵、EAS credentialsをクライアント、Git、`EXPO_PUBLIC_`へ置いてはならない。

## 22. 開発環境構築

### 22.1 必要環境

- Windows/macOS
- Node.js 20.19以上
- Git
- pnpm（packageManager欄と同じ版）
- Expoアカウント
- Supabase CLI
- DB回帰試験用Docker Desktop（WindowsはWSL 2 backend）
- iOS確認用iPhone、Android確認用端末

### 22.2 初期化

```powershell
cd C:\dev\tsudowa
npx.cmd pnpm@10.34.5 install
Copy-Item .env.example .env
npm.cmd run start
```

`.env`へ本番または開発プロジェクトの公開設定だけを入れる。Expo Goは素早いJS確認用。本番と同じnative設定を確認する場合はDevelopment BuildまたはTestFlight/内部テストを使う。

### 22.3 Supabase

```powershell
npx.cmd --yes supabase@2.109.1 login
npx.cmd --yes supabase@2.109.1 link --project-ref <PROJECT_REF>
npx.cmd --yes supabase@2.109.1 db push --dry-run
npx.cmd --yes supabase@2.109.1 db push
npx.cmd --yes supabase@2.109.1 functions deploy export-account
npx.cmd --yes supabase@2.109.1 functions deploy delete-account
```

大学等で5432/TCPが閉じられている場合は、許可されたネットワークへ切り替える。Docker警告はremote push/deploy自体の成功と分けて判断する。

## 23. ビルド・更新

### 23.1 開発起動

```powershell
npm.cmd run start
npm.cmd run web
```

### 23.2 品質確認

```powershell
pnpm check:dates
pnpm check:times
pnpm check:onboarding
pnpm check:storage
pnpm check:auth-redirect
pnpm check:collections
pnpm check:chat
pnpm typecheck
pnpm lint
pnpm export:web
pnpm release:check
npx.cmd --yes supabase@2.109.1 db start
npx.cmd --yes supabase@2.109.1 test db supabase/tests
npx.cmd --yes supabase@2.109.1 db lint --local --level warning
```

`release:verify`は`pnpm release:check`までのアプリ検査を順番に実行する。末尾3つのSupabaseコマンドはCIの`database-tests` jobで実行する。時刻回帰検査では、iOS pickerがlive `draftDate`をvalueに使うこと、wheel eventでstateを更新すること、`textColor`を明示することを検査する。

### 23.3 EAS Build

```powershell
npx.cmd --yes eas-cli@latest build --platform ios --profile production
npx.cmd --yes eas-cli@latest build --platform android --profile production
```

- `appVersionSource=remote`
- productionはbuild number/versionCodeをautoIncrement
- iOSは`newArchEnabled=false`。Expo GoはNew Architecture固定なので、同一挙動とは限らない。
- Android Maps keyはpreview/production EAS environmentへSensitive Stringとして設定する。

### 23.4 更新方式

- JS、文言、スタイルのみ: EAS Updateを導入・runtimeVersion整備後はOTA候補。
- SDK、native module、権限、icon、scheme、app config: 新しいstore build必須。
- 現在は重要修正を確実に検証するため、新しいTestFlight／Playビルドを基本とする。

## 24. テスト仕様

### 24.1 自動回帰

- date: 1970年・1900年固定再発、UTC日ずれ、範囲正規化
- time: 09:00へ戻る問題、最新wheel値、iOS 26文字可視性
- onboarding: 登録完了復元、デフォルトTest排除、永続化順序
- storage: SecureStore key、chunk、旧データ移行
- auth redirect: scheme/route allowlist、悪意あるURL拒否
- collection: 均等端数、個別額、支払状態保持、主催者限定UI/RPC
- chat: 検索、返信、リアクション、編集・取消期限、ピン、既読数、private Realtime認可
- db structure: RLS、grant、RPC、constraint、trigger、Realtime publication 30件
- db behavior: 主催者／参加者／部外者の送信・閲覧・reaction・編集・削除・pin・archive 24件
- typecheck、ESLint、Web export、release configuration

### 24.2 3アカウントE2E

A=主催者、B=共同主催者/参加者、C=未参加者で確認する。

1. A登録、メール確認、同意、生年月日境界。
2. Aが複数日・時間帯・地図・写真・参加費付きイベントを作成。
3. Bがコード確認後に参加。名称が「新しいメンバー」にならない。
4. Cはイベント、チャット、画像、集金を読めない。
5. Bのプロフィール変更がAへ反映される。
6. AがBを共同主催者にし、Bがタイムフロー・場所・候補日を編集。
7. Bは集金を編集・支払変更できず、Aだけが可能。
8. 後から参加したCへ1人あたり参加費が未払いで追加される。
9. チャット本文、写真、未読、返信、検索、リアクション、編集、送信取消、ピン、既読数、オンライン、入力中、ブロック、通報を確認。
10. Bの脱退申請をAが承認し、Bのアクセスが失われる。
11. 終了前アーカイブ拒否、終了後成功、以後全変更拒否。
12. Aのアカウント削除で所有イベント・画像が消える。

### 24.3 端末マトリクス

- iPhone 15 / iOS 26.5.2: 時間spinnerが表示され、文字が濃色、回転値を保持
- iPhone 15 Pro / iOS 26.6: 同上
- Android現行主要端末: clock、calendar、地図、戻る
- 小画面、文字最大、ダークモード端末設定（アプリはlight固定）
- 権限の許可／拒否／後から変更
- Wi-Fi、モバイル、低速、オフライン、セッション期限切れ
- TestFlight/Play buildとExpo Goを混同せず、版番号を記録

## 25. セキュリティ受入条件

- publishable keyだけを逆コンパイルで得た攻撃者が、他イベントを読めない。
- memberがRESTを直接呼んでもowner、role、membership、支払状態を改変できない。
- cohostが集金を直接改変できない。
- 未参加者が署名URLを新規発行できない。
- 期限切れ署名URLは再利用できない。
- path偽装、MIME偽装、8MB超、quota超をStorage/DBが拒否する。
- archive後の直接DB操作をtriggerが拒否する。
- 自己通報・自己ブロック・自己脱退審査を拒否する。
- export/deleteは古いセッションだけでは実行できない。
- operator全アカウントでMFA、復旧コードのオフライン保管、最小権限を実施する。

## 26. 現在できること

現行ソースで実装済み:

- メール登録、2回パスワード確認、確認メール、ログイン、再設定、ログアウト
- 16歳以上確認、3文書同意、同意履歴
- イベント作成、単日・複数日、開始のみ・時間帯
- ネイティブ／Webの日付・時刻UI
- 地図検索、現在地、ピン、場所保存
- 招待コード・QR・参加前プレビュー・即時参加
- 参加者、出欠、共同主催者、脱退申請
- タイムフローCRUD、候補日投票・確定
- 複数集金、均等・個別・1人あたり、期限、対象者、支払状態
- チャット、写真、未読、検索、返信、リアクション、15分編集、24時間送信取消、ピン留め、既読人数、メンション候補、実オンライン・入力中、ブロック、通報
- プロフィール・イベント写真
- 端末カレンダー、ローカルリマインダー
- 過去予定、手動・不変アーカイブ、思い出カレンダー
- データ書き出し、アカウント削除
- RLS、private Storage、rate limit、moderation基盤
- iOS／Android production buildとApp Store/Play向け設定

## 27. 既知の差分・残課題

### 27.1 リリース前に修正または判断が必要

1. iOS 26.5.2時間spinnerの文字色修正はソースに入っているが、影響端末が使うbuild 8には未収録。新しいTestFlight buildで確認する。
2. イベント詳細から日時・場所編集への導線が全参加者に表示され、Contextもクライアント側manager検証をしていない。DB RLSは不正更新を拒否するが、一時的に端末表示だけ変わる可能性がある。UIとContextにもmanager check、await、rollbackを追加する。
3. プッシュ通知の実装は完了しているが、本番DB migration、Edge Function、Database Webhook、APNs/FCM資格情報、新しい実機buildでの受信試験は未実施。
4. 自動RLS統合テスト、負荷試験、バックアップ復元試験、第三者脆弱性診断は運用上まだ必要。
5. 本番SupabaseのResumeと`202608270001_chat_foundation.sql`適用は完了。匿名API拒否試験に加え、構造・権限30件と主催者／参加者／部外者の行動24件、合計pgTAP 54件が本番linked DBで合格。すべてrollback済み。複数実機でのPresence/Broadcast、画像送受信、表示同期だけは端末試験が必要。
6. Realtime Settingsでpublic channelを無効化し、private channel強制後もチャットPresence/Broadcastが参加者だけに届くことを実機確認する。

### 27.2 将来拡張

- タイムゾーンをイベント単位で選択し、夏時間を正しく扱う。
- ISO 4217通貨をUIへ公開し、通貨別に合計する。
- 英語化と地域別表示。
- 監査ログ、イベント変更履歴、競合編集UI。
- Universal Links / App Links。現在の認証復帰はcustom scheme中心。
- モデレーション管理画面と処分・異議申立て監査UI。

## 28. 再構築の推奨順序

1. Expo Router、theme、共通フォーム、OS別date/time/mapを作る。
2. Supabase Auth、PKCE、SecureStore、navigation guardを作る。
3. 初期schema、RLS helper、プロフィール、同意を作る。
4. events、members、招待preview/join、プロフィール可視性を作る。
5. EventContext集約、cloud mapper、Realtime、pull-to-refreshを作る。
6. 作成、一覧、詳細、日時、場所、参加者を作る。
7. schedule、candidate/voteを作る。
8. collections/shares、自動付与、owner-only RPCを作る。
9. messages、private media、未読、通報、ブロックを作る。
10. profile/event media、leave、delete、archive read-only triggerを作る。
11. export/delete Edge Functionsを作る。
12. 規約、安全センター、ストア申告、自動回帰を完成させる。
13. 3アカウントE2E、iOS/Android実機、審査用アカウントで受入する。

各段階でUI権限とDB権限を同時に実装し、クライアント制御だけで次段階へ進まない。

## 29. 完了定義

次をすべて満たした時、当該版をリリース候補とする。

- 自動検査がすべて成功。
- iOS 26.5.2/26.6とAndroid実機で日付・時刻を確認。
- A/B/Cの権限E2Eが成功。
- private media、archive、delete、exportの否定系が成功。
- App Privacy、Data safety、年齢、UGC、暗号化申告が実装と一致。
- 審査用アカウント、サンプルイベント、招待コード、審査メモが稼働。
- `support@tsudowa.app` と公開5ページが利用可能。
- Apple審査承認とGoogle Playクローズドテスト要件が完了。
- 運営者が手動公開を承認。
