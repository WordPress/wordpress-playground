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
/* eslint-disable no-console */
import { addXdebugIDEConfig, clearXdebugIDEConfig } from '@php-wasm/cli-util';
import {
	FileLockManagerForNode,
	loadNodeRuntime,
	useHostFilesystem,
} from '@php-wasm/node';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { PHP } from '@php-wasm/universal';
import { startBridge } from '@php-wasm/xdebug-bridge';
import path from 'path';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

const bold = (text: string) =>
	process.stdout.isTTY ? '\x1b[1m' + text + '\x1b[0m' : text;

const italic = (text: string) =>
	process.stdout.isTTY ? `\x1b[3m${text}\x1b[0m` : text;

const highlight = (text: string) =>
	process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text;

const baseUrl = (import.meta || {}).url;

// Write the ca-bundle.crt file to disk so that PHP can find it.
const caBundlePath = new URL('ca-bundle.crt', baseUrl).pathname;
if (!existsSync(caBundlePath)) {
	writeFileSync(caBundlePath, rootCertificates.join('\n'));
}
args.unshift('-d', `openssl.cafile=${caBundlePath}`);

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
			emscriptenOptions: {
				fileLockManager: new FileLockManagerForNode(),
				processId: 1,
				ENV: {
					...envVariables,
					TMPDIR: sysTempDir,
					TERM: 'xterm',
					PATH: `${tempDir}:${envVariables['PATH']}`,
				},
			},
			withXdebug: hasXdebugOption,
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
			});

			// Display IDE-specific instructions
			const hasVSCode = ides.includes('vscode');
			const hasPhpStorm = ides.includes('phpstorm');
			const configFiles = Object.values(modifiedConfig);

			console.log('');

			if (configFiles.length > 0) {
				console.log(bold(`Xdebug configured successfully`));
				console.log(
					highlight(`Updated IDE config: `) + configFiles.join(' ')
				);
			} else {
				console.log(bold(`Xdebug configuration failed.`));
				console.log(
					'No IDE-specific project settings directory was found in the current working directory.'
				);
			}

			console.log('');

			if (hasVSCode && modifiedConfig['vscode']) {
				console.log(bold('VS Code / Cursor instructions:'));
				console.log(
					'  1. Ensure you have installed an IDE extension for PHP Debugging'
				);
				console.log(
					`     (The ${bold('PHP Debug')} extension by ${bold(
						'Xdebug'
					)} has been a solid option)`
				);
				console.log(
					'  2. Open the Run and Debug panel on the left sidebar'
				);
				console.log(
					`  3. Select "${italic(IDEConfigName)}" from the dropdown`
				);
				console.log('  3. Click "start debugging"');
				console.log('  5. Set a breakpoint.');
				console.log('  6. Run your command with PHP.wasm CLI.');
				if (hasPhpStorm) {
					console.log('');
				}
			}

			if (hasPhpStorm && modifiedConfig['phpstorm']) {
				console.log(bold('PhpStorm instructions:'));
				console.log(
					`  1. Choose "${italic(
						IDEConfigName
					)}" debug configuration in the toolbar`
				);
				console.log('  2. Click the debug button (bug icon)`');
				console.log('  3. Set a breakpoint.');
				console.log('  4. Run your command with PHP.wasm CLI.');
			}

			console.log('');
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
