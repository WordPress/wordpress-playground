/**
 * Serve the built preview on two local hostnames through one HTTP listener.
 *
 * Install host routing before exposing the shared public tree on both hostnames.
 * This is not a Vite dev server: the request helper uses compiled HTML and bundles.
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
app.use((req, res, next) => {
	if (
		req.path.endsWith('.js') ||
		/\.(wasm|zip|zst)$/.test(req.path) ||
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
app.use(
	wordPressFrameMiddleware(() =>
		fileURLToPath(directory('wordpress-frame-public'))
	)
);
app.use(express.static(fileURLToPath(directory('wordpress-frame-public'))));
app.listen(Number(new URL(root).port || 80), '127.0.0.1', () => {
	console.log('WordPress frame prototype: ' + root);
});
