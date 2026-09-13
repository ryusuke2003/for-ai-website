# React 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、画面単位で React へ移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- `src/main.jsx` を React エントリーポイントとして使用
- Hero / Footer / ThemeSwitcher / タイマーUIに加えて、集中の記録・破棄と今日/今週/連続日/累計のサマリーを React 管理へ移行
- 初回描画のちらつきを防ぐ `theme-bootstrap.js` はCSSより前に残す
- タイマー・集中記録の状態管理、保存、タブ間調停はまだ既存の vanilla JavaScript を正とし、React UI とは一時的なブリッジで接続する
- React のマウントは `DOMContentLoaded` 後に行い、既存スクリプトがフォールバックDOMを初期化し終えてから置き換える

## 移行順

1. **表示専用領域** — Hero / Footer（完了）
2. **表示テーマ** — ThemeSwitcher と保存・別タブ同期（完了）
3. **タイマーUI**
   - 3A: 開始・一時停止 / リセット / 集中表示（完了）
   - 3B: 残り時間 / 進捗 / 状態 / 終了予定時刻（完了）
   - 3C: 時間プリセット / 自由設定 / 完了音・通知・画面維持（完了）
4. **集中記録・統計UI**
   - 4A: 記録 / 破棄、今日 / 今週 / 連続日 / 累計（この段階）
   - 4B: 今日の目標、直近7日 / 30日の可視化
5. **バックアップ・データ削除UI**
6. **状態管理のReact統合** — 残ったvanilla JavaScriptの状態管理をReact側へ統合する
7. **Tailwind CSS移行** — React移行完了後に、`styles.css` / `timer-progress.css` をReactコンポーネントのTailwind utilityへ段階移行し、最終的に旧CSSを削除する

## テーマ移行の境界

React版 `ThemeSwitcher` が、テーマ選択、`one.theme.v1` の保存確認、別タブの `storage` 同期、タブ復帰時の再同期を担当します。

一方、ページ描画前に保存済みテーマを適用して色のちらつきを防ぐ処理だけは `theme-bootstrap.js` に残します。これはReactの起動を待つと初回描画が先に発生するためです。

## タイマー主操作の移行境界

`TimerControls` は、開始・一時停止、リセット、集中表示の3ボタンをReactで描画します。ただしタイマーの状態機械そのものは `app.js`、複数タブの排他制御は `tab-guard.js` に残します。

Vite経由では `react-timer-controls-bridge.js` が、Reactの操作を既存ボタンへ委譲し、既存側で変化したラベル・disabled・`aria-pressed` をReactへ同期します。これにより、保存形式やタブ間調停を同時に書き換えずにUIだけを先に移行できます。

## タイマー表示の移行境界

`TimerDisplay` は残り時間、進捗バー、タイマー状態メッセージ、終了予定時刻をReactで描画します。

Vite経由では `react-timer-display-bridge.js` が、既存の `app.js` / `custom-timer.js` が更新するフォールバックDOMを監視し、その状態だけをReactへ渡します。タイマー計算・保存形式・document title更新はまだ既存実装を維持します。

## タイマー設定の移行境界

`TimerSettings` は、10/25/50分のプリセット、1〜180分の自由設定、完了音、完了通知、画面維持の操作と状態表示をReactで描画します。

Vite経由では `react-timer-settings-bridge.js` が、Reactの操作を既存の `app.js` / `custom-timer.js` / `completion-sound.js` / `wake-lock.js` に委譲します。既存側が更新した `disabled`、`aria-pressed`、ステータスメッセージ、別タブ同期結果をReactへ戻すため、保存形式・通知権限・Wake Lock制御・完了音の重複防止ロジックはこの段階では変更しません。

自由設定の入力値もブリッジを通して既存入力へ同期し、既存の入力検証をそのまま利用します。無効値で既存コードが入力欄へフォーカスを戻す場合は、ブリッジがReact側の入力へフォーカスを転送します。

## 集中記録サマリーの移行境界

`ProgressOverview` は、完了した集中の「記録する / 記録せず破棄する」と、今日・今週・連続日・累計のサマリーをReactで描画します。

`react-progress-overview-bridge.js` は、Reactの記録/破棄操作を既存の `app.js` / `tab-guard.js` のボタン処理へ委譲し、`stats.js` が更新する集計値、連続日メッセージ、pending completion時のdisabled/hidden状態をReactへ同期します。複数タブで同じ完了を二重記録しないための既存の排他制御は変更しません。

この領域は `stats.js` と `tab-guard.js` が初期化を終えた後で置き換える必要があるため、`src/main.jsx` が既存のフォールバックDOMをまとめて `react-progress-overview-root` を生成してからReactをマウントします。直接 `index.html` を開く場合は従来DOMのまま動作します。

Reactは `DOMContentLoaded` 後にマウントするため、既存スクリプトは先にフォールバックDOMを参照できます。Reactへ置き換えた後も各ブリッジは元DOMへの参照を保持し、既存ロジックを壊さずUIだけをReact化します。

Viteを通さず `index.html` を開いた場合は従来のHTMLがそのまま残り、React用ブリッジは動作しません。

## Tailwind CSSについて

Tailwindへの移行は行います。ただし、React移行とCSS基盤の置換を同じPRで進めると、DOM変更と見た目の差分が混ざって回帰原因を追いにくくなります。

そのため、まずReactへの責務移行を完了し、その後にTailwind専用の段階移行を行います。Tailwind導入後は新しいReactコンポーネントをutility class中心にし、旧CSSを機能単位で削減していきます。

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存のDOM ID・アクセシビリティ・保存形式を必要以上に同時変更しない
- タイマー状態や保存形式は、UI移行とは別に互換性を維持する
- Reactへ移した領域でも `dangerouslySetInnerHTML` は使わない
- 各段階で既存Quality checksとVite production buildを通す
- npm依存関係はCIの `npm audit --audit-level=moderate` で継続監査する

Reactへ移した領域も、Viteを通さない場合に最低限の表示が残るよう `index.html` にフォールバックHTMLを置きます。Vite経由では `createRoot()` が同じ領域をReact管理へ置き換えます。
