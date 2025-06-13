/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import os from 'os';
import { writeFileSync, existsSync, mkdtempSync, chmodSync } from 'fs';
import { rootCertificates } from 'tls';

import {
	LatestSupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';

import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime, useHostFilesystem } from '@php-wasm/node';
import path from 'path';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

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
				ENV: {
					...envVariables,
					TMPDIR: sysTempDir,
					TERM: 'xterm',
					PATH: `${tempDir}:${envVariables['PATH']}`,
				},
			},
		})
	);

	useHostFilesystem(php);

	const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
	if (!hasMinusCOption) {
		args.unshift('-c', defaultPhpIniPath);
	}

	await php
		.cli(['php', ...args])
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
