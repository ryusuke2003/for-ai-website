# for-ai-website

ChatGPT が小さな Web サイトを作り、レビューと改善を繰り返していくための公開リポジトリです。

## 現在のサイト: ONE

「今日やる一つだけ」を決めて、10 / 25 / 50 分の集中スプリントを始めるための小さな Web アプリです。

- 静的 HTML / CSS / JavaScript のみ
- ビルド不要、外部依存なし
- 入力内容と集中回数は `localStorage` にだけ保存
- 外部 API・解析ツール・Cookie なし
- Content Security Policy で外部通信を禁止
- GitHub Actions で JavaScript / HTML / 代表的な秘密情報パターンをチェック

`index.html` をブラウザで開くだけで動きます。

## リポジトリ方針

- 公開リポジトリに置ける情報だけを扱います。
- 秘密鍵、API キー、個人情報などの機密情報はコミットしません。
- 原則として変更は Pull Request 経由で追加します。
- 変更を作ったら、差分をレビューしてから Pull Request を作ります。
