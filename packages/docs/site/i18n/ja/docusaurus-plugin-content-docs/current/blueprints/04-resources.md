---
slug: /blueprints/steps/resources
---

# 参照リソース

<!--
# Resources References
-->

「リソース参照」を使用すると、ブループリントで外部ファイルを使用できるようになります。

<!--
"Resource References" allow you use external files in Blueprints
-->

:::info
[`installPlugin`](/blueprints/steps#InstallPluginStep) や [`installTheme`](/blueprints/steps#InstallThemeStep) などのブループリントステップでは、インストールするプラグインまたはテーマの場所を指定する必要があります。

その場所は、テーマまたはプラグインを含む `.zip` ファイルの [`URL` リソース](#urlreference) として定義できます。また、公式 WordPress ディレクトリに公開されているプラグイン/テーマの場合は、[`wordpress.org/plugins`](#corepluginreference) または [`wordpress.org/themes`](#corethemereference) リソースとして定義することもできます。
:::

<!--
:::info
Blueprints steps such as [`installPlugin`](/blueprints/steps#InstallPluginStep) or [`installTheme`](/blueprints/steps#InstallThemeStep) require a location of the plugin or theme to be installed.

That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories.
:::
-->

次のリソース参照が利用可能です。

<!--
The following resource references are available:
-->

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### URL 参照

<!--
### URLReference
-->

`URLReference` リソースは、リモートサーバーに保存されているファイルを参照するために使用されます。`URLReference` リソースは次のように定義されます。

<!--
The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows:
-->

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

`URLReference` リソースを使用するには、ファイルの URL を指定する必要があります。例えば、リモートサーバーに保存されている「index.html」という名前のファイルを参照するには、次のように `URLReference` を作成します。

<!--
To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows:
-->

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

リソース `url` タイプは、[`installPlugin`](/blueprints/steps#InstallPluginStep) や
[`installTheme`](http://localhost:3000/wordpress-playground/blueprints/steps#InstallThemeStep) などのブループリントステップと組み合わせて使用します。
これらのステップでは、インストールするプラグインまたはテーマの場所を定義する `ResourceType` が必要です。

<!--
The resource `url` type works really in combination with blueprint steps such as [`installPlugin`](/blueprints/steps#InstallPluginStep) or
[`installTheme`](http://localhost:3000/wordpress-playground/blueprints/steps#InstallThemeStep).
These steps require a `ResourceType` to define the location of the plugin or the theme to install.
-->

`"resource": "url"` を使用すると、GitHub リポジトリを直接ポイントできる URL を介して、プラグイン/テーマを含む `.zip` の場所を定義できます。

<!--
With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme via a URL that can point directly to a GitHub repo.
-->

:::tip
Playground プロジェクトは[GitHub Proxy](https://playground.wordpress.net/proxy)を提供しています。これを使用すると、プラグインやテーマを含むリポジトリ（またはリポジトリ内のフォルダ）から `.zip` ファイルを生成できます。このツールは、CORS の問題などを回避するのに非常に便利です。
:::

<!--
:::tip
The Playground project provides a [GitHub Proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin or theme. This tool is very useful for avoiding CORS issues, among others.
:::
-->

### コアテーマリファレンス

<!--
### CoreThemeReference
-->

_CoreThemeReference_ リソースは、WordPress コアテーマを参照するために使用されます。_CoreThemeReference_ リソースは以下のように定義されています。

<!--
The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows:
-->

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

_CoreThemeReference_ リソースを使用するには、テーマのスラッグを指定する必要があります。例えば、「Twenty Twenty-One」テーマを参照するには、次のように _CoreThemeReference_ を作成します。

<!--
To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows:
-->

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### コアプラグインリファレンス

<!--
### CorePluginReference
-->

_CorePluginReference_ リソースは、WordPress コアプラグインを参照するために使用されます。_CorePluginReference_ リソースは以下のように定義されています。

<!--
The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows:
-->

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

_CorePluginReference_ リソースを使用するには、プラグインのスラッグを指定する必要があります。例えば、「 Akismet 」プラグインを参照するには、次のように _CorePluginReference_ を作成します。

<!--
To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows:
-->

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### VFS リファレンス

<!--
### VFSReference
-->

_VFSReference_ リソースは、仮想ファイルシステム (VFS) に格納されているファイルを参照するために使用されます。VFS はメモリに格納されるファイルシステムであり、オペレーティングシステムのファイルシステムに含まれないファイルを格納できます。_VFSReference_ リソースは次のように定義されています。

<!--
The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows:
-->

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

_VFSReference_ リソースを使用するには、VFS 内のファイルへのパスを指定する必要があります。例えば、VFS のルートに保存されている「index.html」という名前のファイルを参照するには、次のように _VFSReference_ を作成します。

<!--
To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows:
-->

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### リテラル参照

<!--
### LiteralReference
-->

_LiteralReference_ リソースは、コード内でリテラルとして保存されているファイルを参照するために使用されます。_LiteralReference_ リソースは次のように定義されます。

<!--
The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows:
-->

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

_LiteralReference_ リソースを使用するには、ファイル名とその内容を指定する必要があります。例えば、「Hello, World!」というテキストを含む「index.html」という名前のファイルを参照するには、次のように _LiteralReference_ を作成します。

<!--
To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows:
-->

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```

### バンドルリファレンス

<!--
### BundledReference
-->

`BundledReference` リソースは、ブループリント自体にバンドルされているファイルを参照するために使用されます。これは、必要なリソースをすべて含む自己完結型のブループリントバンドルを作成する場合に特に便利です。`BundledReference` リソースは次のように定義されます。

<!--
The `BundledReference` resource is used to reference files that are bundled with the Blueprint itself. This is particularly useful for creating self-contained Blueprint bundles that include all necessary resources. The `BundledReference` resource is defined as follows:
-->

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

`BundledReference` リソースを使用するには、バンドル内のファイルへの相対パスを指定する必要があります。例えば、ブループリントにバンドルされている「plugin.php」というファイルを参照するには、次のように `BundledReference` を作成します。

<!--
To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows:
-->

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

ブループリント バンドルは、次のようなさまざまな形式で配布できます。

<!--
Blueprint bundles can be distributed in various formats, including:
-->

-   トップレベルに `blueprint.json` ファイルを含む ZIP ファイル
-   `blueprint.json` ファイルと関連リソースを含むディレクトリ
-   ブループリントとそのリソースが一緒にホストされているリモート URL

<!--
-   ZIP files with a top-level `blueprint.json` file
-   Directories containing a `blueprint.json` file and related resources
-   Remote URLs where the Blueprint and its resources are hosted together
-->

ブループリント バンドルの詳細については、[ブループリント バンドル](/blueprints/bundles) ドキュメントを参照してください。

<!--
For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation.
-->
