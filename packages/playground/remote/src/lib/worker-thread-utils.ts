/*
PHP self requests

Idea 1: 

export abstract class PHPPool implements IsomorphicLocalPHP

Implement all BasePHP methods
Proxy the calls to the underlying instances

It feels off, though:
* API client would think it talks to PHP but it would talk to... a pool? That's weird. FS calls would affect just the first PHP instance. It's a pool so it should be about locks, but the implementation is mostly glue code to fulfill the interface. 
* It needs to keep a copy of args like newName in setSapiName(newName: string).
* How are new instances created and configured? Would PHPPool get a factory function that returns BasePHP instance? Or a Runtime instance? It's unclear how they would they be wired together and configured.
* PHPPool has a "absoluteUrl" method that relies on PHPRequestHandler.
* FS methods (writefile, mkdir etc.) are always proxied to the first PHP instance in the pool
* addEventListener and removeEventListener make sense for events like request.error, request.end but not for runtime.initialized, runtime.beforedestroy

Idea 2:

PHPPool with just acquire(), release(), and grow() methods.
Split out cloning mechanics.
*/

import { WebPHP } from '@php-wasm/web';
import {
	LatestSupportedWordPressVersion,
	SupportedWordPressVersionsList,
} from '@wp-playground/wordpress';
import { wordPressSiteUrl } from './config';
import { setURLScope } from '@php-wasm/scopes';
import {
	PHPPool,
	PHPResponse,
	RequestHandler,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
	__private__dont__use,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { createSpawnHandler, phpVar } from '@php-wasm/util';

export const scope = Math.random().toFixed(16);
export const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();

export type ReceivedStartupOptions = {
	wpVersion?: string;
	phpVersion?: string;
	sapiName?: string;
	storage?: string;
	phpExtensions?: string[];
};

export type ParsedStartupOptions = {
	wpVersion: string;
	phpVersion: SupportedPHPVersion;
	sapiName: string;
	storage: string;
	phpExtensions: string[];
};

export const receivedParams: ReceivedStartupOptions = {};
const url = self?.location?.href;
if (typeof url !== 'undefined') {
	const params = new URL(self.location.href).searchParams;
	receivedParams.wpVersion = params.get('wpVersion') || undefined;
	receivedParams.phpVersion = params.get('phpVersion') || undefined;
	receivedParams.storage = params.get('storage') || undefined;
	// Default to CLI to support the WP-CLI Blueprint step
	receivedParams.sapiName = params.get('sapiName') || 'cli';
	receivedParams.phpExtensions = params.getAll('php-extension');
}

export const requestedWPVersion = receivedParams.wpVersion || '';
export const startupOptions = {
	wpVersion: SupportedWordPressVersionsList.includes(requestedWPVersion)
		? requestedWPVersion
		: LatestSupportedWordPressVersion,
	phpVersion: SupportedPHPVersionsList.includes(
		receivedParams.phpVersion || ''
	)
		? (receivedParams.phpVersion as SupportedPHPVersion)
		: '8.0',
	sapiName: receivedParams.sapiName || 'cli',
	storage: receivedParams.storage || 'local',
	phpExtensions: receivedParams.phpExtensions || [],
} as ParsedStartupOptions;

const { phpVersion, phpExtensions } = startupOptions;
const monitor = new EmscriptenDownloadMonitor();
const recreateRuntime = async () =>
	await WebPHP.loadRuntime(phpVersion, {
		downloadMonitor: monitor,
		// We don't yet support loading specific PHP extensions one-by-one.
		// Let's just indicate whether we want to load all of them.
		loadAllExtensions: phpExtensions?.length > 0,
	});

export function spawnHandlerFactory(pool: PHPPool<WebPHP>) {
	return createSpawnHandler(async function (args, processApi, options) {
		if (args[0] === 'exec') {
			args.shift();
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
		} else if (args[0] === 'less') {
			processApi.on('stdin', (data: Uint8Array) => {
				processApi.stdout(data);
			});
			processApi.flushStdin();
			processApi.exit(0);
		} else if (args[0] === 'fetch') {
			processApi.flushStdin();
			fetch(args[1]).then(async (res) => {
				const reader = res.body?.getReader();
				if (!reader) {
					processApi.exit(1);
					return;
				}
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						processApi.exit(0);
						break;
					}
					processApi.stdout(value);
				}
			});
			return;
		} else if (args[0] === 'php') {
			const { php: childPHP, release } = await pool.acquire();

			let result: PHPResponse | undefined = undefined;
			try {
				// @TODO: Run the actual PHP CLI SAPI instead of
				//        interpreting the arguments and emulating
				//        the CLI constants and globals.
				const cliBootstrapScript = `<?php
                // Set the argv global.
                $GLOBALS['argv'] = array_merge([
                    "/wordpress/wp-cli.phar",
                    "--path=/wordpress"
                ], ${phpVar(args.slice(2))});

                // Provide stdin, stdout, stderr streams outside of
                // the CLI SAPI.
                define('STDIN', fopen('php://stdin', 'rb'));
                define('STDOUT', fopen('php://stdout', 'wb'));
                define('STDERR', fopen('/tmp/stderr', 'wb'));

                ${options.cwd ? 'chdir(getenv("DOCROOT")); ' : ''}
                `;

				if (args.includes('-r')) {
					result = await childPHP.run({
						code: `${cliBootstrapScript} ${
							args[args.indexOf('-r') + 1]
						}`,
						env: options.env,
					});
				} else if (args[1] === 'wp-cli.phar') {
					result = await childPHP.run({
						code: `${cliBootstrapScript} require( "/wordpress/wp-cli.phar" );`,
						env: {
							...options.env,
							// Set SHELL_PIPE to 0 to ensure WP-CLI formats
							// the output as ASCII tables.
							// @see https://github.com/wp-cli/wp-cli/issues/1102
							SHELL_PIPE: '0',
						},
					});
				} else {
					result = await childPHP.run({
						scriptPath: args[1],
						env: options.env,
					});
				}
				processApi.stdout(result.bytes);
				processApi.stderr(result.errors);
				processApi.exit(result.exitCode);
			} catch (e) {
				console.error('Error in childPHP:', e);
				if (e instanceof Error) {
					processApi.stderr(e.message);
				}
				processApi.exit(1);
			} finally {
				release();
			}
		} else {
			processApi.exit(1);
		}
	});
}

export async function setupPHP(
	php: WebPHP,
	pool: PHPPool<WebPHP>,
	requestHandler: RequestHandler
) {
	php.requestHandler = requestHandler as any;
	php.initializeRuntime(await recreateRuntime());
	php.setPhpIniEntry('memory_limit', '256M');
	if (startupOptions.sapiName) {
		await php.setSapiName(startupOptions.sapiName);
	}
	// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
	// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
	rotatePHPRuntime({
		php,
		recreateRuntime,
		// 400 is an arbitrary number that should trigger a rotation
		// way before the memory gets too fragmented. If the memory
		// issue returns, let's explore:
		// * Lowering this number
		// * Adding a memory usage monitor and rotate based on that
		maxRequests: 400,
	});
	php.setSpawnHandler(spawnHandlerFactory(pool));
	if (php !== pool.primary) {
		// Share the parent's MEMFS instance with the child process.
		// Only mount the document root and the /tmp directory,
		// the rest of the filesystem (like the devices) should be
		// private to each PHP instance.
		for (const path of [requestHandler.documentRoot, '/tmp']) {
			if (!php.fileExists(path)) {
				php.mkdir(path);
			}
			if (!pool.primary.fileExists(path)) {
				pool.primary.mkdir(path);
			}
			php[__private__dont__use].FS.mount(
				php[__private__dont__use].PROXYFS,
				{
					root: path,
					fs: pool.primary[__private__dont__use].FS,
				},
				path
			);
		}
	}
}
