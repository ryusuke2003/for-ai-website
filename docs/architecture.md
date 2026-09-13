# ONE アーキテクチャ

ONE は React / Vite / Tailwind CSS をフロントエンドの正本とし、同じUIをブラウザ版と Tauri v2 のmacOSデスクトップ版で利用します。

vanilla JavaScript から React への移行は完了しています。この文書は移行履歴ではなく、現在の責務と保守時に守る境界を記録します。

## 技術構成

- React 19.3.0
- React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3
- Tauri v2
- Vitest + React Testing Library
- `localStorage`

バックエンド、アカウント、外部API、解析SDKはありません。

## ディレクトリ

```text
src/
├── App.jsx
├── main.jsx
├── tailwind.css
├── desktop/
│   ├── trayTimerSync.js
│   └── trayTimerSync.test.js
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
├── Cargo.toml
├── Cargo.lock
├── tauri.conf.json
├── capabilities/default.json
├── icons/
└── src/lib.rs
```

## タイマー境界

### `timerStateGuard.js`

`one.timer.v1` の保存形式を検証します。時間範囲、残り秒数、実行状態、終了時刻、未記録完了状態、完了日などを信頼せずに検証します。

### `timerStore.js`

タイマー状態の正本です。

- 保存値の読込 / 保存
- 開始 / 一時停止 / リセット / 再開
- tickと0秒完了
- 再読み込み復元
- 別タブからのアイドル時間同期
- 完了状態の保持

React UIは `useTimerState()` で購読し、操作は `timerActions` を利用します。

## 複数タブ調停

`tabGuard.js` は、別タブ所有中の開始拒否、未記録完了のclaim、二重記録 / 二重破棄防止、タブセッションIDなどを担当します。

`localStorage` はトランザクションではないため、保存後の読み戻しや利用可能な場合の Web Locks を組み合わせて競合を抑えます。

## 進捗とバックアップ

`progressStore.js` は累計と最大90日の日次履歴を管理し、`progressInsights.js` が今週、連続日、7日グラフ、30日アクティビティなどの派生値を計算します。

`useBackupControl.js` は version 1 JSON の検証、100KB上限、復元前退避、ロールバック、1世代Undoを担当します。

## テーマとCSS

`ThemeSwitcher.jsx` がテーマ設定を管理し、`public/theme-bootstrap.js` は React mount 前に保存済みテーマだけを反映して初期描画のちらつきを防ぎます。

`src/tailwind.css` に Tailwind utilities、テーマ変数、focus-visible、reduced-motion、progress表示、集中表示に必要な共通CSSを集約します。

## macOS / Tauri 境界

`src-tauri/src/lib.rs` はmacOSデスクトップ固有機能を担当します。

- メニューバーのTray Icon生成
- 左クリックによるメインウィンドウ表示 / 非表示
- 右クリックメニューの「ONEを表示 / 隠す」「ONEを終了」
- 閉じるボタンで終了せずウィンドウを非表示
- frontendから受け取ったタイマー表示文字列をTray titleへ反映

`src/desktop/trayTimerSync.js` はブラウザ / Tauri の境界です。Tauri実行時だけ `timerStore` を購読し、次の表示をRust側へ送ります。

- 実行中: `24:32`
- 一時停止: `⏸ 24:32`
- 待機中: `ONE`
- 完了: `00:00`

ブラウザ実行時はTauri APIを呼びません。

## セキュリティ境界

- CSPは `default-src 'none'` を基準に必要なローカル資産だけを許可
- Tauri capabilityはmain windowに対する `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- `localStorage.clear()` は使わず、ONEの既知キーだけを削除
- 保存値は型、サイズ、範囲、日付整合性を検証
- GitHub Actionsの外部Actionはcommit SHAに固定
- npm / CargoともlockfileをCIで強制

## テスト方針

React UIとhookの利用者向け挙動は Vitest + React Testing Library で検証します。

Python / Nodeの検査は、CSP、保存形式、サイズ上限、保存順序、複数タブ境界、秘密情報混入防止など、静的検査に向く領域へ限定します。

## CI

- `Quality checks`: Python / Nodeによる静的・境界検査
- `Frontend build`: `npm ci` → Vitest / RTL → audit → Vite build
- `Tauri build`: `npm ci` + `Cargo.lock --locked` → macOS `.app` bundle → ZIP artifact

Tauri artifactはGitHub Actionsに `ONE-macos-app` として7日間保存します。
