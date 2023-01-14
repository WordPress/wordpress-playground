import * as phpLoaderModule from '../../build/php-8.0.node.js';
import { startPHP } from './php';
import type { startPHP } from './php';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

async function main() {
	const php = await startPHP(phpLoaderModule, 'NODE');

	php.mkdirTree('/wordpress');
	php.mount({ root: '../../wordpress-develop' }, '/wordpress/');
	php.addServerGlobalEntry('js_argv', JSON.stringify(process.argv.slice(2)));
	php.writeFile(
		'/wordpress/tests.php',
		`<?php
    // PHPUnit uses the CLI constants we don't have in WASM SAPI.
    // No problem – let's define them here:
    define('STDERR', fopen('php://stderr', 'w'));
    define('STDOUT', fopen('php://stdout', 'w'));
    define('STDIN', fopen('php://stdin', 'w'));

    // Preconfigure WordPress tests:
    define('WP_RUN_CORE_TESTS', true);
    putenv('WP_TESTS_SKIP_INSTALL=1');

    // Provide CLI args for PHPUnit:
    $_SERVER['argv'] = json_decode($_SERVER['js_argv']);
    // ['./vendor/bin/phpunit', '-c', './phpunit.xml.dist', '--filter', 'Tests_Formatting_Utf8UriEncode'];
    chdir('/wordpress');

    // Let's go!
    require($_SERVER['argv'][0]); //"/wordpress/vendor/bin/phpunit");
    `
	);
	php.setSkipShebang(true);
	const output = php.run({
		scriptPath: '/wordpress/tests.php',
	});
	// console.log(output);
	console.log(new TextDecoder().decode(output.body));
}
main();
