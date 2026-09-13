# React / Tailwind 構成整理方針

ONE は vanilla JavaScript から React へ段階移行してきたため、移行用の互換レイヤーと classic runtime が残っています。機能を壊さずに足場を外してから、Tailwind移行を再開します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- `src/App.jsx` + 単一 `#root` へ統合済み
- timer / progress / backup のReactコードは `src/features/*` に集約
- `index.html` 自体がReact entryと残存classic scriptの読み込み順を定義する
- production向けclassic scriptは `index.html` から自動検出してVite/Rollupのassetとして出力する
- Theme / 端末保存状態 / Wake Lock / 完了音・完了通知はReact側へ移行済み
- 自由設定タイマー、タイマー進捗、終了予定時刻、ページタイトルもReact側へ移行済み
- 日次目標の入力・保存・別タブ同期・進捗表示もReact側へ移行済み
- 今週回数・連続日・直近7日・直近30日の集計と表示もReact側へ移行済み
- 端末データ削除の状態・確認UI・別タブ通知もReact側へ移行済み
- JSONバックアップの書き出し・復元・1世代UndoもReact側へ移行済み
- `stats.js` / `privacy-reset.js` / `backup.js` は削除済み
- `legacy/interop/progress-backup.js` も削除済み
- Tailwind Step 7Aとして Hero / Footer / ThemeSwitcher のutility化まで完了
- タイマー保存形式、複数タブ排他、バックアップの復元前退避・ロールバックなどの安全性ロジックは維持する

## いったん止めるもの

Tailwind Step 7B以降は、React構成の大掃除が終わるまで停止します。互換レイヤーと旧CSSを同時に触ると回帰原因を切り分けにくいためです。

## 大掃除の順番

1. **Cleanup 1: 移行用の足場を削除**（完了）
   - 過去の移行形だけを固定する検査を削除
   - 機能・セキュリティ・保存・複数タブ・バックアップの振る舞いテストは維持
2. **Cleanup 2: `App.jsx` + 単一React root**（完了）
   - 複数の `createRoot()` と `wrapSiblingRange()` を廃止
   - React管理UIを1つのコンポーネントツリーへ統合
3. **Cleanup 3: feature / interop 単位へ整理**（完了）
   - timer / progress / backup のコンポーネントと購読hookを `src/features/*` へ移動
   - ルート直下に散らばっていた8個の `react-*-bridge.js` / `react-*-state-source.js` を一時interopへ集約
4. **Cleanup 4A: `index.html` をViteの正本にする**（完了）
   - `injectReactEntry()` を削除
   - React entry、interop、React有効化用data属性を `index.html` に直接記述
5. **Cleanup 4B: classic script出力を `index.html` 基準にする**（完了）
   - `legacyScripts` の手書き一覧を削除
   - `copyFile()` によるbuild後コピーを廃止
   - classic scriptを `index.html` から自動検出してasset出力
6. **Cleanup 4C: フォールバックDOMをruntime scaffoldへ縮小**（完了）
   - `index.html` に重複していた画面全体の旧UIを削除
   - classic runtimeが初期化時に参照する最小DOMだけを非表示scaffoldとして残す
7. **Cleanup 4D: classic runtime / interopを機能単位で廃止**（進行中）
   - Theme runtimeをReactへ移行済み
   - 端末保存状態をReactへ移行済み
   - Wake LockをReactへ移行済み
   - 完了音・完了通知をReactへ移行済み
   - 自由設定タイマーとタイマー表示の補助処理をReactへ移行済み
   - 日次目標の状態・保存・進捗をReactへ移行済み
   - 今週回数・連続日・7日/30日集計をReactへ移行し、`stats.js` を削除済み
   - 端末データ削除をReactへ移行し、`privacy-reset.js` を削除済み
   - バックアップ書き出し・復元・UndoをReactへ移行し、`backup.js` / `progress-backup.js` を削除済み
   - 次にtimer / progress本体のclassic runtimeと残りinteropを整理する
8. **Tailwind移行を再開**
   - 7B: タイマーUI
   - 7C: 集中記録・統計・バックアップUI
   - 7D: テーマ色・フォーカス・レスポンシブと旧CSS整理

## 現在のReact構成

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
│   │   ├── useTimerState.js
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

画面全体は `src/main.jsx` で1回だけ `createRoot()` し、`App.jsx` 配下で管理します。`components/` はアプリ横断の小さな表示要素、`features/` は機能単位のUIとブラウザ機能制御を置く場所です。

`ProgressSection` はclassic runtimeから「記録操作状態・累計・正規化済み履歴」だけを受け取り、`progressInsights.js` が今日・今週・連続日・直近7日・直近30日の表示用read modelを生成します。日次目標はその今日回数を `useDailyGoalControl()` へ渡すため、集計UIと目標UIが同じ履歴を正本にします。

## 一時的に残す互換レイヤー

```text
legacy/interop/
├── timer.js
└── settings-progress.js
```

これらはclassic JavaScriptが保持するタイマー本体・記録処理をReactへ公開するための一時的なアダプターです。複数タブ排他や完了記録の安全な処理を迂回しないために残しています。

`timer.js` はタイマー本体への操作委譲と状態snapshotに加え、端末データ削除直前に保存し直さずtimer intervalだけを停止する準備eventを受け取ります。`settings-progress.js` は記録/破棄アクション、累計・履歴snapshot、バックアップ復元時の進捗適用、tab guardの復元可否判定に必要な最小状態だけを公開します。

## legacy runtime scaffold

`index.html` の `#root` には画面の完成形を重複して書きません。残すのは、classic scriptが起動時に `querySelector()` で取得する要素と初期状態だけを持つ `#legacy-runtime-scaffold` です。

scaffoldは `hidden` かつ `aria-hidden="true"` で、ユーザー向けUIではありません。日次目標・集計表示・端末データ削除・バックアップ用DOMは削除済みです。現在はタイマー本体、記録/破棄、累計など、まだclassic runtimeが直接参照する要素だけを残します。

## バックアップの責務

`useBackupControl.js` が次を担当します。

- `one-focus-backup` version 1のJSON検証と100KB上限
- 累計・最大90日の日次履歴・1〜180分のタイマー時間だけを書き出す
- 端末保存を利用できない場合の、Reactが保持する現在状態からの救出用JSON
- 復元前に`one.restoreRecovery.v1`へ1世代だけ退避
- 復元確認中の別タブ更新・タイマー状態変化の再確認
- 復元後の保存値検証と失敗時ロールバック
- 復元後の状態が変わっていない場合だけ利用できる1世代Undo

実際の進捗状態反映は `settings-progress.js` の最小adapter、タイマー時間反映は `timer.js` の既存操作adapterを通します。別タブのアクティブタイマー有無は既存 `tab-guard.js` の判定を再利用し、React側で排他ロジックを二重実装しません。

## 端末データ削除の責務

`usePrivacyResetControl.js` が、ONEの既知localStorageキーだけを対象にした削除・削除後確認・別タブ通知を管理します。`localStorage.clear()` は使いません。通知値はWeb Cryptoを優先し、受信側はキー・長さ・形式を検証してから処理します。

削除後のreload直前には `one:privacy-reset-prepare` を同期dispatchし、`legacy/interop/timer.js` がintervalと`endAt`を止めます。この準備処理はタイマー状態を保存し直さないため、削除直後にtimer runtimeが古い保存値を復活させない構成です。

## `index.html` とViteの役割

`index.html` は次の責務を持ちます。

- CSPと基本meta情報
- 残っているclassic JavaScript / interopの読み込み順
- `/src/main.jsx` のmodule entry
- classic初期化に必要な最小runtime scaffold

Vite側はTailwind pluginと、`index.html` に書かれたclassic scriptをproduction assetとして出力する処理を担当します。HTML文字列の差し替えやclassic script一覧の二重管理は行いません。

## 残すテストの考え方

移行手順そのものを固定するテストは削除します。一方で、次の振る舞いは今後もCIで守ります。

- タイマー状態と復元
- 複数タブの所有権・二重記録防止
- 日付境界、今週・連続日・7日/30日履歴
- 日次目標の厳格検証・保存確認・期限切れ掃除・別タブ同期
- 端末データ削除の対象限定・削除確認・別タブ通知検証
- 完了音 / 通知 / Wake Lock
- バックアップ形式検証、救出用書き出し、復元前退避、ロールバック、1世代Undo
- 保存障害時のフォールバック
- CSP、フォーカス、秘密情報混入防止

進捗の通常storage同期は `app.js`、claim直後の再読込は `tab-guard.js` と責務を分けたまま維持します。表示上の日付意味付けと集計は `progressInsights.js` / React UIを直接検査します。

## 整理後の目標

Cleanup 4D完了時には、`index.html` を `#root` とViteエントリ中心の通常構成へ寄せ、ルート直下のclassic JavaScriptと `legacy/interop/` を廃止します。その後にTailwind Step 7B以降を再開します。
