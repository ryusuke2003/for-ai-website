# React / Tailwind 構成整理方針

ONE は vanilla JavaScript から React へ段階移行しています。機能・保存形式・複数タブ安全性を維持したまま classic runtime と移行用adapterを外し、その後に Tailwind 移行を再開します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- `src/App.jsx` + 単一 `#root`
- timer / progress / backup のReactコードは `src/features/*` に集約
- Theme / 端末保存状態 / Wake Lock / 完了音・完了通知はReact化済み
- 自由設定、タイマー進捗、終了予定時刻、ページタイトル、Space / F / EscapeはReact化済み
- タイマー開始・一時停止・リセット・復元・tick・`one.timer.v1` 保存を `timerStore.js` へ移行済み
- 日次目標、今週回数、連続日、7日/30日集計はReact化済み
- 端末データ削除、JSONバックアップ、復元、1世代UndoはReact化済み
- `stats.js` / `privacy-reset.js` / `backup.js` / `shortcuts.js` / `legacy/interop/timer.js` は削除済み
- 残るinteropは進捗用 `legacy/interop/settings-progress.js` のみ

## 大掃除の進捗

1. **Cleanup 1: 移行用の足場を削除** — 完了
2. **Cleanup 2: `App.jsx` + 単一React root** — 完了
3. **Cleanup 3: feature / interop 単位へ整理** — 完了
4. **Cleanup 4A: `index.html` をViteの正本にする** — 完了
5. **Cleanup 4B: classic script出力を `index.html` 基準にする** — 完了
6. **Cleanup 4C: フォールバックDOMをruntime scaffoldへ縮小** — 完了
7. **Cleanup 4D: classic runtime / interopを機能単位で廃止** — 進行中
   - Theme / 保存状態 / Wake Lock / 完了効果 / 自由設定 / ショートカット — 完了
   - 日次目標 / 集計 / 端末データ削除 / バックアップ — 完了
   - タイマー本体を `timerStore.js` へ移し `legacy/interop/timer.js` を削除 — 完了
   - 次は進捗の保存・記録処理をReactへ移して `app.js` / `settings-progress.js` を削除する
   - その後 `tab-guard.js` をmodule化し、legacy runtime scaffoldを完全撤去する
8. **Tailwind移行を再開**
   - 7B: タイマーUI
   - 7C: 集中記録・統計・バックアップUI
   - 7D: テーマ色・フォーカス・レスポンシブと旧CSS整理

## React構成

```text
src/
├── App.jsx
├── main.jsx
├── components/
│   ├── AppFooter.jsx
│   ├── HeroIntro.jsx
│   ├── StorageHealthStatus.jsx
│   └── ThemeSwitcher.jsx
├── features/
│   ├── timer/
│   │   ├── TimerControls.jsx
│   │   ├── TimerDisplay.jsx
│   │   ├── TimerSettings.jsx
│   │   ├── timerStore.js
│   │   ├── useTimerState.js
│   │   ├── useTimerShortcuts.js
│   │   ├── useFocusModeControl.js
│   │   ├── useCustomTimerControl.js
│   │   ├── useCompletionEffectsControl.js
│   │   └── useWakeLockControl.js
│   ├── progress/
│   │   ├── ProgressOverview.jsx
│   │   ├── ProgressDetails.jsx
│   │   ├── progressInsights.js
│   │   ├── useDailyGoalControl.js
│   │   └── useProgressOverviewState.js
│   └── backup/
│       ├── BackupPanel.jsx
│       ├── useBackupControl.js
│       └── usePrivacyResetControl.js
└── tailwind.css
```

## タイマーの責務

`timerStore.js` が次を担当します。

- `one.timer.v1` の読み書き
- `ONE_TIMER_STATE_GUARD` を使った保存状態の検証
- 1〜180分のタイマー時間
- 開始・一時停止・リセット・再開
- 250ms tickと0秒到達時の完了確定
- 再読み込み後の実行中タイマー復元
- 期限切れタイマーの未記録完了への復元
- 完了日を保持した記録待ち状態
- 別タブからの安全なアイドル時間同期
- 端末データ削除直前のinterval停止

`useTimerState()` は `useSyncExternalStore()` でこのstoreを直接購読します。TimerControls、自由設定、Spaceショートカット、バックアップのタイマー時間復元も `timerActions` を直接利用するため、timer用DOM bridgeはありません。

## 複数タブ調停

`tab-guard.js` は現時点ではclassic scriptのまま残します。暗号学的乱数によるタブ識別、別タブ所有タイマーの開始拒否、古いタブからの再開拒否、完了記録のclaim、記録/破棄時の保存確認を担当します。

Reactタイマーとは一時的な小さい境界で接続します。

- `ONE_TAB_GUARD`: timerStoreから開始・リセット・時間変更前の調停を呼ぶ
- `ONE_TIMER_RUNTIME`: tab guardからtimer snapshot、完了消費、feedback、アイドル同期を扱う
- `ONE_TAB_COORDINATION`: backupから安全な復元可否を問い合わせる

この境界は複数タブ安全性を一度に書き換えないための移行用です。Cleanup 4Dの最後に `tab-guard.js` 自体をmodule化します。

## 進捗runtimeと残るinterop

現在 `app.js` はタイマー本体を持ちません。残っている責務は以下だけです。

- `one.doneCount` / `one.history.v1` の検証・読込・保存補助
- 通常のstorageイベントによる別タブ進捗同期
- 完了記録時のインメモリ履歴更新

`legacy/interop/settings-progress.js` は、Reactの進捗UIへ累計・履歴snapshotを公開し、記録/破棄を `ONE_TAB_GUARD` の安全なclaim経路へ渡し、バックアップ復元時の進捗反映を行う最小adapterです。

次段でこの責務をReactのprogress storeへ移し、`app.js` と `settings-progress.js` を削除します。

## legacy runtime scaffold

`index.html` の `#legacy-runtime-scaffold` は `hidden` / `aria-hidden="true"` です。タイマー用DOMはすべて削除済みで、現在は残るclassic進捗adapterが初期化時に使う `#done-count` だけを保持します。

進捗runtimeをReactへ移した後、このscaffold自体を削除します。

## バックアップの責務

`useBackupControl.js` は次を維持します。

- `one-focus-backup` version 1のJSON検証と100KB上限
- 累計・最大90日の日次履歴・1〜180分のタイマー時間だけを書き出す
- 保存障害時のReactメモリ状態からの救出用JSON
- 復元前に `one.restoreRecovery.v1` へ1世代退避
- 復元確認中の別タブ更新・タイマー状態変化の再確認
- 復元後の保存値検証と失敗時ロールバック
- 復元後の状態が変わっていない場合だけ利用できる1世代Undo

進捗反映は残る `settings-progress.js` adapterを通し、タイマー時間は `timerActions.selectMinutes()` でReact storeへ直接反映します。

## 端末データ削除

`usePrivacyResetControl.js` はONEの既知localStorageキーだけを削除します。`localStorage.clear()` は使いません。別タブ通知値は形式・長さを検証し、Web Cryptoを優先します。

reload直前の `one:privacy-reset-prepare` は `timerStore.js` が受け取り、保存し直さずintervalと実行中endAtを停止します。削除直後に古いタイマー保存値を復活させないための処理です。

## `index.html` とVite

`index.html` はCSP、基本meta、残るclassic scriptの読み込み順、`/src/main.jsx`、最小runtime scaffoldを定義します。

現在のclassic scriptは次のとおりです。

```text
theme-bootstrap.js
timer-bootstrap.js
app.js
tab-guard.js
legacy/interop/settings-progress.js
```

`theme-bootstrap.js` は初期描画前のテーマ適用、`timer-bootstrap.js` は保存形式の共通検証器です。後者3つはCleanup 4Dで順次module/React側へ吸収します。

## CIで守るもの

移行手順そのものではなく、次の振る舞いを検査します。

- タイマー保存形式・復元・0秒境界
- Space / F / Escapeの入力・IME・修飾キー・フォーカス安全性
- 複数タブ所有権、暗号学的セッションID、二重記録防止
- 完了消費 → 累計 → 履歴の保存順と読み戻し確認
- 日付境界、今週・連続日・7日/30日履歴
- 日次目標の厳格検証・保存確認・別タブ同期
- 端末データ削除の対象限定・削除確認・別タブ通知検証
- 完了音 / 通知 / Wake Lock
- バックアップ形式検証、救出用書き出し、復元前退避、ロールバック、1世代Undo
- 保存障害時のフォールバック
- CSP、フォーカス、秘密情報混入防止

## 整理後の目標

Cleanup 4D完了時には、`index.html` を通常のVite + React構成へ寄せ、ルート直下のclassic runtime、`legacy/interop/`、hidden runtime scaffoldを廃止します。その後 Tailwind Step 7B以降を再開します。
