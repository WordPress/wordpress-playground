import { logger } from '@php-wasm/logger';
import type { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import { joinPaths, randomString } from '@php-wasm/util';

const ACTIVATION_STATUS_PAYLOAD_PREFIX = 'PLAYGROUND_PLUGIN_ACTIVATION_STATUS:';

export interface PluginActivation {
	pluginPath: string;
	continueOnError: boolean;
}

export interface PluginActivationOutcome {
	error?: unknown;
}

interface RuntimePluginActivation extends PluginActivation {
	index: number;
	activationLogPath: string;
}

interface ActivationAttempt {
	status: 'started' | 'returned';
	active?: boolean;
	errorMessage?: string;
}

interface ActivationState {
	attempts: Record<string, ActivationAttempt>;
}

/**
 * Activates plugins in as few WordPress requests as possible.
 *
 * A plugin can redirect, exit, or fail before activate_plugin() returns. Each
 * attempt is written to a scratch file before it starts. A separate WordPress
 * request then checks which plugins are active, and any unattempted plugins are
 * resumed in another collective request.
 *
 * The status check also handles ordinary activation output. WordPress returns
 * a WP_Error when a plugin prints bytes, but it adds the plugin to the active
 * list first. The active list remains the source of truth, just as it was for
 * the singular activatePlugin step.
 *
 * @see https://github.com/WordPress/wordpress-develop/blob/6.7/src/wp-admin/includes/plugin.php#L733
 */
export async function activatePlugins(
	playground: UniversalPHP,
	plugins: PluginActivation[]
): Promise<PluginActivationOutcome[]> {
	const outcomes: PluginActivationOutcome[] = plugins.map(() => ({}));
	if (plugins.length === 0) {
		return outcomes;
	}

	const docroot = await playground.documentRoot;
	const activationId = randomString(20, '');
	const statePath = joinPaths(
		'/tmp',
		`playground-activate-plugins-${activationId}.json`
	);
	/**
	 * Route each plugin's PHP errors to a unique scratch file. Do not change
	 * the site's debug.log. CLI workers share /tmp, so concurrent activations
	 * must not share a filename.
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
					requestedTargets
				);
			} catch (error) {
				activationRequestError = error;
			}

			const state = await readActivationState(playground, statePath);
			const attemptedTargets = requestedTargets.filter(
				(target) => state.attempts[target.index]
			);
			const lastAttemptedTarget = attemptedTargets.at(-1);
			const interruptedTarget = attemptedTargets.find(
				(target) => state.attempts[target.index]?.status === 'started'
			);
			const requestErrorTarget =
				activationRequestError === undefined
					? undefined
					: interruptedTarget || lastAttemptedTarget;

			let statuses: Record<string, boolean> | undefined;
			let statusRequestError: unknown;
			try {
				statuses = await readActivationStatuses(
					playground,
					docroot,
					requestedTargets
				);
			} catch (error) {
				statusRequestError = error;
			}

			if (attemptedTargets.length === 0) {
				const target = requestedTargets[0];
				if (
					activationRequestError === undefined &&
					statuses?.[target.index] === true
				) {
					nextIndex++;
					continue;
				}
				outcomes[target.index].error =
					activationRequestError ||
					statusRequestError ||
					createActivationError(
						target.pluginPath,
						activationResponse?.text,
						await readScratchLog(
							playground,
							target.activationLogPath
						),
						activationResponse?.headers
					);
				if (!target.continueOnError) {
					break;
				}
				nextIndex++;
				continue;
			}

			let processedThrough = nextIndex - 1;
			for (const target of attemptedTargets) {
				const attempt = state.attempts[target.index];
				const isRequestErrorTarget =
					target.index === requestErrorTarget?.index;
				const isStatusErrorTarget =
					statuses === undefined &&
					target.index === lastAttemptedTarget?.index;
				const active =
					statuses === undefined
						? !isStatusErrorTarget && attempt.active === true
						: statuses[target.index] === true;
				const output =
					attempt.errorMessage ||
					(target.index === lastAttemptedTarget?.index
						? activationResponse?.text
						: '');
				if (output) {
					logger.warn(
						`Plugin ${target.pluginPath} activation printed the following bytes: ${output}`
					);
				}

				let error: unknown;
				if (isRequestErrorTarget) {
					error = activationRequestError;
				} else if (isStatusErrorTarget && statusRequestError) {
					error = statusRequestError;
				} else if (!active || isStatusErrorTarget) {
					const activationLog = await readScratchLog(
						playground,
						target.activationLogPath
					);
					error = createActivationError(
						target.pluginPath,
						output,
						activationLog,
						activationResponse?.headers
					);
				}

				processedThrough = target.index;
				if (error) {
					outcomes[target.index].error = error;
					if (!target.continueOnError) {
						return outcomes;
					}
				}

				if (
					attempt.status === 'started' ||
					isRequestErrorTarget ||
					isStatusErrorTarget
				) {
					break;
				}
			}

			if (processedThrough < nextIndex) {
				outcomes[nextIndex].error =
					activationRequestError ||
					statusRequestError ||
					new Error(
						`Plugin ${targets[nextIndex].pluginPath} could not be activated.`
					);
				break;
			}
			nextIndex = processedThrough + 1;
		}

		return outcomes;
	} finally {
		/**
		 * Remove the per-run state and error logs after both activation and
		 * verification. Ignore only files that another cleanup already removed.
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
	targets: RuntimePluginActivation[]
) {
	return playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once getenv( 'DOCROOT' ) . '/wp-load.php';
require_once getenv( 'DOCROOT' ) . '/wp-admin/includes/plugin.php';

function playground_blueprints_write_activation_state( $state_path, $attempts ) {
	file_put_contents(
		$state_path,
		wp_json_encode( array( 'attempts' => $attempts ) )
	);
}

${PLUGIN_IS_ACTIVE_PHP}

$targets = json_decode( getenv( 'PLUGIN_TARGETS' ), true );
$attempts = array();
$state_path = getenv( 'ACTIVATION_STATE' );

// Set current user to admin.
wp_set_current_user( get_users( array( 'role' => 'Administrator' ) )[0]->ID );

foreach ( $targets as $target ) {
	$index = $target['index'];
	$plugin_path = $target['pluginPath'];
	ini_set( 'log_errors', '1' );
	ini_set( 'error_log', $target['activationLogPath'] );

	$attempts[ $index ] = array( 'status' => 'started' );
	playground_blueprints_write_activation_state( $state_path, $attempts );

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
	$attempt = array(
		'status' => 'returned',
		'active' => $active,
	);
	if ( is_wp_error( $response ) ) {
		$attempt['errorMessage'] = $response->get_error_message();
	} elseif ( false === $response ) {
		$attempt['errorMessage'] =
			"The activatePlugin step wasn't able to find the plugin $plugin_path.";
	}
	$attempts[ $index ] = $attempt;
	playground_blueprints_write_activation_state( $state_path, $attempts );

	if ( ! $active && ! $target['continueOnError'] ) {
		break;
	}
}
`,
		env: {
			DOCROOT: docroot,
			PLUGIN_TARGETS: JSON.stringify(targets),
			ACTIVATION_STATE: statePath,
		},
	});
}

async function readActivationStatuses(
	playground: UniversalPHP,
	docroot: string,
	targets: RuntimePluginActivation[]
) {
	const result = await playground.run({
		code: `<?php
ob_start();
require_once getenv( 'DOCROOT' ) . '/wp-load.php';

${PLUGIN_IS_ACTIVE_PHP}

$statuses = array();
foreach ( json_decode( getenv( 'PLUGIN_TARGETS' ), true ) as $target ) {
	$statuses[ $target['index'] ] =
		playground_blueprints_plugin_is_active( $target['pluginPath'] );
}
ob_end_clean();

// Print the machine-readable status after activation-related shutdown output.
$payload_prefix = getenv( 'ACTIVATION_STATUS_PAYLOAD_PREFIX' );
register_shutdown_function(
	function() use ( $statuses, $payload_prefix ) {
		echo "\\n" . $payload_prefix;
		echo wp_json_encode( $statuses ) . "\\n";
	}
);
`,
		env: {
			DOCROOT: docroot,
			PLUGIN_TARGETS: JSON.stringify(targets),
			ACTIVATION_STATUS_PAYLOAD_PREFIX: ACTIVATION_STATUS_PAYLOAD_PREFIX,
		},
	});

	return parseActivationStatuses(result.text);
}

async function readActivationState(
	playground: UniversalPHP,
	statePath: string
): Promise<ActivationState> {
	if (!(await playground.fileExists(statePath))) {
		return { attempts: {} };
	}
	try {
		const state = JSON.parse(
			await playground.readFileAsText(statePath)
		) as Partial<ActivationState>;
		return {
			attempts: state.attempts || {},
		};
	} catch {
		return { attempts: {} };
	}
}

function parseActivationStatuses(text: string | undefined) {
	const output = text || '';
	const payloadIndex = output.lastIndexOf(ACTIVATION_STATUS_PAYLOAD_PREFIX);
	if (payloadIndex === -1) {
		if (output.trim()) {
			logger.debug(output.trim());
		}
		return undefined;
	}

	const payload = output
		.slice(payloadIndex + ACTIVATION_STATUS_PAYLOAD_PREFIX.length)
		.trimStart()
		.split(/\r?\n/, 1)[0]
		.trim();
	try {
		return JSON.parse(payload) as Record<string, boolean>;
	} catch {
		logger.debug(output.trim());
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
	 * Point to both because this message is shared by both runtimes.
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
