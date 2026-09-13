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

- メニューバーのONEをクリック: 最小限のネイティブメニューを表示
- ウィンドウの閉じるボタン: アプリを終了せず、ウィンドウを非表示
- Dock: ONEのアイコンは表示しない

メニューバーのメニューは、日常的に使う操作だけに絞ります。

- `ONEを開く`
- `開始 / 再開`
- `一時停止`
- `リセット`
- `ONEを終了`

`25分開始` や `5分休憩` などのプリセット選択はメインウィンドウ側で行い、メニューバーメニューには重複して載せません。今後もメニューバー側は「すぐ使う最小操作」に留めます。

Trayは通常時はストップウォッチアイコンだけを表示し、タイマー実行中だけ残り時間を横に表示します。

| 状態 | Tray表示 |
| --- | --- |
| 待機中 | アイコンのみ |
| 実行中 | アイコン + `24:32` のような残り時間 |
| 一時停止 | アイコンのみ |
| 完了 | アイコンのみ |

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

## GitHub Release

`v` で始まるタグをpushすると、Tauri buildの成功後にGitHub Releaseを自動作成し、`ONE-macos.zip` をRelease assetとして添付します。再実行時は既存ReleaseのZIPを上書きするため、同じタグでworkflowを再実行しても復旧できます。

タグのバージョンは `src-tauri/tauri.conf.json` の `version` と一致している必要があります。たとえば現在のアプリバージョンが `0.1.0` なら次のようにします。

```sh
git tag v0.1.0
git push origin v0.1.0
```

実行後はGitHubのReleasesから `ONE-macos.zip` を直接取得できます。次のバージョンを出すときは、先に `tauri.conf.json` の `version` を更新してから対応するタグを作成します。

## 保存領域

タイマー、進捗、設定、復旧用データはWebViewの `localStorage` に保存します。

Tauriの保存領域はSafari / Chrome / Webデプロイとは別です。別環境へ記録を移す場合はONEのJSONバックアップ / 復元を利用します。

## セキュリティ境界

- main windowのTauri capabilityは `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- frontendのCSPは `index.html` 側で維持
- frontendからRustへのcommandはTray title更新に限定
- RustからfrontendへのTray操作は固定されたtimer action eventだけを送る
- npmは `package-lock.json`、Rustは `Cargo.lock` をCIで強制
- GitHub Actionsの外部Actionはcommit SHAに固定
- Release作成時だけ専用jobへ `contents: write` を付与し、通常のbuild jobは `contents: read` のままにする

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

### メニューバーは最小操作に留める

メニューバーから全機能を操作できるようにはしません。プリセット選択や詳細設定などはメインウィンドウへ集約し、メニューバー側は開く・開始/再開・一時停止・リセット・終了だけを基本とします。

今後AIが機能追加を検討するときも、メニューバーメニューへ項目を増やす場合は「毎回すぐ使う操作か」を基準にし、重複機能を安易に追加しないでください。

## 現時点で未対応

個人利用を前提として、次はまだ必須にしていません。

- DMG配布
- Apple Developer証明書によるコード署名
- notarization
