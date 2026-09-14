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

`v*` タグのpush後はGitHub ActionsがmacOS版をビルドし、手動インストール用の `timer-macos.zip` に加えて、Tauri Updater用のbundle・署名・`latest.json` をGitHub Releaseへ添付します。

## アプリ内アップデート

Updater搭載版では、メニューバーのタイマーアイコンを右クリックし、更新項目から新しいバージョンをインストールできます。起動時にGitHub Releaseの `latest.json` を確認し、新しい版があれば更新項目を有効にします。

Updaterの配布物には専用署名が必要です。最初のUpdater対応リリースを作る前に、RepositoryのActions secretsへ次を登録してください。

- Name: `TAURI_SIGNING_PRIVATE_KEY`
- Value: Tauri Updater用の秘密鍵
- Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Value: 秘密鍵を生成したときに設定したパスワード

秘密鍵とパスワードはリポジトリへコミットせず、紛失しないよう別途バックアップします。公開鍵は `src-tauri/tauri.conf.json` に置きます。タグのbuildでは両方のsecretが設定済みかを署名前に検証し、Tauri CLIには環境変数経由で渡します。

現在インストール済みのUpdater非搭載版から、最初のUpdater搭載版への移行だけは手動で `timer-macos.zip` を取得してアプリ本体を置き換える必要があります。それ以降はアプリ内Updaterを利用できます。

## 既存データの引き継ぎ

Updaterはアプリbundleを更新しますが、Todoやテンプレートの保存データを削除する処理は行いません。bundle identifier `com.ryusuke2003.one` と既存のlocalStorageキーを維持するため、現在のTodo・テンプレート・タイマー設定は同じ保存領域を引き続き利用します。

データ形式やbundle identifierを将来変更する場合は、別途マイグレーションを用意してください。
