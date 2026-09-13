# テスト方針

ReactのUI、hook、store、ブラウザAPI連携など、実際にJavaScriptを動かして確認できる振る舞いはVitestとReact Testing Libraryで検証します。

特にタイマー完了、進捗保存、localStorage障害時のフォールバック、複数タブ調停、セッションID生成のような実行時仕様は、ソース文字列の並びではなく利用者から見える結果と状態遷移をテストします。

Python検査はリポジトリ全体の静的ルールやセキュリティ境界に限定します。少なくとも次はPythonのまま維持します。

- `scripts/secret_checks.py`
- `scripts/browser_policy_checks.py`
- `scripts/static_checks.py`
- `scripts/tailwind_migration_checks.py`

バックアップ系など、まだPythonで残っている挙動検査は別PRでVitest化を検討します。一度に全廃せず、対応する実行テストを追加してから置き換えます。
