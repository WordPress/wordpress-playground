---
slug: /blueprints/steps/resources
description: Une référence technique pour les « Resource References ». Découvrez comment utiliser des fichiers externes pour les thèmes, les extensions et le contenu.
---

<!-- description: A technical reference for "Resource References." Learn how to use external files for themes, plugins, and content. -->

<!-- # Resources References -->

# Références de ressources

<!-- "Resource References" allow you use external files in Blueprints -->

Les « Resource References » vous permettent d’utiliser des fichiers externes
dans les Blueprints.

<div class="callout callout-info">

<!-- Blueprint steps such as [`installPlugin`](/blueprints/steps) or [`installTheme`](/blueprints/steps) require a location of the plugin or theme to be installed. -->

Les étapes de Blueprint comme [`installPlugin`](/blueprints/steps) ou
[`installTheme`](/blueprints/steps) nécessitent l’emplacement de l’extension ou
du thème à installer.

<!-- That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories. -->

Cet emplacement peut être défini comme une ressource [`URL`](#urlreference) du
fichier `.zip` contenant le thème ou l’extension. Il peut aussi être défini
comme une ressource [`wordpress.org/plugins`](#corepluginreference) ou
[`wordpress.org/themes`](#corethemereference) pour les extensions/thèmes publiés
dans les répertoires officiels WordPress.

</div>

<!-- The following resource references are available: -->

Les références de ressources suivantes sont disponibles :

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- ### URLReference -->

### URLReference

<!-- The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows: -->

La ressource `URLReference` sert à référencer des fichiers stockés sur un
serveur distant. La ressource `URLReference` est définie comme suit :

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

<!-- To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows: -->

Pour utiliser la ressource `URLReference`, vous devez fournir l’URL du fichier.
Par exemple, pour référencer un fichier nommé "index.html" stocké sur un
serveur distant, vous pouvez créer une `URLReference` comme suit :

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

La ressource `url` fonctionne avec des étapes de Blueprint comme
[`installPlugin`](/blueprints/steps) ou [`installTheme`](/blueprints/steps).
Ces étapes nécessitent un `ResourceType` pour définir l’emplacement de
l’extension ou du thème à installer.

<!-- With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme. Use this for built ZIP artifacts hosted on a publicly accessible URL that does not require authentication, such as a release asset. CI artifact direct-download URLs can work, but they are often short-lived or restricted. -->

Avec `"resource": "url"`, nous pouvons définir l’emplacement d’un `.zip`
contenant l’extension/le thème. Utilisez cette option pour des artifacts ZIP
construits hébergés sur une URL accessible publiquement qui ne nécessite pas
d’authentification, comme un asset de release. Les URL de téléchargement direct
d’artifacts CI peuvent fonctionner, mais elles sont souvent de courte durée ou
restreintes.

<!-- For source code stored in a Git repository, prefer [`git:directory`](/blueprints/steps/resources#gitdirectoryreference). It can fetch a repository subdirectory from a branch, tag, or commit without requiring a ZIP archive. -->

Pour du code source stocké dans un dépôt Git, préférez
[`git:directory`](/blueprints/steps/resources#gitdirectoryreference). Cette
ressource peut récupérer un sous-répertoire de dépôt depuis une branche, une
étiquette ou un commit sans nécessiter d’archive ZIP.

<!-- Before using a `url` resource, verify that the URL: -->

Avant d’utiliser une ressource `url`, vérifiez que l’URL :

<!--
- Downloads the file directly. It must not return an HTML page, redirect warning, login page, repository file viewer, or proxy error page.
- Is available without cookies, authentication, a VPN, or a temporary browser session.
- Sends CORS headers that allow Playground to fetch it.
- Points to the expected file type. `installPlugin` and `installTheme` need a plugin or theme ZIP archive unless you use another resource type.
- Will remain available. Temporary tunnel URLs, draft release assets, and short-lived CI artifacts can expire.
- Is a real ZIP archive when the step expects a ZIP. Very small downloads often mean the server returned an HTML error page instead of the archive.
-->

- Télécharge directement le fichier. Elle ne doit pas renvoyer une page HTML, un avertissement de redirection, une page de connexion, un aperçu de fichier de dépôt ni une page d’erreur de proxy.
- Est disponible sans cookies, authentification, VPN ni session temporaire de navigateur.
- Envoie des en-têtes CORS qui autorisent Playground à la récupérer.
- Pointe vers le type de fichier attendu. `installPlugin` et `installTheme` nécessitent une archive ZIP d’extension ou de thème, sauf si vous utilisez un autre type de ressource.
- Restera disponible. Les URL de tunnel temporaires, les assets de release en brouillon et les artifacts CI de courte durée peuvent expirer.
- Est une véritable archive ZIP lorsque l’étape attend un ZIP. Les téléchargements très petits signifient souvent que le serveur a renvoyé une page d’erreur HTML au lieu de l’archive.

<!--
For GitHub source code, do not point `url` at a repository page or a generated
ZIP from a branch when you can use `git:directory`. Use `url` for built ZIP
artifacts and `git:directory` for source directories.
-->

Pour du code source GitHub, ne faites pas pointer `url` vers une page de dépôt
ou un ZIP généré depuis une branche lorsque vous pouvez utiliser
`git:directory`. Utilisez `url` pour des artifacts ZIP construits et
`git:directory` pour des répertoires de source.

<!-- ### GitDirectoryReference -->

### GitDirectoryReference

<!-- The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit. -->

La ressource `GitDirectoryReference` sert à référencer un répertoire dans un
dépôt Git. C’est utile lorsqu’une extension ou un thème se trouve dans un
sous-dossier d’un dépôt, ou lorsque vous voulez installer depuis une branche,
une étiquette ou un commit précis.

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

**Exemple :**

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

**Notes :**

<!--
- When using a branch or tag name for `ref`, you must specify `refType` (e.g. `"refType": "branch"`). Without it, only `HEAD` is reliably resolved.
- Playground automatically detects providers like GitHub and GitLab.
- Repository URLs may include or omit a trailing `.git` suffix. Extra trailing slashes are ignored.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps) and [`installTheme`](/blueprints/steps).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref.
- The folder name is derived from the URL by default (e.g. `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` in the step to override it, as shown in the example above.
-->

- Lorsque vous utilisez un nom de branche ou d’étiquette pour `ref`, vous devez indiquer `refType` (par exemple `"refType": "branch"`). Sans cela, seul `HEAD` est résolu de façon fiable.
- Playground détecte automatiquement les fournisseurs comme GitHub et GitLab.
- Les URL de dépôt peuvent inclure ou omettre un suffixe final `.git`. Les barres obliques finales supplémentaires sont ignorées.
- Cette ressource gère les récupérations via proxy CORS et les sparse checkouts ; vous pouvez donc utiliser des URL qui pointent vers des sous-répertoires ou branches précis.
- Cette ressource peut être utilisée avec des étapes comme [`installPlugin`](/blueprints/steps) et [`installTheme`](/blueprints/steps).
- Définissez `".git": true` pour inclure un dossier `.git` contenant les packfiles et les refs afin que les outils sensibles à Git puissent détecter le checkout. Cela reflète actuellement un clone superficiel de la ref sélectionnée.
- Le nom du dossier est dérivé de l’URL par défaut (par exemple `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Utilisez `options.targetFolderName` dans l’étape pour le remplacer, comme dans l’exemple ci-dessus.

<!-- ### CoreThemeReference -->

### CoreThemeReference

<!-- The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows: -->

La ressource _CoreThemeReference_ sert à référencer les thèmes du cœur
WordPress. La ressource _CoreThemeReference_ est définie comme suit :

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

<!-- To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows: -->

Pour utiliser la ressource _CoreThemeReference_, vous devez fournir le slug du
thème. Par exemple, pour référencer le thème "Twenty Twenty-One", vous pouvez
créer une _CoreThemeReference_ comme suit :

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

<!-- ### CorePluginReference -->

### CorePluginReference

<!-- The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows: -->

La ressource _CorePluginReference_ sert à référencer les extensions du cœur
WordPress. La ressource _CorePluginReference_ est définie comme suit :

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

<!-- To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows: -->

Pour utiliser la ressource _CorePluginReference_, vous devez fournir le slug de
l’extension. Par exemple, pour référencer l’extension "Akismet", vous pouvez
créer une _CorePluginReference_ comme suit :

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

<!-- ### VFSReference -->

### VFSReference

<!-- The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows: -->

La ressource _VFSReference_ sert à référencer des fichiers stockés dans un
système de fichiers virtuel (VFS). Le VFS est un système de fichiers stocké en
mémoire qui peut servir à stocker des fichiers ne faisant pas partie du système
de fichiers du système d’exploitation. La ressource _VFSReference_ est définie
comme suit :

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

<!-- To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows: -->

Pour utiliser la ressource _VFSReference_, vous devez fournir le chemin vers le
fichier dans le VFS. Par exemple, pour référencer un fichier nommé "index.html"
stocké à la racine du VFS, vous pouvez créer une _VFSReference_ comme suit :

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

<!-- ### LiteralReference -->

### LiteralReference

<!-- The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows: -->

La ressource _LiteralReference_ sert à référencer des fichiers stockés comme
littéraux dans le code. La ressource _LiteralReference_ est définie comme suit :

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

<!-- To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows: -->

Pour utiliser la ressource _LiteralReference_, vous devez fournir le nom du
fichier et son contenu. Par exemple, pour référencer un fichier nommé
"index.html" qui contient le texte "Hello, World!", vous pouvez créer une
_LiteralReference_ comme suit :

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

La ressource `BundledReference` sert à référencer des fichiers inclus avec le
Blueprint lui-même. C’est particulièrement utile pour créer des bundles de
Blueprint autonomes qui incluent toutes les ressources nécessaires. La ressource
`BundledReference` est définie comme suit :

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

<!-- To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows: -->

Pour utiliser la ressource `BundledReference`, vous devez fournir le chemin
relatif vers le fichier dans le bundle. Par exemple, pour référencer un fichier
nommé "plugin.php" inclus avec le Blueprint, vous pouvez créer une
`BundledReference` comme suit :

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

<!-- Blueprint bundles can be distributed in various formats, including: -->

Les bundles de Blueprint peuvent être distribués dans différents formats,
notamment :

<!--
- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together
-->

- Des fichiers ZIP avec un fichier `blueprint.json` au premier niveau.
- Des répertoires contenant un fichier `blueprint.json` et les ressources associées.
- Des URL distantes où le Blueprint et ses ressources sont hébergés ensemble.

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Pour plus d’informations sur les bundles de Blueprint, consultez la
documentation des [Blueprint Bundles](/blueprints/bundles).
