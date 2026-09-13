# React / Tailwind 構成整理方針

ONE は vanilla JavaScript から React へ段階移行してきたため、現在は移行用の bridge / state source / 複数root / フォールバックDOMが残っています。機能を壊さずにこの足場を外してから、Tailwind移行を再開します。

## 現在

- React 19.3.0 / React DOM 19.3.0
- Vite 8.3.0
- Tailwind CSS 4.3.3 / `@tailwindcss/vite` 4.3.3
- React管理UIの状態購読は `useSyncExternalStore` ベースへ統一済み
- React管理UIから `MutationObserver` ベースの状態同期は撤去済み
- Tailwind Step 7Aとして Hero / Footer / ThemeSwitcher のutility化まで完了
- タイマー保存形式、複数タブ排他、通知権限、Wake Lock、バックアップのロールバックなどの安全性ロジックは維持する

## いったん止めるもの

Tailwind Step 7B以降は、React構成の大掃除が終わるまで停止します。移行用DOM構造と旧CSSを同時に触ると回帰原因を切り分けにくいためです。

## 大掃除の順番

1. **Cleanup 1: 移行用の足場を削除**（この段階）
   - `react_migration_checks.py` など、過去の移行形を固定するだけの検査を削除
   - 機能・セキュリティ・保存・複数タブ・バックアップの振る舞いテストは維持
2. **Cleanup 2: `App.jsx` + 単一React root**
   - 複数の `createRoot()` と `wrapSiblingRange()` を廃止
   - React管理UIを1つのコンポーネントツリーへまとめる
3. **Cleanup 3: bridge / state source を feature 単位へ整理**
   - `react-*-bridge.js` / `react-*-state-source.js` を段階的に廃止
   - タイマー、記録、バックアップのロジックを `src/features/*` へ移す
   - 安全性ロジックは書き換えず、まず配置と依存方向を整理する
4. **Cleanup 4: `index.html` / Vite構成を簡素化**
   - legacy script injection / copy を削減
   - 直接 `index.html` を開くためのフォールバック互換を終了し、通常のViteアプリ構成へ寄せる
   - 最終的に `#root` + `/src/main.jsx` を中心とする構成へする
5. **Tailwind移行を再開**
   - 7B: タイマーUI
   - 7C: 集中記録・統計・バックアップUI
   - 7D: テーマ色・フォーカス・レスポンシブと旧CSS整理

## 残すテストの考え方

移行手順そのものを固定するテストは削除します。一方で、次の振る舞いは今後もCIで守ります。

- タイマー状態と復元
- 複数タブの所有権・二重記録防止
- 日付境界と履歴
- 完了音 / 通知 / Wake Lock
- バックアップ検証、復元前退避、ロールバック
- 保存障害時のフォールバック
- CSP、フォーカス、秘密情報混入防止

## 整理後の目標構成

```text
src/
├── App.jsx
├── main.jsx
├── components/
├── features/
│   ├── timer/
│   ├── progress/
│   └── backup/
├── hooks/
└── styles/
```

ルート直下にある多数の `react-*.js` と legacy script は、Cleanup 2〜4で安全に減らしていきます。
