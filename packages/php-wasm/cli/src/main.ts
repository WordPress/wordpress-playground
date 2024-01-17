/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import { writeFileSync, existsSync, mkdtempSync } from 'fs';
import { rootCertificates } from 'tls';

import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';

import { NodePHP } from '@php-wasm/node';
import { spawn } from 'child_process';
import { createSpawnHandler } from './create-spawn-handler';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

// Write the ca-bundle.crt file to disk so that PHP can find it.
const caBundlePath = new URL('ca-bundle.crt', (import.meta || {}).url).pathname;
if (!existsSync(caBundlePath)) {
	writeFileSync(caBundlePath, rootCertificates.join('\n'));
}
args.unshift('-d', `openssl.cafile=${caBundlePath}`);

async function run() {
	// @ts-ignore
	const defaultPhpIniPath = await import('./php.ini');
	const phpVersion = (process.env['PHP'] ||
		LatestSupportedPHPVersion) as SupportedPHPVersion;
	if (!SupportedPHPVersionsList.includes(phpVersion)) {
		throw new Error(`Unsupported PHP version ${phpVersion}`);
	}

	const php = await NodePHP.load(phpVersion, {
		emscriptenOptions: {
			ENV: {
				...process.env,
				TERM: 'xterm',
			},
		},
	});

	php.useHostFilesystem();
	const lessSpawnHandler = createSpawnHandler(
		(command, processApi, childProcess) => {
			childProcess.on('stdin', (data) => {
				processApi.stdout(data);
			});
		}
	);
	php.setSpawnHandler((command: string) => {
		console.log({ command });
		// if (command === 'less') {
		// 	console.log("It's less!");
		// 	return lessSpawnHandler(command);
		// }
		console.log("It's not less!");
		const phpWasmCommand = `${process.argv[0]} ${process.execArgv.join(
			' '
		)} ${process.argv[1]}`;
		// Naively replace the PHP binary with the PHP-WASM command
		// @TODO: Don't process the command. Lean on the shell to do it, e.g. through
		//        a PATH or an alias.
		const updatedCommand = command.replace(
			/^(?:\\ |[^ ])*php\d?(\s|$)/,
			phpWasmCommand
		);

		// Create a shell script in a temporary directory
		const tempDir = mkdtempSync('php-wasm-');
		const tempScriptPath = `${tempDir}/script.sh`;
		writeFileSync(
			tempScriptPath,
			`#!/bin/sh
	${updatedCommand} < /dev/stdin
	`
		);

		return spawn('sh', [tempScriptPath], {
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: 100,
		});
	});

	const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
	if (!hasMinusCOption) {
		args.unshift('-c', defaultPhpIniPath);
	}

	await php
		.cli(['php', ...args])
		.catch((result) => {
			console.log({ result });
			if (result.name === 'ExitStatus') {
				process.exit(result.status === undefined ? 1 : result.status);
			}
			throw result;
		})
		.finally(() => {
			// process.exit(0);
		});
}

run();
