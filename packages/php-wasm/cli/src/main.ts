/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import { spawn } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'fs';
import os from 'os';
import { rootCertificates } from 'tls';
import {
	CLIOutput,
	makeXdebugConfig,
	addXdebugIDEConfig,
	clearXdebugIDEConfig,
	DEFAULT_PATH_SKIPPINGS,
} from '@php-wasm/cli-util';
import { loadNodeRuntime, useHostFilesystem } from '@php-wasm/node';
import {
	type SupportedPHPVersion,
	FileLockManagerInMemory,
} from '@php-wasm/universal';
import { PHP } from '@php-wasm/universal';
import { startBridge } from '@php-wasm/xdebug-bridge';
import path from 'path';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

const cliOutput = new CLIOutput({ verbosity: 'normal' });

const baseUrl = (import.meta || {}).url;

// Write the ca-bundle.crt file to disk so that PHP can find it.
const caBundlePath = new URL('ca-bundle.crt', baseUrl).pathname;
if (!existsSync(caBundlePath)) {
	writeFileSync(caBundlePath, rootCertificates.join('\n'));
}
args.unshift(
	'-d',
	`openssl.cafile=${caBundlePath}`,
	'-d',
	`curl.cainfo=${caBundlePath}`
);

async function run() {
	const defaultPhpIniPath = new URL('php.ini', baseUrl).pathname;
	const phpVersion = (process.env['PHP'] ||
		LatestSupportedPHPVersion) as SupportedPHPVersion;
	if (!SupportedPHPVersionsList.includes(phpVersion)) {
		throw new Error(`Unsupported PHP version ${phpVersion}`);
	}

	const hasXdebugOption = args.some((arg) => arg.startsWith('--xdebug'));
	if (hasXdebugOption) {
		args = args.filter((arg) => arg !== '--xdebug');
	}

	const hasDevtoolsOption = args.some((arg) =>
		arg.startsWith('--experimental-devtools')
	);
	if (hasDevtoolsOption) {
		args = args.filter((arg) => arg !== '--experimental-devtools');
	}

	const experimentalUnsafeIDEIntegrationOptions =
		args
			.filter((arg) =>
				arg.startsWith('--experimental-unsafe-ide-integration')
			)
			.map((arg) => {
				const value = arg.split('=')[1];
				if (value === undefined) return ['vscode', 'phpstorm'];
				if (value.includes(',')) return value.split(',');
				return [value];
			})[0] ?? false;
	if (experimentalUnsafeIDEIntegrationOptions) {
		args = args.filter(
			(arg) => !arg.startsWith('--experimental-unsafe-ide-integration')
		);
	}

	// npm scripts set the TMPDIR env variable
	// PHP accepts a TMPDIR env variable and expects it to
	// be a writable directory within the PHP filesystem.
	// These two clash and prevent PHP from creating temporary
	// files and directories so let's just not pass the npm TMPDIR
	// to PHP.
	// @see https://github.com/npm/npm/issues/4531
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { TMPDIR, ...envVariables } = process.env;

	/**
	 * Ensure the PHP_BINARY constant is set to the PHP-WASM binary.
	 *
	 * ## Rationale
	 *
	 * We want any `proc_open()` calls to use the PHP-WASM binary and
	 * not the system PHP binary.
	 *
	 * ## How it works
	 *
	 * The code below creates a temporary `php` executable in PATH,
	 * which covers `proc_open( "php", ... )` calls.
	 *
	 * Furthermore, when PHP detects the `php` executable in PATH, it
	 * sets the PHP_BINARY constant to it.
	 */
	const tempDir = mkdtempSync(path.join(os.tmpdir(), 'php-wasm-bin'));
	writeFileSync(
		`${tempDir}/php`,
		`#!/bin/sh
${process.argv[0]} ${process.execArgv.join(' ')} ${process.argv[1]}
	`
	);
	chmodSync(`${tempDir}/php`, 0o755);

	const sysTempDir = mkdtempSync(path.join(os.tmpdir(), 'php-wasm-sys-tmp'));
	const php = new PHP(
		await loadNodeRuntime(phpVersion, {
			fileLockManager: new FileLockManagerInMemory(),
			emscriptenOptions: {
				processId: 1,
				ENV: {
					...envVariables,
					TMPDIR: sysTempDir,
					TERM: 'xterm',
					PATH: `${tempDir}:${envVariables['PATH']}`,
				},
			},
			extensions: hasXdebugOption
				? [
						{
							name: 'xdebug',
							options: makeXdebugConfig({
								pathSkippings: [...DEFAULT_PATH_SKIPPINGS],
							}),
						},
					]
				: [],
		})
	);
	php.setSpawnHandler((command: string, args: string[]): any =>
		spawn(command, args, {
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
		})
	);

	useHostFilesystem(php);

	// If xdebug, and experimental IDE are enabled,
	// add the new IDE config.
	if (hasXdebugOption && experimentalUnsafeIDEIntegrationOptions) {
		try {
			const IDEConfigName = 'PHP.wasm CLI - Listen for Xdebug';
			const ides = experimentalUnsafeIDEIntegrationOptions;

			// NOTE: Both the 'clear' and 'add' operations can throw errors.
			await clearXdebugIDEConfig(IDEConfigName, process.cwd());

			const modifiedConfig = await addXdebugIDEConfig({
				name: IDEConfigName,
				host: 'example.com',
				port: 443,
				ides: ides,
				cwd: process.cwd(),
				pathSkippings: [...DEFAULT_PATH_SKIPPINGS],
			});

			// Display IDE-specific instructions
			const hasVSCode = ides.includes('vscode');
			const hasPhpStorm = ides.includes('phpstorm');
			const configFiles = Object.values(modifiedConfig);

			cliOutput.print('');

			if (configFiles.length > 0) {
				cliOutput.print(
					cliOutput.bold(`Xdebug configured successfully`)
				);
				cliOutput.print(
					cliOutput.highlight(`Updated IDE config: `) +
						configFiles.join(' ')
				);
			} else {
				cliOutput.print(cliOutput.bold(`Xdebug configuration failed.`));
				cliOutput.print(
					'No IDE-specific project settings directory was found in the current working directory.'
				);
			}

			cliOutput.print('');

			if (hasVSCode && modifiedConfig['vscode']) {
				cliOutput.print(
					cliOutput.bold('VS Code / Cursor instructions:')
				);
				cliOutput.print(
					'  1. Ensure you have installed an IDE extension for PHP Debugging'
				);
				cliOutput.print(
					`     (The ${cliOutput.bold('PHP Debug')} extension by ${cliOutput.bold(
						'Xdebug'
					)} has been a solid option)`
				);
				cliOutput.print(
					'  2. Open the Run and Debug panel on the left sidebar'
				);
				cliOutput.print(
					`  3. Select "${cliOutput.italic(IDEConfigName)}" from the dropdown`
				);
				cliOutput.print('  4. Click "start debugging"');
				cliOutput.print('  5. Set a breakpoint.');
				cliOutput.print('  6. Run your command with PHP.wasm CLI.');
				if (hasPhpStorm) {
					cliOutput.print('');
				}
			}

			if (hasPhpStorm && modifiedConfig['phpstorm']) {
				cliOutput.print(cliOutput.bold('PhpStorm instructions:'));
				cliOutput.print(
					`  1. Choose "${cliOutput.italic(
						IDEConfigName
					)}" debug configuration in the toolbar`
				);
				cliOutput.print('  2. Click the debug button (bug icon)');
				cliOutput.print('  3. Set a breakpoint.');
				cliOutput.print('  4. Run your command with PHP.wasm CLI.');
			}

			cliOutput.print('');
		} catch (error) {
			throw new Error('Could not configure Xdebug', {
				cause: error,
			});
		}
	}

	if (hasXdebugOption && hasDevtoolsOption) {
		const bridge = await startBridge({ breakOnFirstLine: true });

		bridge.start();
	}

	const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
	if (!hasMinusCOption) {
		args.unshift('-c', defaultPhpIniPath);
	}

	const response = await php.cli(['php', ...args]);
	response.stderr.pipeTo(
		new WritableStream({
			write(chunk) {
				process.stderr.write(chunk);
			},
		})
	);
	response.stdout.pipeTo(
		new WritableStream({
			write(chunk) {
				process.stdout.write(chunk);
			},
		})
	);

	await response.exitCode
		.catch((result) => {
			if (result.name === 'ExitStatus') {
				process.exit(result.status === undefined ? 1 : result.status);
			}
			throw result;
		})
		.finally(() => {
			setTimeout(() => {
				process.exit(0);
				// 100 is an arbitrary number. It's there to give any child processes
				// a chance to pass their output to JS before the main process exits.
			}, 100);
		});
}

run();
