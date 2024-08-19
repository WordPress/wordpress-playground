---
slug: /blueprints/steps/resources
---

# Resources References

Resource References allow you use external files in Blueprints

In the `installPlugin` step in the example above, we reference the `https://downloads.wordpress.org/plugins/friends.latest-stable.zip` file by using the `wordpress.org/plugins` resource reference.

The following resource references are available:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### URLReference

The URLReference resource is used to reference files that are stored on a remote server. The URLReference resource is defined as follows:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

To use the URLReference resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a URLReference as follows:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

The resource `url` type works really in combination with blueprint steps such as [`installPlugin`](/blueprints/steps#InstallPluginStep) or
[`installTheme`](http://localhost:3000/wordpress-playground/blueprints/steps#InstallThemeStep). These steps require a `ResourceType` to define the location of the plugin or the theme to install.

With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme via a URL that can point direclty to a GitHub repo. To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that also allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin or theme.

### CoreThemeReference

The CoreThemeReference resource is used to reference WordPress core themes. The CoreThemeReference resource is defined as follows:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

To use the CoreThemeReference resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a CoreThemeReference as follows:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### CorePluginReference

The CorePluginReference resource is used to reference WordPress core plugins. The CorePluginReference resource is defined as follows:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

To use the CorePluginReference resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a CorePluginReference as follows:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### VFSReference

The VFSReference resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The VFSReference resource is defined as follows:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

To use the VFSReference resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a VFSReference as follows:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### LiteralReference

The LiteralReference resource is used to reference files that are stored as literals in the code. The LiteralReference resource is defined as follows:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

To use the LiteralReference resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a LiteralReference as follows:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```
