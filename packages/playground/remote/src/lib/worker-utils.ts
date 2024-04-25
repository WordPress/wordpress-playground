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
import {
	BasePHP,
	PHPResponse,
	PHPProcessManager,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
	__private__dont__use,
	rotatePHPRuntime,
	PHPRequestHandler,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { createSpawnHandler, phpVar } from '@php-wasm/util';

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

export async function createPhp(requestHandler: PHPRequestHandler<WebPHP>) {
	const php = new WebPHP();
	php.requestHandler = requestHandler as any;
	php.initializeRuntime(await createPhpRuntime());
	php.setPhpIniEntry('memory_limit', '256M');
	if (startupOptions.sapiName) {
		await php.setSapiName(startupOptions.sapiName);
	}
	php.setSpawnHandler(spawnHandlerFactory(requestHandler.processManager));
	// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
	// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
	rotatePHPRuntime({
		php,
		cwd: requestHandler.documentRoot,
		recreateRuntime: createPhpRuntime,
		maxRequests: 400,
	});
	return php;
}

export const downloadMonitor = new EmscriptenDownloadMonitor();

const monitoredFetch = (input: RequestInfo | URL, init?: RequestInit) =>
	downloadMonitor.monitorFetch(fetch(input, init));
const fetchMemo = memoizedFetch(monitoredFetch);

const createPhpRuntime = async () => {
	let wasmUrl = '';
	return await WebPHP.loadRuntime(startupOptions.phpVersion, {
		onPhpLoaderModuleLoaded: (phpLoaderModule) => {
			wasmUrl = phpLoaderModule.dependencyFilename;
			downloadMonitor.expectAssets({
				[wasmUrl]: phpLoaderModule.dependenciesTotalSize,
			});
		},
		// We don't yet support loading specific PHP extensions one-by-one.
		// Let's just indicate whether we want to load all of them.
		loadAllExtensions: startupOptions.phpExtensions?.length > 0,
		emscriptenOptions: {
			instantiateWasm(imports, receiveInstance) {
				// Using .then because Emscripten typically returns an empty
				// object here and not a promise.
				fetchMemo(wasmUrl, {
					credentials: 'same-origin',
				})
					.then((response) =>
						WebAssembly.instantiateStreaming(response, imports)
					)
					.then((wasm) => {
						receiveInstance(wasm.instance, wasm.module);
					});
				return {};
			},
		},
	});
};

interface CachedFetchResponse {
	body: ReadableStream<Uint8Array>;
	responseInit: ResponseInit;
}

/**
 * Creates a fetch function that memoizes the response stream.
 * Calling it twice will return a response with the same status,
 * headers, and the body stream.
 * Memoization is keyed by URL. Method, headers etc are ignored.
 *
 * @param originalFetch The fetch function to memoize. Defaults to the global fetch.
 */
function memoizedFetch(originalFetch = fetch) {
	const cache: Record<
		string,
		Promise<CachedFetchResponse> | CachedFetchResponse
	> = {};
	return async function cachedFetch(url: string, options?: RequestInit) {
		if (!cache[url]) {
			// Write to cache synchronously to avoid duplicate requests.
			cache[url] = originalFetch(url, options).then((response) => ({
				body: response.body!,
				responseInit: {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
				},
			}));
		}
		const { body, responseInit } = await cache[url];
		const [stream1, stream2] = body.tee();
		cache[url] = {
			body: stream2,
			responseInit,
		};
		return new Response(stream1, responseInit);
	};
}

/**
 * Share the parent's MEMFS instance with the child process.
 * Only mount the document root and the /tmp directory,
 * the rest of the filesystem (like the devices) should be
 * private to each PHP instance.
 */
export function proxyFileSystem(
	sourceOfTruth: BasePHP,
	replica: BasePHP,
	documentRoot: string
) {
	for (const path of [documentRoot, '/tmp']) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		replica[__private__dont__use].FS.mount(
			replica[__private__dont__use].PROXYFS,
			{
				root: path,
				fs: sourceOfTruth[__private__dont__use].FS,
			},
			path
		);
	}
}

export function spawnHandlerFactory(processManager: PHPProcessManager<WebPHP>) {
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
			const { php, reap } = await processManager.acquirePHPInstance();

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
					result = await php.run({
						code: `${cliBootstrapScript} ${
							args[args.indexOf('-r') + 1]
						}`,
						env: options.env,
					});
				} else if (args[1] === 'wp-cli.phar') {
					result = await php.run({
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
					result = await php.run({
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
				reap();
			}
		} else {
			processApi.exit(1);
		}
	});
}
