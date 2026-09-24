import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../../', import.meta.url);
const { release, base } = JSON.parse(
	await readFile(new URL('dist/origin-isolation.json', root))
);
const launcher = await readFile(
	new URL('launcher.html', import.meta.url),
	'utf8'
);
const website = new URL('dist/packages/playground/website/', root);
const remote = new URL('dist/packages/playground/remote/', root);
const manifest = JSON.parse(await readFile(new URL('manifest.json', website)));
for (const image of [...manifest.icons, ...manifest.screenshots]) {
	image.src = new URL(image.src, base).href;
}
const app = express();

app.use((req, res, next) => {
	res.set('X-Content-Type-Options', 'nosniff');
	res.set('Cache-Control', 'no-store');
	if (req.hostname === 'playground.localhost') {
		// No remote.html, api.html, or user content is served on the catalogue origin.
		res.set('Content-Security-Policy', "frame-ancestors 'none'");
		if (req.path !== '/') return res.sendStatus(404);
		return res.type('html').send(launcher);
	}
	if (req.hostname === 'static.playground.localhost') {
		res.on('finish', () => {
			console.log(
				JSON.stringify({
					asset: req.originalUrl,
					status: res.statusCode,
					bytes: Number(res.get('Content-Length') || 0),
					encoding: res.get('Content-Encoding') || 'identity',
				})
			);
		});
		res.set('Access-Control-Allow-Origin', '*');
		res.set(
			'Access-Control-Expose-Headers',
			'Content-Encoding, Content-Range'
		);
		res.set('Cross-Origin-Resource-Policy', 'cross-origin');
		res.set('Cache-Control', 'public, max-age=31536000, immutable');
		return next();
	}
	if (!/^site-[a-f0-9-]+\.playground\.localhost$/.test(req.hostname)) {
		return res.sendStatus(404);
	}
	// Untrusted site pages cannot embed another app instance or its remote API.
	res.set('Content-Security-Policy', "frame-ancestors 'self'");
	res.set('Cross-Origin-Opener-Policy', 'same-origin');
	if (req.path === '/' || req.path === '/index.html') {
		return res.sendFile(fileURLToPath(new URL('index.html', website)));
	}
	if (req.path === '/remote.html') {
		return res.sendFile(fileURLToPath(new URL('remote.html', remote)));
	}
	if (req.path === '/manifest.json') {
		return res.json(manifest);
	}
	if (new RegExp(`^/${release}/assets/worker-[\\w-]+\\.js$`).test(req.path)) {
		return res
			.type('js')
			.send(
				`importScripts(${JSON.stringify(new URL(req.path, base).href)});`
			);
	}
	if (
		new RegExp(
			`^/${release}/assets/opfs-site-storage-worker-for-safari-[\\w-]+\\.js$`
		).test(req.path) ||
		req.path === `/${release}/sw.js` ||
		new RegExp(
			`^/${release}/playground-worker-endpoint-blueprints-[\\w-]+\\.js$`
		).test(req.path)
	) {
		res.set('Service-Worker-Allowed', '/');
		return res
			.type('js')
			.send(`import ${JSON.stringify(new URL(req.path, base).href)};`);
	}
	// Redirect public WordPress static files, never PHP responses or private data.
	if (req.path.startsWith('/wp-')) {
		return res.redirect(302, new URL(`.${req.path}`, base).href);
	}
	return res.sendStatus(404);
});

// Express's static middleware confines requests to these build directories.
// Only public build files are served here. Worker entry scripts can be imported,
// but HTML documents must run on site origins.
const publicFiles = express.Router();
for (const directory of [website, remote]) {
	publicFiles.use(
		express.static(fileURLToPath(directory), {
			immutable: true,
			maxAge: '1y',
			index: false,
		})
	);
}
app.use(
	`/${release}`,
	(req, res, next) => {
		if (
			req.path.endsWith('.html') ||
			req.path.endsWith('.br') ||
			req.path === '/'
		)
			return res.sendStatus(404);
		next();
	},
	(req, res, next) => {
		const extension = /\.(js|css|wasm)$/.exec(req.path)?.[1];
		if (!extension) return publicFiles(req, res, next);
		res.vary('Accept-Encoding');
		// Runtime resume offsets count decoded bytes. Range requests must read the
		// original file, not offsets into its compressed representation.
		if (req.get('Range') || !req.acceptsEncodings('br'))
			return publicFiles(req, res, next);
		const originalUrl = req.url;
		const compressedUrl = new URL(req.url, base);
		compressedUrl.pathname += '.br';
		res.type(extension);
		res.set('Content-Encoding', 'br');
		req.url = compressedUrl.pathname + compressedUrl.search;
		return publicFiles(req, res, () => {
			// Public WordPress assets are not precompressed by this prototype.
			req.url = originalUrl;
			res.removeHeader('Content-Encoding');
			res.removeHeader('Content-Type');
			publicFiles(req, res, next);
		});
	}
);
app.use((_req, res) => res.sendStatus(404));
app.listen(9400, '127.0.0.1', () => {
	console.log('Origin isolation prototype: http://playground.localhost:9400');
});
