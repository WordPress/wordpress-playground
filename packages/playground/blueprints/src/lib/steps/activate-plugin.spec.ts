import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { unzip } from './unzip';
import { activatePlugin } from './activate-plugin';
import { phpVar } from '@php-wasm/util';
import { PHPRequestHandler } from '@php-wasm/universal';

describe('Blueprint step activatePlugin()', () => {
	let php: NodePHP;
	let handler: PHPRequestHandler<NodePHP>;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: () => NodePHP.load(RecommendedPHPVersion),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
	});

	it('should activate the plugin', async () => {
		const docroot = php.documentRoot;
		php.writeFile(
			`/${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);
		await activatePlugin(php, {
			pluginPath: docroot + '/wp-content/plugins/test-plugin.php',
		});

		const response = await php.run({
			code: `<?php
				require_once '/wordpress/wp-load.php';
				require_once ${phpVar(docroot)}. "/wp-admin/includes/plugin.php" ;
				echo is_plugin_active('test-plugin.php') ? 'true' : 'false';
			`,
		});
		expect(response.text).toBe('true');
	});

	it('should run the activation hooks as a priviliged user', async () => {
		const docroot = php.documentRoot;
		const createdFilePath =
			docroot + '/activation-ran-as-a-priviliged-user.txt';
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */
			function myplugin_activate() {
				if( ! current_user_can( 'activate_plugins' ) ) return;
				file_put_contents( ${phpVar(createdFilePath)}, 'Hello World');
			}
			register_activation_hook( __FILE__, 'myplugin_activate' );
			`
		);
		await activatePlugin(php, {
			pluginPath: docroot + '/wp-content/plugins/test-plugin.php',
		});

		expect(php.fileExists(createdFilePath)).toBe(true);
	});
});
