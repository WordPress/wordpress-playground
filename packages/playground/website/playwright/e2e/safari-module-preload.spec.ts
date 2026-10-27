import { test, expect } from '@playwright/test';
import { mkdtemp, realpath, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { joinPaths } from '@php-wasm/util';
import { build } from 'vite';
import type { Rollup } from 'vite';
import { safariModulePreloadWorkaround } from '../../vite-safari-module-preload';

let server: Server;
let origin: string;
let failedDependency: string | undefined;
let failedRequests = 0;

test.beforeAll(async () => {
	// A dev server does not emit Vite's HTML links or dynamic-import preloads.
	const assets = await buildFixture();
	server = createServer((request, response) => {
		const pathname = new URL(request.url!, origin).pathname;
		const asset = assets.find(
			(file) =>
				new URL(file.fileName, origin).pathname ===
				(pathname === '/' ? '/index.html' : pathname)
		);
		// A failed preload can stick in Safari even when HTTP caching is disabled.
		response.setHeader('Cache-Control', 'no-store');
		if (!asset) {
			response.writeHead(404).end();
			return;
		}
		response.setHeader(
			'Content-Type',
			asset.fileName.endsWith('.html')
				? 'text/html'
				: asset.fileName.endsWith('.css')
					? 'text/css'
					: 'application/javascript'
		);
		if (failedDependency && asset.fileName.includes(failedDependency)) {
			failedRequests++;
			response.writeHead(503).end();
			return;
		}
		response.end(asset.type === 'chunk' ? asset.code : asset.source);
	});
	await new Promise<void>((resolve) =>
		server.listen(0, '127.0.0.1', resolve)
	);
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.beforeEach(() => {
	failedDependency = undefined;
	failedRequests = 0;
});

test.afterAll(async () => {
	if (server) {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

test('skips Safari JS preloads while retaining other browsers preloads and lazy CSS', async ({
	page,
	browserName,
}) => {
	await page.goto(origin);
	await expect(page.locator('#state')).toHaveText('ready');
	const preloads = page.locator('link[rel="modulepreload"]');
	if (browserName === 'webkit') {
		await expect(preloads).toHaveCount(0);
	} else {
		await expect(
			preloads.and(page.locator('[href*="entry-dependency-"]'))
		).toHaveCount(1);
	}

	await page.getByRole('button', { name: 'Load feature' }).click();
	await expect(page.locator('#state')).toHaveText('feature ready');
	if (browserName === 'webkit') {
		await expect(preloads).toHaveCount(0);
	} else {
		await expect(
			preloads.and(page.locator('[href*="feature-dependency-"]'))
		).toHaveCount(1);
	}
});

test('reloads an initial dependency after the server recovers', async ({
	page,
}) => {
	failedDependency = 'entry-dependency-';
	await page.goto(origin);
	await expect(page.locator('#state')).toHaveText('loading');
	expect(failedRequests).toBeGreaterThan(0);

	failedDependency = undefined;
	await page.reload();
	await expect(page.locator('#state')).toHaveText('ready');
});

test('reloads a lazy dependency after the server recovers', async ({
	page,
}) => {
	await page.goto(origin);
	await expect(page.locator('#state')).toHaveText('ready');
	failedDependency = 'feature-dependency-';
	await page.getByRole('button', { name: 'Load feature' }).click();
	await expect(page.locator('#state')).toHaveText('feature failed');
	expect(failedRequests).toBeGreaterThan(0);

	failedDependency = undefined;
	await page.reload();
	await expect(page.locator('#state')).toHaveText('ready');
	await page.getByRole('button', { name: 'Load feature' }).click();
	await expect(page.locator('#state')).toHaveText('feature ready');
});

async function buildFixture() {
	const root = await realpath(
		await mkdtemp(joinPaths(tmpdir(), 'playground-module-preload-'))
	);
	try {
		const files = {
			'index.html': `<div id="state">loading</div><button>Load feature</button>
				<script type="module" src="/entry.js"></script>`,
			'entry.js': `import { ready } from './entry-dependency.js';
				const state = document.querySelector('#state');
				if (ready) state.textContent = 'ready';
				document.querySelector('button').onclick = () => import('./feature.js').then(
					feature => state.textContent = feature.ready ? 'feature ready' : 'missing CSS',
					() => state.textContent = 'feature failed'
				);`,
			'entry-dependency.js':
				'export const ready = !!document.querySelector("#state");',
			'feature.js': `import './feature.css';
				import { ready as dependencyReady } from './feature-dependency.js';
				export const ready = dependencyReady && getComputedStyle(document.documentElement)
					.getPropertyValue('--feature-loaded').trim() === 'yes';`,
			'feature-dependency.js':
				'export const ready = !!document.querySelector("#state");',
			'feature.css': ':root { --feature-loaded: yes; }',
		};
		await Promise.all(
			Object.entries(files).map(([name, contents]) =>
				writeFile(joinPaths(root, name), contents)
			)
		);
		const result = (await build({
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: [safariModulePreloadWorkaround()],
			build: {
				write: false,
				rollupOptions: {
					output: {
						manualChunks(id) {
							if (id.endsWith('/entry-dependency.js')) {
								return 'entry-dependency';
							}
							if (id.endsWith('/feature-dependency.js')) {
								return 'feature-dependency';
							}
						},
					},
				},
			},
		})) as Rollup.RollupOutput;
		return result.output;
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
