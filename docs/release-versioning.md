# リリース版数の更新

Tauriアプリの版数は `src-tauri/tauri.conf.json` を正本とします。

patch版を1つ上げるときは、手作業で3ファイルを直さず次の1コマンドを使います。

```sh
npm run version:patch
```

このコマンドは現在のTauri版数を基準に、たとえば `0.1.1 -> 0.1.2` のようにpatch版を1つ上げ、次をまとめて同期します。

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

`Cargo.lock` の同期には、対象packageと更新後のversionを限定した `cargo update` を使うため、Rust toolchainが必要です。依存関係全体は更新しません。途中で失敗した場合は3ファイルを実行前の内容へ戻します。

更新後は差分を確認してPRへ含めます。

```sh
git diff -- src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "v0.1.2へ更新"
git push
```

PRをmainへマージし、CIが成功したあとに同じ版数のタグをpushします。

```sh
git switch main
git pull --ff-only
git tag -a v0.1.2 -m "v0.1.2"
git push origin v0.1.2
```

`v*` タグのpush後はGitHub ActionsがmacOS版をビルドし、`timer-macos.zip` をGitHub Releaseへ添付します。
