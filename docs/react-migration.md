# React 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、画面単位で React へ移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- `src/main.jsx` を React エントリーポイントとして使用
- 既存の静的HTMLを残し、移行済みの表示専用領域は `hydrateRoot()` で段階的にReact管理へ移す

## 移行順

1. **表示専用領域** — Hero / Footer（この段階）
2. **表示テーマ** — ThemeSwitcher と保存・別タブ同期
3. **タイマー操作UI** — 時間選択、開始・一時停止、集中表示
4. **集中記録・統計UI** — 回数、目標、7日/30日の可視化
5. **バックアップ・データ削除UI**
6. 最後に、残ったvanilla JavaScriptの状態管理をReact側へ統合する

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存のDOM ID・アクセシビリティ・保存形式を必要以上に同時変更しない
- タイマー状態や保存形式は、UI移行とは別に互換性を維持する
- Reactへ移した領域でも `dangerouslySetInnerHTML` は使わない
- 各段階で既存Quality checksとVite production buildを通す
- npm依存関係はCIの `npm audit --audit-level=moderate` で継続監査する

表示専用領域は、JavaScriptが無効またはViteを通さない場合にも最低限のHTMLが残るよう、`index.html` のフォールバックHTMLとReactコンポーネントを一致させてハイドレーションします。
