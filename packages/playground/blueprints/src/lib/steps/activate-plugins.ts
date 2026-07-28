import { logger } from '@php-wasm/logger';
import type { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import { joinPaths, randomString } from '@php-wasm/util';

interface PluginActivation {
	pluginPath: string;
	continueOnError: boolean;
}

interface RuntimePluginActivation extends PluginActivation {
	index: number;
	activationLogPath: string;
}

interface ActivationState {
	lastIndex: number;
	active: Record<string, boolean>;
	messages: Record<string, string>;
	checked?: boolean;
}

/**
 * Activates plugins in as few WordPress requests as possible.
 *
 * A plugin can redirect or exit before activate_plugin() returns. The scratch
 * state records the current plugin so the next request can resume with the
 * following one. A shutdown callback checks the active plugin list because
 * WordPress may activate a plugin even when activation printed output.
 *
 * @see https://github.com/WordPress/wordpress-develop/blob/6.7/src/wp-admin/includes/plugin.php#L733
 */
export async function activatePlugins(
	playground: UniversalPHP,
	plugins: PluginActivation[]
) {
	const outcomes: Array<{ error?: unknown }> = plugins.map(() => ({}));
	if (plugins.length === 0) {
		return outcomes;
	}

	const docroot = await playground.documentRoot;
	const statePath = joinPaths(
		'/tmp',
		`playground-activate-plugins-${randomString(20, '')}.json`
	);
	/**
	 * Do not change the site's debug.log. CLI workers share /tmp, so every
	 * activation also needs its own PHP error log.
	 */
	const targets: RuntimePluginActivation[] = plugins.map((plugin, index) => ({
		...plugin,
		index,
		activationLogPath: joinPaths(
			'/tmp',
			`playground-activate-plugin-${randomString(20, '')}.log`
		),
	}));

	let nextIndex = 0;
	try {
		while (nextIndex < targets.length) {
			const requestedTargets = targets.slice(nextIndex);
			let activationResponse: PHPResponse | undefined;
			let activationRequestError: unknown;
			try {
				activationResponse = await runActivationRequest(
					playground,
					docroot,
					statePath,
					nextIndex,
					requestedTargets
				);
			} catch (error) {
				activationRequestError = error;
			}

			const state = await readActivationState(playground, statePath);
			const statuses = state?.checked ? state.active : undefined;
			const attemptedThrough = Math.min(
				targets.length - 1,
				Math.max(nextIndex, state?.lastIndex ?? nextIndex)
			);

			for (let index = nextIndex; index <= attemptedThrough; index++) {
				const target = targets[index];
				const output =
					state?.messages[target.index] ||
					(target.index === attemptedThrough
						? activationResponse?.text
						: '');
				if (output) {
					logger.warn(
						`Plugin ${target.pluginPath} activation printed the following bytes: ${output}`
					);
				}

				let error: unknown;
				if (
					target.index === attemptedThrough &&
					activationRequestError !== undefined
				) {
					error = activationRequestError;
				} else if (
					statuses === undefined &&
					target.index === attemptedThrough
				) {
					error = createActivationError(
						target.pluginPath,
						output,
						await readScratchLog(
							playground,
							target.activationLogPath
						),
						activationResponse?.headers
					);
				} else if (
					(statuses?.[target.index] ??
						state?.active[target.index]) !== true
				) {
					error = createActivationError(
						target.pluginPath,
						output,
						await readScratchLog(
							playground,
							target.activationLogPath
						),
						activationResponse?.headers
					);
				}

				if (error) {
					outcomes[target.index].error = error;
					if (!target.continueOnError) {
						return outcomes;
					}
				}
			}

			nextIndex = attemptedThrough + 1;
		}

		return outcomes;
	} finally {
		/**
		 * Ignore only files that another cleanup already removed. Other
		 * filesystem errors must still surface.
		 */
		await removeScratchFile(playground, statePath);
		for (const target of targets) {
			await removeScratchFile(playground, target.activationLogPath);
		}
	}
}

const PLUGIN_IS_ACTIVE_PHP = `
function playground_blueprints_plugin_is_active( $plugin_path ) {
	$plugin_directory = rtrim( WP_PLUGIN_DIR, '/' ) . '/';
	$relative_plugin_path = $plugin_path;
	if ( strpos( $relative_plugin_path, $plugin_directory ) === 0 ) {
		$relative_plugin_path = substr(
			$relative_plugin_path,
			strlen( $plugin_directory )
		);
	}
	if ( is_dir( $plugin_directory . $relative_plugin_path ) ) {
		$relative_plugin_path = rtrim( $relative_plugin_path, '/' ) . '/';
	}

	$active_plugins = get_option( 'active_plugins' );
	if ( ! is_array( $active_plugins ) ) {
		$active_plugins = array();
	}
	foreach ( $active_plugins as $plugin ) {
		if (
			substr( $plugin, 0, strlen( $relative_plugin_path ) ) ===
			$relative_plugin_path
		) {
			return true;
		}
	}
	return false;
}
`;

async function runActivationRequest(
	playground: UniversalPHP,
	docroot: string,
	statePath: string,
	startIndex: number,
	targets: RuntimePluginActivation[]
) {
	return playground.run({
		code: `<?php
function playground_blueprints_write_activation_state( $path, $state ) {
	file_put_contents( $path, json_encode( $state ) );
}

${PLUGIN_IS_ACTIVE_PHP}

$state = array(
	'lastIndex' => (int) getenv( 'START_INDEX' ),
	'active' => array(),
	'messages' => array(),
);
$state_path = getenv( 'ACTIVATION_STATE' );
$targets = json_decode( getenv( 'PLUGIN_TARGETS' ), true );
playground_blueprints_write_activation_state( $state_path, $state );

/**
 * Register before WordPress loads so this runs before any plugin shutdown
 * callbacks, including callbacks that call exit.
 */
register_shutdown_function(
	function() use ( &$state, $state_path, $targets ) {
		if (
			! defined( 'WP_PLUGIN_DIR' ) ||
			! function_exists( 'get_option' )
		) {
			return;
		}
		$state['active'] = array();
		foreach ( $targets as $target ) {
			$state['active'][ $target['index'] ] =
				playground_blueprints_plugin_is_active(
					$target['pluginPath']
				);
		}
		$state['checked'] = true;
		playground_blueprints_write_activation_state( $state_path, $state );
	}
);

define( 'WP_ADMIN', true );
require_once getenv( 'DOCROOT' ) . '/wp-load.php';
require_once getenv( 'DOCROOT' ) . '/wp-admin/includes/plugin.php';

// Set current user to admin.
wp_set_current_user( get_users( array( 'role' => 'Administrator' ) )[0]->ID );

foreach ( $targets as $target ) {
	$index = $target['index'];
	$plugin_path = $target['pluginPath'];
	ini_set( 'log_errors', '1' );
	ini_set( 'error_log', $target['activationLogPath'] );

	$state['lastIndex'] = $index;
	playground_blueprints_write_activation_state( $state_path, $state );

	$response = false;
	if ( ! is_dir( $plugin_path ) ) {
		$response = activate_plugin( $plugin_path );
	}

	// Activate a directory by its first plugin entry file.
	if ( null !== $response ) {
		foreach ( ( glob( $plugin_path . '/*.php' ) ?: array() ) as $file ) {
			$info = get_plugin_data( $file, false, false );
			if ( ! empty( $info['Name'] ) ) {
				$response = activate_plugin( $file );
				break;
			}
		}
	}

	$active = playground_blueprints_plugin_is_active( $plugin_path );
	$state['active'][ $index ] = $active;
	if ( is_wp_error( $response ) ) {
		$state['messages'][ $index ] = $response->get_error_message();
	} elseif ( false === $response ) {
		$state['messages'][ $index ] =
			"Plugin activation couldn't find $plugin_path.";
	}
	playground_blueprints_write_activation_state( $state_path, $state );

	if ( ! $active && ! $target['continueOnError'] ) {
		break;
	}
}
`,
		env: {
			DOCROOT: docroot,
			PLUGIN_TARGETS: JSON.stringify(targets),
			ACTIVATION_STATE: statePath,
			START_INDEX: String(startIndex),
		},
	});
}

async function readActivationState(
	playground: UniversalPHP,
	statePath: string
): Promise<ActivationState | undefined> {
	if (!(await playground.fileExists(statePath))) {
		return undefined;
	}
	try {
		const state = JSON.parse(
			await playground.readFileAsText(statePath)
		) as Partial<ActivationState>;
		if (typeof state.lastIndex !== 'number') {
			return undefined;
		}
		return {
			lastIndex: state.lastIndex,
			active: state.active || {},
			messages: state.messages || {},
			checked: state.checked === true,
		};
	} catch {
		return undefined;
	}
}

async function readScratchLog(
	playground: UniversalPHP,
	path: string
): Promise<string> {
	if (!(await playground.fileExists(path))) {
		return '';
	}
	return (await playground.readFileAsText(path)).trim();
}

function createActivationError(
	pluginPath: string,
	wpOutput: string | undefined,
	activationLog: string,
	headers: Record<string, string[]> = {}
) {
	const details: string[] = [];
	if (wpOutput?.trim()) {
		details.push(`WordPress said: ${wpOutput.trim()}`);
	}
	if (activationLog) {
		details.push(`PHP error log:\n${activationLog}`);
	}
	/**
	 * A redirect may leave response headers as the only useful signal. Keep
	 * the established JSON layout so existing log searches still find it.
	 */
	details.push(`Response headers: ${JSON.stringify(headers, null, 2)}`);
	/**
	 * Browser runs expose PHP logs in DevTools; the CLI writes them to stderr.
	 */
	details.push(
		'If you need more context, check the Playground console ' +
			'(browser DevTools) or the CLI output where this Blueprint was run.'
	);

	return new Error(
		`Plugin ${pluginPath} could not be activated.\n\n${details.join(
			'\n\n'
		)}`
	);
}

async function removeScratchFile(
	playground: UniversalPHP,
	path: string
): Promise<void> {
	try {
		if (await playground.fileExists(path)) {
			await playground.unlink(path);
		}
	} catch (error) {
		if (!isFileNotFoundError(error)) {
			throw error;
		}
	}
}

// Emscripten's MEMFS reports ENOENT as errno 44 instead of a Node error code.
const EMSCRIPTEN_ENOENT = 44;

function isFileNotFoundError(error: unknown): boolean {
	const fileSystemError = error as { code?: unknown; errno?: unknown };
	return (
		fileSystemError.code === 'ENOENT' ||
		fileSystemError.errno === EMSCRIPTEN_ENOENT
	);
}
