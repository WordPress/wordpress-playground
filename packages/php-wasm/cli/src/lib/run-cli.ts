import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import os from 'os';
import { writeFileSync, existsSync, mkdtempSync, chmodSync } from 'fs';
import { rootCertificates } from 'tls';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { FileLockManagerForNode } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime, useHostFilesystem } from '@php-wasm/node';
import { startBridge } from '@php-wasm/xdebug-bridge';
import path from 'path';

interface CLIDefaults {
	directive: string[];
	config: string;
}

interface CLIArgs {
	_: string[];
	config: string;
	directive: string[];
	xdebug?: boolean;
	experimentalDevtools?: boolean;
}

function parseCliArgs(defaults: CLIDefaults) {
	return yargs(hideBin(process.argv))
		.usage(
			`
PHP.wasm CLI

Usage: php-wasm-cli <command> [options]
		`
		)
		.option('config', {
			alias: 'c',
			type: 'string',
			describe: 'Path to configuration file',
			default: defaults.config,
		})
		.option('directive', {
			alias: 'd',
			type: 'array',
			describe: 'Set configuration directives (key=value)',
			default: defaults.directive,
		})
		.option('xdebug', {
			type: 'boolean',
			describe: 'Enable Xdebug.',
			default: false,
		})
		.option('experimental-devtools', {
			type: 'boolean',
			describe: 'Enable experimental browser development tools.',
			default: false,
		})
		.strictCommands()
		.help()
		.epilog(
			`
Examples:
  php-wasm-cli                                             # Start with default settings
  php-wasm-cli --config /path/to/php.ini           # Run PHP CLI with custom config file
  php-wasm-cli --xdebug --experimental-devtools             # Enable Xdebug and Devtools
		`
		)
		.parseSync() as CLIArgs;
}

function mapArgsArray(args: CLIArgs): string[] {
	const argv: string[] = [];

	if (args.config) {
		argv.push('-c', args.config);
	}

	if (Array.isArray(args.directive)) {
		args.directive.forEach((d) => {
			argv.push('-d', d);
		});
	}

	if (Array.isArray(args._)) {
		argv.push(...args._);
	}

	return argv;
}

export async function parseOptionsAndRunCLI(): Promise<void> {
	const phpVersion = (process.env['PHP'] ||
		LatestSupportedPHPVersion) as SupportedPHPVersion;
	if (!SupportedPHPVersionsList.includes(phpVersion)) {
		throw new Error(`Unsupported PHP version ${phpVersion}`);
	}

	const baseUrl = (import.meta || {}).url;

	const defaultPhpIniPath = new URL('php.ini', baseUrl).pathname;
	// Write the ca-bundle.crt file to disk so that PHP can find it.
	const caBundlePath = new URL('ca-bundle.crt', baseUrl).pathname;
	if (!existsSync(caBundlePath)) {
		writeFileSync(caBundlePath, rootCertificates.join('\n'));
	}

	const args = parseCliArgs({
		directive: [`openssl.cafile=${caBundlePath}`],
		config: defaultPhpIniPath,
	});

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
			withXdebug: args.xdebug,
		})
	);

	useHostFilesystem(php);

	if (args.experimentalDevtools && args.xdebug) {
		const bridge = await startBridge({ breakOnFirstLine: true });

		bridge.start();
	}

	const response = await php.cli(['php', ...mapArgsArray(args)]);

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
