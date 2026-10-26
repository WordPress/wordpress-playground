import type { Plugin } from 'vite';
import type { OutputBundle } from 'rollup';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * Build the small document root served on the WordPress host.
 *
 * Only the HTTP helper and worker loaders belong here. Their code still loads
 * from the app origin, sharing its bundles and HTTP cache. The server can serve
 * this directory as-is instead of rewriting HTML or constructing JavaScript.
 * The first helper load precedes service-worker installation, so these files
 * must exist on the server even though the worker later supplies offline copies.
 * Find the thumbnail worker through Vite's source-file mapping so a dependency
 * update cannot silently leave its new hashed filename out of the sandbox.
 */
export function wordPressSandboxPlugin(appOrigin: string): Plugin {
	let sourceRoot: URL;
	return {
		name: 'wordpress-sandbox-docroot',
		apply: 'build',
		configResolved(config) {
			sourceRoot = pathToFileURL(`${config.root}/`);
		},
		// Vite has finished extracting inline HTML scripts by writeBundle. Generate
		// the sandbox from that final HTML, not the original source document.
		async writeBundle({ dir }, bundle) {
			if (!dir)
				throw new Error('The sandbox build needs an output directory.');
			await writeWordPressSandbox(dir, appOrigin, bundle, sourceRoot);
		},
	};
}

/**
 * Write bootstrap files for one app address without rebuilding its bundles.
 *
 * The built preview and upgrade-test server use different ports. Both must serve
 * these same files with their own app URLs, while sharing the compiled assets.
 */
export async function writeWordPressSandbox(
	outputDirectory: string,
	appOrigin: string,
	bundle: OutputBundle,
	sourceRoot: URL
) {
	const app = new URL('/', appOrigin);
	const bridge = bundle['wordpress-bridge.html'];
	const workerSource = import.meta.resolve('modern-screenshot/worker');
	const worker = Object.values(bundle).find(
		(file) =>
			file.type === 'asset' &&
			file.originalFileNames.some(
				(source) => new URL(source, sourceRoot).href === workerSource
			)
	);
	if (bridge?.type !== 'asset' || !worker) {
		throw new Error(
			'The sandbox build needs the HTTP helper and thumbnail worker.'
		);
	}
	const sandbox = new URL(
		'wordpress-sandbox/',
		pathToFileURL(`${outputDirectory}/`)
	);
	// Rebuilding this root must not leave an old app file or obsolete loader exposed.
	await rm(sandbox, { recursive: true, force: true });
	const thumbnail = new URL(worker.fileName, sandbox);
	await mkdir(new URL('./', thumbnail), { recursive: true });
	const html =
		typeof bridge.source === 'string'
			? bridge.source
			: new TextDecoder().decode(bridge.source);
	// App-origin modules identify the trusted parent through import.meta.url.
	// Point both script and preload URLs there before the first helper load.
	await writeFile(
		new URL('wordpress-bridge.html', sandbox),
		html.replace(/((?:src|href)=["'])\/(?!\/)/g, `$1${app.origin}/`)
	);
	await writeFile(
		new URL('sw.js', sandbox),
		`import ${JSON.stringify(new URL('sw.js', app).href)};`
	);
	const workerUrl = new URL(worker.fileName, app);
	workerUrl.searchParams.set('playground-site-thumbnail-worker', '1');
	await writeFile(
		thumbnail,
		`importScripts(${JSON.stringify(workerUrl.href)});`
	);
}
