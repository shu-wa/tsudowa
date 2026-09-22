# データ申告・実装照合（2026-09-11）

対象: `501e54e` と、9月11日のローカル準備変更。ソース・インストール済み依存ライブラリ・公式資料の照合結果であり、配布IPA/AABの解析やネットワーク実測、ストアへの保存は未実施。申告の最終決定と、SDKのプライバシーマニフェストは別の確認事項。

## 実装から確認したデータ経路

| 経路・根拠 | 内容 | 送信先・保持 | 申告への反映 |
| --- | --- | --- | --- |
| `context/auth-context.tsx` / Supabase Auth | メール、パスワード、認証セッション | Supabase。認証情報は公開しない | アカウント機能、メール、ユーザーID |
| プロフィール・イベント・グループのDB | 表示名/ID、生年月日、任意地域、イベント、メンバー、出欠 | Supabase。所属・役割に応じたアクセス制御 | 氏名、ユーザーID、その他個人情報、ユーザーコンテンツ |
| `lib/cloud-media.ts` 等 | 利用者が選択した写真 | Supabase private Storage、期限付きURL | Photos。写真全体への無条件アクセスとは区別 |
| チャット・集金 | 本文、返信、リアクション、既読、費用、支払状態 | Supabase。決済は行わない | アプリ内メッセージ、アクティビティ、その他金融情報 |
| `lib/notifications.native.ts` | 許可後のExpo Push Token、ランダムUUID、OS | Supabase `push_devices`。無効化と削除は別 | Device ID / Device or other IDs、アプリ機能、アカウントと関連付け |
| `lib/cloud-notifications.ts` | 種類別/時間帯別通知設定、タイムゾーン | Supabase | その他ユーザー設定・アプリ機能 |
| `dispatch-notifications` | 宛先トークン、通知タイトル・本文・遷移先 | Expo Push Service→FCM/APNs | 通知用の識別子と内容を外部処理事業者も扱う |
| `app/create.tsx` / `edit-location.tsx` | 検索文字列、選択座標、任意の現在地取得 | OSジオコーディング。保存時にイベント場所としてSupabase | 利用者の位置と任意の会場住所を区別 |
| `components/location-map.native.tsx` | MapView、Marker、地図移動 | iOS標準Apple Maps、Android Google Maps | Android SDK診断情報をiOSへ機械的に転記しない |
| `components/location-map.web.tsx` | 地図表示範囲・IP等 | OpenStreetMap iframe | Webの取扱いは公開ポリシーに残す。モバイルSDK申告と区別 |

パスワードは「アプリが収集しない」と案内しない。認証サービスへ送る秘密情報であり、ログやサポート窓口へ収集しない、という区別が必要。

## SDKの追加確認

- `expo-notifications` 0.32.17のAndroid Gradleは `firebase-messaging:24.0.1` を指定。Firebase Installationsも確認対象。JS側で通知をオフにしていても、SDKによる識別子処理がないとは断定できない。
- `react-native-maps` 1.20.1のGradle既定値は `play-services-maps:18.2.0`、`play-services-location:21.0.1`。依存関係解決やビルド側の上書きがあるため、これを配布物の確定版とは記載しない。
- Mapsの公式開示は最新版についての資料。IP・SDK識別子・端末メタデータ・クラッシュ情報・機能に応じた地図操作情報が対象。実際に解決されたSDK版との対応確認が残る。
- 独自の広告SDK、Firebase Analytics、Crashlyticsの直接依存は `package.json` で見つからない。ただし「独自の分析SDKがない」ことを「組み込みSDKも診断データを一切収集しない」の根拠にしない。
- `getConfig`による設定解決で `.ts` が優先され、Firebase File変数が消える問題を再現・修正。設定値あり/なしを実際のExpo APIでテスト済み。再ビルド前のAABは変更されない。

## ストア回答の確度

| 項目 | 現時点の扱い | 最終確認 |
| --- | --- | --- |
| データ収集 | あり | SDKも含める |
| トラッキング/広告 | 独自の広告追跡なし | 提供者の目的、Appleの定義も照合 |
| 識別子 | 通知の識別子を追加申告 | Googleの必須/任意はSDK自動初期化を含めて判定 |
| 診断・アプリ操作 | Android Maps由来を申告対象に追加 | 実配布版、Crash logs/Diagnostics/App interactions、用途（分析等）を確認 |
| 位置 | 現在地利用・場所共有の実装あり | 精度、端末外送信、関連付け、任意/必須を分ける。単にIPを扱うだけで位置分析ありとは断定しない |
| 第三者との共有 | 一律「なし」は未確定 | サービス提供者の例外適用とGoogle自身の利用目的を照合。広告目的の共有なしと全共有なしを混同しない |
| 削除 | アプリ内削除・公開請求導線あり | 本人確認、画像、グループ、通知登録、バックアップの扱いを専用データで試す |

## 今回のポリシー修正

`constants/legal.ts` の版を `2026-09-11.1` とし、Android Maps/FCM/Installationsの処理と、通知表示を止めることとSDK通信の停止の違いを補足した。新たなデータ収集コードや分析SDKは追加していない。

未反映先: 配布済みアプリ、公開サイト、ストア申告欄。公開前に同じ版の内容を反映し、既存ユーザーの同意更新導線を確認する。所在地・契約・国外移転・バックアップ実施のような運営実態は、ソースだけでは確認できないため、この照合を法務監査の完了とは扱わない。

## 公式根拠

- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Firebase Androidデータ開示](https://firebase.google.com/docs/android/play-data-disclosure)
- [Maps Androidデータ開示](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure)

資料の更新日やSDK版が変わった場合は再照合する。ストア欄へそのまま転記できる確定回答と、未確定候補を混ぜない。
