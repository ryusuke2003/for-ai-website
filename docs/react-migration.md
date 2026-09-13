# React / Tailwind 段階移行方針

ONE は既存のタイマー・記録機能を壊さないことを優先し、UI → 状態同期 → CSS基盤の順で段階移行します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- `src/main.jsx` をReactエントリーポイントとして使用
- Hero / Footer / ThemeSwitcher / タイマーUI / 集中記録・統計UI / バックアップUIはReact管理
- React管理UIの外部状態購読は `useSyncExternalStore` ベースへ統一
- DOM変化を監視する `MutationObserver` bridge はReact管理UIから撤去
- 保存形式、タイマー状態機械、複数タブ排他、通知権限、Wake Lock、バックアップのロールバックなど安全性ロジックは既存vanilla JavaScriptを正として維持
- TailwindはPreflightを無効にした状態で段階導入し、既存CSSとの衝突を避ける
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
6. **状態管理のReact統合**（完了）
   - 6A: タイマー表示・主操作を共有状態ソースへ統合
   - 6B: タイマー設定・集中記録サマリーを外部状態購読へ統合
   - 6C: 目標・可視化 / バックアップUIも外部状態購読へ統合し、残ったDOM監視と旧タスク互換を削除
7. **Tailwind CSS移行**
   - 7A: Tailwind基盤導入 + Hero / Footer / ThemeSwitcherのレイアウト・タイポグラフィをutility化（この段階）
   - 7B: タイマーUIをutility化
   - 7C: 集中記録・統計・バックアップUIをutility化
   - 7D: テーマ色・フォーカス・レスポンシブ指定をTailwind側へ統合し、旧CSS依存を削減

## Step 6: React状態境界

`react-timer-state-source.js`、`react-secondary-state-source.js`、`react-remaining-state-source.js` が既存ロジックの状態を安定したスナップショットとして公開し、React側は `useSyncExternalStore` で購読します。

これにより、React管理UIのためだけにDOMを監視する `MutationObserver` は不要になりました。操作bridgeは、複数タブ排他やバックアップの安全性ロジックを迂回しないよう、既存のイベント経路への委譲と必要なフォーカス転送だけを担当します。

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

## Step 7A: Tailwind基盤

Tailwind CSS 4.3.3と公式Vite pluginを導入し、`src/tailwind.css` をReactエントリから読み込みます。

既存画面へTailwind Preflightを一度に適用すると、button / input / headingなどのリセットが既存CSSへ広く影響します。そのため7Aでは `tailwindcss/theme.css` と `tailwindcss/utilities.css` だけを読み込み、Preflightは明示的に無効化します。

最初のutility化対象は副作用の小さい `HeroIntro`、`AppFooter`、`ThemeSwitcher` のレイアウト・余白・タイポグラフィです。色やテーマ切替の既存セレクタはまだ残し、ライト / ダーク / 自動テーマの挙動を同時に書き換えません。

`styles.css` / `timer-progress.css` は直接 `index.html` を開くフォールバックと未移行領域のため、この段階では削除しません。後続PRで機能単位にTailwindへ寄せてから削減します。

## 移行ルール

- 1つのPRで責務を広げすぎない
- 既存の保存形式と複数タブ排他をUI/CSS移行と同時に変更しない
- DOMを状態ソースにする `MutationObserver` bridgeを使わない
- Reactの外部状態購読は安定したsnapshotを返す
- 操作は安全性ロジックを迂回しない
- Tailwind移行中はPreflightによる全体リセットを避ける
- `dangerouslySetInnerHTML` は使わない
- 各段階でQuality checks、`npm audit --audit-level=moderate`、Vite production buildを通す

Viteを通さず `index.html` を開いた場合は従来のフォールバックHTML・既存CSS・既存スクリプトを維持します。Vite経由ではReactとTailwind utilityを段階的に使用します。
