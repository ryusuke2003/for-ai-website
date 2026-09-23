# タイマー macOSデスクトップ版

タイマーは React / Vite のフロントエンドをそのまま利用し、Tauri v2 でmacOSデスクトップアプリとして動作します。Web版とデスクトップ版でタイマーやTodoの実装を二重管理しません。

## 必要な環境

- Node.js 22.22.2以上
- Rust stable
- Xcode Command Line Tools

```sh
xcode-select --install
rustup toolchain install stable
npm ci
```

## 開発

Tauriウィンドウで起動:

```sh
npm run tauri dev
```

通常のブラウザ開発も引き続き利用できます。

```sh
npm run dev
```

## macOSメニューバー常駐

デスクトップ版はメニューバーにタイマーを常駐させます。macOSではDockアイコンを表示せず、Trayをアプリの主な入口にします。

### ログイン時自動起動

macOS版を起動すると、次回ログイン用のLaunchAgentを次へ登録します。

```text
~/Library/LaunchAgents/com.ryusuke2003.one.autostart.plist
```

LaunchAgentは `/usr/bin/open -b com.ryusuke2003.one --args --autostart` でアプリを起動します。アプリ側は `--autostart` を検知し、通常ウィンドウを表示せずTrayだけを常駐させます。手動で起動した場合は従来どおり通常ウィンドウを表示します。

LaunchAgentはbundle identifierを使って起動するため、配布版は `/Applications/タイマー.app` に置いて一度手動起動してから利用することを前提にします。アプリ更新後も同じbundle identifierを維持します。

LaunchAgentの登録失敗でタイマー本体まで起動不能にしないため、登録に失敗した場合は標準エラーへ記録して通常起動を継続します。

### 左クリック: コンパクト操作画面

Trayアイコンを左クリックすると、ネイティブの項目一覧ではなく、メニューバー直下にコンパクトなアプリ画面を表示します。もう一度Trayアイコンを押すか、コンパクト画面がフォーカスを失うと非表示になります。

直前にコンパクトタイマー / Todoを表示していた場合は、Trayを再表示してもその画面を維持します。直前のTray画面がない場合はTodoを初期表示します。

コンパクトタイマーでは次を操作できます。

- 残り時間、進捗、状態を表示
- `スタート / 再開 / 一時停止`
- `リセット`
- `タイマーを開く`: 通常サイズのタイマー画面へ戻す
- `Todoへ`: コンパクトTodo表示へ切り替える

コンパクトTodoでは「今日の時間割」だけを表示します。タスク追加フォームやテンプレート編集などは出しません。

- 登録済みTodoと現在時刻を含む必要範囲だけを表示
- 時刻目盛りが重なる場合は最初 / 最後の時刻を30分刻みより優先
- Todoのチェックボックスはその場で操作でき、既存のTodo保存領域へ反映する
- `タイマーへ`: コンパクトタイマーへ戻る
- `Todoを開く`: 通常サイズのTodo画面を開く

通常サイズのTodo画面では、予定作成、テンプレート、ドラッグ&ドロップ、完了、個別削除を扱います。

### 右クリック: 更新 / 終了

Trayアイコンの右クリックではネイティブメニューを表示し、アップデートの確認・適用と `タイマーを終了` を提供します。Dockを非表示にしているため、アプリを明示的に終了する入口としても利用します。

macOS 27では、Tauri 2.11系が利用する `tray-icon 0.24.x` で、ネイティブメニューをTrayへ常時関連付けすると左クリックがメニュー側に吸収される既知問題があります。そのため現在はメニューを通常時はTrayから外し、右クリック時だけ一時的に関連付けて表示します。これは `tray-icon 0.25.1` の上流修正と同じ「表示中だけメニューを関連付ける」方式です。

ウィンドウの閉じるボタンはアプリを終了せず、ウィンドウを非表示にします。

## Tray表示

Trayは通常時はアイコンだけを表示し、タイマー実行中だけ残り時間を横に表示します。

| 状態 | Tray表示 |
| --- | --- |
| 待機中 | アイコンのみ |
| 実行中 | アイコン + `24:32` のような残り時間 |
| 一時停止 | アイコンのみ |
| 完了 | アイコンのみ |

`src/desktop/trayTimerSync.js` が `timerStore` を購読し、Tauri実行時だけ `set_tray_title` commandを呼びます。ブラウザ版ではTauri APIを呼びません。

Tray左クリック時のウィンドウサイズ変更・位置調整・フォーカスアウト時の非表示は `src-tauri/src/lib.rs` が担当します。画面切り替えは `one:tray-navigation` eventを利用し、React側は `#tray-timer` / `#tray-todo` をコンパクト表示として扱います。

コンパクト表示から通常ウィンドウを開く場合は `src/desktop/trayWindow.js` が `open_full_window` commandを呼び、Rust側で装飾・サイズ・位置を通常状態へ戻します。

## ネイティブ完了通知

macOSデスクトップ版の完了通知はWebViewのブラウザ通知ではなく、Tauriの `tauri-plugin-notification` からmacOSネイティブ通知として送ります。

`src/desktop/nativeNotificationBridge.js` はTauri実行時だけ既存の `Notification` 利用箇所をRust commandへ橋渡しします。そのためReact側の完了通知ロジックをWeb版と二重管理せず、通常のWeb版ではこれまでどおりブラウザの `Notification` APIを使います。

デスクトップ版で `完了通知 OFF` を初めてオンにするとネイティブ通知の利用を確認し、許可された場合は確認用の通知を1件送ります。以後、タイマー完了時にウィンドウが前面にない場合はmacOS通知を送ります。設定値は従来どおり `one.completionNotification.v1` に保存します。

## lockfile準拠のビルド

CIと同じく、npm / Cargoの依存をlockfileに固定してビルドします。

```sh
npm ci
cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1 --no-deps > /dev/null
npm run tauri -- build --bundles app --no-sign -- --locked
```

生成された `.app` は次に出力されます。

```text
src-tauri/target/release/bundle/macos/タイマー.app
```

現在のCIはDMG生成・コード署名・notarizationまでは行わず、`.app` をZIP化してGitHub Actions artifactとして保存します。

## CI artifact

`.github/workflows/tauri-build.yml` は `macos-latest` 上で以下を実行します。

1. `npm ci`
2. `cargo metadata --locked` で `Cargo.lock` 整合性確認
3. `tauri build --bundles app --no-sign -- --locked`
4. `.app` を `timer-macos.zip` に圧縮
5. `timer-macos-app` artifactとして7日間保存

Rust build cacheも利用します。

## GitHub Release

`v` で始まるタグをpushすると、Tauri buildの成功後にGitHub Releaseを自動作成し、`timer-macos.zip` をRelease assetとして添付します。再実行時は既存ReleaseのZIPを上書きします。

タグのバージョンは `src-tauri/tauri.conf.json` の `version` と一致している必要があります。

```sh
git switch main
git pull --ff-only
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

## 保存領域

タイマー、進捗、設定、TodoはWebViewの `localStorage` に保存します。コンパクト表示と通常表示は同じmain WebViewを切り替えて使うため、別のデータコピーは作りません。

Trayを隠すだけではWebViewを破棄しないため、次回のTray表示で直前のコンパクト画面を維持するための追加ストレージは使いません。

Tauriの保存領域はSafari / Chrome / Webデプロイとは別です。別環境へ記録を移す場合はこのアプリのJSONバックアップ / 復元を利用します。

## セキュリティ境界

- main windowのTauri capabilityは `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- frontendのCSPは `index.html` 側で維持
- frontendからRustへのcommandはTray title更新、通常ウィンドウ復帰、ネイティブ通知の権限確認・表示に限定する
- Rustからfrontendへの画面切り替えは固定されたnavigation eventだけを送る
- ログイン時自動起動はユーザー領域の `~/Library/LaunchAgents` だけを利用し、管理者権限を要求しない
- npmは `package-lock.json`、Rustは `Cargo.lock` をCIで強制
- GitHub Actionsの外部Actionはcommit SHAに固定
- Release作成時だけ専用jobへ `contents: write` を付与し、通常のbuild jobは `contents: read` のままにする

## アイコン

アプリ / Trayのアイコンは `src-tauri/icons/icon.png` を利用します。macOSではTrayをtemplate iconとして扱い、ライト / ダークのメニューバーに馴染むようにしています。

将来アイコン一式を作り直す場合はTauriのicon生成を利用できます。

```sh
npm run tauri icon path/to/app-icon.png
```

## プロダクト方針

### ログイン時はTrayだけ自動起動する

macOSへログインしたときはタイマーを自動起動します。ただし通常ウィンドウを勝手に前面表示せず、メニューバーのTrayだけを常駐させます。ユーザーが必要になったときにTrayからタイマー / Todoを開きます。

### Trayはコンパクト操作に留める

Trayではタイマーと今日の時間割の確認・最小限の操作だけを扱います。詳細設定、Todo作成、テンプレート編集、記録の振り返りなどは通常ウィンドウへ集約します。

### 内部識別子は互換性のため維持する

表示名は「タイマー」に統一しますが、`one.timer.v1`、`one:tray-*`、`--one-*`、bundle identifier `com.ryusuke2003.one` などの内部識別子は、保存データやイベント互換性を壊さないため変更しません。

## 現時点で未対応

個人利用を前提として、次はまだ必須にしていません。

- DMG配布
- Apple Developer証明書によるコード署名
- notarization
- アプリ内自動アップデート
