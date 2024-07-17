import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ViteDevServer } from 'vite';

const getManifestContent = (manifestPath: string) => {
	return readFileSync(manifestPath).toString();
};

const generateManifestJson = (
	manifestPath: string,
	defaultUrl: string,
	newServerUrl: string
) => {
	return getManifestContent(manifestPath).replace(
		new RegExp(defaultUrl, 'g'),
		newServerUrl
	);
};

/**
 * Generate a manifest.json file for the website.
 *
 * The manifest.json file requires full paths, so we need different versions for each environment.
 *
 * When building for production, we copy the manifest.json file in the dist folder. This is the default build behavior.
 *
 * If a `PLAYGROUND_URL` environment variable is provided during build, it will modify the manifest.json file url
 * to the `PLAYGROUND_URL` and copy it to the dist folder.
 *
 * The development server needs it's own version of the manifest, so we modify the URL to use the local server URL.
 */
export const addManifestJson = ({ manifestPath }: { manifestPath: string }) => {
	const defaultUrl = 'https://playground.wordpress.net';
	return {
		name: 'manifest-plugin-build',
		writeBundle({ dir: outputDir }: { dir: string }) {
			/**
			 * If a `PLAYGROUND_URL` environment variable is set, use it as the URL for generating the manifest.json file.
			 */
			const url = process.env.PLAYGROUND_URL;
			if (existsSync(manifestPath) && outputDir) {
				const manifest = url
					? generateManifestJson(
							manifestPath,
							defaultUrl,
							url ?? defaultUrl
					  )
					: getManifestContent(manifestPath);
				writeFileSync(join(outputDir, 'manifest.json'), manifest);
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
