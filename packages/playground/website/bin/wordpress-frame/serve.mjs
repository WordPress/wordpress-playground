import express from 'express';
import { appOrigin as root } from './origins.mjs';
import { wordPressFrameMiddleware } from './middleware.mjs';
import { fileURLToPath } from 'node:url';

const app = express();
const assetResponses = [];
/** Resolve one built package independently of the caller's working directory. */
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
