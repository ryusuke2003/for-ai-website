# React / Tailwind 移行の完了状態

ONE は vanilla JavaScript から React / Vite / Tailwind CSS へ段階移行し、現在は React module を正本とする構成です。

この文書は移行手順ではなく、**移行後に守る境界と現在の責務**を記録します。

## 完了したもの

- 単一 `#root` + `src/main.jsx` からReactをmount
- timer / progress / backupを `src/features/*` へ分離
- `app.js`、`timer-bootstrap.js`、`stats.js`、`shortcuts.js` 等のclassic runtimeを削除
- `legacy/interop/*` とglobal互換APIを削除
- タイマー保存値検証を `timerStateGuard.js` へmodule化
- 複数タブ調停を `tabGuard.js` へmodule化
- 累計・履歴を `progressStore.js` へ集約
- Tailwind CSS 4へUIを移行
- `styles.css` / `timer-progress.css` を削除
- テーマ変数、進捗バー、focus-visible、集中表示CSSを `src/tailwind.css` へ統合
- `theme-bootstrap.js` を `public/` へ移し、Vite標準のpublic assetコピーを利用
- classic scriptを手動emitする独自Vite pluginを削除

## 現在の技術構成

- React 19.3.0
- React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3
- Tauri v2
- Vitest + React Testing Library
- localStorage

バックエンド、アカウント、外部API、解析SDKはありません。

## ディレクトリ

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
    │   ├── useTimerState.js
    │   ├── useTimerShortcuts.js
    │   ├── useFocusModeControl.js
    │   ├── useCustomTimerControl.js
    │   ├── useCompletionEffectsControl.js
    │   └── useWakeLockControl.js
    ├── progress/
    │   ├── ProgressOverview.jsx
    │   ├── ProgressDetails.jsx
    │   ├── progressStore.js
    │   ├── progressInsights.js
    │   ├── useDailyGoalControl.js
    │   └── useProgressOverviewState.js
    └── backup/
        ├── BackupPanel.jsx
        ├── useBackupControl.js
        └── usePrivacyResetControl.js

public/
└── theme-bootstrap.js

src-tauri/
└── Tauri desktop shell / config
```

## タイマー境界

### `timerStateGuard.js`

`one.timer.v1` の保存形式を検証します。

- 最大10KB
- 1〜180分
- `remainingSeconds`
- `running` / `endAt`
- 未記録完了状態
- 完了日の整合性
- 旧形式の完了状態との互換読込

### `timerStore.js`

- 保存値の読込 / 保存
- 開始 / 一時停止 / リセット / 再開
- tickと0秒完了
- 再読み込み復元
- 完了日の保持
- 別タブからのアイドル時間同期
- 端末データ削除前のinterval停止

React UIは `useTimerState()` でstoreを購読し、操作は `timerActions` を直接利用します。

## 複数タブ調停

`tabGuard.js` は次を担当します。

- Web CryptoによるタブセッションID
- 別タブ所有中のタイマー開始拒否
- 古いタブからの再開拒否
- 未記録完了のclaim
- 二重記録 / 二重破棄の防止
- 完了消費と保存結果の照合
- localStorage障害時の単一タブフォールバック

通常のlocalStorage照合は完全なトランザクションではないため、必要な箇所では保存後の読み戻しやWeb Locksの利用可否確認を組み合わせます。

## 進捗

`progressStore.js` は `one.doneCount` と `one.history.v1` を管理します。

- 最大90日の履歴
- 保存値の型・サイズ検証
- 別タブstorageイベント同期
- BFCache / 前面復帰時の再読込
- 集中完了後のメモリ更新
- 累計 / 履歴の保存後読み戻し

`progressInsights.js` は今週、連続日、7日グラフ、30日アクティビティなどの派生値を計算します。

## バックアップ

`useBackupControl.js` は次を担当します。

- version 1 JSONの検証
- 100KB上限
- 累計、最大90日の日次履歴、タイマー時間の書き出し
- 保存障害時の救出用JSON
- 復元前の1世代退避
- 復元中の競合再確認
- 保存失敗時ロールバック
- 条件付き1世代Undo

backupからは `progressActions` / `timerActions` / `timerStateGuard` / `tabCoordination` をmodule importします。

## テーマとCSS

React UIのテーマ変更は `ThemeSwitcher.jsx` が担当します。

`public/theme-bootstrap.js` はReact mount前に保存済みテーマだけを同期適用し、初期描画のテーマちらつきを防ぎます。通常のアプリロジックをclassic scriptへ戻すためのものではありません。

`src/tailwind.css` は以下を一元管理します。

- Tailwind theme / utilities
- ライト / ダーク共通CSS変数
- OS設定へ追従する自動ダークテーマ
- focus-visible
- reduced-motion
- progress要素の共通表示
- 集中表示で必要なbody状態依存CSS

## テスト方針

### Vitest + React Testing Library

React UIやhookは、ソースコードの文字列ではなく**利用者から見た振る舞い**を優先して検証します。

例:

- テーマボタンを押すとDOMとlocalStorageが変わる
- 別タブのstorageイベントでテーマ表示が追従する
- Space / F / Escapeのショートカットが期待通り動く
- 入力欄、IME、修飾キー、キーリピートでは誤発火しない
- TimerControlsのラベル、disabled状態、操作先が正しい

### Python / Nodeの静的検査

Python検査は今後、次のような**静的境界に向くもの**へ絞ります。

- CSP
- 保存形式 / サイズ上限
- 保存順序
- 複数タブの安全条件
- バックアップ形式
- セキュリティ上消してはいけないガード
- 秘密情報混入防止

「特定class文字列がある」「関数呼び出しがソース上でこの順番にある」といったUI実装詳細の検査は、可能な範囲でVitest / React Testing Libraryへ移します。

## CI

- `Quality checks`: Python / Nodeの静的・境界検査
- `Frontend build`: dependencies → Vitest / RTL → audit → Vite build
- `Tauri build`: macOS向けdesktop build

## 今後の整理候補

React / Tailwind移行そのものは完了扱いです。以降は移行ではなく保守性改善として進めます。

1. 残るPython文字列検査を、挙動テストへ向くものから順に移行
2. `useBackupControl.js` と `useCompletionEffectsControl.js` の責務分割
3. package-lockとCI install方針を `npm ci` ベースへ統一
4. Tauriのアイコン / bundle metadata / 配布署名の整備
