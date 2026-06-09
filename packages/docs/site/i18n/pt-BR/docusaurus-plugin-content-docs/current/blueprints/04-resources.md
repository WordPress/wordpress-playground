---
slug: /blueprints/steps/resources
description: Uma referência técnica para "Referências de recursos". Aprenda a usar arquivos externos para temas, plugins e conteúdo.
---

<!-- description: A technical reference for "Resource References." Learn how to use external files for themes, plugins, and content. -->

<!-- # Resources References -->

# Referências de recursos

<!-- "Resource References" allow you use external files in Blueprints -->

"Referências de recursos" permitem usar arquivos externos em Blueprints.

<div class="callout callout-info">

<!-- Blueprint steps such as [`installPlugin`](/blueprints/steps) or [`installTheme`](/blueprints/steps) require a location of the plugin or theme to be installed. -->

Etapas de Blueprint como <a href="/blueprints/steps"><code>installPlugin</code></a> ou <a href="/blueprints/steps"><code>installTheme</code></a> exigem a localização do plugin ou tema que será instalado.

<!-- That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories. -->

Essa localização pode ser definida como um <a href="#urlreference">recurso <code>URL</code></a> do arquivo <code>.zip</code> que contém o tema ou plugin. Ela também pode ser definida como um recurso <a href="#corepluginreference"><code>wordpress.org/plugins</code></a> ou <a href="#corethemereference"><code>wordpress.org/themes</code></a> para plugins/temas publicados nos diretórios oficiais do WordPress.

</div>

<!-- The following resource references are available: -->

As seguintes referências de recursos estão disponíveis:

- [URLReference](#urlreference)
- [GitDirectoryReference](#gitdirectoryreference)
- [CoreThemeReference](#corethemereference)
- [CorePluginReference](#corepluginreference)
- [VFSReference](#vfsreference)
- [LiteralReference](#literalreference)
- [BundledReference](#bundledreference)

<!-- ### URLReference -->

### URLReference

<!-- The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows: -->

O recurso `URLReference` é usado para referenciar arquivos armazenados em um
servidor remoto. O recurso `URLReference` é definido assim:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

<!-- To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows: -->

Para usar o recurso `URLReference`, você precisa fornecer a URL do arquivo. Por
exemplo, para referenciar um arquivo chamado "index.html" armazenado em um
servidor remoto, crie um `URLReference` assim:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

<!--
The `url` resource works with Blueprint steps such as [`installPlugin`](/blueprints/steps) or
[`installTheme`](/blueprints/steps).
These steps require a `ResourceType` to define the location of the plugin or the theme to install.
-->

O recurso `url` funciona com etapas de Blueprint como [`installPlugin`](/blueprints/steps) ou
[`installTheme`](/blueprints/steps).
Essas etapas exigem um `ResourceType` para definir a localização do plugin ou
tema a instalar.

<!-- With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme. Use this for built ZIP artifacts hosted on a publicly accessible URL that does not require authentication, such as a release asset. CI artifact direct-download URLs can work, but they are often short-lived or restricted. -->

Com `"resource": "url"`, podemos definir a localização de um `.zip` que contém
o plugin/tema. Use isso para artefatos ZIP já criados e hospedados em uma URL
publicamente acessível que não exija autenticação, como um asset de release.
URLs de download direto de artefatos de CI podem funcionar, mas costumam ter
duração curta ou acesso restrito.

<!-- For source code stored in a Git repository, prefer [`git:directory`](/blueprints/steps/resources#gitdirectoryreference). It can fetch a repository subdirectory from a branch, tag, or commit without requiring a ZIP archive. -->

Para código-fonte armazenado em um repositório Git, prefira
[`git:directory`](/blueprints/steps/resources#gitdirectoryreference). Ele pode
buscar um subdiretório de repositório a partir de um branch, tag ou commit sem
exigir um arquivo ZIP.

<!-- Before using a `url` resource, verify that the URL: -->

Antes de usar um recurso `url`, verifique se a URL:

<!--
- Downloads the file directly. It must not return an HTML page, redirect warning, login page, repository file viewer, or proxy error page.
- Is available without cookies, authentication, a VPN, or a temporary browser session.
- Sends CORS headers that allow Playground to fetch it.
- Points to the expected file type. `installPlugin` and `installTheme` need a plugin or theme ZIP archive unless you use another resource type.
- Will remain available. Temporary tunnel URLs, draft release assets, and short-lived CI artifacts can expire.
- Is a real ZIP archive when the step expects a ZIP. Very small downloads often mean the server returned an HTML error page instead of the archive.
-->

- Baixa o arquivo diretamente. Ela não deve retornar uma página HTML, aviso de redirecionamento, página de login, visualizador de arquivo de repositório ou página de erro de proxy.
- Está disponível sem cookies, autenticação, VPN ou sessão temporária do navegador.
- Envia cabeçalhos CORS que permitem que o Playground a busque.
- Aponta para o tipo de arquivo esperado. `installPlugin` e `installTheme` precisam de um arquivo ZIP de plugin ou tema, a menos que você use outro tipo de recurso.
- Permanecerá disponível. URLs temporárias de túnel, assets de release em rascunho e artefatos de CI de curta duração podem expirar.
- É um arquivo ZIP real quando a etapa espera um ZIP. Downloads muito pequenos costumam significar que o servidor retornou uma página HTML de erro em vez do arquivo.

<!--
For GitHub source code, do not point `url` at a repository page or a generated
ZIP from a branch when you can use `git:directory`. Use `url` for built ZIP
artifacts and `git:directory` for source directories.
-->

Para código-fonte no GitHub, não aponte `url` para uma página de repositório ou
para um ZIP gerado de um branch quando você puder usar `git:directory`. Use
`url` para artefatos ZIP criados e `git:directory` para diretórios de código-fonte.

<!-- ### GitDirectoryReference -->

### GitDirectoryReference

<!-- The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit. -->

O recurso `GitDirectoryReference` é usado para referenciar um diretório dentro
de um repositório Git. Isso é útil quando um plugin ou tema fica em uma subpasta
de um repositório, ou quando você quer instalar a partir de um branch, tag ou
commit específico.

```typescript
type GitDirectoryReference = {
	resource: 'git:directory';
	url: string; // Repository URL (https://, ssh git@..., etc.)
	path?: string; // Optional subdirectory inside the repository
	ref?: string; // Branch, tag, or commit SHA (defaults to HEAD)
	refType?: 'branch' | 'tag' | 'commit'; // Hint for resolving the ref
	'.git'?: boolean; // Experimental: include a .git directory with fetched metadata
};
```

<!-- **Example:** -->

**Exemplo:**

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
		"activate": true,
		"targetFolderName": "data-basics"
	}
}
```

<!-- **Notes:** -->

**Observações:**

<!--
- When using a branch or tag name for `ref`, you must specify `refType` (e.g. `"refType": "branch"`). Without it, only `HEAD` is reliably resolved.
- Playground automatically detects providers like GitHub and GitLab.
- Repository URLs may include or omit a trailing `.git` suffix. Extra trailing slashes are ignored.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps) and [`installTheme`](/blueprints/steps).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref.
- The folder name is derived from the URL by default (e.g. `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` in the step to override it, as shown in the example above.
-->

- Ao usar um nome de branch ou tag em `ref`, você deve especificar `refType` (por exemplo, `"refType": "branch"`). Sem isso, somente `HEAD` é resolvido de forma confiável.
- O Playground detecta automaticamente provedores como GitHub e GitLab.
- URLs de repositório podem incluir ou omitir o sufixo `.git` final. Barras finais extras são ignoradas.
- Ele lida com buscas via proxy CORS e checkouts esparsos, então você pode usar URLs que apontam para subdiretórios ou branches específicos.
- Esse recurso pode ser usado com etapas como [`installPlugin`](/blueprints/steps) e [`installTheme`](/blueprints/steps).
- Defina `".git": true` para incluir uma pasta `.git` contendo packfiles e refs, para que ferramentas cientes de Git possam detectar o checkout. Atualmente, isso espelha um clone raso do ref selecionado.
- O nome da pasta é derivado da URL por padrão (por exemplo, `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` na etapa para sobrescrevê-lo, como mostrado no exemplo acima.

<!-- ### CoreThemeReference -->

### CoreThemeReference

<!-- The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows: -->

O recurso _CoreThemeReference_ é usado para referenciar temas principais do
WordPress. O recurso _CoreThemeReference_ é definido assim:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

<!-- To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows: -->

Para usar o recurso _CoreThemeReference_, você precisa fornecer o slug do tema.
Por exemplo, para referenciar o tema "Twenty Twenty-One", crie um
_CoreThemeReference_ assim:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

<!-- ### CorePluginReference -->

### CorePluginReference

<!-- The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows: -->

O recurso _CorePluginReference_ é usado para referenciar plugins principais do
WordPress. O recurso _CorePluginReference_ é definido assim:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

<!-- To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows: -->

Para usar o recurso _CorePluginReference_, você precisa fornecer o slug do
plugin. Por exemplo, para referenciar o plugin "Akismet", crie um
_CorePluginReference_ assim:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

<!-- ### VFSReference -->

### VFSReference

<!-- The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows: -->

O recurso _VFSReference_ é usado para referenciar arquivos armazenados em um
sistema de arquivos virtual (VFS). O VFS é um sistema de arquivos armazenado em
memória e pode ser usado para armazenar arquivos que não fazem parte do sistema
de arquivos do sistema operacional. O recurso _VFSReference_ é definido assim:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

<!-- To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows: -->

Para usar o recurso _VFSReference_, você precisa fornecer o caminho para o
arquivo no VFS. Por exemplo, para referenciar um arquivo chamado "index.html"
armazenado na raiz do VFS, crie um _VFSReference_ assim:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

<!-- ### LiteralReference -->

### LiteralReference

<!-- The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows: -->

O recurso _LiteralReference_ é usado para referenciar arquivos armazenados como
literais no código. O recurso _LiteralReference_ é definido assim:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

<!-- To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows: -->

Para usar o recurso _LiteralReference_, você precisa fornecer o nome do arquivo
e o conteúdo dele. Por exemplo, para referenciar um arquivo chamado "index.html"
que contém o texto "Hello, World!", crie um _LiteralReference_ assim:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```

<!-- ### BundledReference -->

### BundledReference

<!-- The `BundledReference` resource is used to reference files that are bundled with the Blueprint itself. This is particularly useful for creating self-contained Blueprint bundles that include all necessary resources. The `BundledReference` resource is defined as follows: -->

O recurso `BundledReference` é usado para referenciar arquivos empacotados com
o próprio Blueprint. Isso é especialmente útil para criar pacotes de Blueprint
autocontidos que incluem todos os recursos necessários. O recurso
`BundledReference` é definido assim:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

<!-- To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows: -->

Para usar o `BundledReference`, você precisa fornecer o caminho relativo para o
arquivo dentro do pacote. Por exemplo, para referenciar um arquivo chamado
"plugin.php" que está empacotado com o Blueprint, crie um `BundledReference`
assim:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

<!-- Blueprint bundles can be distributed in various formats, including: -->

Pacotes de Blueprint podem ser distribuídos em vários formatos, incluindo:

<!--
- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together
-->

- Arquivos ZIP com um arquivo `blueprint.json` no nível superior
- Diretórios contendo um arquivo `blueprint.json` e recursos relacionados
- URLs remotas onde o Blueprint e seus recursos estão hospedados juntos

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Para mais informações sobre pacotes de Blueprint, consulte a documentação de
[Pacotes de Blueprint](/blueprints/bundles).
