# ONE macOSデスクトップ版

ONE は React / Vite のフロントエンドをそのまま利用し、Tauri v2 でmacOSデスクトップアプリとして動作します。Web版とデスクトップ版でタイマーや進捗の実装を二重管理しません。

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

デスクトップ版はメニューバーにONEを常駐させます。macOSではDockアイコンを表示せず、メニューバーをアプリの主な入口にします。

- 左クリック: メインウィンドウを表示 / 非表示
- 右クリック: タイマー操作とアプリ操作のメニューを表示
- ウィンドウの閉じるボタン: アプリを終了せず、ウィンドウを非表示
- Dock: ONEのアイコンは表示しない

右クリックメニューから、ウィンドウを開かずに次を直接実行できます。

- `開始`: 現在選択中のタイマーを開始 / 再開
- `一時停止`: 実行中のタイマーを一時停止
- `リセット`: 現在選択中の時間へ戻す
- `25分開始`: 25分へ切り替えてそのまま開始
- `5分休憩`: 5分休憩へ切り替えてそのまま開始
- `ONEを表示 / 隠す`
- `ONEを終了`

メニューバーのtitleはタイマー状態と同期します。

| 状態 | Tray title |
| --- | --- |
| 待機中 | `ONE` |
| 実行中 | `24:32` のような残り時間 |
| 一時停止 | `⏸ 24:32` |
| 完了 | `00:00` |

`src/desktop/trayTimerSync.js` が `timerStore` を購読し、Tauri実行時だけ `set_tray_title` commandを呼びます。ブラウザ版ではTauri APIを呼びません。

Trayのタイマー操作は `src-tauri/src/lib.rs` から `one:tray-timer-action` eventをmain WebViewへ送り、`src/desktop/trayTimerActions.js` が既存の `timerActions` へ委譲します。タイマー状態をRust側へ二重実装せず、ウィンドウが非表示でも同じReact timer storeを操作します。

Rust側のTray生成、Dock非表示、ウィンドウ常駐、終了処理、title反映は `src-tauri/src/lib.rs` が担当します。

## lockfile準拠のビルド

CIと同じく、npm / Cargoの依存をlockfileに固定してビルドします。

```sh
npm ci
cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1 --no-deps > /dev/null
npm run tauri -- build --bundles app --no-sign -- --locked
```

生成された `.app` は次に出力されます。

```text
src-tauri/target/release/bundle/macos/ONE.app
```

現在のCIはDMG生成・コード署名・notarizationまでは行わず、`.app` をZIP化してGitHub Actions artifactとして保存します。

## CI artifact

`.github/workflows/tauri-build.yml` は `macos-latest` 上で以下を実行します。

1. `npm ci`
2. `cargo metadata --locked` で `Cargo.lock` 整合性確認
3. `tauri build --bundles app --no-sign -- --locked`
4. `.app` を `ONE-macos.zip` に圧縮
5. `ONE-macos-app` artifactとして7日間保存

Rust build cacheも利用します。

## 保存領域

タイマー、進捗、設定、復旧用データはWebViewの `localStorage` に保存します。

Tauriの保存領域はSafari / Chrome / Webデプロイとは別です。別環境へ記録を移す場合はONEのJSONバックアップ / 復元を利用します。

## セキュリティ境界

- main windowのTauri capabilityは `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- frontendのCSPは `index.html` 側で維持
- frontendからRustへのcommandはTray title更新に限定
- RustからfrontendへのTray操作は固定された5種類のtimer action eventだけを送る
- npmは `package-lock.json`、Rustは `Cargo.lock` をCIで強制
- GitHub Actionsの外部Actionはcommit SHAに固定

## アイコン

アプリ / Trayのアイコンは `src-tauri/icons/icon.png` を利用します。macOSではTrayをtemplate iconとして扱い、ライト / ダークのメニューバーに馴染むようにしています。

将来アイコン一式を作り直す場合はTauriのicon生成を利用できます。

```sh
npm run tauri icon path/to/app-icon.png
```

生成物を確認したうえで `src-tauri/icons/` を更新してください。

## プロダクト方針

### ログイン時自動起動は実装しない

ONEは、macOSへのログイン時やMac起動時に自動起動する機能を**採用しません**。ユーザーが必要なときに手動で起動し、起動後はメニューバーに常駐する設計とします。

今後AIが改善案を検討するときも、**ログイン時自動起動を未実装タスク・推奨候補として扱わないでください**。この方針を変更する明示的な指示がある場合だけ再検討します。

## 現時点で未対応

個人利用を前提として、次はまだ必須にしていません。

- GitHub Releaseへの自動添付
- DMG配布
- Apple Developer証明書によるコード署名
- notarization
