import { loadWebRuntime } from '@php-wasm/web';
import {
	LatestSupportedWordPressVersion,
	SupportedWordPressVersionsList,
} from '@wp-playground/wordpress-builds';
import {
	PHPResponse,
	PHPProcessManager,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { createSpawnHandler, phpVar } from '@php-wasm/util';
import { createMemoizedFetch } from './create-memoized-fetch';
import { logger } from '@php-wasm/logger';

export type ReceivedStartupOptions = {
	wpVersion?: string;
	phpVersion?: string;
	sapiName?: string;
	storage?: string;
	phpExtensions?: string[];
	siteSlug?: string;
};

export type ParsedStartupOptions = {
	wpVersion: string;
	phpVersion: SupportedPHPVersion;
	sapiName: string;
	storage: string;
	phpExtensions: string[];
	siteSlug: string;
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
	receivedParams.siteSlug = params.get('site-slug') || undefined;
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
	phpExtensions: receivedParams.phpExtensions || [],
	siteSlug: receivedParams.siteSlug,
} as ParsedStartupOptions;

export const downloadMonitor = new EmscriptenDownloadMonitor();

export const monitoredFetch = (input: RequestInfo | URL, init?: RequestInit) =>
	downloadMonitor.monitorFetch(fetch(input, init));
const memoizedFetch = createMemoizedFetch(monitoredFetch);

export const createPhpRuntime = async () => {
	let wasmUrl = '';
	return await loadWebRuntime(startupOptions.phpVersion, {
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
				memoizedFetch(wasmUrl, {
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

export function spawnHandlerFactory(processManager: PHPProcessManager) {
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
				logger.error('Error in childPHP:', e);
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
