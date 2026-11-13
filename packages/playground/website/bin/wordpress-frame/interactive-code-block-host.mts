/** Run the released plugin in Node-hosted WordPress, outside the browser sandbox. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { phpVar } from '@php-wasm/util';
// The public CLI alias is its executable entry point; this fixture uses its library API.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { runCLI, type RunCLIServer } from '../../../cli/src/run-cli';

let server: RunCLIServer | undefined;
let stopping = false;
process.once('disconnect', stop);
process.once('SIGTERM', stop);

try {
	const appOrigin = new URL(process.argv[2]).origin;
	const archive = await loadPluginArchive();
	server = await runCLI({
		command: 'server',
		port: 0,
		wp: '6.9',
		php: '8.3',
		workers: 1,
		verbosity: 'quiet',
		blueprint: {
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'literal',
						name: 'interactive-code-block.zip',
						contents: archive,
					},
					options: { activate: true },
				},
			],
		},
	});
	const attributes = {
		codeEditor: true,
		codeEditorMode: 'plugin',
		codeEditorReadOnly: false,
		requireLivePreviewActivation: true,
		configurationSource: 'block-attributes',
		logInUser: false,
		landingPageUrl: '/',
		files: [
			{
				name: 'demo.php',
				contents: `<?php
/** Plugin Name: Embedding integration example */
add_action('wp_footer', function () {
	echo '<p id="block-integration-marker">Original plugin output</p>';
});`,
			},
		],
	};
	const result = await server.playground.run({
		code: `<?php
require '/wordpress/wp-load.php';
// Retarget only the production hostname literals in the verified release.
// Keep the plugin's SDK calls, iframe setup, and compiled application code intact.
foreach (glob(WP_PLUGIN_DIR . '/interactive-code-block/build/*.js') as $file) {
	file_put_contents($file, str_replace(
		'https://playground.wordpress.net', ${phpVar(appOrigin)}, file_get_contents($file)
	));
}
// Use the plugin's saved-attribute format to preserve PHP through WordPress sanitization.
$attributes = ${phpVar(attributes)};
$attributes['files'] = array(base64_encode(wp_json_encode($attributes['files'])));
$post = wp_insert_post(wp_slash(array(
	'post_title' => 'Interactive code block integration',
	'post_status' => 'publish',
	'post_content' => serialize_block(array(
		'blockName' => 'wordpress-playground/playground',
		'attrs' => $attributes,
		'innerBlocks' => array(),
		'innerHTML' => '',
		'innerContent' => array(),
	)),
)), true);
if (is_wp_error($post)) throw new Exception($post->get_error_message());
echo $post;
`,
	});
	if (result.exitCode !== 0 || !/^\d+$/.test(result.text)) {
		throw new Error(
			`Could not publish the plugin fixture: ${result.errors}\n${result.text}`
		);
	}
	const url = new URL('/', server.serverUrl);
	url.searchParams.set('p', result.text);
	process.send!({ url: url.href });
} catch (error) {
	console.error(error);
	await stop(1);
}

async function loadPluginArchive(): Promise<Uint8Array> {
	const release = JSON.parse(
		await readFile(
			new URL(
				'../../playwright/wordpress-frame/interactive-code-block-release.json',
				import.meta.url
			),
			'utf8'
		)
	);
	const cache = new URL(
		'../../../../../node_modules/.cache/playground-e2e/',
		import.meta.url
	);
	const cachedArchive = new URL(
		`interactive-code-block.${release.version}.zip`,
		cache
	);
	let bytes: Buffer;
	try {
		bytes = await readFile(cachedArchive);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		const response = await fetch(release.url, {
			signal: AbortSignal.timeout(60000),
		});
		if (!response.ok)
			throw new Error(`Plugin download failed: HTTP ${response.status}`);
		bytes = Buffer.from(await response.arrayBuffer());
	}
	if (createHash('sha256').update(bytes).digest('hex') !== release.sha256) {
		throw new Error(
			`Checksum mismatch for interactive-code-block ${release.version}`
		);
	}
	await mkdir(cache, { recursive: true });
	const temporary = new URL(
		`interactive-code-block.${process.pid}.tmp`,
		cache
	);
	await writeFile(temporary, bytes);
	await rename(temporary, cachedArchive);
	return Uint8Array.from(bytes);
}

async function stop(exitCode = 0) {
	if (stopping) return;
	stopping = true;
	try {
		await server?.[Symbol.asyncDispose]();
	} catch (error) {
		console.error(error);
		exitCode = 1;
	}
	process.exit(exitCode);
}
