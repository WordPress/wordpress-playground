---
slug: /developers/architecture/wasm-php-data-dependencies
---

# Data dependencies (browser version)

Importing file to PHP by manually calling `writeFile()` would be quite inconvenient. Fortunately, Emscripten provides a "data dependencies" feature.

Data dependencies consist of a `dependency.data` file and a `dependency.js` loader and can be packaged with the [file_packager.py tool](https://emscripten.org/docs/porting/files/packaging_files.html).

WordPress Playground also requires wrapping the Emscripten-generated `dependency.js` file in an ES module as follows:

1. Prepend `export default function(emscriptenPHPModule) {'; `
2. Prepend `export const dependencyFilename = '<DATA FILE NAME>'; `
3. Prepend `export const dependenciesTotalSize = <DATA FILE SIZE>;`
4. Append `}`

Be sure to use the `--export-name="emscriptenPHPModule"` file_packager.py option.

You want the final output to look as follows:

```js
export const dependenciesTotalSize = 5644199;
export const dependencyFilename = 'dependency.data';
export default function (emscriptenPHPModule) {
	// Emscripten-generated code:
	var Module = typeof emscriptenPHPModule !== 'undefined' ? emscriptenPHPModule : {};
	// ... the rest of it ...
}
```

Such a constructions enables loading the `dependency.js` as an ES Module using
`import("/dependency.js")`.

Once it's ready, you can load PHP and your data dependencies as follows:

```js
const php = await PHP.load('7.4', {
	dataModules: [import('/wp.js')],
});
```
