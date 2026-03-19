/**
 * Vite plugin that serves the built @wp-playground/client library at
 * /client/ during development, matching production where
 * playground.wordpress.net/client/index.js is available.
 *
 * Auto-builds the client if missing and triggers a rebuild when source
 * files change (detected via Vite's file watcher).
 */
import type { Plugin, ViteDevServer } from 'vite';
import {
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
} from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { exec } from 'node:child_process';

export function serveClientLibrary(): Plugin {
	return {
		name: 'serve-client-library',
		configureServer(server: ViteDevServer) {
			const repoRoot = join(__dirname, '../../../');
			const clientDistDir = join(
				repoRoot,
				'dist/packages/playground/client'
			);
			const clientSrcDir = join(__dirname, '../client/src');
			let buildInProgress = false;
			let stalenessChecked = false;
			let sourcesDirty = false;

			function newestMtimeIn(dir: string): number {
				let newest = 0;
				try {
					for (const entry of readdirSync(dir, {
						withFileTypes: true,
					})) {
						const full = join(dir, entry.name);
						if (entry.isDirectory()) {
							newest = Math.max(
								newest,
								newestMtimeIn(full)
							);
						} else if (entry.isFile()) {
							newest = Math.max(
								newest,
								statSync(full).mtimeMs
							);
						}
					}
				} catch {
					// Directory may not exist yet
				}
				return newest;
			}

			function triggerClientBuild() {
				if (buildInProgress) {
					return;
				}
				buildInProgress = true;
				server.config.logger.warn(
					'\n  Building @wp-playground/client… Refresh when done.\n'
				);
				exec(
					'npx nx build playground-client',
					{ cwd: repoRoot },
					(error, stdout, stderr) => {
						buildInProgress = false;
						stalenessChecked = true;
						sourcesDirty = false;
						if (error) {
							server.config.logger.error(
								'  @wp-playground/client build failed. ' +
									'Run manually: npx nx build playground-client\n'
							);
							if (stderr) {
								server.config.logger.error(stderr);
							}
						} else {
							server.config.logger.info(
								'  @wp-playground/client built. Refresh to load.\n'
							);
						}
					}
				);
			}

			server.watcher.add(clientSrcDir);
			server.watcher.on('change', (changedPath) => {
				if (changedPath.startsWith(clientSrcDir)) {
					sourcesDirty = true;
					stalenessChecked = false;
				}
			});

			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith('/client/')) {
					return next();
				}

				const distIndexPath = join(clientDistDir, 'index.js');

				if (!existsSync(distIndexPath)) {
					triggerClientBuild();
					res.setHeader('Access-Control-Allow-Origin', '*');
					res.setHeader(
						'Content-Type',
						'application/javascript'
					);
					res.statusCode = 503;
					res.end(
						'throw new Error(' +
							'"@wp-playground/client is not built yet. ' +
							'A build was triggered automatically — refresh in a few seconds.\\n' +
							'Or build manually: npx nx build playground-client"' +
							');'
					);
					return;
				}

				if (
					!stalenessChecked &&
					!buildInProgress
				) {
					stalenessChecked = true;
					const distMtime =
						statSync(distIndexPath).mtimeMs;
					const srcMtime = newestMtimeIn(clientSrcDir);
					if (srcMtime > distMtime) {
						sourcesDirty = true;
					}
				}
				if (sourcesDirty && !buildInProgress) {
					sourcesDirty = false;
					triggerClientBuild();
				}

				let urlPath: string;
				try {
					urlPath = new URL(req.url, 'http://localhost')
						.pathname;
				} catch {
					res.statusCode = 400;
					res.end('Invalid request URL');
					return;
				}
				const filePath = resolve(
					clientDistDir,
					urlPath.slice('/client/'.length)
				);
				const rel = relative(clientDistDir, filePath);
				if (rel.startsWith('..') || isAbsolute(rel)) {
					res.statusCode = 403;
					res.end();
					return;
				}
				if (!existsSync(filePath)) {
					return next();
				}
				const contentTypes: Record<string, string> = {
					'.js': 'application/javascript',
					'.cjs': 'application/javascript',
					'.json': 'application/json',
					'.map': 'application/json',
				};
				const ext = Object.keys(contentTypes).find((e) =>
					filePath.endsWith(e)
				);
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader(
					'Content-Type',
					ext ? contentTypes[ext] : 'application/octet-stream'
				);
				res.end(readFileSync(filePath));
			});
		},
	};
}
