---
title: ブループリントバンドル
slug: /blueprints/bundles
---

# ブループリントバンドル

<!--
# Blueprint Bundles
-->

ブループリントバンドルは、ブループリント宣言（`blueprint.json`）と、コンパイルおよび実行に必要なすべての追加リソースを含む自己完結型パッケージです。これにより、WordPress Playground の完全なセットアップを容易に配布・共有できます。

<!--
Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.
-->

## What are Blueprint Bundles?

<!--
## ブループリント バンドルとは何ですか?
-->

ブループリント バンドルは、次のものを含むファイルのコレクションです:

<!--
A Blueprint bundle is a collection of files that includes:
-->

1. ブループリントの設定を定義する `blueprint.json` ファイル
2. ブループリントが参照する追加リソース（テーマ、プラグイン、コンテンツファイルなど）

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

ブループリント バンドルはさまざまな形式で配布できます:

<!--
Blueprint bundles can be distributed in various formats:
-->

-   トップレベルの `blueprint.json` ファイルと追加リソースを含む ZIP ファイル
-   Git リポジトリ内の `blueprint.json` とその他のリソースが格納されているディレクトリ
-   コンピュータ上のローカルディレクトリ
-   関連ファイルがインライン化されたインライン JavaScript オブジェクト

<!--
-   A ZIP file with a top-level `blueprint.json` file and additional resources
-   A directory inside a git repository where `blueprint.json` resides alongside other resources
-   A local directory on your computer
-   An inline JavaScript object with the relevant files inlined
-->

## ブループリントバンドルの使用

<!--
## Using Blueprint Bundles
-->

### ウェブサイト

<!--
### On the Website
-->

WordPress Playground ウェブサイトは、`?blueprint-url=` クエリパラメータを通じて Blueprint バンドルをサポートしています。Blueprint バンドルを含む ZIP ファイルの URL を指定できます。

<!--
The WordPress Playground website supports Blueprint bundles through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle.
-->

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

ZIP ファイルには、ルート レベルの `blueprint.json` ファイルと、ブループリントによって参照される追加のリソースが含まれている必要があります。

<!--
The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

### CLI の場合

<!--
### In the CLI
-->

Playground CLI は `--blueprint=` オプションを通じてブループリントバンドルをサポートします。以下のオプションを指定できます:

<!--
The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:
-->

-   ブループリントバンドルを含むローカルディレクトリへのパス
-   ブループリントバンドルを含むローカル ZIP ファイルへのパス
-   リモートブループリントバンドルへの URL (http:// または https://)

<!--
-   A path to a local directory containing a Blueprint bundle
-   A path to a local ZIP file containing a Blueprint bundle
-   A URL to a remote Blueprint bundle (http:// or https://)
-->

例えば：

<!--
For example:
-->

```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

デフォルトでは、セキュリティ上の理由から、CLI はローカルファイルへのアクセスを制限します。ブループリントが同じ親ディレクトリ内のファイルにアクセスする必要がある場合は、`--blueprint-may-read-adjacent-files`フラグを使用して明示的に権限を付与する必要があります。

<!--
By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag:
-->

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

## ブループリントバンドルの作成

<!--
## Creating Blueprint Bundles
-->

### 基本構造

<!--
### Basic Structure
-->

基本的なブループリント バンドルは次のようになります:

<!--
A basic Blueprint bundle might look like this:
-->

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

### バンドルされたリソースを含むブループリントの例

<!--
### Example Blueprint with Bundled Resources
-->

バンドルされたリソースを参照する `blueprint.json` ファイルの例を次に示します。

<!--
Here's an example of a `blueprint.json` file that references bundled resources:
-->

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/theme.zip"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/plugin.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content/sample-content.wxr"
			}
		}
	]
}
```

この例では、ブループリントはバンドルされたいくつかのリソースを参照します:

<!--
In this example, the Blueprint references several bundled resources:
-->

-   `/bundled-text-file.txt` にあるテキストファイル
-   `/theme.zip` にあるテーマの ZIP ファイル
-   `/plugin.zip` にあるプラグインの ZIP ファイル
-   `/content/sample-content.wxr` にある WXR コンテンツファイル

<!--
-   A text file at `/bundled-text-file.txt`
-   A theme ZIP file at `/theme.zip`
-   A plugin ZIP file at `/plugin.zip`
-   A WXR content file at `/content/sample-content.wxr`
-->

### ZIP バンドルの作成

<!--
### Creating a ZIP Bundle
-->

ZIP バンドルを作成するには、`blueprint.json` と必要なすべてのリソースを含むディレクトリを作成し、それを ZIP 形式で圧縮するだけです:

<!--
To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up:
-->

```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```

## トラブルシューティング

<!--
## Troubleshooting
-->

ブループリント バンドルで問題が発生した場合:

<!--
If you encounter issues with Blueprint bundles:
-->

1. `blueprint.json` ファイルが ZIP ファイルのルートレベルにあることを確認してください。
2. バンドルされたリソース参照内のすべてのパスが正しいことを確認してください。
3. ZIP ファイルが適切にフォーマットされていることを確認してください。
4. CLI を使用する場合は、`--blueprint-may-read-adjacent-files` フラグが必要かどうかを確認してください。
5. 必要なすべてのリソースがバンドルに含まれていることを確認してください。

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->
