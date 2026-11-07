---
title: Run and share v2 Blueprints
slug: /blueprints/v2/blueprints-101/run
description: Share and run the same v2 Blueprint with the Playground website, CLI, or JavaScript client.
---

# Run and share v2 Blueprints

**Lesson 3 of 3 · Choose the path you need**

You will use the edited Blueprint from lesson 1. If you are unsure where to
start, use the Playground website: it gives you a working site and a link to
share without installing anything. Save the JSON as `blueprint.json` only if
you choose the CLI or JavaScript path.

## Choose where to run it

| I want to…                         | Use                         | Blueprint input                                  |
| ---------------------------------- | --------------------------- | ------------------------------------------------ |
| Share a temporary interactive site | Playground website          | Public URL, ZIP bundle, or inline JSON           |
| Develop or test locally            | Playground CLI              | Local JSON, directory bundle, ZIP, or public URL |
| Run in CI or build a snapshot      | Playground CLI              | Local JSON or bundle                             |
| Embed Playground in an application | `@wp-playground/client`     | Blueprint object or bundle                       |
| Build a custom runner              | `@wp-playground/blueprints` | Version-aware validation and compilation APIs    |

Every supported Playground surface recognizes the v2 Blueprint automatically.
No experimental flag is required.

## Share it from the Playground website

The quickest option is built into the editor. Open **Dock → Blueprint**, choose
**Export → Copy Blueprint URL**, and send the copied link. Opening it creates a
new temporary site from the current Blueprint. Test the copied link in a new
tab and confirm that it opens the personalized site from lesson 1.

### Build a link from hosted JSON

For documentation, automation, or a stable file in a repository, put the
public JSON URL in the `blueprint-url` query parameter. This example uses the
course example:

```js
const blueprintUrl = 'https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/quickstart.json';

const playgroundUrl = new URL('https://playground.wordpress.net/');
playgroundUrl.searchParams.set('blueprint-url', blueprintUrl);

console.log(playgroundUrl.href);
```

Open the printed URL or share it. Replace `blueprintUrl` with the public HTTPS
location of your own `blueprint.json`. A remote ZIP bundle works through the
same parameter.

Browser v2 runs currently fetch declared remote files directly. Serve the
Blueprint and its adjacent files with browser CORS access; do not rely on a
host's proxy fallback for these inputs. The CLI does not have this browser
restriction.

### Put a small Blueprint in the URL

For a short-lived link, encode the JSON in the URL fragment. This snippet loads
the same course example and prints an inline link:

```js
const blueprintResponse = await fetch('https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/quickstart.json');
if (!blueprintResponse.ok) {
	throw new Error(`Could not load Blueprint: ${blueprintResponse.status}`);
}
const blueprint = await blueprintResponse.json();

const inlineUrl = new URL('https://playground.wordpress.net/');
inlineUrl.hash = encodeURIComponent(JSON.stringify(blueprint));

console.log(inlineUrl.href);
```

Use hosted JSON or a bundle for larger Blueprints. URL fragments have practical
length limits and are awkward to review. Website query overrides such as
`?php=` and `?wp=` do not override v2 Blueprints loaded through
`blueprint-url`; put runtime requirements in the JSON.

## Run it with the Playground CLI

The CLI is best for local development, repeatable checks, and CI. From the
directory containing the `blueprint.json` saved in lesson 1, start a local
server:

```bash
npx @wp-playground/cli@latest server --blueprint=./blueprint.json
```

`npx` downloads the CLI if needed and runs it without a global installation.
When setup finishes, open the local URL shown by the CLI and confirm that the
dashboard has the personalized title, theme, plugin, and Welcome post.

To execute the Blueprint without keeping a web server open:

```bash
npx @wp-playground/cli@latest run-blueprint --blueprint=./blueprint.json
```

The headless check succeeds when the command applies the Blueprint and exits
with status 0.

To build a distributable site snapshot:

```bash
npx @wp-playground/cli@latest build-snapshot \
	--blueprint=./blueprint.json \
	--outfile=wordpress.zip
```

After it succeeds, confirm that `wordpress.zip` exists.

Pass a directory or ZIP bundle to `--blueprint` in the same way. When a local
JSON file reads `./assets/...`, allow it to read adjacent files explicitly. A
directory input is shorthand for its `blueprint.json`, so it needs the same
flag when the Blueprint reads sibling files; a ZIP bundle does not.

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

For v2, declared `phpVersion`, `wordpressVersion`, and application login values
win. The matching CLI flags only fill values that are missing from the
Blueprint. The CLI does not support `phpVersion: "next"`; the web runtime does.

Applying a Blueprint to mounted WordPress files is an advanced mode with
different safety and compatibility rules. Follow
[apply to an existing site safely](/blueprints/v2/apply-to-existing-site)
before using it.

## Embed the same Blueprint with JavaScript

`@wp-playground/client` is best when Playground is part of a web application.
Serve the course file as `/blueprint.json`, add an `<iframe>` to the page, and
load that same JSON into `startPlaygroundWeb()`:

```js
import { startPlaygroundWeb } from '@wp-playground/client';

const iframe = document.querySelector('iframe');
if (!iframe) {
	throw new Error('Missing Playground iframe');
}

const response = await fetch('/blueprint.json');
if (!response.ok) {
	throw new Error(`Could not load Blueprint: ${response.status}`);
}

const blueprint = await response.json();
const playground = await startPlaygroundWeb({
	iframe,
	remoteUrl: 'https://playground.wordpress.net/remote.html',
	blueprint,
});
```

The integration is ready when the promise resolves and the iframe shows the
personalized WordPress dashboard.

`startPlaygroundWeb()` recognizes `version: 2` and uses the v2 runner. See the
[JavaScript API guide](/developers/apis/javascript-api/playground-api-client)
for iframe lifecycle, client methods, and production integration details.

## Advanced: validate or build a custom runner

Most browser integrations should stop at `startPlaygroundWeb()`. If you are
building a runner or developer tool, `@wp-playground/blueprints` also provides:

- `validateBlueprintDeclaration()`, the async validator for both versions;
- `compileBlueprintForExecution()`, the version-aware compiler.

The older synchronous `validateBlueprint()` and legacy `compileBlueprint()`
exports remain v1-only. A compiled Blueprint still needs a booted
`UniversalPHP` implementation:

```js
import { compileBlueprintForExecution, validateBlueprintDeclaration } from '@wp-playground/blueprints';

export async function runBlueprint(blueprint, playground) {
	const result = await validateBlueprintDeclaration(blueprint);
	if (!result.valid) {
		throw new Error(JSON.stringify(result.errors));
	}

	const compiled = await compileBlueprintForExecution(blueprint);
	await compiled.run(playground);
}
```

Your custom runner supplies the Blueprint object and the booted runtime.

## Course complete

You can now run, read, edit, and share a v2 Blueprint. Continue with a complete
project: [add a plugin Preview, build a theme demo, or create a one-click
reproduction](/blueprints/v2/tutorials).

Need to revisit the model? Return to
[lesson 2: how v2 Blueprints work](/blueprints/v2/blueprints-101/how-it-works).
