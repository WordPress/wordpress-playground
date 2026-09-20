import type { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import type { StepHandler } from '.';
import { joinPaths, phpVar } from '@php-wasm/util';
import type { UrlReference } from '../v1/resources';
import { logger } from '@php-wasm/logger';

export const defaultWpCliPath = '/tmp/wp-cli.phar';
export const defaultWpCliResource: UrlReference = {
	resource: 'url',
	/**
	 * Use compression for downloading the wp-cli.phar file.
	 * The official release, hosted at raw.githubusercontent.com, is ~7MB
	 * and the transfer is uncompressed. playground.wordpress.net supports
	 * transfer compression and only transmits ~1.4MB.
	 *
	 * @TODO: minify the wp-cli.phar file. It can be as small as 1MB when all the
	 *        whitespaces and are removed, and even 500KB when libraries
	 *        like the JavaScript parser or Composer are removed.
	 */
	url: 'https://playground.wordpress.net/wp-cli.phar',
};

const stdinUnsupportedMessage =
	'This WP-CLI command tried to read from STDIN, but the wp-cli Blueprint ' +
	'step does not support interactive input. Provide all required arguments.';

const wpCliOverridesPath = '/tmp/playground-wp-cli-overrides.php';

/**
 * Loaded via `--require` before WP-CLI dispatches the command.
 *
 * `wp db query` normally shells out to the `mysql` binary, which does not
 * exist in Playground and whose spawn traps the WASM runtime. Re-register it
 * on top of $wpdb so the query runs against the SQLite-backed database.
 */
const wpCliOverrides = `<?php
if ( ! class_exists( 'WP_CLI' ) ) {
	return;
}

WP_CLI::add_command(
	'db query',
	function ( $args, $assoc_args ) {
		global $wpdb;

		$sql = isset( $args[0] ) ? trim( $args[0] ) : '';
		if ( '' === $sql ) {
			WP_CLI::error(
				'Pass the SQL query as an argument. Reading it from STDIN ' .
				'is not supported in Playground.'
			);
		}

		$suppressed = $wpdb->suppress_errors( true );
		$rows       = $wpdb->get_results( $sql, ARRAY_A );
		$wpdb->suppress_errors( $suppressed );
		if ( '' !== $wpdb->last_error ) {
			// The SQLite driver reports errors as an HTML debug dump. Surface
			// only the underlying database error message.
			$error = $wpdb->last_error;
			if ( preg_match( '/class="error_message"[^>]*>(.*?)<\\/div>/s', $error, $m ) ) {
				$error = $m[1];
			}
			WP_CLI::error( trim( wp_strip_all_tags( $error ) ) );
		}

		if ( ! empty( $rows ) ) {
			WP_CLI\\Utils\\format_items( 'table', $rows, array_keys( $rows[0] ) );
		} elseif ( ! preg_match( '/^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|PRAGMA)\\b/i', $sql ) ) {
			WP_CLI::success(
				sprintf( 'Query OK, %d rows affected.', $wpdb->rows_affected )
			);
		}
	},
	array(
		'shortdesc' => 'Executes a query against the database.',
		'synopsis'  => array(
			array(
				'type'     => 'positional',
				'name'     => 'sql',
				'optional' => false,
			),
		),
		'when'      => 'after_wp_load',
	)
);
`;

export const assertWpCli = async (
	playground: UniversalPHP,
	wpCliPath: string = defaultWpCliPath
) => {
	if (!(await playground.fileExists(wpCliPath))) {
		throw new Error(`wp-cli.phar not found at ${wpCliPath}.
			You can enable wp-cli support by adding "wp-cli" to the list of extra libraries in your blueprint as follows:
			{
				"extraLibraries": [ "wp-cli" ]
			}
			Read more about it in the documentation.
			https://wordpress.github.io/wordpress-playground/blueprints/data-format#extra-libraries`);
	}
};

/**
 * @inheritDoc wpCLI
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "wp-cli",
 * 		"command": "wp post create --post_title='Test post' --post_excerpt='Some content'"
 * }
 * </code>
 */
export interface WPCLIStep {
	/** The step identifier. */
	step: 'wp-cli';
	/** The WP CLI command to run. */
	command: string | string[];
	/** wp-cli.phar path */
	wpCliPath?: string;
}

/**
 * Runs PHP code using [WP-CLI](https://developer.wordpress.org/cli/commands/).
 */
export const wpCLI: StepHandler<WPCLIStep, Promise<PHPResponse>> = async (
	playground,
	{ command, wpCliPath = defaultWpCliPath }
) => {
	await assertWpCli(playground, wpCliPath);

	let args: string[];
	if (typeof command === 'string') {
		command = command.trim();
		args = splitShellCommand(command);
	} else {
		args = command;
	}

	const cmd = args.shift();
	if (cmd !== 'wp') {
		throw new Error(`The first argument must be "wp".`);
	}

	let rewrotePaths = false;
	const argsWithRewrittenPaths = args.map((arg) => {
		if (arg.startsWith('wordpress/')) {
			rewrotePaths = true;
			return `/${arg}`;
		}
		return arg;
	});

	if (rewrotePaths) {
		logger.error(
			`
The wp-cli step in your Blueprint refers to a relative path.

Playground recently changed the working directory from '/' to '/wordpress' to better mimic 
how real web servers work. This means relative paths that used to work may no longer 
point to the correct location.

Playground automatically updated the path for you, but at one point path rewriting will be removed. Please
update your code to use an absolute path instead:

Instead of:

        {
            "step": "wp-cli",
            "command": "wp media import wordpress/wp-content/Select-storage-method.png --post_id=4 --title='Select your storage method' --featured_image"
        }

Use:

        {
            "step": "wp-cli",
            "command": "wp media import /wordpress/wp-content/Select-storage-method.png --post_id=4 --title='Select your storage method' --featured_image"
        }

This will ensure your code works reliably regardless of the current working directory.
        `.trim()
		);
	}

	const documentRoot = await playground.documentRoot;

	await playground.writeFile('/tmp/stdout', '');
	await playground.writeFile('/tmp/stderr', '');
	await playground.writeFile(wpCliOverridesPath, wpCliOverrides);
	await playground.writeFile(
		joinPaths(documentRoot, 'run-cli.php'),
		`<?php
		// Set up the environment to emulate a shell script
		// call.

		// Set SHELL_PIPE to 0 to ensure WP-CLI formats
		// the output as ASCII tables.
		// @see https://github.com/wp-cli/wp-cli/issues/1102
		putenv( 'SHELL_PIPE=0' );

		// Set the argv global.
		$GLOBALS['argv'] = array_merge([
		  "/tmp/wp-cli.phar",
		  "--path=${documentRoot}",
		  "--require=${wpCliOverridesPath}"
		], ${phpVar(argsWithRewrittenPaths)});

		// Fail before a command can treat missing interactive input as an empty
		// value. The Blueprint step has no way to provide STDIN.
		class Playground_No_Stdin_Stream {
			public $context;

			public function stream_open($path, $mode, $options, &$opened_path) {
				return true;
			}

			public function stream_eof() {
				throw new RuntimeException(
					${phpVar(stdinUnsupportedMessage)}
				);
			}

			public function stream_read($count) {
				return $this->stream_eof();
			}

			public function stream_stat() {
				return [];
			}
		}

		$playground_no_stdin_scheme =
			'playground-no-stdin-' . str_replace('.', '-', uniqid('', true));
		if (
			!stream_wrapper_register(
				$playground_no_stdin_scheme,
				Playground_No_Stdin_Stream::class
			)
		) {
			throw new RuntimeException(${phpVar(stdinUnsupportedMessage)});
		}
		$playground_no_stdin = fopen(
			$playground_no_stdin_scheme . '://input',
			'rb'
		);
		if (!is_resource($playground_no_stdin)) {
			throw new RuntimeException(${phpVar(stdinUnsupportedMessage)});
		}
		define('STDIN', $playground_no_stdin);

		// Provide stdout and stderr streams outside of the CLI SAPI.
		define('STDOUT', fopen('php://stdout', 'wb'));
		define('STDERR', fopen('php://stderr', 'wb'));

		require( ${phpVar(wpCliPath)} );
		`
	);

	const result = await playground.run({
		scriptPath: joinPaths(documentRoot, 'run-cli.php'),
	});

	if (result.exitCode !== 0) {
		throw new Error(result.errors);
	}

	return result;
};

/**
 * Naive shell command parser.
 * Ensures that commands like `wp option set blogname "My blog name"` are split
 * into `['wp', 'option', 'set', 'blogname', 'My blog name']` instead of
 * `['wp', 'option', 'set', 'blogname', 'My', 'blog', 'name']`.
 *
 * @param command
 * @returns
 */
export function splitShellCommand(command: string) {
	const MODE_NORMAL = 0;
	const MODE_IN_QUOTE = 1;

	let mode = MODE_NORMAL;
	let quote = '';

	const parts: string[] = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (mode === MODE_NORMAL) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				if (currentPart) {
					parts.push(currentPart);
				}
				currentPart = '';
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === '\\') {
				i++;
				currentPart += command[i];
			} else if (char === quote) {
				mode = MODE_NORMAL;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart);
	}
	return parts;
}
