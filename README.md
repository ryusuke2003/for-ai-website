# for-ai-website

ChatGPT が小さな Web アプリを作り、レビューと改善を繰り返していくための公開リポジトリです。

## ONE

ONE は、集中時間を決めてタイマーを動かし、完了した集中を記録・可視化するアプリです。

- React 19 + Vite 8
- Tailwind CSS 4
- ブラウザ版 + Tauri v2 デスクトップ版
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
- ライト / ダーク / 自動テーマ
- 完了音、完了通知、Screen Wake Lock
- JSONバックアップ / 復元 / 1世代Undo
- ONEが利用する端末データだけを対象にした削除
- 同一オリジン内の複数タブ同期と二重記録防止

### キーボード

| キー | 操作 |
| --- | --- |
| Space | 開始 / 一時停止 |
| F | 集中表示の切り替え |
| Escape | 集中表示を解除 |
| Enter | 自由設定・今日の目標の入力を確定 |

入力欄やボタン操作中、IME変換中、修飾キー付き入力ではグローバルショートカットを発火させません。

## 保存について

タイマー状態、累計・日次履歴、今日の目標、テーマ、完了通知、Wake Lockなどはブラウザ / WebView の `localStorage` に保存します。

`localStorage` はサーバー同期ではないため、Safari、Chrome、Tauri、Vercelなどの実行環境ごとにデータは分かれます。必要な記録はJSONバックアップで移行できます。

日次履歴は最大90日分です。バックアップには累計回数、日次履歴、選択中のタイマー時間を含め、実行中タイマーやUI設定などの一時状態は含めません。

## 現在のアーキテクチャ

vanilla JavaScript から React への移行は完了しています。旧 `app.js`、`timer-bootstrap.js`、`stats.js`、`shortcuts.js`、`legacy/interop/*` などは削除済みです。

```text
src/
├── App.jsx
├── main.jsx
├── tailwind.css
├── test/
│   └── setup.js
├── components/
│   ├── AppFooter.jsx
│   ├── HeroIntro.jsx
│   ├── StorageHealthStatus.jsx
│   └── ThemeSwitcher.jsx
└── features/
    ├── timer/
    │   ├── TimerControls.jsx
    │   ├── TimerDisplay.jsx
    │   ├── TimerSettings.jsx
    │   ├── timerStore.js
    │   ├── timerStateGuard.js
    │   ├── tabGuard.js
    │   └── use*.js
    ├── progress/
    │   ├── ProgressOverview.jsx
    │   ├── ProgressDetails.jsx
    │   ├── progressStore.js
    │   ├── progressInsights.js
    │   └── use*.js
    └── backup/
        ├── BackupPanel.jsx
        ├── useBackupControl.js
        └── usePrivacyResetControl.js

public/
└── theme-bootstrap.js

src-tauri/
└── Tauri v2 desktop shell
```

### 役割

- `timerStore.js`: タイマー状態、開始・停止、再読み込み復元、保存
- `timerStateGuard.js`: `one.timer.v1` の保存形式検証
- `tabGuard.js`: 複数タブ所有権、未記録完了のclaim、二重記録防止
- `progressStore.js`: 累計・90日履歴・別タブ同期
- `progressInsights.js`: 今週、連続日、7日 / 30日集計
- `useBackupControl.js`: JSONバックアップ、復元、Undo、ロールバック
- `ThemeSwitcher.jsx`: テーマ選択と保存
- `public/theme-bootstrap.js`: React起動前に保存テーマを反映し、テーマのちらつきを防止
- `src/tailwind.css`: Tailwind utilities、テーマ変数、focus / progress / 集中表示の共通CSS

詳細は [`docs/react-migration.md`](docs/react-migration.md) を参照してください。

## セキュリティ上の前提

- CSPは `default-src 'none'` を基準に、必要なローカルスクリプト / CSSだけを許可
- 外部通信、画像、iframe、フォーム送信、workerを既定で許可しない
- 保存値はサイズ・型・範囲・日付の整合性を検証
- `localStorage.clear()` は使用せず、ONEの既知キーだけを削除
- タブセッションIDはWeb Cryptoを優先して生成
- 保存後は必要な箇所で読み戻し確認を行う
- 保存障害時は現在タブの利用を可能な範囲で継続し、JSON救出へ案内

## ローカル開発

Node.js 22.12以上を使用します。

```sh
npm install
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

Pythonの `scripts/*_checks.py` は、CSP、保存形式、サイズ上限、複数タブ保存順序など、DOMを描画する必要がない静的・境界検査を中心に残しています。React UIの文字列や実装順序を直接検査するPythonテストは段階的にVitest / React Testing Libraryへ移しています。

### production build

```sh
npm run build
npm run preview
```

## Tauri デスクトップ版

macOSではRust toolchainとXcode Command Line Toolsを用意したうえで、既存React/Viteをそのままデスクトップアプリとして起動できます。

```sh
npm run tauri dev
```

ビルド:

```sh
npm run tauri build
```

詳細は [`docs/tauri-desktop.md`](docs/tauri-desktop.md) を参照してください。

## CI

GitHub Actionsでは大きく3系統を確認します。

1. **Quality checks**: Python / Nodeによる保存形式・セキュリティ・境界条件の検査
2. **Frontend build**: npm install → Vitest / RTL → npm audit → Vite build
3. **Tauri build**: macOS向けTauri build

新しいReact UIの振る舞いは、可能な限り「ソースに特定文字列があるか」ではなく「利用者が操作した結果どうなるか」でテストします。
