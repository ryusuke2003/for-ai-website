# React / Tailwind 構成整理方針

ONE は vanilla JavaScript から React へ段階移行してきたため、移行用の互換レイヤーとフォールバックDOMが残っています。機能を壊さずにこの足場を外してから、Tailwind移行を再開します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- `src/App.jsx` + 単一 `#root` へ統合済み
- React管理UIの状態購読は `useSyncExternalStore` ベース
- React管理UIから `MutationObserver` ベースの状態同期は撤去済み
- timer / progress / backup のReactコードは `src/features/*` に集約
- Reactとclassic JavaScriptの互換処理は `legacy/interop/` の3ファイルに集約
- `index.html` 自体がReact entryとinterop scriptの読み込み順を定義し、ViteのHTML文字列置換は使わない
- Tailwind Step 7Aとして Hero / Footer / ThemeSwitcher のutility化まで完了
- タイマー保存形式、複数タブ排他、通知権限、Wake Lock、バックアップのロールバックなどの安全性ロジックは維持する

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
4. **Cleanup 4A: `index.html` をViteの正本にする**（この段階）
   - `injectReactEntry()` を削除
   - React entry、interop、React有効化用data属性を `index.html` に直接記述
   - classic scriptとmodule entryをstatic checkで別々に検証する
5. **Cleanup 4B: legacy copy / フォールバックDOMを縮小**
   - `copyLegacyScripts()` を廃止できる配置へclassic JavaScriptを移す
   - 直接 `index.html` を開くための互換を終了する
   - classic JavaScriptの機能ロジックを `src/features/*` 側へ段階的に移し、`legacy/interop/` 自体を削除する
6. **Tailwind移行を再開**
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
│   └── ThemeSwitcher.jsx
├── features/
│   ├── timer/
│   │   ├── TimerControls.jsx
│   │   ├── TimerDisplay.jsx
│   │   ├── TimerSettings.jsx
│   │   ├── useTimerState.js
│   │   └── useTimerSettingsState.js
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

画面全体は `src/main.jsx` で1回だけ `createRoot()` し、`App.jsx` 配下で管理します。`components/` はアプリ横断の小さな表示要素、`features/` は機能単位のUIと状態購読を置く場所です。

## 一時的に残す互換レイヤー

```text
legacy/interop/
├── timer.js
├── settings-progress.js
└── progress-backup.js
```

これらはclassic JavaScriptが保持する既存状態・イベント経路をReactへ公開するための一時的なアダプターです。複数タブ排他、完了記録、バックアップ検証などの既存の安全な処理を迂回せず、既存ボタンへの操作委譲と `useSyncExternalStore` 用のsnapshot/event公開だけを担当します。

Cleanup 4Aでは、これらをVite pluginが文字列置換でHTMLへ差し込む方式をやめ、読み込み順を `index.html` だけ見れば把握できるようにします。実装本体の移動・廃止はCleanup 4B以降で行います。

## `index.html` とViteの役割

`index.html` は次の責務を持ちます。

- CSPと基本meta情報
- classic JavaScriptの読み込み順
- 一時的なinterop scriptの読み込み順
- `/src/main.jsx` のmodule entry
- legacy初期化に必要なフォールバックDOM

Vite側はTailwind pluginと、まだ残るclassic JavaScriptをproduction出力へコピーする処理だけを担当します。HTMLの書き換えは行いません。

## 残すテストの考え方

移行手順そのものを固定するテストは削除します。一方で、次の振る舞いは今後もCIで守ります。

- タイマー状態と復元
- 複数タブの所有権・二重記録防止
- 日付境界と履歴
- 完了音 / 通知 / Wake Lock
- バックアップ検証、復元前退避、ロールバック
- 保存障害時のフォールバック
- CSP、フォーカス、秘密情報混入防止

## 整理後の目標

Cleanup 4B完了時には、`index.html` を `#root` とViteエントリ中心の通常構成へさらに縮小し、ルート直下のclassic JavaScriptと `legacy/interop/` を段階的に廃止します。その後にTailwind Step 7B以降を再開します。
