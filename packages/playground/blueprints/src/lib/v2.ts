import { UniversalPHP } from '@php-wasm/universal';
// @ts-ignore
import v2_runner_url from '../../public/blueprints.phar?url';

interface RunV2Options {
	hooks?: {
		onBlueprintTargetResolved?: (php: UniversalPHP) => void | Promise<void>;
	};
}

export async function runV2(
	php: UniversalPHP,
	blueprintJSON: string,
	options: RunV2Options = {}
) {
	const file = await getV2Runner();
	php.writeFile(
		'/tmp/blueprints.phar',
		new Uint8Array(await file.arrayBuffer())
	);
	php.writeFile('/tmp/blueprint.json', blueprintJSON);

	await php.onMessage(async (message) => {
		console.log('message', message);
		try {
			const parsed =
				typeof message === 'string' ? JSON.parse(message) : message;
			if (parsed && parsed.type === 'blueprint.target_resolved') {
				if (options.hooks?.onBlueprintTargetResolved) {
					await options.hooks.onBlueprintTargetResolved(php);
				}
				return 'true';
			}
		} catch (e) {
			console.warn('Failed to parse message as JSON:', message, e);
		}
		process.exit(0);
	});

	await php?.writeFile('/tmp/stdout', '');
	await php?.writeFile('/tmp/stderror', '');
	await php?.writeFile(
		'/tmp/run-blueprints.php',
		`<?php
// Set up the environment to emulate a shell script
// call.

// Set the argv global.
$_SERVER['argv'] = $GLOBALS['argv'] = array_merge([
	"/tmp/blueprints.phar",
], json_decode(getenv('ARGV')));

// Provide stdin, stdout, stderr streams outside of
// the CLI SAPI.
define('STDIN', fopen('php://stdin', 'rb'));
define('STDOUT', fopen('php://stdout', 'wb'));
define('STDERR', fopen('/tmp/stderr', 'wb'));

function playground_on_blueprint_target_resolved() {
	post_message_to_js(json_encode(array(
		'type' => 'blueprint.target_resolved',
	)));
}
playground_add_filter('blueprint.target_resolved', 'playground_on_blueprint_target_resolved');

require( "/tmp/blueprints.phar" );
`
	);

	try {
		const output = await php.run({
			scriptPath: '/tmp/run-blueprints.php',
			env: {
				ARGV: JSON.stringify([
					'exec',
					'/tmp/blueprint.json',
					'--site-path=/wordpress',
					'--site-url=http://127.0.0.1',
					'--db-engine=sqlite',
					'--truncate-new-site-directory=true',
				]),
			},
		});
		return output;
	} catch (e) {
		console.error(e.response.text);
	}
}

export async function getV2Runner(): Promise<File> {
	let data = null;
	if (v2_runner_url.startsWith('/')) {
		console.log('v2_runner_url', v2_runner_url);
		let path = v2_runner_url;
		if (path.startsWith('/@fs/')) {
			path = path.slice(4);
		}

		const { readFile } = await import('node:fs/promises');
		data = await readFile(path);
	} else {
		const response = await fetch(v2_runner_url);
		data = await response.blob();
	}
	return new File([data], `blueprints.phar`, {
		type: 'application/zip',
	});
}
