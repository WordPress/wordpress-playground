## Blueprints

A Blueprint is a JSON that describes how to set up a WordPress Playground instance.

For example:

```json
{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "7.4",
		"wp": "5.9"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

## Using Blueprints

You can use Blueprints in one of two ways:

### URL Fragment

The easiest way to use Blueprints is to pass them as a URL fragment to the Playground. For example, to run the Bluprint presented above, you would visit a URL like this:

```
https://playground.wordpress.net/#{"landingPage":"/wp-admin",...
```

### JavaScript API

You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen:

```html
<!DOCTYPE html>
<html>
	<head>
		<title>WordPress Playground</title>
	</head>
	<body>
		<iframe id="wp" style="width: 1200px; height: 800px"></iframe>
		<script type="module">
			import { startPlaygroundWeb } from 'https://unpkg.com/@wp-playground/client/index.js';

			const client = await startPlaygroundWeb({
				iframe,
				remoteUrl: `https://playground.wordpress.net/remote.html`,
				blueprint: {
					landingPage: '/wp-admin/',
					preferredVersions: {
						php: '8.0',
						wp: 'latest',
					},
					steps: [
						{
							step: 'login',
							username: 'admin',
							password: 'password',
						},
						{
							step: 'installPlugin',
							pluginZipFile: {
								resource: 'wordpress.org/plugins',
								slug: 'friends',
							},
						},
					],
				},
			});

			const response = await client.run({
				code: '<?php echo "Hi!"; ',
			});
			console.log(response.text);
		</script>
	</body>
</html>
```

## Blueprint Data Format

A Blueprint can contain the following properties:

-   `landingPage` (string): The URL to navigate to after the blueprint has been run.
-   `preferredVersions`: The preferred PHP and WordPress versions to use.
-   `steps`: The steps to run.

### Preferred Versions

The `preferredVersions` property is an object that specifies the preferred PHP and WordPress versions to use. It can contain the following properties:

-   `php` (string): The preferred PHP version to use. Defaults to 'latest'.
-   `wp` (string): The preferred WordPress version to use. Defaults to 'latest'.

Example:

```json
{
	"preferredVersions": {
		"php": "7.4",
		"wp": "5.9"
	}
}
```

### Steps

The `steps` property is an array of steps to run. Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Here are the possible steps and their usage:

#### installPlugin

This step installs a WordPress plugin in the Playground. It takes the following parameters:

-   `pluginZipFile`: The URL or `File` object of the plugin zip file to install.
-   `options` (optional): An object that specifies whether to activate the plugin after installing it.

Example:

```json
{
	"step": "installPlugin",
	"pluginZipFile": "http://example.com/plugin.zip",
	"options": {
		"activate": true
	}
}
```

#### installTheme

This step installs a WordPress theme in the Playground. It takes the following parameters:

-   `themeZipFile`: The URL or `File` object of the theme zip file to install.
-   `options` (optional): An object that specifies whether to activate the theme after installing it.

Example:

```json
{
	"step": "installTheme",
	"themeZipFile": "http://example.com/theme.zip",
	"options": {
		"activate": true
	}
}
```

#### login

This step logs in to the Playground. It takes the following parameters:

-   `username` (optional): The username to log in as. Defaults to 'admin'.
-   `password` (optional): The password to log in with. Defaults to 'password'.

Example:

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

#### importFile

This step uploads a file to the WordPress importer and returns the response. It takes the following parameters:

-   `file`: The URL or `File` object of the file to import.

Example:

```json
{
	"step": "importFile",
	"file": "http://example.com/file.xml"
}
```

#### activatePlugin

This step activates a WordPress plugin in the Playground. It takes the following parameter:

-   `plugin`: The slug of the plugin to activate.

Example:

```json
{
	"step": "activatePlugin",
	"plugin": "plugin-slug"
}
```

#### replaceSite

This step replaces the current site with the contents of a full site zip file. It takes the following parameter:

-   `fullSiteZip`: The URL or `File` object of the full site zip file to use.

Example:

```json
{
	"step": "replaceSite",
	"fullSiteZip": "http://example.com/full-site.zip"
}
```

#### unzip

This step unzips a file in the Playground. It takes the following parameters:

-   `zipPath`: The path to the zip file to unzip.
-   `extractToPath`: The path to extract the zip file to.

Example:

```json
{
	"step": "unzip",
	"zipPath": "/path/to/file.zip",
	"extractToPath": "/path/to/extract/to"
}
```

#### setSiteOptions

This step sets options for the current site in the Playground. It takes the following parameter:

-   `options`: An object that specifies the site options to set.

Example:

```json
{
	"step": "setSiteOptions",
	"options": {
		"option_name": "option_value"
	}
}
```

#### updateUserMeta

This step updates user meta in the Playground. It takes the following parameters:

-   `meta`: An object that specifies the user meta to update.

```json
{
	"step": "updateUserMeta",
	"meta": {
		"meta_key": "meta_value"
	},
	"userId": 1
}
```

#### runPHP

This step runs PHP code in the Playground. It takes the following parameter:

-   `code`: The PHP code to run.

Example:

```json
{
	"step": "runPHP",
	"code": "<?php echo 'Hello, World!'; ?>"
}
```

#### runPHPWithOptions

This step runs PHP code in the Playground with additional options. It takes the following parameter:

-   `options` (optional): An object that specifies the options for running the PHP code.

Example:

```json
{
	"step": "runPHPWithOptions",
	"options": {
		"code": "<?php echo 'Hello, World!'; ?>",
		"allowUrlFopen": true
	}
}
```

#### setPhpIniEntry

This step sets a PHP ini entry in the Playground. It takes the following parameters:

-   `key`: The name of the PHP ini entry to set.
-   `value`: The value to set the PHP ini entry to.

Example:

```json
{
	"step": "setPhpIniEntry",
	"key": "max_execution_time",
	"value": "60"
}
```

#### request

This step makes a PHP request in the Playground. It takes the following parameters:

-   `request`: An object that specifies the PHP request to make.
-   `maxRedirects` (optional): The maximum number of redirects to follow. Defaults to 10.

Example:

```json
{
	"step": "request",
	"request": {
		"method": "GET",
		"url": "http://example.com"
	},
	"maxRedirects": 5
}
```

#### cp

This step copies a file in the Playground. It takes the following parameters:

-   `fromPath`: The path to the file to copy.
-   `toPath`: The path to copy the file to.

Example:

```json
{
	"step": "cp",
	"fromPath": "/path/to/file",
	"toPath": "/path/to/copy/to"
}
```

#### mv

This step moves a file in the Playground. It takes the following parameters:

-   `fromPath`: The path to the file to move.
-   `toPath`: The path to move the file to.

Example:

```json
{
	"step": "mv",
	"fromPath": "/path/to/file",
	"toPath": "/path/to/move/to"
}
```

#### mkdir

This step creates a directory in the Playground. It takes the following parameter:

-   `path`: The path of the directory to create.

Example:

```json
{
	"step": "mkdir",
	"path": "/path/to/create"
}
```

#### rm

This step deletes a file in the Playground. It takes the following parameter:

-   `path`: The path of the file to delete.

Example:

```json
{
	"step": "rm",
	"path": "/path/to/delete"
}
```

#### rmdir

This step deletes a directory in the Playground. It takes the following parameter:

-   `path`: The path of the directory to delete.

Example:

```json
{
	"step": "rmdir",
	"path": "/path/to/delete"
}
```

#### writeFile

This step writes data to a file in the Playground. It takes the following parameters:

-   `path`: The path of the file to write to.
-   `data`: The data to write to the file.

Example:

```json
{
	"step": "writeFile",
	"path": "/path/to/write/to",
	"data": "Hello, World!"
}
```
