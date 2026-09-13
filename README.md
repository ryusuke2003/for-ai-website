# for-ai-website

ChatGPT が小さな Web アプリを作り、レビューと改善を繰り返していくための公開リポジトリです。

## タイマー

タイマーは、集中時間を決めてタイマーを動かし、完了した集中を記録・可視化するアプリです。

- React 19 + Vite 8
- Tailwind CSS 4
- ブラウザ版 + Tauri v2 macOSデスクトップ版
- バックエンドなし
- アカウント登録なし
- 記録は `localStorage` に保存
- 外部API・解析ツール・Cookieなし

## 主な機能

- 5 / 25 / 50分のクイック設定と1〜180分の自由設定
- 開始 / 一時停止 / 再開 / リセット
- 残り時間、進捗、終了予定時刻、タブタイトルの同期
- 集中表示
- 完了した集中の記録 / 破棄
- 今日 / 今週 / 連続日 / 累計
- 直近7日の棒グラフと30日のアクティビティ表示
- 1〜12回の今日の目標
- 5分刻みのTodo時間割、テンプレート、ドラッグ&ドロップ
- Todoの重複回避とドラッグ中の押し出しプレビュー
- 今日の予定のリセット / 1世代復元
- ライト / ダーク / 自動テーマ
- 完了音、完了通知、Screen Wake Lock
- JSONバックアップ / 復元 / 1世代Undo
- このアプリが利用する端末データだけを対象にした削除
- 同一オリジン内の複数タブ同期と二重記録防止
- macOSメニューバー常駐
- macOSログイン時の自動起動（通常ウィンドウは開かずTrayだけ常駐）
- Trayのコンパクト画面からタイマー / Todoの確認・操作
- メニューバーにタイマー実行中の残り時間を表示

### macOSメニューバー表示

Trayは通常時はアイコンだけを表示し、タイマー実行中だけ残り時間を横に表示します。

| 状態 | 表示 |
| --- | --- |
| 待機中 | アイコンのみ |
| 実行中 | アイコン + `24:32` のような残り時間 |
| 一時停止 | アイコンのみ |
| 完了 | アイコンのみ |

Trayアイコンを左クリックすると、メニューバー直下にコンパクトなタイマー / Todo画面を表示します。Trayを隠して再表示した場合は直前に開いていたコンパクト画面を維持し、直前のTray画面がない場合はTodoを開きます。右クリックメニューは `タイマーを終了` だけです。ウィンドウの閉じるボタンではアプリ自体を終了せず、ウィンドウだけを隠して常駐を続けます。

macOS版を通常起動すると、次回ログイン用のLaunchAgentを `~/Library/LaunchAgents/com.ryusuke2003.one.autostart.plist` に登録します。ログインから起動した場合は通常ウィンドウを表示せず、メニューバーのTrayだけを起動します。安定して自動起動させるため、配布版は `/Applications/タイマー.app` に置いてから一度起動してください。

### キーボード

| キー | 操作 |
| --- | --- |
| Space | 開始 / 一時停止 |
| F | 集中表示の切り替え |
| Escape | 集中表示を解除 |
| Enter | 自由設定・今日の目標の入力を確定 |

入力欄やボタン操作中、IME変換中、修飾キー付き入力ではグローバルショートカットを発火させません。

## 保存について

タイマー状態、累計・日次履歴、今日の目標、テーマ、完了通知、Wake Lock、Todo、Todoテンプレートなどはブラウザ / WebView の `localStorage` に保存します。

`localStorage` はサーバー同期ではないため、Safari、Chrome、Tauri、Vercelなどの実行環境ごとにデータは分かれます。必要な記録はJSONバックアップで移行できます。

日次履歴は最大90日分です。バックアップには累計回数、日次履歴、選択中のタイマー時間を含め、実行中タイマーやUI設定などの一時状態は含めません。

## 現在のアーキテクチャ

React / Vite / Tailwind CSS がフロントエンドの正本です。macOS固有処理は `src/desktop/` と `src-tauri/` に閉じ込めています。

```text
src/
├── App.jsx
├── main.jsx
├── tailwind.css
├── desktop/
│   ├── trayNavigation.js
│   ├── trayNavigation.test.js
│   ├── trayTimerSync.js
│   ├── trayTimerSync.test.js
│   └── trayWindow.js
├── storage/
│   └── useStorageHealthProbe.js
├── test/
│   └── setup.js
├── components/
└── features/
    ├── timer/
    ├── progress/
    ├── todo/
    └── backup/

public/
└── theme-bootstrap.js

src-tauri/
├── Cargo.toml
├── Cargo.lock
├── tauri.conf.json
├── capabilities/default.json
├── icons/
│   └── icon.png
└── src/lib.rs
```

主な責務:

- `timerStore.js`: タイマー状態、開始・停止、再読み込み復元、保存
- `timerStateGuard.js`: `one.timer.v1` の保存形式検証
- `tabGuard.js`: 複数タブ所有権、未記録完了のclaim、二重記録防止
- `progressStore.js`: 累計・90日履歴・別タブ同期
- `progressInsights.js`: 今週、連続日、7日 / 30日集計
- `useBackupControl.js`: JSONバックアップ、復元、Undo、ロールバック
- `useCurrentMinute.js`: Tray Todoの現在時刻を分境界ごとに更新
- `useStorageHealthProbe.js`: `localStorage` の利用確認とlegacyタスクキーの掃除
- `src/desktop/trayTimerSync.js`: timerStoreとTauri Tray titleの同期
- `src/desktop/trayNavigation.js`: Trayコンパクト画面の遷移と再表示時の画面維持
- `src/desktop/trayWindow.js`: コンパクト表示から通常ウィンドウへの復帰
- `src-tauri/src/lib.rs`: macOS Tray、ログイン時自動起動、ウィンドウ常駐、Tauri command / event
- `public/theme-bootstrap.js`: React起動前のテーマ適用
- `src/tailwind.css`: Tailwind utilitiesと共通CSS

詳細は [`docs/architecture.md`](docs/architecture.md) を参照してください。

## セキュリティ上の前提

- CSPは `default-src 'none'` を基準に、必要なローカルスクリプト / CSSだけを許可
- 外部通信、画像、iframe、フォーム送信、workerを既定で許可しない
- Tauri capabilityはmain window向け `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- 保存値はサイズ・型・範囲・日付の整合性を検証
- `localStorage.clear()` は使用せず、既知キーだけを削除
- タブセッションIDはWeb Cryptoを優先して生成
- 保存後は必要な箇所で読み戻し確認を行う
- npm / CargoはlockfileをCIで強制

## ローカル開発

Node.js 22.22.2以上を使用します。

```sh
npm ci
npm run dev
```

通常は `http://127.0.0.1:5173` で開発サーバーが起動します。

### テスト

Reactの利用者向け挙動は Vitest + React Testing Library で検証します。

```sh
npm test
```

監視モード:

```sh
npm run test:watch
```

Pythonの `scripts/*_checks.py` は、CSPや移行後のアーキテクチャ境界など、DOMを描画する必要がない静的・境界検査を中心に残しています。テスト方針は [`docs/testing-strategy.md`](docs/testing-strategy.md) を参照してください。

### production build

```sh
npm run build
npm run preview
```

## Tauri デスクトップ版

macOSではRust toolchainとXcode Command Line Toolsを用意します。

```sh
npm ci
npm run tauri dev
```

lockfile準拠で `.app` をビルドする場合:

```sh
cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1 --no-deps > /dev/null
npm run tauri -- build --bundles app --no-sign -- --locked
```

詳細は [`docs/tauri-desktop.md`](docs/tauri-desktop.md) を参照してください。

## GitHub Release

`v` で始まるタグをpushすると、GitHub ActionsがmacOS `.app` をビルドして `timer-macos.zip` をGitHub Releaseへ添付します。タグのバージョンは `src-tauri/tauri.conf.json` の `version` と一致させます。

patch版を上げる場合は、Tauri設定・Cargo package・Cargo.lockを個別に編集せず次のコマンドを使います。

```sh
npm run version:patch
```

たとえば現在が `0.1.1` なら `0.1.2` へ更新し、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` をまとめて同期します。更新をPRでmainへマージし、CIが成功したあとに同じ版数のタグをpushしてください。

詳しい手順は [`docs/release-versioning.md`](docs/release-versioning.md) を参照してください。

## CI

GitHub Actionsでは3系統を確認します。

1. **Quality checks**: Pythonによるセキュリティ・アーキテクチャ境界検査 + JavaScript構文確認
2. **Frontend build**: `npm ci` → Vitest / RTL → npm audit → Vite build
3. **Tauri build**: `npm ci` + `Cargo.lock --locked` → macOS `.app` bundle → `timer-macos-app` ZIP artifact

Tauri artifactは7日間保存します。`v*` タグでは同じビルド成果物をGitHub Releaseにも添付します。新しいReact UIの振る舞いは、可能な限り「ソースに特定文字列があるか」ではなく「利用者が操作した結果どうなるか」でテストします。
