---
title: Run Blueprints v2
slug: /blueprints/v2/blueprints-101/run
description: Run Blueprint v2 declarations in the Playground website, CLI, JavaScript client, and blueprints package.
---

# Run Blueprints v2

This is lesson 3 of the
[Blueprints 101 v2 crash course](/blueprints/v2/blueprints-101).

The exact numeric `version: 2` field selects the v2 path on every supported
Playground surface. There is no experimental v2 flag.

## Choose a surface

| Need                               | Surface                     | Input                                         |
| ---------------------------------- | --------------------------- | --------------------------------------------- |
| Share a temporary interactive site | Playground website          | Inline URL fragment or `blueprint-url`        |
| Author with schema feedback        | Playground website          | **New → Write a Blueprint**                   |
| Develop or test locally            | Playground CLI              | JSON, directory bundle, ZIP, or URL           |
| Run in CI                          | Playground CLI              | `run-blueprint` or `build-snapshot`           |
| Embed Playground                   | `@wp-playground/client`     | Declaration object or bundle                  |
| Build a custom runner/tool         | `@wp-playground/blueprints` | Version-aware validation and compilation APIs |

## Playground website

For a hosted JSON file, encode its URL in the `blueprint-url` query parameter:

```js
const blueprintUrl = 'https://example.com/blueprint.json';
const playgroundUrl = 'https://playground.wordpress.net/?blueprint-url=' + encodeURIComponent(blueprintUrl);
```

The hosted JSON and all remote adjacent files need normal browser fetch and
CORS access. A remote ZIP bundle works through the same parameter.

For a small inline declaration, put encoded JSON in the URL fragment:

```js
const blueprint = {
	$schema: 'https://playground.wordpress.net/blueprint-schema.json',
	version: 2,
	applicationOptions: {
		'wordpress-playground': {
			landingPage: '/wp-admin/',
			login: true,
		},
	},
	phpVersion: '8.3',
};

const url = new URL('https://playground.wordpress.net/');
url.hash = encodeURIComponent(JSON.stringify(blueprint));
```

Use hosted JSON or a bundle for larger declarations. URL fragments have
practical length limits and are awkward to review.

Website query overrides such as `?php=` and `?wp=` apply to v1-generated
declarations, not v2 declarations loaded through `blueprint-url`. Put runtime
requirements in the v2 JSON.

## Playground CLI

Start a local server:

```bash
npx @wp-playground/cli@latest server --blueprint=./blueprint.json
```

Execute headlessly:

```bash
npx @wp-playground/cli@latest run-blueprint --blueprint=./blueprint.json
```

Build a distributable site snapshot:

```bash
npx @wp-playground/cli@latest build-snapshot \
	--blueprint=./blueprint.json \
	--outfile=wordpress.zip
```

Run a directory or ZIP bundle by passing it to `--blueprint`. When a standalone
local JSON file references `./assets/...`, grant access to adjacent files:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

For v2, declared `phpVersion`, `wordpressVersion`, and application login values
win. The corresponding CLI flags only fill values missing from the
declaration. Do not rely on the broad v1 rule that CLI flags always override a
Blueprint.

The CLI does not support `phpVersion: "next"`; the web runtime does.

## JavaScript client

`startPlaygroundWeb()` accepts the unified Blueprint type and routes v2
automatically:

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

const iframe = document.querySelector('iframe');
if (!iframe) {
	throw new Error('Missing Playground iframe');
}

const playground = await startPlaygroundWeb({
	iframe,
	remoteUrl: 'https://playground.wordpress.net/remote.html',
	blueprint: {
		version: 2,
		applicationOptions: {
			'wordpress-playground': {
				landingPage: '/wp-admin/',
				login: true,
			},
		},
		phpVersion: '8.3',
		plugins: ['query-monitor'],
	},
});
```

See the [JavaScript API guide](/developers/apis/javascript-api/playground-api-client)
for iframe lifecycle and client methods.

## Blueprints package

Use the async, cross-version validator. The older synchronous
`validateBlueprint()` export is v1-only.

```ts
import { validateBlueprintDeclaration, type BlueprintV2Declaration } from '@wp-playground/blueprints';

const blueprint = {
	version: 2,
	applicationOptions: {
		'wordpress-playground': {
			landingPage: '/wp-admin/',
		},
	},
	phpVersion: '8.3',
} satisfies BlueprintV2Declaration;

const result = await validateBlueprintDeclaration(blueprint);
if (!result.valid) {
	throw new Error(JSON.stringify(result.errors));
}
```

Custom runners should use `compileBlueprintForExecution()`. The legacy
`compileBlueprint()` export intentionally remains v1-only:

```ts
import { compileBlueprintForExecution } from '@wp-playground/blueprints';

const compiled = await compileBlueprintForExecution(blueprint);
await compiled.run(playground);
```

The `playground` value is a booted `UniversalPHP` implementation. Most browser
integrations should use `startPlaygroundWeb()` rather than assembling this
lower-level pipeline.

## Site modes

New-site creation is the default. To apply with the CLI to mounted existing
WordPress files:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--mode=apply-to-existing-site \
	--mount-before-install=/absolute/path/to/wordpress:/wordpress
```

Read [apply to an existing site safely](/blueprints/v2/apply-to-existing-site)
before using that mode. It changes the meaning of baselines and version
constraints.

## Continue with a project

You have completed Blueprints 101. Next, [add a plugin Preview, build a theme
demo, or create a one-click reproduction](/blueprints/v2/tutorials).
