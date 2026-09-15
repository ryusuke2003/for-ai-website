<div align="center">
  <img src="src-tauri/icons/icon.png" width="88" alt="タイマーのアプリアイコン" />
  <h1>タイマー</h1>
  <p>
    集中時間を決めて、記録して、今日の予定まで組み立てる<br />
    ローカルファーストなタイマー / Todo アプリ。
  </p>
  <p><strong>React 19 · Vite 8 · Tailwind CSS 4 · Tauri v2</strong></p>
</div>

## Preview

![タイマーアプリの画面プレビュー](./docs/assets/app-preview.jpg)

## このアプリについて

ブラウザと macOS デスクトップの両方で使える、シンプルな集中タイマーです。
集中回数の記録・可視化に加えて、5分刻みの Todo 時間割を同じアプリ内で管理できます。

- バックエンドなし / アカウント登録なし
- 外部 API・解析ツール・Cookie なし
- データは端末の `localStorage` に保存
- ブラウザ版 + Tauri v2 macOS デスクトップ版
- ライト / ダーク / 自動テーマ

## 主な機能

| タイマー | Todo | macOS デスクトップ |
| --- | --- | --- |
| 5 / 25 / 50分 + 1〜180分の自由設定 | 5分刻みの時間割 | メニューバー常駐 |
| 開始 / 一時停止 / 再開 / リセット | ドラッグ&ドロップで予定を配置 | Trayからタイマー / Todoを操作 |
| 集中表示、完了音、通知、Wake Lock | テンプレート保存 | 実行中は残り時間をメニューバー表示 |
| 今日 / 今週 / 連続日 / 累計を記録 | 重複を避けて予定を自動調整 | ログイン時の自動起動 |
| 7日グラフ / 30日アクティビティ | 日付変更時に前日の予定を自動クリア | ウィンドウを閉じても常駐 |

そのほか、JSONバックアップ / 復元、1世代Undo、複数タブ同期と二重記録防止にも対応しています。

## すぐ試す

Node.js `22.22.2` 以上を使用します。

```sh
npm ci
npm run dev
```

`http://127.0.0.1:5173` を開くとブラウザ版を確認できます。

テストとproduction build:

```sh
npm test
npm run build
```

## キーボード操作

| キー | 操作 |
| --- | --- |
| `Space` | 開始 / 一時停止 |
| `F` | 集中表示の切り替え |
| `Escape` | 集中表示を解除 |
| `Enter` | 自由設定・今日の目標の入力を確定 |

入力欄やボタン操作中、IME変換中、修飾キー付き入力ではグローバルショートカットを発火させません。

## 保存とプライバシー

タイマー状態、集中履歴、今日の目標、テーマ、通知設定、Todo、Todoテンプレートなどはブラウザ / WebView の `localStorage` に保存します。

Safari、Chrome、Tauriなどの実行環境ごとに保存領域は分かれます。必要な記録はJSONバックアップで移行できます。サーバーへの同期や解析用の外部送信は行いません。

日次履歴は最大90日分です。データ削除では `localStorage.clear()` を使わず、このアプリが利用する既知キーだけを対象にします。

## macOS デスクトップ版

Rust toolchain と Xcode Command Line Tools を用意した上で起動します。

```sh
npm ci
npm run tauri dev
```

通常起動すると、次回ログイン用のLaunchAgentを `~/Library/LaunchAgents/com.ryusuke2003.one.autostart.plist` に登録します。ログインから起動した場合は通常ウィンドウを表示せず、メニューバーのTrayだけを起動します。

配布版は `/Applications/タイマー.app` に置いてから一度起動する想定です。詳しくは [`docs/tauri-desktop.md`](docs/tauri-desktop.md) を参照してください。

---

<details>
<summary><strong>アーキテクチャ</strong></summary>

React / Vite / Tailwind CSS がフロントエンドの正本です。macOS固有処理は `src/desktop/` と `src-tauri/` に閉じ込めています。

```text
src/
├── App.jsx
├── main.jsx
├── tailwind.css
├── components/
├── desktop/
├── storage/
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
└── src/
```

主な責務:

- `timerStore.js`: タイマー状態、開始・停止、再読み込み復元、保存
- `timerStateGuard.js`: タイマー保存形式の検証
- `tabGuard.js`: 複数タブ所有権と二重記録防止
- `progressStore.js`: 累計・日次履歴・別タブ同期
- `progressInsights.js`: 今週、連続日、7日 / 30日集計
- `useBackupControl.js`: JSONバックアップ、復元、Undo、ロールバック
- `src/desktop/`: TrayとWeb UIの連携
- `src-tauri/src/lib.rs`: macOS Tray、自動起動、Tauri command / event

詳細: [`docs/architecture.md`](docs/architecture.md)

</details>

<details>
<summary><strong>セキュリティ上の前提</strong></summary>

- CSPは `default-src 'none'` を基準に必要なローカルスクリプト / CSSだけを許可
- 外部通信、画像、iframe、フォーム送信、workerを既定で許可しない
- Tauri capabilityはmain window向け `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- 保存値はサイズ・型・範囲・日付の整合性を検証
- タブセッションIDはWeb Cryptoを優先して生成
- npm / CargoはlockfileをCIで強制

</details>

<details>
<summary><strong>テスト / CI</strong></summary>

利用者向けの挙動は Vitest + React Testing Library で検証します。

```sh
npm test
npm run test:watch
```

Pythonの `scripts/*_checks.py` は、CSPや移行後のアーキテクチャ境界など、リポジトリ横断の静的チェックに限定して使用しています。

GitHub Actionsでは主に次を確認します。

1. **Quality checks** — セキュリティ / アーキテクチャ境界とJavaScript構文
2. **Frontend build** — Vitest / RTL、`npm audit`、Vite build
3. **Tauri build** — `Cargo.lock --locked` でmacOS `.app` をビルド

詳細: [`docs/testing-strategy.md`](docs/testing-strategy.md)

</details>

<details>
<summary><strong>GitHub Release / バージョン更新</strong></summary>

`v` で始まるタグをpushすると、GitHub ActionsがmacOS `.app` をビルドし、ZIPをGitHub Releaseへ添付します。

patch版を上げる場合:

```sh
npm run version:patch
```

`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` のバージョンをまとめて同期します。

詳細: [`docs/release-versioning.md`](docs/release-versioning.md)

</details>

## Repository

このリポジトリは、AIを使って小さなWebアプリを作り、レビューと改善を繰り返すための公開リポジトリとして始まりました。現在はタイマー / Todoアプリを継続的に改善しています。
