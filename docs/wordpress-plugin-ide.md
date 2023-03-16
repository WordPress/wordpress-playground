## This code has not been ported to the nx build system yet

You can browse it in the (previous trunk version)[https://github.com/WordPress/wordpress-playground/tree/5da9aa0ac0acaeba6055a1de3b8a1ed286fb216f/packages/wordpress-plugin-ide], but you
cannot import it or use it at the moment.

## WordPress code editor

Edit WordPress plugin and live preview them in the browser:

<img width="1460" alt="CleanShot 2022-11-17 at 00 35 45@2x (1)" src="https://user-images.githubusercontent.com/205419/202327600-0e44a227-43fa-466d-a0c5-08024e71beab.png">

### How does it work?

The architecture can be visualized as follows:

![Code editor architecture](https://user-images.githubusercontent.com/205419/203397653-504fd238-eb19-48d0-9b74-9c03404493ae.png)

Here's what happens step by step:

-   The CodeMirror editor is set up to edit files from a specific WordPress filesystem directory. Note that filesystem lives in the browser memory.
-   Every code change is saved to a disk directory, say, `my-plugin/src`.
-   Code changes trigger a bundling process using the browser versions of [Rollup](https://rollupjs.org/) and [Babel](https://babeljs.io/).
-   The resulting bundle consists of [AMD (Asynchronous Modules)](https://requirejs.org/docs/whyamd.html#amd). It was the most convenient format for our purposes here. This means each module declaration is wrapped in `define('moduleName', ['dependency1', 'dependency2', ...], function moduleFactory(dep1, dep2) { });`.
-   The bundle ships with a custom module loader that understands all the `define()` and `require()` calls even for JSON and CSS modules.
-   The resulting JavaScript bundle is:
    -   stored in, say, `my-plugin/build` alongside non-JavaScript changes (like an updated index.php)
    -   live `eval()`'d in the WordPress iframe to trigger live reloading when appropriate

The editor+bundler setup is heavyweight (~3.5MB JavaScript code minified) and thus is shipped as a separate chunk using esbuild's code splitting.

### Usage

```js
const { WordPressPluginIDE, createBlockPluginFixture } = await import(
	'../wordpress-plugin-ide/index.js'
);
// createBlockPluginFixture defines files to create on the disk to boostrap
// a create-block plugin
render(
	<WordPressPluginIDE
		plugin={createBlockPluginFixture}  // Create the plugin in the FileSystem and edit its files
		workerThread={workerThread}
		initialEditedFile="edit.js"
		onBundleReady={(bundleContents: string) => {
			if (doneFirstBoot) {
				(wpFrame.contentWindow as any).eval(bundleContents);
			} else {
				doneFirstBoot = true;
				wpFrame.src = workerThread.pathToInternalUrl(
					query.get('url') || '/'
				);
			}
		}}
	/>,
	document.getElementById('code-editor')!
);
```
