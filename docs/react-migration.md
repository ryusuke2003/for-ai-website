# React / Tailwind 構成整理方針

ONE は vanilla JavaScript から React へ段階移行してきたため、移行用の互換レイヤーと classic runtime が残っています。機能を壊さずに足場を外してから、Tailwind移行を再開します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- `src/App.jsx` + 単一 `#root` へ統合済み
- timer / progress / backup のReactコードは `src/features/*` に集約
- Reactとclassic JavaScriptの互換処理は `legacy/interop/` に集約
- `index.html` 自体がReact entryとclassic scriptの読み込み順を定義する
- production向けclassic scriptは `index.html` から自動検出してVite/Rollupのassetとして出力する
- Theme / 端末保存状態 / Wake Lock / 完了音・完了通知はReact側へ移行済み
- 自由設定タイマー、タイマー進捗、終了予定時刻、ページタイトルもReact側へ移行中
- Tailwind Step 7Aとして Hero / Footer / ThemeSwitcher のutility化まで完了
- タイマー保存形式、複数タブ排他、通知権限、バックアップのロールバックなどの安全性ロジックは維持する

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
   - ルート直下に散らばっていた8個の `react-*-bridge.js` / `react-*-state-source.js` を3個の `legacy/interop/*.js` へ集約
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
   - 自由設定タイマーとタイマー表示の補助処理をReactへ移行中
   - 次に progress / backup 系runtimeとinteropを整理する
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
│   │   ├── useProgressOverviewState.js
│   │   └── useProgressDetailsState.js
│   └── backup/
│       ├── BackupPanel.jsx
│       └── useBackupPanelState.js
└── tailwind.css
```

画面全体は `src/main.jsx` で1回だけ `createRoot()` し、`App.jsx` 配下で管理します。`components/` はアプリ横断の小さな表示要素、`features/` は機能単位のUIとブラウザ機能制御を置く場所です。

## 一時的に残す互換レイヤー

```text
legacy/interop/
├── timer.js
├── settings-progress.js
└── progress-backup.js
```

これらはclassic JavaScriptが保持する既存状態・イベント経路をReactへ公開するための一時的なアダプターです。複数タブ排他、完了記録、バックアップ検証などの既存の安全な処理を迂回しないために残しています。

`timer.js` はタイマー本体への操作委譲と状態snapshot、`settings-progress.js` は主にProgressOverviewと自由設定バックアップ互換、`progress-backup.js` は記録詳細とバックアップUIの互換処理を担当します。機能本体をReactへ移すたびに責務を減らし、最終的に削除します。

## legacy runtime scaffold

`index.html` の `#root` には画面の完成形を重複して書きません。残すのは、classic scriptが起動時に `querySelector()` で取得する要素と初期状態だけを持つ `#legacy-runtime-scaffold` です。

scaffoldは `hidden` かつ `aria-hidden="true"` で、ユーザー向けUIではありません。React移行済みの要素は順次scaffoldから削除しています。現在はタイマー本体・記録・バックアップなど、まだclassic runtimeが直接参照するDOMだけを残します。

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
- 日付境界と履歴
- 完了音 / 通知 / Wake Lock
- バックアップ検証、復元前退避、ロールバック
- 保存障害時のフォールバック
- CSP、フォーカス、秘密情報混入防止

同じ振る舞いを複数ファイルで固定している検査は、React移行に合わせて統合します。今回、ページタイトル・終了予定・進捗の検査は `timer_state_checks.py` に集約します。

## 整理後の目標

Cleanup 4D完了時には、`index.html` を `#root` とViteエントリ中心の通常構成へ寄せ、ルート直下のclassic JavaScriptと `legacy/interop/` を廃止します。その後にTailwind Step 7B以降を再開します。
