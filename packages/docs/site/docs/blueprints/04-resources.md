---
slug: /blueprints/steps/resources
description: A technical reference for "Resource References." Learn how to use external files for themes, plugins, and content.
---

# Resources References

"Resource References" allow you use external files in Blueprints

<div class="callout callout-info">

Blueprint steps such as [`installPlugin`](/blueprints/steps) or [`installTheme`](/blueprints/steps) require a location of the plugin or theme to be installed.

That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories.

</div>

The following resource references are available:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### URLReference

The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

The `url` resource works with Blueprint steps such as [`installPlugin`](/blueprints/steps) or
[`installTheme`](/blueprints/steps).
These steps require a `ResourceType` to define the location of the plugin or the theme to install.

With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme. Use this for built ZIP artifacts hosted on a publicly accessible URL that does not require authentication, such as a release asset. CI artifact direct-download URLs can work, but they are often short-lived or restricted.

For source code stored in a Git repository, prefer [`git:directory`](/blueprints/steps/resources#gitdirectoryreference). It can fetch a repository subdirectory from a branch, tag, or commit without requiring a ZIP archive.

Before using a `url` resource, verify that the URL:

- Downloads the file directly. It must not return an HTML page, redirect warning, login page, repository file viewer, or proxy error page.
- Is available without cookies, authentication, a VPN, or a temporary browser session.
- Sends CORS headers that allow Playground to fetch it.
- Points to the expected file type. `installPlugin` and `installTheme` need a plugin or theme ZIP archive unless you use another resource type.
- Will remain available. Temporary tunnel URLs, draft release assets, and short-lived CI artifacts can expire.
- Is a real ZIP archive when the step expects a ZIP. Very small downloads often mean the server returned an HTML error page instead of the archive.

For GitHub source code, do not point `url` at a repository page or a generated
ZIP from a branch when you can use `git:directory`. Use `url` for built ZIP
artifacts and `git:directory` for source directories.

### GitDirectoryReference

The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit.

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
		"activate": true,
		"targetFolderName": "data-basics"
	}
}
```

**Notes:**

- When using a branch or tag name for `ref`, you must specify `refType` (e.g. `"refType": "branch"`). Without it, only `HEAD` is reliably resolved.
- Playground automatically detects providers like GitHub and GitLab.
- Repository URLs may include or omit a trailing `.git` suffix. Extra trailing slashes are ignored.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps) and [`installTheme`](/blueprints/steps).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref.
- The folder name is derived from the URL by default (e.g. `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` in the step to override it, as shown in the example above.

### CoreThemeReference

The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### CorePluginReference

The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### VFSReference

The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### LiteralReference

The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```

### BundledReference

The `BundledReference` resource is used to reference files that are bundled with the Blueprint itself. This is particularly useful for creating self-contained Blueprint bundles that include all necessary resources. The `BundledReference` resource is defined as follows:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

Blueprint bundles can be distributed in various formats, including:

- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together

For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation.
