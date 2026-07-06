import type { StepHandler } from '.';
import { logger } from '@php-wasm/logger';
/**
 * @inheritDoc activatePlugin
 * @example
 *
 * <code>
 * {
 * 		"step": "activatePlugin",
 * 		"pluginName": "Gutenberg",
 * 		"pluginPath": "/wordpress/wp-content/plugins/gutenberg"
 * }
 * </code>
 */
export interface ActivatePluginStep {
	step: 'activatePlugin';
	/**
	 * Path to the plugin directory as absolute path
	 * (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file
	 * relative to the plugins directory (plugin-name/plugin-name.php).
	 */
	pluginPath: string;
	/** Optional. Plugin name to display in the progress bar. */
	pluginName?: string;
}

/**
 * Activates a WordPress plugin (if it's installed).
 *
 * @param playground The playground client.
 */
export const activatePlugin: StepHandler<ActivatePluginStep> = async (
	playground,
	{ pluginPath, pluginName },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${pluginName || pluginPath}`);

	const docroot = await playground.documentRoot;

	/**
	 * Route this request's PHP errors to a scratch file we own, so we can
	 * include them in the JS-side error message if activation fails. We
	 * don't touch the user's debug.log — the activation snippet ini_sets
	 * the path for this single request only.
	 */
	const activationLogPath = '/tmp/playground-activate-plugin.log';
	if (await playground.fileExists(activationLogPath)) {
		await playground.unlink(activationLogPath);
	}

	/**
	 * Instead of checking the plugin activation response,
	 * check if the plugin is active by looking at the active plugins list.
	 *
	 * We have to split the activation and the check into two PHP runs
	 * because some plugins might redirect during activation,
	 * which would prevent any output that happens after activation from being returned.
	 *
	 * Relying on the plugin activation response is not reliable because if the plugin activation
	 * produces any output, WordPress will assume it's an activation error and return a WP_Error.
	 * WordPress will still activate the plugin and load the required page,
	 * but it will also show the error as a notice in wp-admin.
	 * See WordPress source code for more details:
	 * https://github.com/WordPress/wordpress-develop/blob/6.7/src/wp-admin/includes/plugin.php#L733
	 */
	const activatePluginResult = await playground.run({
		code: `<?php
			define( 'WP_ADMIN', true );
			require_once( getenv('DOCROOT') . "/wp-load.php" );
			require_once( getenv('DOCROOT') . "/wp-admin/includes/plugin.php" );

			// Force PHP errors to our scratch log for this request so the
			// JS caller can surface them when activation fails. This wins
			// over whatever WP_DEBUG_LOG resolved to during bootstrap.
			ini_set('log_errors', '1');
			ini_set('error_log', getenv('ACTIVATION_LOG'));

			// Set current user to admin
			wp_set_current_user( get_users(array('role' => 'Administrator') )[0]->ID );

			$plugin_path = getenv('PLUGIN_PATH');
			$response = false;
			if ( ! is_dir( $plugin_path)) {
				$response = activate_plugin($plugin_path);
			}

			// Activate plugin by name if activation by path wasn't successful
			if ( null !== $response ) {
				foreach ( ( glob( $plugin_path . '/*.php' ) ?: array() ) as $file ) {
					$info = get_plugin_data( $file, false, false );
					if ( ! empty( $info['Name'] ) ) {
						$response = activate_plugin( $file );
						break;
					}
				}
			}

			if ( is_wp_error($response) ) {
				die( $response->get_error_message() );
			} else if ( false === $response ) {
				die( "The activatePlugin step wasn't able to find the plugin $plugin_path." );
			}
		`,
		env: {
			PLUGIN_PATH: pluginPath,
			DOCROOT: docroot,
			ACTIVATION_LOG: activationLogPath,
		},
	});
	if (activatePluginResult.text) {
		logger.warn(
			`Plugin ${pluginPath} activation printed the following bytes: ${activatePluginResult.text}`
		);
	}

	/**
	 * Drain the scratch log immediately so the file is gone whether
	 * activation succeeded or failed. We only need its contents on the
	 * failure path below, but reading and deleting unconditionally
	 * keeps cleanup off the error branches.
	 */
	let activationLog = '';
	if (await playground.fileExists(activationLogPath)) {
		activationLog = (
			await playground.readFileAsText(activationLogPath)
		).trim();
		await playground.unlink(activationLogPath);
	}

	/**
	 * Instead of trusting the activation response, check the active plugins list.
	 *
	 * We try to discard any extra output via output buffering. The output of the script below
	 * end with `{"success": true}` or `{"success": false}`. Only `{"success": true}` is
	 * treated as a successful plugin activation.
	 */
	const activationStatusResult = await playground.run({
		code: `<?php
			ob_start();
			require_once( getenv( 'DOCROOT' ) . "/wp-load.php" );

			$plugin_directory = rtrim( WP_PLUGIN_DIR, '/' ) . '/';
			$relative_plugin_path = getenv( 'PLUGIN_PATH' );
			if (strpos($relative_plugin_path, $plugin_directory) === 0) {
				$relative_plugin_path = substr($relative_plugin_path, strlen($plugin_directory));
			}

			if ( is_dir( $plugin_directory . $relative_plugin_path ) ) {
				$relative_plugin_path = rtrim( $relative_plugin_path, '/' ) . '/';
			}

			$active_plugins = get_option( 'active_plugins' );
			if ( ! is_array( $active_plugins ) ) {
				$active_plugins = array();
			}
			ob_end_clean();

			/**
			 * Use a shutdown function to ensure the activation-related output comes
			 * last in stdout.
			 */
			register_shutdown_function( function() use ( $relative_plugin_path, $active_plugins ) {
				foreach ( $active_plugins as $plugin ) {
					if ( substr( $plugin, 0, strlen( $relative_plugin_path ) ) === $relative_plugin_path ) {
						die('{"success": true}');
						break;
					}
				}
				die('{"success": false}');
			});
		`,
		env: {
			DOCROOT: docroot,
			PLUGIN_PATH: pluginPath,
		},
	});

	const rawStatus = (activationStatusResult.text ?? '').trim();
	if (rawStatus.endsWith('{"success": true}')) {
		return;
	}
	if (rawStatus !== '{"success": false}') {
		logger.debug(rawStatus);
	}

	/**
	 * At this point php.run() has already returned with exit code 0
	 * (otherwise it would have thrown). The plugin still isn't active,
	 * which usually means activate_plugin() returned a WP_Error and the
	 * activation snippet die()'d with the message — that text is in
	 * activatePluginResult.text. Combine that with anything PHP wrote
	 * to the scratch log during the activation request.
	 */
	const details: string[] = [];
	const wpOutput = (activatePluginResult.text ?? '').trim();
	if (wpOutput) {
		details.push(`WordPress said: ${wpOutput}`);
	}
	if (activationLog) {
		details.push(`PHP error log:\n${activationLog}`);
	}

	/**
	 * Response headers are sometimes the only signal — e.g. plugins that
	 * redirect during activation produce no body at all. Always include
	 * them as a last line. Reuse the same JSON layout the previous error
	 * message used so anyone grepping logs for "Response headers:" still
	 * finds it.
	 */
	details.push(
		`Response headers: ${JSON.stringify(
			activatePluginResult.headers,
			null,
			2
		)}`
	);

	/**
	 * The browser app surfaces PHP debug logs via the in-page console;
	 * the CLI prints them to stderr. Point at both so the message is
	 * useful regardless of where the Blueprint is being run.
	 */
	details.push(
		`If you need more context, check the Playground console (browser DevTools) or the CLI output where this Blueprint was run.`
	);

	throw new Error(
		`Plugin ${pluginPath} could not be activated.\n\n${details.join('\n\n')}`
	);
};
