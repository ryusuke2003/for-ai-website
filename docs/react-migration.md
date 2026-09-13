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
- タイマー本体は `timerStore.js`、累計・履歴は `progressStore.js` が管理
- 日次目標、今週回数、連続日、7日/30日集計はReact化済み
- 端末データ削除、JSONバックアップ、復元、1世代UndoはReact化済み
- `app.js` と `legacy/interop/*` は削除済み
- hidden runtime scaffoldも撤去済み
- classicで残る実行時ロジックは複数タブ調停の `tab-guard.js`。`theme-bootstrap.js` / `timer-bootstrap.js` は初期化用bootstrap

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
   - 累計・履歴・別タブ進捗同期を `progressStore.js` へ移し `app.js` / `settings-progress.js` / hidden scaffoldを削除 — 完了
   - 次は `tab-guard.js` のmodule化と残るclassic境界を整理する
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
│   │   ├── progressStore.js
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

`timerStore.js` は `one.timer.v1` の検証・読み書き、1〜180分の選択、開始・一時停止・リセット・再開、250ms tick、0秒完了、再読み込み復元、完了日の保持、別タブからのアイドル時間同期、端末データ削除直前のinterval停止を担当します。

`useTimerState()` は `useSyncExternalStore()` でstoreを直接購読します。TimerControls、自由設定、Spaceショートカット、バックアップのタイマー時間復元も `timerActions` を直接利用します。

## 進捗の責務

`progressStore.js` は次を担当します。

- `one.doneCount` と `one.history.v1` の厳格な検証・読込
- 最大90日の日次履歴と1日1000回上限
- 累計32byte、履歴50KBの保存値上限
- 通常のstorageイベントによる別タブ同期
- BFCache / 前面復帰時の安全な再読込
- 完了記録時に、保存より先に現在タブのメモリ状態を更新する救出経路
- 累計・履歴の書込後読み戻し確認
- バックアップ復元時の進捗反映

`useProgressOverviewState()` は `useSyncExternalStore()` で `progressStore.js` を直接購読します。記録・破棄ボタンは `progressActions` から `ONE_TAB_GUARD` のclaim処理へ入るため、複数タブの二重記録防止を迂回しません。

## 複数タブ調停

`tab-guard.js` は現時点ではclassic scriptのまま残します。暗号学的乱数によるタブ識別、別タブ所有タイマーの開始拒否、古いタブからの再開拒否、完了記録のclaim、記録/破棄時の保存確認を担当します。

React側とは小さいruntime境界で接続します。

- `ONE_TAB_GUARD`: timer/progress storeから調停・完了処理を呼ぶ
- `ONE_TIMER_RUNTIME`: tab guardからtimer snapshot、完了消費、feedback、アイドル同期を扱う
- `ONE_PROGRESS_RUNTIME`: tab guardから進捗再読込、インメモリ加算、累計/履歴保存確認を扱う
- `ONE_TAB_COORDINATION`: backupから安全な復元可否を問い合わせる

完了記録は **claim → タイマー完了消費 → タイマー保存値の読み戻し確認 → メモリ上の進捗更新 → 累計保存確認 → 履歴保存確認** の順を維持します。保存途中で失敗しても現在タブの進捗は残し、JSON救出へ案内します。

## legacy runtime scaffold

削除済みです。`index.html` の `#root` は空で、ユーザー向けUIも実行時の状態DOMもReactが構築します。

## バックアップの責務

`useBackupControl.js` は次を維持します。

- `one-focus-backup` version 1のJSON検証と100KB上限
- 累計・最大90日の日次履歴・1〜180分のタイマー時間だけを書き出す
- 保存障害時のReactメモリ状態からの救出用JSON
- 復元前に `one.restoreRecovery.v1` へ1世代退避
- 復元確認中の別タブ更新・タイマー状態変化の再確認
- 復元後の保存値検証と失敗時ロールバック
- 復元後の状態が変わっていない場合だけ利用できる1世代Undo

進捗反映はReact progress store、タイマー時間は `timerActions.selectMinutes()` へ反映します。復元中は `ONE_TAB_COORDINATION` で別タブのアクティブタイマーも確認します。

## 端末データ削除

`usePrivacyResetControl.js` はONEの既知localStorageキーだけを削除します。`localStorage.clear()` は使いません。別タブ通知値は形式・長さを検証し、Web Cryptoを優先します。

reload直前の `one:privacy-reset-prepare` は `timerStore.js` が受け取り、保存し直さずintervalと実行中endAtを停止します。

## `index.html` とVite

`index.html` はCSP、基本meta、残るclassic scriptの読み込み順、`/src/main.jsx` を定義します。hidden scaffoldはありません。

現在のclassic scriptは次の3つです。

```text
theme-bootstrap.js
timer-bootstrap.js
tab-guard.js
```

`theme-bootstrap.js` は初期描画前のテーマ適用、`timer-bootstrap.js` はタイマー保存形式の共通検証器です。`tab-guard.js` はCleanup 4Dの最後にmodule化します。

## CIで守るもの

- タイマー保存形式・復元・0秒境界
- Space / F / Escapeの入力・IME・修飾キー・フォーカス安全性
- 複数タブ所有権、暗号学的セッションID、二重記録防止
- 完了消費 → 累計 → 履歴の保存順と読み戻し確認
- 進捗保存値のサイズ・形式検証と別タブ同期
- 日付境界、今週・連続日・7日/30日履歴
- 日次目標の厳格検証・保存確認・別タブ同期
- 端末データ削除の対象限定・削除確認・別タブ通知検証
- 完了音 / 通知 / Wake Lock
- バックアップ形式検証、救出用書き出し、復元前退避、ロールバック、1世代Undo
- 保存障害時のフォールバック
- CSP、フォーカス、秘密情報混入防止

## 整理後の目標

Cleanup 4D完了時には `tab-guard.js` をmodule側へ吸収し、通常のVite + React構成へさらに寄せます。その後 Tailwind Step 7B以降を再開します。
