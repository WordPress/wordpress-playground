# nx-extensions

This private package provides custom [Nx](https://nx.dev) executors and generators
for the Playground monorepo.

## Building

Run `npm exec nx -- build nx-extensions` to build the library.

## Running unit tests

Run `npm exec nx -- test nx-extensions` to execute the unit tests via Vitest.

## Checking ESM and CommonJS builds

The `test:esmcjs` target uses the `assert-built-esm-and-cjs` executor to check
that Node.js can load a built package as both an ES module and a CommonJS module.
It imports the built `index.js` file and requires the package directory, failing
if either entry point cannot load. This checks module loading, not the behavior
of the package's exports or its browser bundle.

Add the target to a package's `project.json` and set `outputPath` to the built
package directory relative to the workspace root. The target must depend on
`build` so the files exist before the check runs. For example, the Playground
Client configures it under `targets` like this:

```json
{
	"targets": {
		"test:esmcjs": {
			"executor": "@wp-playground/nx-extensions:assert-built-esm-and-cjs",
			"options": {
				"outputPath": "dist/packages/playground/client"
			},
			"dependsOn": ["build"]
		}
	}
}
```

Run this target with `npm exec nx -- run playground-client:test:esmcjs`.
