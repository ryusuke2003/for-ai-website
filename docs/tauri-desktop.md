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

### 左クリック: コンパクト操作画面

Trayアイコンを左クリックすると、ネイティブの項目一覧ではなく、メニューバー直下にコンパクトなアプリ画面を表示します。もう一度Trayアイコンを押すか、コンパクト画面がフォーカスを失うと非表示になります。

最初に表示するのはタイマーです。

- 残り時間、進捗、状態を表示
- `スタート / 再開 / 一時停止`
- `リセット`
- `タイマーを開く`: 通常サイズのタイマー画面へ戻す
- `Todoへ`: コンパクトTodo表示へ切り替える

コンパクトTodoでは「今日の時間割」だけを表示します。タスク追加フォームやテンプレート編集などは出しません。

- 一番上: 登録済みTodoのうち最も早い開始時刻
- 一番下: 登録済みTodoのうち最も遅い終了時刻
- 24時間全体は表示しない
- Todoのチェックボックスはその場で操作でき、既存のTodo保存領域へ反映する
- `タイマーへ`: コンパクトタイマーへ戻る
- `Todoを開く`: 通常サイズのTodo画面を開く

通常サイズのTodo画面では、`現在時刻へ`、`今日の予定をリセット`、`リセットを復元` といった上部の補助ボタンは表示しません。予定の作成・移動・完了・個別削除は従来どおりTodo画面内で行います。

### 右クリック: 終了

Trayアイコンの右クリックメニューには `タイマーを終了` だけを残します。Dockを非表示にしているため、アプリを明示的に終了する入口として利用します。

ウィンドウの閉じるボタンはアプリを終了せず、ウィンドウを非表示にします。

## Tray表示

Trayは通常時はストップウォッチアイコンだけを表示し、タイマー実行中だけ残り時間を横に表示します。

| 状態 | Tray表示 |
| --- | --- |
| 待機中 | アイコンのみ |
| 実行中 | アイコン + `24:32` のような残り時間 |
| 一時停止 | アイコンのみ |
| 完了 | アイコンのみ |

`src/desktop/trayTimerSync.js` が `timerStore` を購読し、Tauri実行時だけ `set_tray_title` commandを呼びます。ブラウザ版ではTauri APIを呼びません。

Tray左クリック時のウィンドウサイズ変更・位置調整・フォーカスアウト時の非表示は `src-tauri/src/lib.rs` が担当します。画面切り替えは `one:tray-navigation` eventを利用し、React側は `#tray-timer` / `#tray-todo` をコンパクト表示として扱います。

コンパクト表示から通常ウィンドウを開く場合は `src/desktop/trayWindow.js` が `open_full_window` commandを呼び、Rust側で装飾・サイズ・位置を通常状態へ戻します。

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
git tag v0.1.0
git push origin v0.1.0
```

## 保存領域

タイマー、進捗、設定、TodoはWebViewの `localStorage` に保存します。コンパクト表示と通常表示は同じmain WebViewを切り替えて使うため、別のデータコピーは作りません。

Tauriの保存領域はSafari / Chrome / Webデプロイとは別です。別環境へ記録を移す場合はこのアプリのJSONバックアップ / 復元を利用します。

## セキュリティ境界

- main windowのTauri capabilityは `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- frontendのCSPは `index.html` 側で維持
- frontendからRustへのcommandはTray title更新と通常ウィンドウ復帰だけ
- Rustからfrontendへの画面切り替えは固定されたnavigation eventだけを送る
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

### ログイン時自動起動は実装しない

タイマーは、macOSへのログイン時やMac起動時に自動起動する機能を採用しません。ユーザーが必要なときに手動で起動し、起動後はメニューバーに常駐する設計とします。

### Trayはコンパクト操作に留める

Trayではタイマーと今日の時間割の確認・最小限の操作だけを扱います。詳細設定、Todo作成、テンプレート編集、記録の振り返りなどは通常ウィンドウへ集約します。

### 内部識別子は互換性のため維持する

表示名は「タイマー」に統一しますが、`one.timer.v1`、`one:tray-*`、`--one-*`、bundle identifier `com.ryusuke2003.one` などの内部識別子は、保存データやイベント互換性を壊さないため変更しません。

## 現時点で未対応

個人利用を前提として、次はまだ必須にしていません。

- DMG配布
- Apple Developer証明書によるコード署名
- notarization
