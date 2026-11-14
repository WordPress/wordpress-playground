/**
 * Serve the installed preview release on two local hostnames through one listener.
 *
 * build.mjs installs the build with the production deployment script, so this
 * serves the same web root layout as WP Cloud: release files and root copies
 * directly, and missing paths through the installed PHP entry. The asset counter
 * records public HTTP response sizes so browser tests can check that switching
 * sites reuses downloads rather than fetching a second copy.
 */
import express from 'express';
import { appOrigin as root, wordPressOrigin } from './origins.mjs';
import { wordPressFrameMiddleware } from './middleware.mjs';
import { fileURLToPath } from 'node:url';

const app = express();
const assetResponses = [];
// Nx may start the preview from a package directory, so resolve from this script.
const webRoot = fileURLToPath(
	new URL(
		'../../../../../dist/packages/playground/wordpress-frame-public/',
		import.meta.url
	)
);
app.use((req, res, next) => {
	if (req.path.endsWith('.js') || req.path.startsWith('/releases/')) {
		res.once('finish', () =>
			assetResponses.push({
				path: req.path,
				bytes:
					res.statusCode === 304
						? 0
						: Number(res.get('Content-Length') || 0),
			})
		);
	}
	next();
});
// Public asset measurements only, for the local browser checks.
app.get('/__wordpress-frame-assets', (_req, res) => res.json(assetResponses));
app.use(
	wordPressFrameMiddleware(
		() => webRoot,
		[new URL(root).hostname, new URL(wordPressOrigin).hostname]
	)
);
app.listen(Number(new URL(root).port || 80), '127.0.0.1', () => {
	console.log('WordPress frame preview: ' + root);
});
