---
slug: /blueprints/steps/resources
description_long: Uma referência técnica para "Referências de Recursos". Saiba como usar arquivos externos para temas, plugins e conteúdo.
---

<!-- A technical reference for "Resource References." Learn how to use external files for themes, plugins, and content. -->

# Resources References

<!-- "Resource References" allow you use external files in Blueprints -->

"Referências de Recursos" permitem que você use arquivos externos em Blueprints

:::info

<!-- Blueprints steps such as [`installPlugin`](/blueprints/steps#InstallPluginStep) or [`installTheme`](/blueprints/steps#InstallThemeStep) require a location of the plugin or theme to be installed.

That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories. -->

Etapas de Blueprints como [`installPlugin`](/blueprints/steps#InstallPluginStep) ou [`installTheme`](/blueprints/steps#InstallThemeStep) exigem um local do plugin ou tema a ser instalado.

Esse local pode ser definido como um recurso [URL](#urlreference) do arquivo `.zip` contendo o tema ou plugin. Também pode ser definido como um recurso [`wordpress.org/plugins`](#corepluginreference) ou [`wordpress.org/themes`](#corethemereference) para aqueles plugins/temas publicados nos diretórios oficiais do WordPress.
:::

<!-- The following resource references are available: -->

As seguintes referências de recursos estão disponíveis:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### URLReference

<!-- The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows: -->

O recurso `URLReference` é usado para referenciar arquivos armazenados em um servidor remoto. O recurso `URLReference` é definido da seguinte forma:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

<!-- To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows: -->

Para usar o recurso `URLReference`, você precisa fornecer a URL do arquivo. Por exemplo, para referenciar um arquivo chamado "index.html" armazenado em um servidor remoto, você pode criar um `URLReference` da seguinte forma:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

<!-- The resource `url` type works really in combination with blueprint steps such as [`installPlugin`](/blueprints/steps#InstallPluginStep) or [`installTheme`](/blueprints/steps#InstallThemeStep). These steps require a `ResourceType` to define the location of the plugin or the theme to install.

With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme via a URL that can point directly to a GitHub repo. -->

O tipo de recurso `url` funciona realmente em combinação com etapas de blueprint como [`installPlugin`](/blueprints/steps#InstallPluginStep) ou [`installTheme`](/blueprints/steps#InstallThemeStep). Essas etapas exigem um `ResourceType` para definir o local do plugin ou do tema a instalar.

Com um `"resource": "url"` podemos definir o local de um `.zip` contendo o plugin/tema via uma URL que pode apontar diretamente para um repositório GitHub.

:::tip

<!-- The Playground project provides a [GitHub Proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin or theme. This tool is very useful for avoiding CORS issues, among others. -->

O projeto Playground fornece um [Proxy GitHub](https://playground.wordpress.net/proxy) que permite gerar um `.zip` a partir de um repositório (ou mesmo uma pasta dentro de um repo) contendo seu plugin ou tema. Essa ferramenta é muito útil para evitar problemas de CORS, entre outros.
:::

### GitDirectoryReference

<!-- The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit. -->

O recurso `GitDirectoryReference` é usado para referenciar um diretório dentro de um repositório Git. Isso é útil quando um plugin ou tema está em uma subpasta de um repo, ou quando você quer instalar de um branch, tag ou commit específico.

```typescript
type GitDirectoryReference = {
	resource: 'git:directory';
	url: string; // Repository URL (https://, ssh git@..., etc.)
	path?: string; // Optional subdirectory inside the repository
	ref?: string; // Optional branch, tag, or commit SHA
	'.git'?: boolean; // Experimental: include a .git directory with fetched metadata
};
```

**Example:**

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "git:directory",
		"url": "https://github.com/WordPress/block-development-examples",
		"ref": "HEAD",
		"path": "plugins/data-basics-59c8f8"
	},
	"options": {
		"activate": true
	}
}
```

**Notas:**

<!-- - Playground automatically detects providers like GitHub and GitLab.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps#InstallPluginStep) and [`installTheme`](/blueprints/steps#InstallThemeStep).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref. -->

- O Playground detecta automaticamente provedores como GitHub e GitLab.
- Ele lida com buscas através de proxy por CORS e URLs parciais, para que você possa usar URLs que apontam para subdiretórios ou branches específicos.
- Este recurso pode ser usado como etapas de [`installPlugin`](/blueprints/steps#InstallPluginStep) e [`installTheme`](/blueprints/steps#InstallThemeStep).
- Defina `".git": true` para incluir uma pasta `.git` contendo packfiles e refs para que ferramentas compatíveis com Git possam detectar a chegada dos arquivos. Atualmente, isso espelha um clone superficial da ref selecionada.

### CoreThemeReference

<!-- The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows: -->

O recurso _CoreThemeReference_ é usado para referenciar temas principais do WordPress. O recurso _CoreThemeReference_ é definido da seguinte forma:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

<!-- To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows: -->

Para usar o recurso _CoreThemeReference_, você precisa fornecer o slug do tema. Por exemplo, para referenciar o tema "Twenty Twenty-One", você pode criar um _CoreThemeReference_ da seguinte forma:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### CorePluginReference

<!-- The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows: -->

O recurso _CorePluginReference_ é usado para referenciar plugins principais do WordPress. O recurso _CorePluginReference_ é definido da seguinte forma:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

<!-- To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows: -->

Para usar o recurso _CorePluginReference_, você precisa fornecer o slug do plugin. Por exemplo, para referenciar o plugin "Akismet", você pode criar um _CorePluginReference_ da seguinte forma:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### VFSReference

<!-- The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows: -->

O recurso _VFSReference_ é usado para referenciar arquivos armazenados em um sistema de arquivos virtual (VFS). O VFS é um sistema de arquivos armazenado na memória e pode ser usado para armazenar arquivos que não fazem parte do sistema de arquivos do sistema operacional. O recurso _VFSReference_ é definido da seguinte forma:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

<!-- To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows: -->

Para usar o recurso _VFSReference_, você precisa fornecer o caminho para o arquivo no VFS. Por exemplo, para referenciar um arquivo chamado "index.html" armazenado na raiz do VFS, você pode criar um _VFSReference_ da seguinte forma:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### LiteralReference

<!-- The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows: -->

O recurso _LiteralReference_ é usado para referenciar arquivos armazenados como literais no código. O recurso _LiteralReference_ é definido da seguinte forma:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

<!-- To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows: -->

Para usar o recurso _LiteralReference_, você precisa fornecer o nome do arquivo e seu conteúdo. Por exemplo, para referenciar um arquivo chamado "index.html" que contém o texto "Olá, Mundo!", você pode criar um _LiteralReference_ da seguinte forma:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Olá, Mundo!"
}
```

### BundledReference

<!-- The `BundledReference` resource is used to reference files that are bundled with the Blueprint itself. This is particularly useful for creating self-contained Blueprint bundles that include all necessary resources. The `BundledReference` resource is defined as follows: -->

O recurso `BundledReference` é usado para referenciar arquivos que são agrupados com o próprio Blueprint. Isso é particularmente útil para criar blueprints autocontidos que incluem todos os recursos necessários. O recurso `BundledReference` é definido da seguinte forma:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

<!-- To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows: -->

Para usar o recurso `BundledReference`, você precisa fornecer o caminho relativo para o arquivo dentro do pacote. Por exemplo, para referenciar um arquivo chamado "plugin.php" agrupado com o Blueprint, você pode criar um `BundledReference` da seguinte forma:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

<!-- Blueprint bundles can be distributed in various formats, including:

- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together

For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Os pacotes Blueprint podem ser distribuídos em vários formatos, incluindo:

- Arquivos ZIP com um arquivo `blueprint.json` no nível superior
- Diretórios contendo um arquivo `blueprint.json` e recursos relacionados
- URLs remotas onde o Blueprint e seus recursos estão hospedados juntos

Para mais informações sobre pacotes Blueprint, consulte a documentação de [Pacotes Blueprint](/blueprints/bundles).
