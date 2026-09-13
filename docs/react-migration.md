# React / Tailwind 構成整理方針

ONE は vanilla JavaScript から React / Vite へ段階移行してきました。機能・保存形式・複数タブ安全性を維持しながら classic runtime と移行用adapterを外し、現在は React module を正本とする構成まで整理できています。

## 現在の構成

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- `src/App.jsx` + 単一 `#root`
- timer / progress / backup は `src/features/*` に集約
- タイマー本体は `timerStore.js`
- タイマー保存値の検証は `timerStateGuard.js`
- 複数タブ調停は `tabGuard.js`
- 累計・履歴は `progressStore.js`
- backupは各module APIを直接import
- `app.js` / `timer-bootstrap.js` / `tab-guard.js` / `legacy/interop/*` は削除済み
- hidden runtime scaffoldも撤去済み
- classic scriptとして意図的に残すのは初期描画前の `theme-bootstrap.js` のみ

`theme-bootstrap.js` はCSS適用前に保存テーマを反映してテーマのちらつきを防ぐため、React mountより前に同期実行します。通常のアプリロジックをclassic scriptへ戻す意図はありません。

## Cleanupの進捗

1. **Cleanup 1: 移行用の足場を削除** — 完了
2. **Cleanup 2: `App.jsx` + 単一React root** — 完了
3. **Cleanup 3: feature / interop 単位へ整理** — 完了
4. **Cleanup 4A: `index.html` をViteの正本にする** — 完了
5. **Cleanup 4B: classic script出力を `index.html` 基準にする** — 完了
6. **Cleanup 4C: フォールバックDOMをruntime scaffoldへ縮小** — 完了
7. **Cleanup 4D: classic runtime / interopを機能単位で廃止** — 完了
   - Theme UI / 保存状態 / Wake Lock / 完了効果 / 自由設定 / ショートカット — React化済み
   - 日次目標 / 集計 / 端末データ削除 / バックアップ — React化済み
   - タイマー本体 — `timerStore.js` へ移行済み
   - 累計・履歴・別タブ進捗同期 — `progressStore.js` へ移行済み
   - タイマー保存値検証 — `timerStateGuard.js` へmodule化済み
   - 複数タブ調停 — `tabGuard.js` へmodule化済み
   - backup向け互換global — direct importへ移行済み
8. **次: Tailwind移行を再開**
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
│   │   ├── tabGuard.js
│   │   ├── timerStateGuard.js
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

`timerStateGuard.js` は `one.timer.v1` の保存形式を検証します。10KB上限、1〜180分、`remainingSeconds`、`running` / `endAt`、未記録完了状態、完了日を検証し、旧形式の完了状態も読み取れる互換性を維持します。

`timerStore.js` は保存値の読み書き、開始・一時停止・リセット・再開、250ms tick、0秒完了、再読み込み復元、完了日の保持、別タブからのアイドル時間同期、端末データ削除直前のinterval停止を担当します。

`useTimerState()` は `useSyncExternalStore()` でstoreを直接購読します。TimerControls、自由設定、Spaceショートカット、バックアップのタイマー時間復元は `timerActions` を直接利用します。

## 進捗の責務

`progressStore.js` は次を担当します。

- `one.doneCount` と `one.history.v1` の厳格な検証・読込
- 最大90日の日次履歴と1日1000回上限
- 累計32byte、履歴50KBの保存値上限
- storageイベントによる別タブ同期
- BFCache / 前面復帰時の再読込
- 完了記録時のインメモリ更新
- 累計・履歴の書込後読み戻し確認
- バックアップ復元時の進捗反映

`useProgressOverviewState()` は `useSyncExternalStore()` で `progressStore.js` を直接購読します。記録・破棄は `progressActions` からmoduleの `tabGuardActions` へ入り、複数タブのclaim処理を迂回しません。

## 複数タブ調停

`tabGuard.js` はES moduleとして次を担当します。

- Web CryptoによるタブセッションID生成
- 別タブが所有するアクティブタイマーの開始拒否
- 古いタブからの再開拒否
- アイドル状態のタイマー時間同期
- 未記録完了のclaim
- 別タブで処理済みの完了の検出
- 記録・破棄時の保存確認
- localStorage障害時の単一タブフォールバック

`timerStore.js` と `progressStore.js` はruntimeを `registerTimerRuntime()` / `registerProgressRuntime()` で明示登録します。backupは `tabCoordination` をmoduleから直接importし、復元前に別タブのアクティブタイマーも確認します。

完了記録は **claim → タイマー完了消費 → タイマー保存値の読み戻し確認 → メモリ上の進捗更新 → 累計保存確認 → 履歴保存確認** の順を維持します。保存途中で失敗しても現在タブの進捗は残し、JSON救出へ案内します。

## バックアップの責務

`useBackupControl.js` は次を維持します。

- `one-focus-backup` version 1のJSON検証と100KB上限
- 累計・最大90日の日次履歴・1〜180分のタイマー時間だけを書き出す
- 保存障害時のReactメモリ状態からの救出用JSON
- 復元前に `one.restoreRecovery.v1` へ1世代退避
- 復元確認中の別タブ更新・タイマー状態変化の再確認
- 復元後の保存値検証と失敗時ロールバック
- 復元後の状態が変わっていない場合だけ利用できる1世代Undo

依存はglobal互換APIではなくmoduleの `progressActions` / `timerActions` / `timerStateGuard` / `tabCoordination` を直接importします。

## 端末データ削除

`usePrivacyResetControl.js` はONEの既知localStorageキーだけを削除します。`localStorage.clear()` は使いません。別タブ通知値は形式・長さを検証し、Web Cryptoを優先します。

reload直前の `one:privacy-reset-prepare` は `timerStore.js` が受け取り、保存し直さずintervalと実行中endAtを停止します。

## `index.html` とVite

`index.html` はCSP、基本meta、描画前テーマbootstrap、`/src/main.jsx` を定義します。hidden scaffoldはありません。

現在のclassic scriptは1つだけです。

```text
theme-bootstrap.js
```

それ以外のアプリロジックはViteのmodule graphへ含めます。

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

## 次の整理

classic runtimeのReact移行は完了扱いとし、次はTailwind Step 7B以降を進めます。`theme-bootstrap.js` は通常runtimeではなく初期描画前テーマ適用という明確な役割があるため、無理にReactへ移してFOUCを起こさないことを優先します。
