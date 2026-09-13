# React 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、UI → 状態同期 → 状態境界整理の順で React へ移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- `src/main.jsx` を React エントリーポイントとして使用
- Hero / Footer / ThemeSwitcher / タイマーUI / 集中記録・統計UI / バックアップUIは React 管理
- React管理UIの外部状態購読は `useSyncExternalStore` ベースへ統一
- DOM変化を監視する `MutationObserver` bridge はReact管理UIから撤去
- 保存形式、タイマー状態機械、複数タブ排他、通知権限、Wake Lock、バックアップのロールバックなど安全性ロジックは既存 vanilla JavaScript を正として維持
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
   - 6A: タイマー表示・主操作を共有状態ソースへ統合（完了）
   - 6B: タイマー設定・集中記録サマリーを外部状態購読へ統合（完了）
   - 6C: 目標・可視化 / バックアップUIも外部状態購読へ統合し、残ったDOM監視と旧タスク互換を削除（この段階）
7. **Tailwind CSS移行** — Step 6完了後に `styles.css` / `timer-progress.css` をutility classへ段階移行

## Step 6A: タイマー共有状態

`react-timer-state-source.js` が既存タイマー状態を安定したスナップショットとして公開し、`one:timer-state` で変更を通知します。`TimerDisplay` と `TimerControls` は `src/state/useTimerState.js` の `useSyncExternalStore` から同じ状態を購読します。

これにより旧 `react-timer-display-bridge.js` とタイマー表示用 `MutationObserver` を削除しました。開始・停止などの操作は `tab-guard.js` の複数タブ排他を迂回しないよう、既存ボタンのイベント経路を維持します。

## Step 6B: 設定・集中記録の共有状態

`react-secondary-state-source.js` がタイマー設定と集中記録サマリーのスナップショットを公開します。`TimerSettings` と `ProgressOverview` は `useSyncExternalStore` で購読し、専用bridgeにあった `MutationObserver` とsnapshot保持を削除しました。

完了音、完了通知、Wake Lock、自由設定、履歴描画などの状態変更は既存の更新関数を境界でラップして通知します。操作bridgeはクリック委譲やフォーカス転送だけを担当します。

## Step 6C: 残りのUI状態境界

`react-remaining-state-source.js` が `ProgressDetails` と `BackupPanel` の状態を公開します。React側は `useProgressDetailsState()` / `useBackupPanelState()` から `useSyncExternalStore` で購読します。

これにより、目標・7日/30日可視化とバックアップ・端末データ削除UIからも `MutationObserver` ベースの状態同期を削除します。`react-progress-details-bridge.js` と `react-backup-panel-bridge.js` は操作委譲とフォーカス転送だけに縮小します。

バックアップの現在タブ判定は `hasActiveTimerContext()` へ整理し、タスク機能削除後に残っていた `hasActiveDailyTaskContext()` と `backup-timer-context-compat.js` を削除します。バックアップ案内に残っていた旧タスク文言もタイマー専用の表現へ更新します。

## 残す vanilla JavaScript

ReactへUIと購読境界を移しても、次のロジックは安全性のため無理にReactへ書き直しません。

- タイマーの時刻計算と保存形式
- 複数タブの所有権・二重記録防止
- 通知権限と完了音の一回実行制御
- Screen Wake Lock制御
- 履歴・目標・バックアップの入力検証
- 復元前退避、保存確認、失敗時ロールバック
- 端末データ削除と別タブ通知

これらはReactから既存の安全な操作経路を呼び出し、状態だけをイベント駆動で購読します。

## Tailwind CSSについて

Step 6Cが完了したらTailwind専用PRへ進みます。React/状態移行とCSS基盤変更を同じPRに混ぜず、見た目の回帰原因を追いやすくします。

Tailwind導入後はReactコンポーネントをutility class中心へ移し、`styles.css` / `timer-progress.css` を機能単位で削減して最終的に旧CSS依存をなくします。

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存の保存形式と複数タブ排他をUI移行と同時に変更しない
- DOMを状態ソースにする `MutationObserver` bridgeを使わない
- Reactの外部状態購読は安定したsnapshotを返す
- 操作は安全性ロジックを迂回しない
- `dangerouslySetInnerHTML` は使わない
- 各段階でQuality checks、`npm audit --audit-level=moderate`、Vite production buildを通す

Viteを通さず `index.html` を開いた場合は従来のフォールバックHTMLと既存スクリプトを維持します。Vite経由ではReactが同じ領域を管理します。
