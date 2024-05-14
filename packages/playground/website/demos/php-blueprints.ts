import { startPlaygroundWeb } from '@wp-playground/client';
import { getRemoteUrl } from '../src/lib/config';
import { joinPaths } from '@php-wasm/util';
export {};

const iframe = document.querySelector('iframe')!;
const playground = await startPlaygroundWeb({
	iframe,
	remoteUrl: getRemoteUrl().toString(),
	// Blueprint v1, implemented in TypeScript:
	blueprint: {
		preferredVersions: {
			wp: 'latest',
			// Required for the PHP library to run:
			php: '8.2',
		},
		features: {
			networking: true,
		},
		// landingPage: '/wp-content/index.php',
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
	const wpCliRequest = fetch(
		'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar'
	);
	const wpCliResponse = await wpCliRequest;
	const wpCli = await wpCliResponse.arrayBuffer();
	await playground.writeFile('/wordpress/wp-cli.phar', new Uint8Array(wpCli));

	outputDiv.textContent +=
		'Running the Blueprint...\nLive progress updates:\n';
	await playground.onMessage((message: string) => {
		try {
			const parsed = JSON.parse(message);
			if (parsed.type === 'progress') {
				outputDiv.textContent +=
					parsed.progress + '% ' + (parsed.caption || '') + '\n';
			}
		} catch (e) {
			console.error(e);
		}
	});
	// Blueprint v2, implemented in PHP. The PHP builder is not required. It only
	// produces a JSON document that is then used to run the Blueprint.
	const result = await playground.run({
		code: `<?php
		use WordPress\\Blueprints\\ContainerBuilder;
		use WordPress\\Blueprints\\Model\\BlueprintBuilder;
		use WordPress\\Blueprints\\Model\\DataClass\\Blueprint;
		use WordPress\\Blueprints\\Model\\DataClass\\UrlResource;
		use WordPress\\Blueprints\\Progress\\DoneEvent;
		use WordPress\\Blueprints\\Progress\\ProgressEvent;
		use Symfony\\Component\\EventDispatcher\\EventSubscriberInterface;
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

		$blueprint = BlueprintBuilder::create()
			// This isn't a WordPress zip file since wordpress.org
			// doesn't expose the right CORS headers. It is a HTTPS-hosted
			// zip file nonetheless, and we can use it for testing.
			// Uncomment this as needed
			// ->setWordPressVersion( 'https://downloads.wordpress.org/plugin/hello-dolly.1.7.3.zip' )

			->withFile( 'wordpress.txt', (new UrlResource())->setUrl('https://downloads.wordpress.org/plugin/hello-dolly.zip') )
			->withSiteOptions( [
				'blogname' => 'My Playground Blog',
			] )
			->withWpConfigConstants( [
				'WP_DEBUG'         => true,
				'WP_DEBUG_LOG'     => true,
				'WP_DEBUG_DISPLAY' => true,
				'WP_CACHE'         => true,
			] )
			->withPlugins( [
				'https://downloads.wordpress.org/plugin/hello-dolly.zip',
				// When the regular UrlDataSource is used, the second
				// downloaded zip file always errors with:
				// > Failed to open stream: Operation timed out
				'https://downloads.wordpress.org/plugin/classic-editor.zip',
				'https://downloads.wordpress.org/plugin/gutenberg.17.7.0.zip',
			] )
			->withTheme( 'https://downloads.wordpress.org/theme/pendant.zip' )
			// ->withContent( 'https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml' )
			->andRunSQL( <<<'SQL'
				CREATE TABLE tmp_table ( id INT );
				INSERT INTO tmp_table VALUES (1);
				INSERT INTO tmp_table VALUES (2);
				SQL
			)
			->withFile( 'wordpress.txt', 'Data' )
			->toBlueprint()
		;

		echo "Running the following Blueprint:\n";
		echo json_encode($blueprint, JSON_PRETTY_PRINT)."\n\n";

		$subscriber = new class implements EventSubscriberInterface {
			public static function getSubscribedEvents() {
				return [
					ProgressEvent::class => 'onProgress',
					DoneEvent::class     => 'onDone',
				];
			}

			public function onProgress( ProgressEvent $event ) {
				post_message_to_js(json_encode([
					'type'    => 'progress',
					'caption'  => $event->caption,
					'progress' => $event->progress,
				]));
			}

			public function onDone( DoneEvent $event ) {
				post_message_to_js(json_encode([
					'type'    => 'progress',
					'progress' => 100,
				]));
			}
		};


		$results = run_blueprint(
			$blueprint,
			[
				'environment'        => ContainerBuilder::ENVIRONMENT_PLAYGROUND,
				'documentRoot'       => '/wordpress',
				'progressSubscriber' => $subscriber,
				'progressType'       => 'steps',
			]
		);

		echo "Blueprint execution finished!\n";
		echo "Contents of /wordpress/wp-content/plugins:";
		print_r(glob('/wordpress/wp-content/plugins/*'));

		`,
	});

	outputDiv.textContent += result.text;
	console.log(result.text);
} catch (e) {
	console.error(e);
	outputDiv.textContent = e + '';
	throw e;
}

console.log(await playground.listFiles('/wordpress/wp-content/plugins'));
