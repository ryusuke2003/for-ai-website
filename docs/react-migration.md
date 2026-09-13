# React 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、画面単位で React へ移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- `src/main.jsx` を React エントリーポイントとして使用
- Hero / Footer に加えて ThemeSwitcher を React 管理へ移行済み
- 初回描画のちらつきを防ぐ `theme-bootstrap.js` はCSSより前に残す
- `theme.js` は `#react-theme-root` がない場合だけ動く非React環境向け互換処理として残す

## 移行順

1. **表示専用領域** — Hero / Footer（完了）
2. **表示テーマ** — ThemeSwitcher と保存・別タブ同期（この段階）
3. **タイマー操作UI** — 時間選択、開始・一時停止、集中表示
4. **集中記録・統計UI** — 回数、目標、7日/30日の可視化
5. **バックアップ・データ削除UI**
6. 最後に、残ったvanilla JavaScriptの状態管理をReact側へ統合する

## テーマ移行の境界

React版 `ThemeSwitcher` が、テーマ選択、`one.theme.v1` の保存確認、別タブの `storage` 同期、タブ復帰時の再同期を担当します。

一方、ページ描画前に保存済みテーマを適用して色のちらつきを防ぐ処理だけは `theme-bootstrap.js` に残します。これはReactの起動を待つと初回描画が先に発生するためです。

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存のDOM ID・アクセシビリティ・保存形式を必要以上に同時変更しない
- タイマー状態や保存形式は、UI移行とは別に互換性を維持する
- Reactへ移した領域でも `dangerouslySetInnerHTML` は使わない
- 各段階で既存Quality checksとVite production buildを通す
- npm依存関係はCIの `npm audit --audit-level=moderate` で継続監査する

Reactへ移した領域も、Viteを通さない場合に最低限の表示が残るよう `index.html` にフォールバックHTMLを置きます。Vite経由では `createRoot()` が同じ領域をReact管理へ置き換えます。
