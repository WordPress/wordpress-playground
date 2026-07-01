import type { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { activatePlugin } from '../../lib/steps/activate-plugin';
import { phpVar } from '@php-wasm/util';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';

describe('Blueprint step activatePlugin()', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	beforeEach(async () => {
		handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		php = await handler.getPrimaryPhp();
	}, 30_000);

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('should activate a plugin file located in the plugins directory', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: 'test-plugin.php',
			})
		).resolves.not.toThrow();
	});

	it('should activate a plugin file located in a subdirectory of the plugins directory', async () => {
		const docroot = handler.documentRoot;
		const pluginDir = `${docroot}/wp-content/plugins/test-plugin`;
		php.mkdir(pluginDir);
		php.writeFile(
			`${pluginDir}/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: `test-plugin/test-plugin.php`,
			})
		).resolves.not.toThrow();
	});

	it('should activate a plugin if a absolute plugin path is provided', async () => {
		const docroot = handler.documentRoot;
		php.mkdir(`${docroot}/wp-content/plugins/test-plugin`);
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin/index.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: `${docroot}/wp-content/plugins/test-plugin/index.php`,
			})
		).resolves.not.toThrow();
	});

	it('should activate a plugin if a absolute plugin directory path is provided', async () => {
		const docroot = handler.documentRoot;
		php.mkdir(`${docroot}/wp-content/plugins/test-plugin`);
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: `${docroot}/wp-content/plugins/test-plugin`,
			})
		).resolves.not.toThrow();
	});

	it('should activate a plugin if a absolute plugin directory path with a trailing slash is provided', async () => {
		const docroot = handler.documentRoot;
		php.mkdir(`${docroot}/wp-content/plugins/test-plugin`);
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: `${docroot}/wp-content/plugins/test-plugin/`,
			})
		).resolves.not.toThrow();
	});

	it('should detect a silent failure in activating the plugin', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);
		php.mkdir(`${docroot}/wp-content/mu-plugins`);
		php.writeFile(
			`${docroot}/wp-content/mu-plugins/0-exit.php`,
			`<?php exit(0); `
		);
		await expect(
			activatePlugin(php, {
				pluginPath: 'test-plugin.php',
			})
		).rejects.toThrow(/Plugin test-plugin.php could not be activated/);
	});

	it('should run the activation hooks as a privileged user', async () => {
		const docroot = handler.documentRoot;
		const createdFilePath =
			docroot + '/activation-ran-as-a-privileged-user.txt';
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
			pluginPath: 'test-plugin.php',
		});

		expect(php.fileExists(createdFilePath)).toBe(true);
	});

	it('should activate a plugin if it redirects during activation', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php
			/**
			 * Plugin Name: Test Plugin
			 */
			add_action( 'activated_plugin', function( $plugin ) {
				if( $plugin == plugin_basename( __FILE__ ) ) {
					wp_redirect( admin_url( 'edit.php' ) );
					exit();
				}
			} );
			`
		);
		await expect(
			activatePlugin(php, {
				pluginPath: 'test-plugin.php',
			})
		).resolves.not.toThrow();
	});

	it('should activate a plugin if it produces a output during activation', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php
			/**
			 * Plugin Name: Test Plugin
			 */
			echo 'Hello World';
			`
		);
		await expect(
			activatePlugin(php, {
				pluginPath: 'test-plugin.php',
			})
		).resolves.not.toThrow();
	});

	it('should log noisy activation output and still treat the plugin as active', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/noisy-plugin.php`,
			`<?php
			/**
			 * Plugin Name: Noisy Plugin
			 */
			register_activation_hook( __FILE__, function() {
				echo 'Activation says hi';
			} );

			register_shutdown_function( function() {
				echo 'Shutdown chimes in too';
			} );
			`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: 'noisy-plugin.php',
			})
		).resolves.not.toThrow();
	});

	it('should throw an error if the plugin was not activated and noisy output is present', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/noisy-plugin.php`,
			`<?php
			/**
			 * Plugin Name: Noisy Plugin
			 */
			register_activation_hook( __FILE__, function() {
				throw new Exception( 'Activation failed' );
			} );
			`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: 'noisy-plugin.php',
			})
		).rejects.toThrow(/Uncaught Exception: Activation failed/);
	});

	it('should surface the WP_Error message when activation is rejected (e.g. unmet PHP requirement)', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/wp-error-plugin.php`,
			`<?php
			/**
			 * Plugin Name: WP Error Plugin
			 * Requires PHP: 99.0
			 */
			`
		);

		// WP's own message for an unmet PHP requirement mentions PHP and
		// the version it expected — assert the gist is reachable, not the
		// exact phrasing.
		await expect(
			activatePlugin(php, {
				pluginPath: 'wp-error-plugin.php',
			})
		).rejects.toThrow(/WordPress said:[^\n]*PHP/i);
	});

	it('should surface the missing-plugin message when the plugin file does not exist', async () => {
		await expect(
			activatePlugin(php, {
				pluginPath: 'no-such-plugin.php',
			})
		).rejects.toThrow(/WordPress said: Plugin file does not exist/);
	});

	it('should include response headers and a pointer to the console in the error message', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/header-trailer-plugin.php`,
			`<?php
			/**
			 * Plugin Name: Header Trailer Plugin
			 * Requires PHP: 99.0
			 */
			`
		);

		let caught: Error | undefined;
		try {
			await activatePlugin(php, {
				pluginPath: 'header-trailer-plugin.php',
			});
		} catch (error) {
			caught = error as Error;
		}

		expect(caught).toBeDefined();
		expect(caught!.message).toMatch(/Response headers:\s*\{/);
		expect(caught!.message).toMatch(/Playground console.*CLI output/);
	});

	it('should surface PHP errors logged during activation in the scratch log', async () => {
		const docroot = handler.documentRoot;
		// Activation hook calls error_log() then wp_die()s. Because
		// wp_die fires inside do_action("activate_{$plugin}") — which
		// runs *before* WordPress writes the active_plugins option —
		// the plugin is never marked active, so the activation-status
		// check returns false and the JS step throws. The error_log()
		// output should be captured into our scratch log and surfaced
		// in that thrown error.
		php.writeFile(
			`${docroot}/wp-content/plugins/error-log-plugin.php`,
			`<?php
			/**
			 * Plugin Name: Error Log Plugin
			 */
			register_activation_hook(__FILE__, function() {
				error_log('marker-from-activation-hook');
				wp_die('halted-by-hook');
			});
			`
		);

		await expect(
			activatePlugin(php, {
				pluginPath: 'error-log-plugin.php',
			})
		).rejects.toThrow(
			/PHP error log:[\s\S]*marker-from-activation-hook/
		);
	});

	it('should not throw an error if the plugin is already active', async () => {
		const docroot = handler.documentRoot;
		php.writeFile(
			`${docroot}/wp-content/plugins/test-plugin.php`,
			`<?php /**\n * Plugin Name: Test Plugin */`
		);
		await activatePlugin(php, {
			pluginPath: 'test-plugin.php',
		});
		await expect(
			activatePlugin(php, {
				pluginPath: 'test-plugin.php',
			})
		).resolves.not.toThrow();
	});
});
