# タイマー アーキテクチャ

タイマーは React / Vite / Tailwind CSS をフロントエンドの正本とし、同じUIをブラウザ版と Tauri v2 のmacOSデスクトップ版で利用します。

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
│   ├── AppFooter.jsx
│   ├── AppNavigation.jsx
│   └── ThemeSwitcher.jsx
└── features/
    ├── timer/
    │   ├── TimerControls.jsx
    │   ├── TimerDisplay.jsx
    │   ├── TimerSettings.jsx
    │   ├── TrayTimerPanel.jsx
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
    ├── todo/
    │   ├── TodoPage.jsx
    │   ├── TodoPageWithActions.jsx
    │   ├── todoSchedule.js
    │   ├── todoLiveDragPreview.js
    │   ├── resetTodoSchedule.js
    │   ├── trayTimelineMarks.js
    │   └── useCurrentMinute.js
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
│   └── icon.png
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

## Todo境界

Todoは `TodoPage.jsx` を中心に、時間割・テンプレート・ドラッグ&ドロップをReactで管理します。

- `todoSchedule.js`: Todo同士を重複させず、衝突時に既存Todoを連鎖的に押し出す配置計算
- `todoLiveDragPreview.js`: ドラッグ中の押し出しプレビュー
- `resetTodoSchedule.js`: 今日の予定のリセットと1世代復元
- `trayTimelineMarks.js`: Tray Todo用の時刻目盛り計算
- `useCurrentMinute.js`: Tray Todoを開きっぱなしにしても分境界ごとに現在時刻を更新

Todoとテンプレートは `localStorage` に保存し、TrayのコンパクトTodoも同じ保存領域を参照します。

## 保存領域の初期確認

`src/storage/useStorageHealthProbe.js` はアプリ起動時に `localStorage` の読み書き可否を確認し、旧タスクキー `one.task` / `one.taskDate.v1` を掃除します。

この処理はUIを描画しません。保存状態の説明文や `aria-live` は持たず、利用不可またはlegacy cleanup失敗時だけ `one:storage-error` イベントを通知します。

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
- 左クリックによるコンパクトウィンドウ表示 / 非表示
- 右クリックメニューの `タイマーを終了`
- 閉じるボタンで終了せずウィンドウを非表示
- frontendから受け取ったタイマー表示文字列をTray titleへ反映
- 通常サイズウィンドウへの復帰時に装飾・サイズ・位置を戻す
- `~/Library/LaunchAgents` へのログイン時自動起動登録
- `--autostart` 起動時は通常ウィンドウを表示せずTrayだけを常駐

ログイン時自動起動では `com.ryusuke2003.one.autostart.plist` をユーザー領域に作成し、`/usr/bin/open -b com.ryusuke2003.one --args --autostart` で同じbundle identifierのアプリを起動します。管理者権限や追加のTauri plugin権限は使いません。

`src/desktop/trayTimerSync.js` はTauri実行時だけ `timerStore` を購読します。タイマー実行中は `24:32` のような残り時間をRust側へ送り、待機中・一時停止・完了時は空文字列を送り、Trayはアイコンのみ表示します。ブラウザ実行時はTauri APIを呼びません。

`src/desktop/trayNavigation.js` は `#tray-timer` / `#tray-todo` の切り替えを担当します。Trayを隠しただけなら同じWebViewが生き続けるため、再表示時は直前のコンパクト画面を維持します。直前のTray画面がない場合はTodoを初期表示します。

`src/desktop/trayWindow.js` はコンパクト表示から通常ウィンドウへ戻るための `open_full_window` command呼び出しを担当します。

## リリース版数

Tauriアプリの版数は `src-tauri/tauri.conf.json` を正本とします。patch版更新は `npm run version:patch` で行い、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock` を一括同期します。詳細は [`release-versioning.md`](release-versioning.md) を参照してください。

## セキュリティ境界

- CSPは `default-src 'none'` を基準に必要なローカル資産だけを許可
- Tauri capabilityはmain windowに対する `core:default` のみ
- filesystem / shell / HTTP / opener等のTauri plugin権限は追加しない
- ログイン時自動起動はユーザー自身の `~/Library/LaunchAgents` だけを書き換え、管理者権限を要求しない
- `localStorage.clear()` は使わず、アプリの既知キーだけを削除
- 保存値は型、サイズ、範囲、日付整合性を検証
- GitHub Actionsの外部Actionはcommit SHAに固定
- npm / CargoともlockfileをCIで強制

`one.timer.v1`、`one:tray-*`、`--one-*`、`com.ryusuke2003.one` などの `one` を含む内部識別子は互換性維持のため残します。

## テスト方針

React UI、hook、store、ブラウザAPI連携などの実行時挙動は Vitest + React Testing Library で検証します。

Python検査は、CSP、静的資産、Tailwind移行境界、focus-visible、タイマー移行境界、秘密情報混入防止など、リポジトリ全体の静的・アーキテクチャ境界に限定します。詳細は [`testing-strategy.md`](testing-strategy.md) を参照してください。

## CI

- `Quality checks`: Pythonによる静的・境界検査 + JavaScript構文確認
- `Frontend build`: `npm ci` → Vitest / RTL → audit → Vite build
- `Tauri build`: `npm ci` + `Cargo.lock --locked` → macOS `.app` bundle → ZIP artifact

Tauri artifactはGitHub Actionsに `timer-macos-app` として7日間保存します。`v*` タグでは `timer-macos.zip` をGitHub Releaseにも添付します。
