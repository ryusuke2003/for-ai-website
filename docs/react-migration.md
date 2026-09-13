# React 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、UI → 状態同期 → 状態所有の順で React へ移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- `src/main.jsx` を React エントリーポイントとして使用
- Hero / Footer / ThemeSwitcher / タイマーUI / 集中記録・統計UI / バックアップUIは React 管理
- タイマー表示と主操作は `useSyncExternalStore` を使う共有状態ソースへ統合中
- 保存形式、タイマー状態機械、複数タブ排他、バックアップ安全性はまだ既存 vanilla JavaScript を正として維持
- 初回描画のちらつきを防ぐ `theme-bootstrap.js` はCSSより前に残す

## 移行順

1. **表示専用領域** — Hero / Footer（完了）
2. **表示テーマ** — ThemeSwitcher と保存・別タブ同期（完了）
3. **タイマーUI**（完了）
   - 3A: 開始・一時停止 / リセット / 集中表示
   - 3B: 残り時間 / 進捗 / 状態 / 終了予定時刻
   - 3C: 時間プリセット / 自由設定 / 完了音・通知・画面維持
4. **集中記録・統計UI**（完了）
   - 4A: 記録 / 破棄、今日 / 今週 / 連続日 / 累計
   - 4B: 今日の目標、直近7日 / 30日の可視化
5. **バックアップ・データ削除UI** — JSON書き出し / 復元 / Undo / 端末データ削除（完了）
6. **状態管理のReact統合**
   - 6A: タイマー表示・主操作を1つの共有状態ソースへ統合（この段階）
   - 6B: タイマー設定・集中記録も同じ状態境界へ統合
   - 6C: 状態所有と操作をReact側へ移し、不要になったbridge / compatを削除
7. **Tailwind CSS移行** — React移行完了後に `styles.css` / `timer-progress.css` をutility classへ段階移行

## Step 6A: タイマー共有状態

これまでは `TimerDisplay` と `TimerControls` がそれぞれ専用bridgeからDOMの変化を受け取っていました。特にタイマー表示は `MutationObserver` で旧DOMを監視しており、React側の表示と旧DOMが二重の状態表現になっていました。

Step 6Aでは `react-timer-state-source.js` が既存タイマー状態を1つのスナップショットにまとめ、`one:timer-state` で変更を通知します。React側は `src/state/useTimerState.js` の `useSyncExternalStore` から同じ状態を購読します。

`TimerDisplay` は残り時間、進捗率、終了予定時刻を共有状態から直接導出します。そのため `react-timer-display-bridge.js` とDOM監視は削除します。

`TimerControls` も同じ共有状態からラベル、disabled、集中表示状態を導出します。一方、開始・停止などの操作はまだ `react-timer-controls-bridge.js` 経由で旧ボタンのイベント経路を通します。これは `tab-guard.js` の複数タブ排他を迂回しないためです。bridgeは状態同期を担当せず、操作委譲とフォーカス転送だけに縮小します。

状態変更通知は同一タスク内の複数更新を `queueMicrotask` でまとめ、Reactに途中状態を過剰通知しないようにします。

## まだ残す境界

`TimerSettings` は完了音・通知・Wake Lockなど複数の旧スクリプトにまたがるため、Step 6Bまでは `react-timer-settings-bridge.js` を維持します。

`ProgressOverview` / `ProgressDetails` / `BackupPanel` も、複数タブ調停、履歴の保存確認、復元ロールバックなど安全性ロジックを同時に書き換えないため、現時点では既存処理へ委譲します。

テーマだけはすでにReact側で保存・同期を担当していますが、初回描画前に保存テーマを適用する `theme-bootstrap.js` はちらつき防止のため残します。

## Tailwind CSSについて

Tailwindへの移行は行います。ただし、状態管理の移行とCSS基盤の置換を同じPRで進めると、DOM・状態・見た目の差分が混ざります。

そのためStep 6を完了してからTailwind専用PRへ進みます。Tailwind導入後はReactコンポーネントをutility class中心へ移し、旧CSSを機能単位で削減します。

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存の保存形式と複数タブ排他をUI移行と同時に変更しない
- DOMを状態ソースにする `MutationObserver` bridgeを段階的に減らす
- Reactの外部状態購読は安定したsnapshotを返す
- `dangerouslySetInnerHTML` は使わない
- 各段階でQuality checks、`npm audit --audit-level=moderate`、Vite production buildを通す
- Tailwind移行は状態管理のReact統合後に行う

Viteを通さず `index.html` を開いた場合は従来のフォールバックHTMLと既存スクリプトを維持します。Vite経由ではReactが同じ領域を管理します。
