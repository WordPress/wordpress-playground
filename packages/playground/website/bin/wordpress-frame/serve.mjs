/**
 * Serve the built preview on two local hostnames through one HTTP listener.
 *
 * Install host routing before exposing any build directory, then mount app,
 * remote, and shared download files on the app host. This is not a Vite dev
 * server: the request helper needs Vite's compiled HTML and bundle URLs.
 * The asset counter records public HTTP response sizes so browser tests can
 * check that switching sites reuses downloads rather than fetching a second copy.
 */
import express from 'express';
import { appOrigin as root } from './origins.mjs';
import { wordPressFrameMiddleware } from './middleware.mjs';
import { fileURLToPath } from 'node:url';

const app = express();
const assetResponses = [];
/**
 * Locate a built package relative to this script, not the process's directory.
 * Nx may start the preview from a package directory rather than the repo root.
 * Return a directory URL so callers can resolve files within the same build tree.
 */
const directory = (name) =>
	new URL(
		`../../../../../dist/packages/playground/${name}/`,
		import.meta.url
	);
app.use(
	wordPressFrameMiddleware(root, () =>
		fileURLToPath(new URL('wordpress-bridge.html', directory('remote')))
	)
);
app.use((req, res, next) => {
	if (
		req.path.endsWith('.js') ||
		req.path.startsWith('/assets/') ||
		/^\/wp-[^/]+\//.test(req.path)
	) {
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
app.use('/client', express.static(fileURLToPath(directory('client'))));
app.use(express.static(fileURLToPath(directory('website'))));
app.use(express.static(fileURLToPath(directory('remote'))));
app.use(express.static(fileURLToPath(directory('website-extras'))));
// Schemas, CLI and static PHP endpoints come from the normal CI assembly.
app.use(express.static(fileURLToPath(directory('wasm-wordpress-net'))));
app.listen(Number(new URL(root).port || 80), '127.0.0.1', () => {
	console.log('WordPress frame prototype: ' + root);
});
