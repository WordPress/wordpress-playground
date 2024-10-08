import { wpVersionToStaticAssetsDirectory } from '@wp-playground/wordpress-builds';
import { PHPResponse, PHPProcessManager, PHP } from '@php-wasm/universal';
import { createSpawnHandler, joinPaths, phpVar } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import { unzipFile } from '@wp-playground/common';
import { hasCachedResponse } from './offline-mode-cache';
import { getLoadedWordPressVersion } from '@wp-playground/wordpress';

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

/**
 * Downloads and unzips a ZIP bundle of all the static assets removed from
 * the currently loaded minified WordPress build. Doesn't do anything if the
 * assets are already downloaded or if a non-minified WordPress build is loaded.
 *
 * ## Asset Loading
 *
 * To load Playground faster, we default to minified WordPress builds shipped
 * without most CSS files, JS files, and other static assets.
 *
 * When Playground requests a static asset that is not in the minified build, the service
 * worker consults the list of the assets removed during the minification process. Such
 * a list is shipped with every minified build in a file called `wordpress-remote-asset-paths`.
 *
 * For example, when `/wp-includes/css/dist/block-library/common.min.css` isn't found
 * in the Playground filesystem, the service worker looks for it in
 * `/wordpress/wordpress-remote-asset-paths`and finds it there. This means it's available on the
 * remote server, so the service worker fetches it from an URL like:
 *
 * https://playground.wordpress.net/wp-6.5/wp-includes/css/dist/block-library/common.min.css
 *
 * ## Assets backfilling
 *
 * Running Playground offline isn't possible without shipping all the static assets into the
 * browser. Downloading every CSS and JS file one request at a time would be slow to run and
 * tedious to maintain. This is where this function comes in!
 *
 * It downloads a zip archive containing all the static files removed from the currently running
 * minified build, and unzips them in the Playground filesystem. Once it finishes, the WordPress
 * installation running in the browser is complete and the service worker will no longer have
 * to backfill any static assets again.
 *
 * This process is started after the Playground boots (see `bootPlaygroundRemote`) and the first
 * page is rendered. This way we're not delaying the initial Playground paint with a large download.
 *
 * ## Prevent backfilling if assets are already available
 *
 * Running this function twice, or running it on a non-minified build will have no effect.
 *
 * The backfilling only runs when a non-empty `wordpress-remote-asset-paths` file
 * exists. When one is missing, we're not running a minified build. When one is empty,
 * it means the backfilling process was already done – this function empties the file
 * after the backfilling is done.
 *
 * ### Downloading assets during backfill
 *
 * Each WordPress release has a corresponding static assets directory on the
 * Playground.WordPress.net server. The file is downloaded from the server and unzipped into the
 * WordPress document root.
 *
 * ### Skipping existing files during unzipping
 *
 * If any of the files already exist, they are skipped and not overwritten.
 * By skipping existing files, we ensure that the backfill process doesn't overwrite any user
 * changes.
 */
export async function backfillStaticFilesRemovedFromMinifiedBuild(php: PHP) {
	if (!php.requestHandler) {
		logger.warn('No PHP request handler available');
		return;
	}

	try {
		const remoteAssetListPath = joinPaths(
			php.requestHandler.documentRoot,
			'wordpress-remote-asset-paths'
		);

		if (
			!php.fileExists(remoteAssetListPath) ||
			php.readFileAsText(remoteAssetListPath) === ''
		) {
			return;
		}

		const staticAssetsUrl = await getWordPressStaticZipUrl(php);
		if (!staticAssetsUrl) {
			return;
		}

		// We don't have the WordPress assets cached yet. Let's fetch them and cache them without
		// awaiting the response. We're awaiting the backfillStaticFilesRemovedFromMinifiedBuild()
		// call in the web app and we don't want to block the initial load on this download.
		const response = await fetch(staticAssetsUrl);

		// We have the WordPress assets already cached, let's unzip them and finish.
		if (!response?.ok) {
			throw new Error(
				`Failed to fetch WordPress static assets: ${response.status} ${response.statusText}`
			);
		}
		await unzipFile(
			php,
			new File([await response!.blob()], 'wordpress-static.zip'),
			php.requestHandler!.documentRoot,
			false
		);
		// Clear the remote asset list to indicate that the assets are downloaded.
		php.writeFile(remoteAssetListPath, '');
	} catch (e) {
		logger.warn('Failed to download WordPress assets', e);
	}
}

export async function hasCachedStaticFilesRemovedFromMinifiedBuild(php: PHP) {
	const staticAssetsUrl = await getWordPressStaticZipUrl(php);
	if (!staticAssetsUrl) {
		return false;
	}
	return await hasCachedResponse(staticAssetsUrl);
}

/**
 * Returns the URL of the wordpress-static.zip file containing all the
 * static assets missing from the currently load minified build.
 *
 * Note: This function will produce a URL even if we're running a full
 *       production WordPress build.
 *
 * See backfillStaticFilesRemovedFromMinifiedBuild for more details.
 */
export async function getWordPressStaticZipUrl(php: PHP) {
	const wpVersion = await getLoadedWordPressVersion(php.requestHandler!);
	const staticAssetsDirectory = wpVersionToStaticAssetsDirectory(wpVersion);
	if (!staticAssetsDirectory) {
		return false;
	}
	return joinPaths('/', staticAssetsDirectory, 'wordpress-static.zip');
}
