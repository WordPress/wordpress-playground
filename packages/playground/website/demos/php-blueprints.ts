import { startPlaygroundWeb } from '@wp-playground/client';
import { getRemoteUrl } from '../src/lib/config';
import { joinPaths } from '@php-wasm/util';
export {};

const iframe = document.querySelector('iframe')!;
console.log('calling startPlaygroundWeb');
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
		landingPage: '/wp-content/index.php',
		// Required for the PHP library to run:
		phpExtensionBundles: ['kitchen-sink'],
	},
});

console.log('fetching the blueprints');
const response = await fetch('./blueprints.phar');
const phar = new Uint8Array(await response.arrayBuffer());
await playground.writeFile(
	joinPaths(await playground.documentRoot, 'blueprints.phar'),
	phar
);
const outputDiv = document.getElementById('output')!;

console.log('Running the PHP code');
// For now, let's try to get a remote network call to work
// const result = await playground.run({
// 	code: `<?php
// 	// HTTP works, yay!
// 	// echo file_get_contents("http://localhost:5400/website-server/");

// 	function test() {
// 		yield 1;
// 		yield file_get_contents('https://localhost:5400/website-server/');
// 		yield 2;
// 	}
// 	foreach(test() as $val) {
// 		echo $val;
// 	}
// 	die();

// 	// HTTPS requires a bit more work
// 	// echo file_get_contents("https://localhost:5400/website-server/");
// 	// use file_get_contents but send some headers and body
// 	$opts = [
// 		'http' => [
// 			'method' => 'GET',
// 			'header' => 'Content-type: text/plain',
// 			'content' => 'Some body :)',
// 		],
// 	];
// 	// $context = stream_context_create($opts);
// 	// echo file_get_contents("https://localhost:5400/website-server/", false, $context);

// 	// fopen, write some headers
// 	// $fp = fsockopen("ssl://localhost:5400/website-server/", 443, $errno, $errstr, 30);
// 	// fwrite($fp, "GET / HTTP/1.1\\r\\nHost: localhost:5400\\r\\nContent-type: text/plain\\r\\nConnection: close\\r\\n\\r\\nSome body :)");
// 	// Get the response
// 	// while (!feof($fp)) {
// 	// 	echo fgets($fp, 128);
// 	// }
// 	// fclose($fp);
// 	`,
// 	throwOnError: true,
// });
// console.log(result.text);
// throw new Error('Done!');

try {
	// For now this only runs with ?php=8.2&php-extension-bundle=kitchen-sink
	// ?php=8.2&php-extension-bundle=kitchen-sink
	const result = await playground.run({
		code: `<?php
		use WordPress\\Blueprints\\Model\\DataClass\\Blueprint;
		use WordPress\\Blueprints\\Model\\BlueprintBuilder;
		use function WordPress\\Blueprints\\run_blueprint;

		// Provide stdin, stdout, stderr streams outside of
		// the CLI SAPI.
		define('STDIN', fopen('php://stdin', 'rb'));
		define('STDOUT', fopen('php://stdout', 'wb'));
		define('STDERR', fopen('/tmp/stderr', 'wb'));

		/*
		 * When the .phar file is build with this box option:
		 * > "check-requirements": false,
		 * Then requiring it breaks http and https requests:
		 *
		 * > echo file_get_contents('http://localhost:5400/website-server/');
		 * > <b>Warning</b>:  PHP Request Startup: Failed to open stream: Operation timed out in <b>php-wasm run script</b> on line <b>13</b><br />
		 * 
		 * The check is therefore disabled for now.
		 */
		require '/wordpress/blueprints.phar';
		
		// 	->withWordPressVersion( 'http://localhost:5400/website-server/demos/wordpress.zip' );
		$blueprint = BlueprintBuilder::create()
			// This isn't a WordPress zip file since wordpress.org
			// doesn't expose the right CORS headers. It is a HTTPS-hosted
			// zip file nonetheless, and we can use it for testing.
			// Uncomment this as needed
			// ->setWordPressVersion( 'https://downloads.wordpress.org/plugin/hello-dolly.1.7.3.zip' )

			// And, by default, let's use a real WordPress zip file – even if it's
			// downloaded via http, not https.
			->withWordPressVersion( 'http://localhost:5400/website-server/demos/wordpress.zip' )
			// ->withSiteOptions( [
			// 	'blogname' => 'My Playground Blog',
			// ] )
			// ->withWpConfigConstants( [
			// 	'WP_DEBUG'         => true,
			// 	'WP_DEBUG_LOG'     => true,
			// 	'WP_DEBUG_DISPLAY' => true,
			// 	'WP_CACHE'         => true,
			// ] )
			// ->withPlugins( [
			// 	'https://downloads.wordpress.org/plugin/hello-dolly.zip',
			// 	'https://downloads.wordpress.org/plugin/gutenberg.17.7.0.zip',
			// ] )
			// ->withTheme( 'https://downloads.wordpress.org/theme/pendant.zip' )
			// ->withContent( 'https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml' )
			// ->withSiteUrl( 'http://localhost:8081' )
			// ->andRunSQL( <<<'SQL'
			// 	CREATE TABLE tmp_table ( id INT );
			// 	INSERT INTO tmp_table VALUES (1);
			// 	INSERT INTO tmp_table VALUES (2);
			// 	SQL
			// )
			->withFile( 'wordpress.txt', 'Data' )
			->toBlueprint()
		;
		
		mkdir('/wordpress2');
		$results = run_blueprint( $blueprint, '/wordpress2' );		
		print_r(glob('/wordpress2/*'));
		`,
		throwOnError: true,
	});

	outputDiv.textContent = result.text;
	console.log(result.text);
} catch (e) {
	outputDiv.textContent = e + '';
	throw e;
}
