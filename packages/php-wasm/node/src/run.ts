import { vi } from 'vitest';
import {
	__private__dont__use,
	getPhpIniEntries,
	loadPHPRuntime,
	PHP,
	PHPProcessManager,
	setPhpIniEntries,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { loadNodeRuntime } from './lib';
import { createSpawnHandler, phpVar } from '@php-wasm/util';

const php = new PHP(await loadNodeRuntime('8.3' as any));
const subPhp = new PHP(await loadNodeRuntime('8.3' as any));
// const streamingResponse = await php.cli(
// 	['php', '-r', `class Top {
// 					function __clone() {
// 						file_get_contents("http://127.0.0.1");
// 					}
// 				}
// 				$x = new Top();
// 				clone $x;`]);
// const streamingResponse = await php.cli(['php', '-r', `echo "Hello, World!";`]);
// const streamingResponse = await php.cli(['php', '-r', `exit(1);`]);

php.setSpawnHandler(createSpawnHandler(async function (args, processApi, options) {
	console.log('spawnHandler', args);
		processApi.notifySpawn();
		if (args[0] === 'exec') {
			args.shift();
		}

		if (args[0].endsWith('.php')) {
			args.unshift('php');
		}

		// Mock programs required by wp-cli:
		if (
			args[0] === '/usr/bin/env' &&
			args[1] === 'stty' &&
			args[2] === 'size'
		) {
			// These numbers are hardcoded because this
			// spawnHandler is transmitted as a string to
			// the PHP backend and has no access to local
			// scope. It would be nice to find a way to
			// transfer / proxy a live object instead.
			// @TODO: Do not hardcode this
			processApi.stdout(`18 140`);
			processApi.exit(0);
		} else if (args[0] === 'tput' && args[1] === 'cols') {
			processApi.stdout(`140`);
			processApi.exit(0);
		} else if (args[0] === 'less') {
			processApi.on('stdin', (data: Uint8Array) => {
				processApi.stdout(data);
			});
			processApi.flushStdin();
			processApi.exit(0);
		} else if (args[0] === 'php') {
			try {
				console.log({options})
				console.log('args', args);

				// @TODO: Run the actual PHP CLI SAPI instead of
				//        interpreting the arguments and emulating
				//        the CLI constants and globals.
				// const cliBootstrapScript = `<?php
                // // Set the argv global.
                // $_SERVER['argv'] = $GLOBALS['argv'] = array_merge([
                //     "/wordpress/wp-cli.phar",
                //     "--path=/wordpress"
                // ], ${phpVar(args.slice(2))});
                // $_SERVER['argc'] = $GLOBALS['argc'] = count($argv);

                // // Provide stdin, stdout, stderr streams outside of
                // // the CLI SAPI.
                // define('STDIN', fopen('php://stdin', 'rb'));
                // define('STDOUT', fopen('php://stdout', 'wb'));
                // define('STDERR', fopen('php://stderr', 'wb'));

				// error_reporting(E_ALL);
				// ini_set('display_errors', '1');
				// ini_set('log_errors', '1');
				// ini_set('error_log', 'php://stderr');

				// // Set DOCROOT to the current working directory.
				// // if(getenv("DOCROOT")) {
				// // 	chdir(getenv("DOCROOT"));
				// // }
				// `;

				const code = args.includes('-r')
					? args[args.indexOf('-r') + 1]
					: `if(!file_exists(getenv("SCRIPT_PATH"))) {
						echo "Script not found: " . getenv("SCRIPT_PATH") . "\n";
						exit(1);
					}
					require( getenv("SCRIPT_PATH") );`;
				// console.log('code', code);

				// const result = await subPhp.runStream({
				// 	code: `${cliBootstrapScript} ${code}`,
				// 	env: {
				// 		...options.env,
				// 		DOCROOT: '/wordpress',

				// 		// Set SHELL_PIPE to 0 to ensure WP-CLI formats
				// 		// the output as ASCII tables.
				// 		// @see https://github.com/wp-cli/wp-cli/issues/1102
				// 		SHELL_PIPE: '0',

				// 		SCRIPT_PATH: args[1],
				// 	},
				// });

				console.log('code', code);
				// @TODO: Use php.cli(). Problem: it doesn't seem to pass the env
				//        variables correctly, especially OUTPUT_FILE.
				// Figure out more about setting env, putenv(), etc.
				const result = await subPhp.cli(args, {
					cwd: '/wordpress',
					env: {
						...options.env,
						DOCROOT: '/wordpress',
						SCRIPT_PATH: args[1],
						// Set SHELL_PIPE to 0 to ensure WP-CLI formats
						// the output as ASCII tables.
						// @see https://github.com/wp-cli/wp-cli/issues/1102
						SHELL_PIPE: '0',
					},
				});

				result.stdout.pipeTo(
					new WritableStream({
						write(chunk) {
							processApi.stdout(chunk);
						},
					})
				);
				result.stderr.pipeTo(
					new WritableStream({
						write(chunk) {
							processApi.stderr(chunk);
						},
					})
				);
				await result.exitCode.then(
					(exitCode) => {
						processApi.exit(exitCode);
					},
					(error) => {
						console.error('Error in childPHP:', error);
						processApi.exit(1);
					}
				);
			} catch (e) {
				console.error('Error in childPHP:');
				console.error(e);
				processApi.exit(1);
			}
		} else {
			processApi.exit(1);
		}
	})
)

// $proc = proc_open("php -r 'echo \\"nested outfile: \\" . getenv(\\"NESTED_OUTFILE_PATH\\");'", [], $pipes, null, null, array(

php.mkdir('/wordpress');
console.log('exists?', php.fileExists('/wordpress'));
const streamingResponse = await php.cli(
	['php', '-r', `echo "outfile: " . getenv("OUTFILE_PATH");
		$pipes = [];
		$proc = proc_open("php -r 'echo \\"nested cwd: \\" . getcwd() . \\" outfile: \\" . getenv(\\"NESTED_OUTFILE_PATH\\") . getenv(\\"ANOTHER_ENV\\");'", [
		// $proc = proc_open("php -r 'echo __DIR__;'", [
			0 => ['pipe', 'r'],
			1 => ['pipe', 'w'],
			2 => ['pipe', 'w']
		], $pipes, null, array(
			'NESTED_OUTFILE_PATH' => getenv("OUTFILE_PATH"),
			'ANOTHER_ENV' => "HAYA",
		));
		$stdout = stream_get_contents($pipes[1]);
		$stderr = stream_get_contents($pipes[2]);
		fclose($pipes[0]);
		fclose($pipes[1]);
		fclose($pipes[2]);
		proc_close($proc);
		echo "\\nstdout: " . $stdout;
		echo "\\nstderr: " . $stderr;
		
		`],
	{
		cwd: '/wordpress',
		env: {
			OUTFILE_PATH: '/Users/josh/Desktop/test.php',
		},
	}
);

// console.log(streamingResponse);
console.log("Done :)");

try {
	// console.log(await streamingResponse.exitCode);
	console.log(await streamingResponse.stdoutText);
	// console.log(await streamingResponse.stderrText);
	// console.log(await streamingResponse.headers);
	// console.log(
	// 	'http status code',
	// 	await streamingResponse.httpStatusCode
	// );
	// console.log(await streamingResponse.exitCode);
} catch (e) {
	console.log(e);
}
console.log("Done :)");
process.exit(0);

// const response = await php.run({
// 	code: `<?php echo "Hello, World!";`
// });

// console.log(response.text);

process.exit(0);
