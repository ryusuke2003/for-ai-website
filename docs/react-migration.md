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
3. **Cleanup 3: feature / interop 単位へ整理**（この段階）
   - timer / progress / backup のコンポーネントと購読hookを `src/features/*` へ移動
   - ルート直下に散らばっていた8個の `react-*-bridge.js` / `react-*-state-source.js` を3個の `legacy/interop/*.js` へ集約
   - classic JavaScriptの実装はまだ書き換えず、依存方向と配置を明確にする
4. **Cleanup 4: `index.html` / Vite構成を簡素化**
   - legacy script injection / copy を削減
   - 直接 `index.html` を開くためのフォールバック互換を終了
   - classic JavaScriptの機能ロジックを `src/features/*` 側へ段階的に移し、`legacy/interop/` 自体を削除する
5. **Tailwind移行を再開**
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

これらはclassic JavaScriptが保持する既存状態・イベント経路をReactへ公開するための一時的なアダプターです。以前は状態ソース3ファイル + 操作bridge 5ファイルがルート直下に分散していましたが、Cleanup 3で3ファイルへ集約しました。

互換レイヤーは複数タブ排他、完了記録、バックアップ検証などの既存の安全な処理を迂回せず、既存ボタンへの操作委譲と `useSyncExternalStore` 用のsnapshot/event公開だけを担当します。Cleanup 4でclassicロジックをfeature側へ移すときに削除します。

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

Cleanup 4完了時には、`index.html` は `#root` とViteエントリを中心とする通常の構成に寄せ、ルート直下のclassic JavaScriptと `legacy/interop/` を段階的に廃止します。その後にTailwind Step 7B以降を再開します。
