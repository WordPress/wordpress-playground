import type { V2StepHandler } from '../types';
import { registerV2StepHandler } from './index';
import { joinPaths, phpVar } from '@php-wasm/util';
import {
	splitShellCommand,
	defaultWpCliPath,
	assertWpCli,
} from '../../steps/wp-cli';

/**
 * Executes a WP-CLI command against the WordPress installation.
 *
 * The handler reuses the V1 `splitShellCommand` parser and
 * `assertWpCli` guard. It writes a PHP bootstrap script that
 * sets up the expected WP-CLI environment (argv, stdio streams)
 * and then requires `wp-cli.phar`.
 */
export const wpCliHandler: V2StepHandler = async (args, context) => {
	const { command, wpCliPath = defaultWpCliPath } = args as {
		command: string;
		wpCliPath?: string;
	};

	await assertWpCli(context.php, wpCliPath);

	const parsedArgs = splitShellCommand(command.trim());
	const cmd = parsedArgs.shift();
	if (cmd !== 'wp') {
		throw new Error('The first argument must be "wp".');
	}

	const documentRoot = await context.php.documentRoot;

	await context.php.writeFile('/tmp/stdout', '');
	await context.php.writeFile('/tmp/stderr', '');
	await context.php.writeFile(
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
		  "--path=${documentRoot}"
		], ${phpVar(parsedArgs)});

		// Provide stdin, stdout, stderr streams outside of
		// the CLI SAPI.
		define('STDIN', fopen('php://stdin', 'rb'));
		define('STDOUT', fopen('php://stdout', 'wb'));
		define('STDERR', fopen('php://stderr', 'wb'));

		require( ${phpVar(wpCliPath)} );
		`
	);

	const result = await context.php.run({
		scriptPath: joinPaths(documentRoot, 'run-cli.php'),
	});

	if (result.exitCode !== 0) {
		throw new Error(result.errors);
	}
};

registerV2StepHandler('wp-cli', wpCliHandler);
