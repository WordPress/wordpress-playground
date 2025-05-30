import { errorLogPath, logger } from '@php-wasm/logger';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import type {
	PHP,
	PHPRequest,
	PHPRequestHandler,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { PHPResponse } from '@php-wasm/universal';
import type {
	BlueprintDeclaration,
	BlueprintBundle,
} from '@wp-playground/blueprints';
import {
	compileBlueprint,
	runBlueprintSteps,
	isBlueprintBundle,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion, zipDirectory } from '@wp-playground/common';
import {
	bootWordPress,
	resolveWordPressRelease,
} from '@wp-playground/wordpress';
import fs from 'fs';
import type { Server } from 'http';
import path from 'path';
import { rootCertificates } from 'tls';
import { expandAutoMounts } from './cli-auto-mount';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import { startServer } from './server';

export interface RunCLIArgs {
	blueprint?: BlueprintDeclaration | BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: string[];
	mountBeforeInstall?: string[];
	outfile?: string;
	php?: SupportedPHPVersion;
	port?: number;
	quiet?: boolean;
	skipWordPressSetup?: boolean;
	skipSqliteSetup?: boolean;
	wp?: string;
	autoMount?: boolean;
	followSymlinks?: boolean;
}

export interface RunCLIServer {
	requestHandler: PHPRequestHandler;
	server: Server;
}

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	/**
	 * Expand auto-mounts to include the necessary mounts and steps
	 * when running in auto-mount mode.
	 */
	if (args.autoMount) {
		args = expandAutoMounts(args);
	}

	/**
	 * TODO: This exact feature will be provided in the PHP Blueprints library.
	 *       Let's use it when it ships. Let's also use it in the web Playground
	 *       app.
	 */
	async function zipSite(outfile: string) {
		// Fake URL for the build
		const { php, reap } =
			await requestHandler.processManager.acquirePHPInstance();
		try {
			await php.run({
				code: `<?php
				$zip = new ZipArchive();
				if(false === $zip->open('/tmp/build.zip', ZipArchive::CREATE | ZipArchive::OVERWRITE)) {
					throw new Exception('Failed to create ZIP');
				}
				$files = new RecursiveIteratorIterator(
					new RecursiveDirectoryIterator('/wordpress')
				);
				foreach ($files as $file) {
					echo $file . PHP_EOL;
					if (!$file->isFile()) {
						continue;
					}
					$zip->addFile($file->getPathname(), $file->getPathname());
				}
				$zip->close();

			`,
			});
			const zip = php.readFileAsBuffer('/tmp/build.zip');
			fs.writeFileSync(outfile, zip);
		} finally {
			reap();
		}
	}

	function mountResources(php: PHP, rawMounts: string[]) {
		const parsedMounts = rawMounts.map((mount) => {
			const [source, vfsPath] = mount.split(':');
			return {
				hostPath: path.resolve(process.cwd(), source),
				vfsPath,
			};
		});
		for (const mount of parsedMounts) {
			php.mkdir(mount.vfsPath);
			php.mount(mount.vfsPath, createNodeFsMountHandler(mount.hostPath));
		}
	}

	async function compileInputBlueprint() {
		/**
		 * @TODO This looks similar to the resolveBlueprint() call in the website package:
		 * 	     https://github.com/WordPress/wordpress-playground/blob/ce586059e5885d185376184fdd2f52335cca32b0/packages/playground/website/src/main.tsx#L41
		 *
		 * 		 Also the Blueprint Builder tool does something similar.
		 *       Perhaps all these cases could be handled by the same function?
		 */
		const blueprint: BlueprintDeclaration | BlueprintBundle =
			isBlueprintBundle(args.blueprint)
				? args.blueprint
				: {
						login: args.login,
						...args.blueprint,
						preferredVersions: {
							php:
								args.php ??
								args?.blueprint?.preferredVersions?.php ??
								RecommendedPHPVersion,
							wp:
								args.wp ??
								args?.blueprint?.preferredVersions?.wp ??
								'latest',
							...(args.blueprint?.preferredVersions || {}),
						},
				  };

		const tracker = new ProgressTracker();
		let lastCaption = '';
		let progressReached100 = false;
		tracker.addEventListener('progress', (e: any) => {
			if (progressReached100) {
				return;
			}
			progressReached100 = e.detail.progress === 100;

			// Use floor() so we don't report 100% until truly there.
			const progressInteger = Math.floor(e.detail.progress);
			lastCaption =
				e.detail.caption || lastCaption || 'Running the Blueprint';
			const message = `${lastCaption.trim()} – ${progressInteger}%`;
			if (!args.quiet) {
				writeProgressUpdate(
					process.stdout,
					message,
					progressReached100
				);
			}
		});
		return await compileBlueprint(blueprint as BlueprintDeclaration, {
			progress: tracker,
		});
	}

	let lastProgressMessage = '';
	function writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
		if (message === lastProgressMessage) {
			// Avoid repeating the same message
			return;
		}
		lastProgressMessage = message;

		if (writeStream.isTTY) {
			// Overwrite previous progress updates in-place for a quieter UX.
			writeStream.cursorTo(0);
			writeStream.write(message);
			writeStream.clearLine(1);

			if (finalUpdate) {
				writeStream.write('\n');
			}
		} else {
			// Fall back to writing one line per progress update
			writeStream.write(`${message}\n`);
		}
	}

	if (args.quiet) {
		// @ts-ignore
		logger.handlers = [];
	}

	const compiledBlueprint = await compileInputBlueprint();

	let requestHandler: PHPRequestHandler;
	let wordPressReady = false;

	logger.log('Starting a PHP server...');

	return startServer({
		port: args['port'] as number,
		onBind: async (server: Server, port: number): Promise<RunCLIServer> => {
			const absoluteUrl = `http://127.0.0.1:${port}`;

			logger.log(`Setting up WordPress ${args.wp}`);
			let wpDetails: any = undefined;
			// @TODO: Rename to FetchProgressMonitor. There's nothing Emscripten
			// about that class anymore.
			const monitor = new EmscriptenDownloadMonitor();
			if (!args.skipWordPressSetup) {
				let progressReached100 = false;
				monitor.addEventListener('progress', ((
					e: CustomEvent<ProgressEvent & { finished: boolean }>
				) => {
					if (progressReached100) {
						return;
					}

					// @TODO Every progress bar will want percentages. The
					//       download monitor should just provide that.
					const { loaded, total } = e.detail;
					// Use floor() so we don't report 100% until truly there.
					const percentProgress = Math.floor(
						Math.min(100, (100 * loaded) / total)
					);
					progressReached100 = percentProgress === 100;

					if (!args.quiet) {
						writeProgressUpdate(
							process.stdout,
							`Downloading WordPress ${percentProgress}%...`,
							progressReached100
						);
					}
				}) as any);

				wpDetails = await resolveWordPressRelease(args.wp);
			}
			logger.log(
				`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
			);

			const preinstalledWpContentPath =
				wpDetails &&
				path.join(
					CACHE_FOLDER,
					`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
				);
			const wordPressZip = !wpDetails
				? undefined
				: fs.existsSync(preinstalledWpContentPath)
				? readAsFile(preinstalledWpContentPath)
				: await cachedDownload(
						wpDetails.releaseUrl,
						`${wpDetails.version}.zip`,
						monitor
				  );

			const constants: Record<string, string | number | boolean | null> =
				{
					WP_DEBUG: true,
					WP_DEBUG_LOG: true,
					WP_DEBUG_DISPLAY: false,
				};

			logger.log(`Booting WordPress...`);
			requestHandler = await bootWordPress({
				siteUrl: absoluteUrl,
				createPhpRuntime: async () =>
					await loadNodeRuntime(compiledBlueprint.versions.php, {
						followSymlinks: args.followSymlinks === true,
					}),
				wordPressZip,
				sqliteIntegrationPluginZip: args.skipSqliteSetup
					? undefined
					: fetchSqliteIntegration(monitor),
				sapiName: 'cli',
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				constants,
				phpIniEntries: {
					'openssl.cafile': '/internal/shared/ca-bundle.crt',
					allow_url_fopen: '1',
					disable_functions: '',
				},
				hooks: {
					async beforeWordPressFiles(php) {
						if (args.mountBeforeInstall) {
							mountResources(php, args.mountBeforeInstall);
						}
					},
				},
				cookieStore: false,
			});
			logger.log(`Booted!`);

			const php = await requestHandler.getPrimaryPhp();
			try {
				if (
					wpDetails &&
					!args.mountBeforeInstall &&
					!fs.existsSync(preinstalledWpContentPath)
				) {
					logger.log(
						`Caching preinstalled WordPress for the next boot...`
					);
					fs.writeFileSync(
						preinstalledWpContentPath,
						await zipDirectory(php, '/wordpress')
					);
					logger.log(`Cached!`);
				}

				if (args.mount) {
					mountResources(php, args.mount);
				}

				wordPressReady = true;

				if (compiledBlueprint) {
					const { php, reap } =
						await requestHandler.processManager.acquirePHPInstance();
					try {
						logger.log(`Running the Blueprint...`);
						await runBlueprintSteps(compiledBlueprint, php);
						logger.log(`Finished running the blueprint`);
					} finally {
						reap();
					}
				}

				if (args.command === 'build-snapshot') {
					await zipSite(args.outfile as string);
					logger.log(`WordPress exported to ${args.outfile}`);
					process.exit(0);
				} else if (args.command === 'run-blueprint') {
					logger.log(`Blueprint executed`);
					process.exit(0);
				} else {
					logger.log(`WordPress is running on ${absoluteUrl}`);
				}

				return { requestHandler, server };
			} catch (error) {
				if (!args.debug) {
					throw error;
				}
				const phpLogs = php.readFileAsText(errorLogPath);
				throw new Error(phpLogs, { cause: error });
			}
		},
		async handleRequest(request: PHPRequest) {
			if (!wordPressReady) {
				return PHPResponse.forHttpCode(
					502,
					'WordPress is not ready yet'
				);
			}
			return await requestHandler.request(request);
		},
	});
}
