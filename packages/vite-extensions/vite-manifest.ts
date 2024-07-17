import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ViteDevServer } from 'vite';

const generateManifestJson = (
	manifestPath: string,
	defaultUrl: string,
	newServerUrl: string
) => {
	const manifest = readFileSync(manifestPath).toString();

	// Nothing to update if the default URL is the same as the new server URL.
	if (defaultUrl === newServerUrl) {
		return manifest;
	}

	return manifest.replace(new RegExp(defaultUrl, 'g'), newServerUrl);
};

/**
 * Generate a manifest.json file for the website.
 *
 * The manifest.json file requires full paths, so we need different versions for each environment.
 *
 * When building for production, we copy the manifest.json file in the dist folder. This is the default build behavior.
 *
 * If the build runs in the development mode, it will modify the manifest.json file url
 * to the `developmentBuildUrl` and copy it to the dist folder.
 * To trigger a development build, run `npx nx run playground-website:build:wasm-wordpress-net:development`.
 *
 * The development server needs it's own version of the manifest, so we modify the URL to use the `localServerUrl`.
 */
export const addManifestJson = ({ manifestPath }: { manifestPath: string }) => {
	const defaultUrl = 'https://playground.wordpress.net';
	return {
		name: 'manifest-plugin-build',
		writeBundle({ dir: outputDir }: { dir: string }) {
			/**
			 * If a PLAYGROUND_URL environment variable is set, use it as the URL for generating the manifest.json file.
			 */
			const url = process.env.PLAYGROUND_URL;
			if (existsSync(manifestPath) && outputDir) {
				writeFileSync(
					join(outputDir, 'manifest.json'),
					generateManifestJson(
						manifestPath,
						defaultUrl,
						url ?? defaultUrl
					)
				);
			}
		},
		configureServer(server: ViteDevServer) {
			server.middlewares.use((req, res, next) => {
				/**
				 * When the development server requests the `manifest.json` file,
				 * modify the URL to use the local server URL.
				 */
				if (
					req.url?.endsWith('manifest.json') &&
					req.headers.host === '127.0.0.1:5400'
				) {
					res.writeHead(200, {
						'Content-Type': 'application/json',
					});
					res.end(
						generateManifestJson(
							manifestPath,
							defaultUrl,
							'http://127.0.0.1:5400/website-server/'
						)
					);
					return;
				}
				next();
			});
		},
	};
};
