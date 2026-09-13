# テスト方針

ReactのUI、hook、store、ブラウザAPI連携など、実際にJavaScriptを動かして確認できる振る舞いはVitestとReact Testing Libraryで検証します。

特にタイマー完了、進捗保存、localStorage障害時のフォールバック、複数タブ調停、セッションID生成、バックアップ、Todo配置・復元のような実行時仕様は、ソース文字列の並びではなく利用者から見える結果と状態遷移をテストします。

Python検査はリポジトリ全体の静的ルールやセキュリティ / アーキテクチャ境界に限定します。現在残すPython検査は次の6本です。

- `scripts/secret_checks.py`: 秘密情報らしい文字列の混入防止
- `scripts/browser_policy_checks.py`: CSPなどブラウザセキュリティ境界
- `scripts/static_checks.py`: 静的資産とlegacy復活防止
- `scripts/tailwind_migration_checks.py`: Tailwind移行後の構成境界
- `scripts/focus_visibility_checks.py`: `:focus-visible` と集中表示CSSの境界
- `scripts/timer_state_checks.py`: Reactタイマー正本とlegacy実装不在の境界

バックアップ、completion persistence、runtime storage fallback、tab session IDなど、以前Python / 単発Nodeスクリプトで確認していた実行時挙動はVitestへ移行済みです。

今後も新しい利用者向け挙動は原則Vitestへ追加し、Pythonは「特定ファイルを復活させない」「セキュリティポリシーを維持する」といったリポジトリ横断の静的制約に使います。
