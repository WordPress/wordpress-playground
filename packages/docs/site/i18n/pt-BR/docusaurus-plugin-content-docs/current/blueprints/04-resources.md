# Referências de Recursos

"Referências de Recursos" permitem que você use arquivos externos em Blueprints

:::info
Etapas de Blueprints como [`installPlugin`](/blueprints/steps#InstallPluginStep) ou [`installTheme`](/blueprints/steps#InstallThemeStep) exigem um local do plugin ou tema a ser instalado.

Esse local pode ser definido como um recurso [URL](#urlreference) do arquivo `.zip` contendo o tema ou plugin. Também pode ser definido como um recurso [`wordpress.org/plugins`](#corepluginreference) ou [`wordpress.org/themes`](#corethemereference) para aqueles plugins/temas publicados nos diretórios oficiais do WordPress.
:::

As seguintes referências de recursos estão disponíveis:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### Referência de URL

O recurso `URLReference` é usado para referenciar arquivos armazenados em um servidor remoto. O recurso `URLReference` é definido da seguinte forma:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

Para usar o recurso `URLReference`, você precisa fornecer a URL do arquivo. Por exemplo, para referenciar um arquivo chamado "index.html" armazenado em um servidor remoto, você pode criar um `URLReference` da seguinte forma:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

O tipo de recurso `url` funciona realmente em combinação com etapas de blueprint como [`installPlugin`](/blueprints/steps#InstallPluginStep) ou [`installTheme`](/blueprints/steps#InstallThemeStep). Essas etapas exigem um `ResourceType` para definir o local do plugin ou do tema a instalar.

Com um `"resource": "url"` podemos definir o local de um `.zip` contendo o plugin/tema via uma URL que pode apontar diretamente para um repositório GitHub.

:::tip
O projeto Playground fornece um [Proxy GitHub](https://playground.wordpress.net/proxy) que permite gerar um `.zip` a partir de um repositório (ou mesmo uma pasta dentro de um repo) contendo seu plugin ou tema. Essa ferramenta é muito útil para evitar problemas de CORS, entre outros.
:::

### Referência de Diretório Git

O recurso `GitDirectoryReference` é usado para referenciar um diretório dentro de um repositório Git. Isso é útil quando um plugin ou tema está em uma subpasta de um repo, ou quando você quer instalar de um branch, tag ou commit específico.

```typescript
type GitDirectoryReference = {
	resource: 'git:directory';
	url: string; // URL do repositório (https://, ssh git@..., etc.)
	path?: string; // Subdiretório opcional dentro do repositório
	ref?: string; // Branch, tag ou SHA de commit opcional
	'.git'?: boolean; // Experimental: incluir um diretório .git com metadados obtidos
};
```

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
		"activate": true
	}
}
```

**Notas:**

-   O Playground detecta automaticamente provedores como GitHub e GitLab.
-   Ele lida com buscas através de proxy por CORS e URLs parciais, para que você possa usar URLs que apontam para subdiretórios ou branches específicos.
-   Este recurso pode ser usado como etapas de [`installPlugin`](/blueprints/steps#InstallPluginStep) e [`installTheme`](/blueprints/steps#InstallThemeStep).
-   Defina `".git": true` para incluir uma pasta `.git` contendo packfiles e refs para que ferramentas compatíveis com Git possam detectar a chegada dos arquivos. Atualmente, isso espelha um clone superficial da ref selecionada.

### Referência de Tema Principal

O recurso _CoreThemeReference_ é usado para referenciar temas principais do WordPress. O recurso _CoreThemeReference_ é definido da seguinte forma:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

Para usar o recurso _CoreThemeReference_, você precisa fornecer o slug do tema. Por exemplo, para referenciar o tema "Twenty Twenty-One", você pode criar um _CoreThemeReference_ da seguinte forma:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### Referência de Plugin Principal

O recurso _CorePluginReference_ é usado para referenciar plugins principais do WordPress. O recurso _CorePluginReference_ é definido da seguinte forma:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

Para usar o recurso _CorePluginReference_, você precisa fornecer o slug do plugin. Por exemplo, para referenciar o plugin "Akismet", você pode criar um _CorePluginReference_ da seguinte forma:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### Referência VFS

O recurso _VFSReference_ é usado para referenciar arquivos armazenados em um sistema de arquivos virtual (VFS). O VFS é um sistema de arquivos armazenado na memória e pode ser usado para armazenar arquivos que não fazem parte do sistema de arquivos do sistema operacional. O recurso _VFSReference_ é definido da seguinte forma:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

Para usar o recurso _VFSReference_, você precisa fornecer o caminho para o arquivo no VFS. Por exemplo, para referenciar um arquivo chamado "index.html" armazenado na raiz do VFS, você pode criar um _VFSReference_ da seguinte forma:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### Referência Literal

O recurso _LiteralReference_ é usado para referenciar arquivos armazenados como literais no código. O recurso _LiteralReference_ é definido da seguinte forma:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

Para usar o recurso _LiteralReference_, você precisa fornecer o nome do arquivo e seu conteúdo. Por exemplo, para referenciar um arquivo chamado "index.html" que contém o texto "Olá, Mundo!", você pode criar um _LiteralReference_ da seguinte forma:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Olá, Mundo!"
}
```

### Referência Agrupada

O recurso `BundledReference` é usado para referenciar arquivos que são agrupados com o próprio Blueprint. Isso é particularmente útil para criar blueprints autocontidos que incluem todos os recursos necessários. O recurso `BundledReference` é definido da seguinte forma:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

Para usar o recurso `BundledReference`, você precisa fornecer o caminho relativo para o arquivo dentro do pacote. Por exemplo, para referenciar um arquivo chamado "plugin.php" agrupado com o Blueprint, você pode criar um `BundledReference` da seguinte forma:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

Os pacotes Blueprint podem ser distribuídos em vários formatos, incluindo:

-   Arquivos ZIP com um arquivo `blueprint.json` no nível superior
-   Diretórios contendo um arquivo `blueprint.json` e recursos relacionados
-   URLs remotas onde o Blueprint e seus recursos estão hospedados juntos

Para mais informações sobre pacotes Blueprint, consulte a documentação de [Pacotes Blueprint](/blueprints/bundles).
