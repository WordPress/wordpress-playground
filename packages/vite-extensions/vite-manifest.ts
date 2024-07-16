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

	return manifest.replaceAll(defaultUrl, newServerUrl);
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
export const addManifestJson = ({
	mode,
	manifestPath,
	defaultUrl,
	localServerUrl,
	developmentBuildUrl,
}: {
	mode: string;
	manifestPath: string;
	defaultUrl: string;
	localServerUrl: string;
	developmentBuildUrl: string;
}) => {
	return {
		name: 'manifest-plugin-build',
		writeBundle({ dir: outputDir }: { dir: string }) {
			const siteUrl =
				mode === 'development' ? developmentBuildUrl : defaultUrl;
			if (existsSync(manifestPath) && outputDir) {
				writeFileSync(
					join(outputDir, 'manifest.json'),
					generateManifestJson(manifestPath, defaultUrl, siteUrl)
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
					mode === 'development' &&
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
							localServerUrl
						)
					);
					return;
				}
				next();
			});
		},
	};
};
