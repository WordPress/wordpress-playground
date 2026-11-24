---
slug: /blueprints/steps/resources
description: Una referencia técnica para "Referencias de recursos". Aprende a usar archivos externos para temas, plugins y contenido.
---

<!-- description: A technical reference for "Resource References." Learn how to use external files for themes, plugins, and content. -->

<!-- # Resources References -->

# Referencias de recursos

<!-- "Resource References" allow you use external files in Blueprints -->

Las "Referencias de recursos" te permiten usar archivos externos en Blueprints

<div class="callout callout-info">

<!-- Blueprint steps such as [`installPlugin`](/blueprints/steps) or [`installTheme`](/blueprints/steps) require a location of the plugin or theme to be installed. -->

Las etapas de Blueprint como [`installPlugin`](/blueprints/steps) o [`installTheme`](/blueprints/steps) requieren una ubicación del plugin o tema que se va a instalar.

<!-- That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories. -->

Esa ubicación puede definirse como un [recurso `URL`](#urlreference) del archivo `.zip` que contiene el tema o plugin. También puede definirse como un recurso [`wordpress.org/plugins`](#corepluginreference) o [`wordpress.org/themes`](#corethemereference) para esos plugins/temas publicados en los directorios oficiales de WordPress.

</div>

<!-- The following resource references are available: -->

Están disponibles las siguientes referencias de recursos:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- ### URLReference -->

### URLReference

<!-- The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows: -->

El recurso `URLReference` se usa para referenciar archivos almacenados en un
servidor remoto. El recurso `URLReference` se define así:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

<!-- To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows: -->

Para usar el recurso `URLReference`, debes proporcionar la URL del archivo. Por
ejemplo, para referenciar un archivo llamado "index.html" almacenado en un
servidor remoto, puedes crear un `URLReference` así:

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

El recurso `url` funciona con etapas de Blueprint como [`installPlugin`](/blueprints/steps) o
[`installTheme`](/blueprints/steps).
Estas etapas requieren un `ResourceType` para definir la ubicación del plugin o
tema que se instalará.

<!-- With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme. Use this for built ZIP artifacts hosted on a publicly accessible URL that does not require authentication, such as a release asset. CI artifact direct-download URLs can work, but they are often short-lived or restricted. -->

Con `"resource": "url"` podemos definir la ubicación de un `.zip` que contiene
el plugin/tema. Usa esto para artifacts ZIP ya creados y alojados en una URL
públicamente accesible que no requiera autenticación, como un asset de release.
Las URL de descarga directa de artifacts de CI pueden funcionar, pero a menudo
son de corta duración o están restringidas.

<!-- For source code stored in a Git repository, prefer [`git:directory`](/blueprints/steps/resources#gitdirectoryreference). It can fetch a repository subdirectory from a branch, tag, or commit without requiring a ZIP archive. -->

Para código fuente almacenado en un repositorio Git, prefiere
[`git:directory`](/blueprints/steps/resources#gitdirectoryreference). Puede
obtener un subdirectorio del repositorio desde una rama, etiqueta o commit sin
requerir un archivo ZIP.

<!-- Before using a `url` resource, verify that the URL: -->

Antes de usar un recurso `url`, verifica que la URL:

<!--
- Downloads the file directly. It must not return an HTML page, redirect warning, login page, repository file viewer, or proxy error page.
- Is available without cookies, authentication, a VPN, or a temporary browser session.
- Sends CORS headers that allow Playground to fetch it.
- Points to the expected file type. `installPlugin` and `installTheme` need a plugin or theme ZIP archive unless you use another resource type.
- Will remain available. Temporary tunnel URLs, draft release assets, and short-lived CI artifacts can expire.
- Is a real ZIP archive when the step expects a ZIP. Very small downloads often mean the server returned an HTML error page instead of the archive.
-->

- Descargue el archivo directamente. No debe devolver una página HTML, aviso de redirección, página de inicio de sesión, visor de archivo de repositorio o página de error de proxy.
- Esté disponible sin cookies, autenticación, VPN o una sesión temporal del navegador.
- Envíe encabezados CORS que permitan que Playground la obtenga.
- Apunte al tipo de archivo esperado. `installPlugin` e `installTheme` necesitan un archivo ZIP de plugin o tema, a menos que uses otro tipo de recurso.
- Permanezca disponible. Las URL temporales de túnel, los assets de release en borrador y los artifacts de CI de corta duración pueden expirar.
- Sea un archivo ZIP real cuando la etapa espere un ZIP. Las descargas muy pequeñas a menudo significan que el servidor devolvió una página HTML de error en lugar del archivo.

<!--
For GitHub source code, do not point `url` at a repository page or a generated
ZIP from a branch when you can use `git:directory`. Use `url` for built ZIP
artifacts and `git:directory` for source directories.
-->

Para código fuente de GitHub, no apuntes `url` a una página del repositorio ni
a un ZIP generado desde una rama cuando puedes usar `git:directory`. Usa `url`
para artifacts ZIP creados y `git:directory` para directorios de código fuente.

<!-- ### GitDirectoryReference -->

### GitDirectoryReference

<!-- The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit. -->

El recurso `GitDirectoryReference` se usa para referenciar un directorio dentro
de un repositorio Git. Esto es útil cuando un plugin o tema vive en una
subcarpeta de un repositorio, o cuando quieres instalar desde una rama, etiqueta
o commit específico.

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

**Ejemplo:**

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

**Notas:**

<!--
- When using a branch or tag name for `ref`, you must specify `refType` (e.g. `"refType": "branch"`). Without it, only `HEAD` is reliably resolved.
- Playground automatically detects providers like GitHub and GitLab.
- Repository URLs may include or omit a trailing `.git` suffix. Extra trailing slashes are ignored.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps) and [`installTheme`](/blueprints/steps).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref.
- The folder name is derived from the URL by default (e.g. `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` in the step to override it, as shown in the example above.
-->

- Al usar un nombre de rama o etiqueta para `ref`, debes especificar `refType` (por ejemplo, `"refType": "branch"`). Sin eso, solo `HEAD` se resuelve de forma fiable.
- Playground detecta automáticamente proveedores como GitHub y GitLab.
- Las URL de repositorio pueden incluir u omitir el sufijo final `.git`. Las barras finales extra se ignoran.
- Maneja solicitudes con proxy CORS y checkouts dispersos, por lo que puedes usar URL que apuntan a subdirectorios o ramas específicos.
- Este recurso puede usarse con etapas como [`installPlugin`](/blueprints/steps) e [`installTheme`](/blueprints/steps).
- Define `".git": true` para incluir una carpeta `.git` que contenga packfiles y refs, de modo que herramientas compatibles con Git puedan detectar el checkout. Actualmente esto refleja un clon superficial del ref seleccionado.
- El nombre de la carpeta se deriva de la URL por defecto (por ejemplo, `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Usa `options.targetFolderName` en la etapa para sobrescribirlo, como se muestra en el ejemplo anterior.

<!-- ### CoreThemeReference -->

### CoreThemeReference

<!-- The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows: -->

El recurso _CoreThemeReference_ se usa para referenciar temas principales de
WordPress. El recurso _CoreThemeReference_ se define así:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

<!-- To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows: -->

Para usar el recurso _CoreThemeReference_, debes proporcionar el slug del tema.
Por ejemplo, para referenciar el tema "Twenty Twenty-One", puedes crear un
_CoreThemeReference_ así:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

<!-- ### CorePluginReference -->

### CorePluginReference

<!-- The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows: -->

El recurso _CorePluginReference_ se usa para referenciar plugins principales de
WordPress. El recurso _CorePluginReference_ se define así:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

<!-- To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows: -->

Para usar el recurso _CorePluginReference_, debes proporcionar el slug del
plugin. Por ejemplo, para referenciar el plugin "Akismet", puedes crear un
_CorePluginReference_ así:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

<!-- ### VFSReference -->

### VFSReference

<!-- The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows: -->

El recurso _VFSReference_ se usa para referenciar archivos almacenados en un
sistema de archivos virtual (VFS). El VFS es un sistema de archivos almacenado
en memoria y puede usarse para almacenar archivos que no forman parte del
sistema de archivos del sistema operativo. El recurso _VFSReference_ se define
así:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

<!-- To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows: -->

Para usar el recurso _VFSReference_, debes proporcionar la ruta al archivo en
el VFS. Por ejemplo, para referenciar un archivo llamado "index.html" almacenado
en la raíz del VFS, puedes crear un _VFSReference_ así:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

<!-- ### LiteralReference -->

### LiteralReference

<!-- The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows: -->

El recurso _LiteralReference_ se usa para referenciar archivos almacenados como
literales en el código. El recurso _LiteralReference_ se define así:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

<!-- To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows: -->

Para usar el recurso _LiteralReference_, debes proporcionar el nombre del
archivo y su contenido. Por ejemplo, para referenciar un archivo llamado
"index.html" que contiene el texto "Hello, World!", puedes crear un
_LiteralReference_ así:

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

El recurso `BundledReference` se usa para referenciar archivos incluidos en el
propio Blueprint. Esto es especialmente útil para crear paquetes de Blueprint
autocontenidos que incluyen todos los recursos necesarios. El recurso
`BundledReference` se define así:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

<!-- To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows: -->

Para usar `BundledReference`, debes proporcionar la ruta relativa al archivo
dentro del paquete. Por ejemplo, para referenciar un archivo llamado
"plugin.php" incluido con el Blueprint, puedes crear un `BundledReference` así:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

<!-- Blueprint bundles can be distributed in various formats, including: -->

Los paquetes de Blueprint pueden distribuirse en varios formatos, incluidos:

<!--
- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together
-->

- Archivos ZIP con un archivo `blueprint.json` de nivel superior
- Directorios que contienen un archivo `blueprint.json` y recursos relacionados
- URL remotas donde el Blueprint y sus recursos están alojados juntos

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Para más información sobre paquetes de Blueprint, consulta la documentación de
[Paquetes de Blueprint](/blueprints/bundles).
