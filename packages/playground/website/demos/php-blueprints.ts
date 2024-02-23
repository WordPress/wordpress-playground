import { startPlaygroundWeb } from '@wp-playground/client';
import { getRemoteUrl } from '../src/lib/config';
import { joinPaths } from '@php-wasm/util';
export {};

const iframe = document.querySelector('iframe')!;
const playground = await startPlaygroundWeb({
	iframe,
	remoteUrl: getRemoteUrl().toString(),
	blueprint: {
		preferredVersions: {
			wp: 'latest',
			// Required for the PHP library to run:
			php: '8.2',
		},
		features: {
			networking: true,
		},
		landingPage: '/',
		// Required for the PHP library to run:
		phpExtensionBundles: ['kitchen-sink'],
	},
});

const response = await fetch('./blueprints.phar');
const phar = new Uint8Array(await response.arrayBuffer());
await playground.writeFile(
	joinPaths(await playground.documentRoot, 'blueprints.phar'),
	phar
);
const outputDiv = document.getElementById('output')!;

try {
	// For now this only runs with ?php=8.2&php-extension-bundle=kitchen-sink
	// ?php=8.2&php-extension-bundle=kitchen-sink
	const result = await playground.run({
		code: `<?php
		use WordPress\\Blueprints\\Model\\BlueprintBuilder;
		use function WordPress\\Blueprints\\run_blueprint;

		// Provide stdin, stdout, stderr streams outside of
		// the CLI SAPI.
		define('STDIN', fopen('php://stdin', 'rb'));
		define('STDOUT', fopen('php://stdout', 'wb'));
		define('STDERR', fopen('/tmp/stderr', 'wb'));

		require '/wordpress/blueprints.phar';

		$blueprint = BlueprintBuilder::create()
			->withWordPressVersion( 'https://wordpress.org/latest.zip' );
		$results = run_blueprint( $blueprint, __DIR__ . '/new-wp' );

		var_dump( $results );

		echo "YAY!";
		`,
		throwOnError: true,
	});

	outputDiv.textContent = result.text;
	console.log(result.text);
} catch (e) {
	outputDiv.textContent = e + '';
	throw e;
}
