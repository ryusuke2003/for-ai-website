# リリース版数の更新

`src-tauri/tauri.conf.json` は開発時の版数を保持します。GUIリリース時の次版は、最新の `v*` tag と開発版数のうち新しい方を基準に決め、release build内だけで3ファイルへ反映します。

## 推奨: GitHub ActionsのGUIからリリース

通常のリリースはローカルでversion更新やtag pushを行わず、GitHubのGUIから実行します。

1. リリースしたい変更を `main` へマージし、CIが成功していることを確認する
2. GitHubの **Actions** を開く
3. 左側の **Release** workflowを選ぶ
4. **Run workflow** を開き、branchが `main` であることを確認する
5. `patch` / `minor` / `major` を選ぶ
6. **Run workflow** を押す

versionの更新規則はSemVerです。

| 選択 | 例 |
| --- | --- |
| `patch` | `0.1.9 -> 0.1.10` |
| `minor` | `0.1.9 -> 0.2.0` |
| `major` | `0.1.9 -> 1.0.0` |

Release workflowは次を自動で行います。

1. 最新の `v*` tag と開発版数から次のversionを決定
2. 現在の `main` commitへ同じversionの `vX.Y.Z` tagを作成
3. release buildのworkspace内だけで `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` を同じversionへ同期
4. `cargo metadata --locked` でlockfile同期を確認
5. 既存のTauri build workflowでmacOS版をbuild
6. Tauri Updater用bundleへ署名
7. `timer-macos.zip`、Updater bundle、署名、`latest.json` をGitHub Releaseへ公開

`main` への直接pushは行いません。これにより「変更はPull Request経由のみ」「protected refを直接更新しない」というRepository Rulesを維持したまま、GUIから1回でリリースできます。

workflowは同時に複数のReleaseが走らないよう直列化しています。また、既存tagの上書きは行いません。

### リリース途中で失敗した場合

tag作成まで成功したあと、macOS buildや署名で失敗した場合は、**新しくRun workflowを押さず、同じworkflow runの「Re-run failed jobs」**を使ってください。新しいRelease workflowを開始すると既存tagと衝突するためです。

## CLIからversionだけ更新する場合

ローカル作業が必要な場合も従来のpatchコマンドは利用できます。

```sh
npm run version:patch
```

minor / majorも同じscriptで指定できます。

```sh
node scripts/version-app.mjs minor
node scripts/version-app.mjs major
```

version更新scriptは次の3ファイルをまとめて同期します。

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

`Cargo.lock` の同期には対象packageと更新後のversionを限定した `cargo update` を使うため、Rust toolchainが必要です。依存関係全体は更新しません。途中で失敗した場合は3ファイルを実行前の内容へ戻します。

従来どおり、version更新commitをmainへ反映してから同じ版数の `v*` tagをpushする手動リリースも残しています。tag push時は `Tauri build` workflowがGitHub Releaseを作成します。

## アプリ内アップデート

Updater搭載版では、メニューバーのタイマーアイコンを右クリックし、更新項目から新しいバージョンをインストールできます。起動時にGitHub Releaseの `latest.json` を確認し、新しい版があれば更新項目を有効にします。

Updaterの配布物には専用署名が必要です。RepositoryのActions secretsへ次を登録しておきます。

- Name: `TAURI_SIGNING_PRIVATE_KEY`
- Value: Tauri Updater用の秘密鍵
- Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Value: 秘密鍵を生成したときに設定したパスワード

秘密鍵とパスワードはリポジトリへコミットせず、紛失しないよう別途バックアップします。公開鍵は `src-tauri/tauri.conf.json` に置きます。Release buildでは両方のsecretが設定済みかを署名前に検証し、Tauri CLIには環境変数経由で渡します。

現在インストール済みのUpdater非搭載版から、最初のUpdater搭載版への移行だけは手動で `timer-macos.zip` を取得してアプリ本体を置き換える必要があります。それ以降はアプリ内Updaterを利用できます。

## 既存データの引き継ぎ

Updaterはアプリbundleを更新しますが、Todoやテンプレートの保存データを削除する処理は行いません。bundle identifier `com.ryusuke2003.one` と既存のlocalStorageキーを維持するため、現在のTodo・テンプレート・タイマー設定は同じ保存領域を引き続き利用します。

データ形式やbundle identifierを将来変更する場合は、別途マイグレーションを用意してください。
