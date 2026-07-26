# TSUDOWA 開発ガイド

この文書は、プログラミング経験が少ない方でもTSUDOWAを起動・編集・更新できるようにまとめた手順書です。

## 1. 最初に理解すること

TSUDOWAはExpoとReact Nativeで作られています。画面を一度作れば、同じコードをiPhone、Android、Webで動かせます。

- Expo Go：開発初期にスマートフォンで素早く試すためのアプリ
- 開発サーバー：パソコン上でコードを読み込み、スマートフォンへ送る仕組み
- Fast Refresh：ファイルを保存すると、変更をほぼ即座に画面へ反映する機能
- Development Build：TSUDOWA専用の開発用アプリ。本格開発で使用
- EAS Build：iOS／Androidアプリをクラウドでビルドするサービス

現在の試作版はExpo SDK 54です。2026年7月20日時点のExpo公式案内では、物理端末のExpo Goで試す場合にSDK 54が案内されています。ただしExpo Goが対応するSDKは更新されるため、互換性エラーが出た場合は後述のDevelopment Buildを使うか、SDKを段階的に更新してください。

## 2. Windowsパソコンの準備

### 必要なもの

1. Node.js 20.19以上のLTS版
2. Visual Studio Codeなどのエディター
3. Git
4. iPhoneまたはAndroid端末
5. パソコンとスマートフォンが接続できるネットワーク

インストール確認：

```powershell
node --version
git --version
```

Node.jsのバージョンが古い場合は、Node.js公式サイトからLTS版を入れ直します。

### pnpmの準備

このプロジェクトはpnpmを使用します。

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm --version
```

PowerShellでスクリプト実行制限が表示される場合は、以後 `pnpm` を `pnpm.cmd` に読み替えてください。

`pnpm` が「認識されません」と表示される場合、すぐ起動するときは次を使います。

```powershell
npm.cmd run start
```

pnpmをパソコンへ常設する場合は、次を一度実行してPowerShellを開き直します。

```powershell
npm.cmd install --global pnpm@11.9.0
pnpm.cmd --version
```

常設インストールが権限エラーになる場合は無理に管理者設定を変更せず、`npm.cmd run start` または `npx.cmd pnpm@11.9.0` を使用してください。

## 3. Expo Goの設定

### スマートフォン側

1. iPhoneはApp Store、AndroidはGoogle Playで「Expo Go」を検索
2. Expo Goをインストール
3. 必要なら無料のExpoアカウントを作成してログイン
4. iPhoneではローカルネットワーク接続の確認が出たら許可

### パソコン側

PowerShellを開き、プロジェクトへ移動します。

```powershell
cd C:\dev\tsudowa
npx.cmd pnpm@11.9.0 install
npm.cmd run start
```

このパソコンでは依存パッケージを配置済みなので、通常は `npm.cmd run start` だけで起動できます。エクスプローラーで `START_TSUDOWA.cmd` をダブルクリックする方法もあります。

ターミナルへQRコードが表示されます。

- iPhone：標準カメラでQRコードを読み取り、Expo Goで開く
- Android：Expo Goの「Scan QR code」で読み取る
- Web：ターミナルで `w` を押す
- Androidエミュレーター：`a` を押す
- iOSシミュレーター：macOSとXcode上で `i` を押す

PCブラウザだけで安定して確認したい場合は、Web版を書き出して専用プレビューを起動できます。

```powershell
cd C:\dev\tsudowa
npm.cmd run web:preview
```

起動後に `http://127.0.0.1:8083` を開きます。Web版の日付と時刻はブラウザ標準のカレンダー／時刻入力を使用し、地図はOpenStreetMapでプレビューします。終了するときはターミナルで `Ctrl + C` を押してください。

### QRコードで接続できない場合

最初にパソコンとスマートフォンが同じWi-Fiへ接続されているか確認します。それでも接続できない場合：

```powershell
pnpm exec expo start --tunnel
```

表示が古い、または画面が更新されない場合：

```powershell
pnpm exec expo start --clear
```

開発サーバーを止めるときは、PowerShellで `Ctrl + C` を押します。

## 4. 日常的なプログラミング方法

Visual Studio Codeで `C:\dev\tsudowa` フォルダーを開きます。別のPowerShellで `pnpm start` を動かしたままファイルを編集します。保存するとFast Refreshで端末へ反映されます。

### よく編集する場所

```text
app/(tabs)/index.tsx       ホーム画面
app/(tabs)/calendar.tsx    予定画面
app/(tabs)/profile.tsx     マイページ
app/create.tsx             イベント作成画面
app/join.tsx               招待コード参加画面
app/event/[id].tsx         イベント詳細画面
app/event/[id]/chat.tsx    チャット画面
components/                複数画面で使う部品
context/event-context.tsx  イベントの状態と追加処理
constants/theme.ts         色、文字、影
types/event.ts             データの形
app.json                   アプリ名やiOS／Android設定
```

### 文字を変更する例

ホーム画面の見出しを変更する場合、`app/(tabs)/index.tsx` の次のような部分を探します。

```tsx
<Text style={styles.sectionTitle}>次のイベント</Text>
```

文字列を変更して保存すると画面へ反映されます。

### 色を変更する例

`constants/theme.ts` の色を変更します。

```ts
primary: '#285943',
accent: '#F47B52',
```

同じ色設定を多くの画面が利用するため、ここを変更するとアプリ全体の印象が揃って変わります。

### イベント表示を確認する

架空のイベントは自動投入されません。画面確認には、アプリの「イベントを作る」から実際にイベントを作成してください。招待・参加・権限の確認は、Supabaseへ接続した複数のテストアカウントで行います。

### 新しい画面を作る

Expo Routerでは、`app` フォルダーへファイルを追加するとURLと画面が作られます。

```text
app/settings.tsx → /settings
app/event/edit.tsx → /event/edit
```

最小の画面例：

```tsx
import { Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>設定画面</Text>
    </View>
  );
}
```

画面へ移動する例：

```tsx
import { router } from 'expo-router';

router.push('/settings');
```

### パッケージを追加する

Expo対応ライブラリは通常の `pnpm add` ではなく、互換バージョンを選ぶExpoコマンドを優先します。

```powershell
pnpm exec expo install パッケージ名
```

`node_modules` の中身は直接編集しません。

## 5. 変更後の確認

コード変更後は次を実行します。

```powershell
pnpm typecheck
pnpm lint
pnpm export:web
```

- `typecheck`：データ型や書き間違いの検査
- `lint`：コード品質の検査
- `export:web`：アプリ全体を実際にまとめられるか確認

エラーが出た状態でSDK更新やストア公開へ進まないでください。

## 6. アプリをアップデートする3つの意味

### A. 開発中の画面を更新する

ファイルを編集して保存するだけです。Fast RefreshでExpo Goへ反映されます。反映されない場合は端末で再読み込みするか、`pnpm exec expo start --clear` を実行します。チャットの写真選択はExpo Goでも確認できますが、参加者限定表示と削除はSupabaseの追加マイグレーション適用後に、複数アカウントで確認してください。

### B. Expo SDKやパッケージを更新する

SDKは一度に飛び越えず、54→55→56→57のように1つずつ更新します。各段階で公式リリースノートを読み、次を実施します。

例としてSDK 55へ上げる場合：

```powershell
git checkout -b upgrade/expo-sdk-55
pnpm add expo@^55.0.0
pnpm exec expo install --fix
pnpm dlx expo-doctor
pnpm typecheck
pnpm lint
pnpm start --clear
```

実機で主要機能を確認してから次のSDKへ進みます。問題があれば作業ブランチを破棄して元へ戻せるよう、更新前にGitへコミットしてください。

### C. 利用者が使う公開アプリを更新する

変更内容によって方法が異なります。

- 画面、文言、JavaScriptの処理、画像：EAS Updateで配信可能
- ネイティブライブラリ、権限、アプリアイコン、アプリ名、SDK：新しいアプリビルドが必要

EAS Updateは設定済みのDevelopment Build／公開アプリで使用します。ネイティブ部分との互換性を守るため、`runtimeVersion`を設定して運用します。

## 7. Expo GoからDevelopment Buildへ進む

Expo Goは試作には便利ですが、プッシュ通知、独自ネイティブライブラリ、アプリ名・アイコンの正確な確認などには制限があります。本格開発を始める時点でTSUDOWA専用のDevelopment Buildへ移行します。

```powershell
pnpm exec expo install expo-dev-client
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build:configure
pnpm dlx eas-cli@latest build --platform android --profile development
```

iPhone用：

```powershell
pnpm dlx eas-cli@latest build --platform ios --profile development
```

EASのクラウドビルドならWindowsからiOSビルドを依頼できますが、実機iPhone向け署名には有料Apple Developerアカウントが必要です。

Development Buildを端末へ一度インストールした後、日常の開発はExpo Goと同様に次で始めます。

```powershell
pnpm start
```

## 8. ストア公開まで

1. `app.json` のBundle IDとAndroid packageを自分が所有する値へ変更
2. 本番用アイコン、スプラッシュ画像を作成
3. 利用規約、プライバシーポリシー、問い合わせ先を用意
4. 通報、ブロック、退会、アカウント削除を実装
5. 本番データベースとアクセス権限を検証
6. TestFlightとGoogle Play内部テストを実施
7. ストア用ビルドを作成

```powershell
pnpm dlx eas-cli@latest build --platform android --profile production
pnpm dlx eas-cli@latest build --platform ios --profile production
```

ビルド完了後、EAS Submitまたは各ストアの管理画面から提出します。

## 9. このアプリで次に実装するもの

現在のイベント、集金、支払状態、予定、チャット、プロフィールは端末内へ永続保存されます。複数端末で同じイベントを共有する次段階は、次の順序が安全です。

1. ユーザー登録・ログイン
2. クラウドデータベース
3. 端末内データとクラウドデータの同期
4. リアルタイムチャット
5. 招待URLとQRコード
6. プッシュ通知
7. 出欠、複数集金、立替・支払記録（試作画面は実装済み。クラウド保存を追加）
8. 支払方法のメモ（現金、PayPayなど。アプリ内決済は行わない）
9. 通報、ブロック、管理機能

TSUDOWAは送金・決済を行わず、支払済みかどうかだけを記録します。現金、PayPay、銀行振込など、利用者が選んだ方法で支払える設計です。

## 10. Gitを使った安全な更新

作業開始：

```powershell
git status
git checkout -b feature/変更内容
```

作業完了：

```powershell
pnpm typecheck
pnpm lint
git add .
git commit -m "変更内容を短く書く"
```

`.env`、秘密鍵、APIの秘密情報、個人情報はGitへ登録しません。公開してよいクライアント設定だけを `EXPO_PUBLIC_` で始まる環境変数として扱います。

## 公式資料

- [Expo環境設定](https://docs.expo.dev/get-started/set-up-your-environment/)
- [Expo SDK更新手順](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Development Buildの説明](https://docs.expo.dev/develop/development-builds/introduction/)
- [Development Buildの作成](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [EAS Buildの設定](https://docs.expo.dev/build/setup/)
