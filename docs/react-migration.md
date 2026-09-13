# React 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、画面単位で React へ移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- `src/main.jsx` を React エントリーポイントとして使用
- Hero / Footer / ThemeSwitcher に加えて、タイマーの主操作（開始・一時停止・リセット・集中表示）を React 管理へ移行
- 初回描画のちらつきを防ぐ `theme-bootstrap.js` はCSSより前に残す
- タイマーの状態管理・保存・タブ間調停はまだ既存の vanilla JavaScript を正とし、React UI とは一時的なブリッジで接続する

## 移行順

1. **表示専用領域** — Hero / Footer（完了）
2. **表示テーマ** — ThemeSwitcher と保存・別タブ同期（完了）
3. **タイマー操作UI**
   - 3A: 開始・一時停止 / リセット / 集中表示（この段階）
   - 3B: 時間プリセット / 自由設定 / タイマー表示・進捗
4. **集中記録・統計UI** — 回数、目標、7日/30日の可視化
5. **バックアップ・データ削除UI**
6. 最後に、残ったvanilla JavaScriptの状態管理をReact側へ統合する

## テーマ移行の境界

React版 `ThemeSwitcher` が、テーマ選択、`one.theme.v1` の保存確認、別タブの `storage` 同期、タブ復帰時の再同期を担当します。

一方、ページ描画前に保存済みテーマを適用して色のちらつきを防ぐ処理だけは `theme-bootstrap.js` に残します。これはReactの起動を待つと初回描画が先に発生するためです。

## タイマー主操作の移行境界

`TimerControls` は、開始・一時停止、リセット、集中表示の3ボタンをReactで描画します。ただし今回の段階ではタイマーの状態機械そのものは `app.js`、複数タブの排他制御は `tab-guard.js` に残します。

Vite経由では `react-timer-controls-bridge.js` が、Reactの操作を既存ボタンへ委譲し、既存側で変化したラベル・disabled・`aria-pressed` をReactへ同期します。これにより、保存形式やタブ間調停を同時に書き換えずにUIだけを先に移行できます。

Viteを通さず `index.html` を開いた場合は従来のボタンがそのまま残り、ブリッジは動作しません。

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存のDOM ID・アクセシビリティ・保存形式を必要以上に同時変更しない
- タイマー状態や保存形式は、UI移行とは別に互換性を維持する
- Reactへ移した領域でも `dangerouslySetInnerHTML` は使わない
- 各段階で既存Quality checksとVite production buildを通す
- npm依存関係はCIの `npm audit --audit-level=moderate` で継続監査する

Reactへ移した領域も、Viteを通さない場合に最低限の表示が残るよう `index.html` にフォールバックHTMLを置きます。Vite経由では `createRoot()` が同じ領域をReact管理へ置き換えます。
