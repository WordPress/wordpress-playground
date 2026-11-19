import { expect, test as base } from '@playwright/test';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { joinPaths } from '@php-wasm/util';
import {
	appOrigin as previewAppOrigin,
	wordPressOrigin as previewWordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

type Failure =
	| 'none'
	| 'service-worker'
	| 'php-worker'
	| 'bootstrap-module'
	| 'entry-document';

interface FailureServer {
	appOrigin: string;
	embedderOrigin: string;
	releaseBase: string;
	failure: Failure;
	connectionTimeoutMs: number;
	sharedVersionMismatch: boolean;
	lazy: boolean;
	spoofSibling: boolean;
	foreignRedirect: boolean;
	slowDedicatedStartup: boolean;
	createLazyFrame: boolean;
	blockedRequests: string[];
}

const webRoot = joinPaths(
	__dirname,
	'../../../../../dist/packages/playground/website-preview'
);

const test = base.extend<{ failureServer: FailureServer }>({
	// Playwright requires a destructured argument even for a fixture with no dependencies.
	// eslint-disable-next-line no-empty-pattern
	failureServer: async ({}, use) => {
		const manifest = JSON.parse(
			await readFile(joinPaths(webRoot, 'release.json'), 'utf8')
		);
		const releaseBase = joinPaths('/releases', manifest.release) + '/';
		const remoteHtml = await readFile(
			joinPaths(webRoot, 'remote.html'),
			'utf8'
		);
		const bootstrapPath = remoteHtml.match(
			/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/
		)?.[1];
		if (!bootstrapPath)
			throw new Error('Built remote.html has no module script');
		const fixture: FailureServer = {
			appOrigin: '',
			embedderOrigin: '',
			releaseBase,
			failure: 'none',
			connectionTimeoutMs: 20000,
			sharedVersionMismatch: false,
			lazy: false,
			spoofSibling: false,
			foreignRedirect: false,
			slowDedicatedStartup: false,
			createLazyFrame: false,
			blockedRequests: [],
		};
		let workerScriptRequests = 0;
		const app = express();
		app.use(async (request, response, next) => {
			response.set('Cache-Control', 'no-store');
			response.set('Access-Control-Allow-Origin', '*');
			if (
				fixture.foreignRedirect &&
				request.path === '/remote.html' &&
				!request.query.afterForeign
			) {
				response.redirect(fixture.embedderOrigin + '/foreign.html');
				return;
			}
			if (request.path === '/foreign.html') {
				response.type('html').send(`<!doctype html><script>
parent.postMessage({ type: 'playground-runtime-startup-error', error: { message: 'Spoofed failure' } }, '*');
location.replace(${JSON.stringify(fixture.appOrigin + '/remote.html?afterForeign=1')});
</script>`);
				return;
			}
			if (
				fixture.slowDedicatedStartup &&
				((request.path === '/sw.js' && workerScriptRequests++ === 0) ||
					request.path.includes(
						'/playground-worker-endpoint-blueprints-'
					))
			) {
				await new Promise((resolve) => setTimeout(resolve, 6000));
			}
			const blocked =
				(fixture.failure === 'service-worker' &&
					request.path === '/sw.js') ||
				(fixture.failure === 'php-worker' &&
					request.path.startsWith(releaseBase) &&
					request.path.includes(
						'/playground-worker-endpoint-blueprints-'
					)) ||
				(fixture.failure === 'bootstrap-module' &&
					request.path === bootstrapPath) ||
				(fixture.failure === 'entry-document' &&
					request.path === '/remote.html');
			if (blocked) {
				fixture.blockedRequests.push(request.path);
				response
					.status(403)
					.type('html')
					.send(
						'<!doctype html><title>Checking your browser...</title><p>Challenge fixture</p>'
					);
				return;
			}
			if (request.path === '/embed.html') {
				// Load the released SDK and real remote page from a different origin.
				// HTTP responses and permission APIs are fault-injected; the SDK and RPC are real.
				response.type('html').send(`<!doctype html>
${fixture.createLazyFrame ? '' : `<iframe id="playground" loading="${fixture.lazy ? 'lazy' : 'eager'}" style="width:100%;height:800px;${fixture.lazy ? 'margin-top:20000px' : ''}"></iframe>`}
${fixture.spoofSibling ? `<iframe src="${fixture.appOrigin}/seed.html?spoof=1"></iframe>` : ''}
<script type="module">
import { startPlaygroundWeb } from ${JSON.stringify(
					fixture.appOrigin + releaseBase + 'client/index.js'
				)};
if (${fixture.createLazyFrame}) {
    const frame = document.createElement('iframe');
    frame.id = 'playground';
    frame.loading = 'lazy';
    frame.style.cssText = 'width:100%;height:800px;margin-top:20000px';
    document.body.append(frame);
}
window.IS_WASM_WORDPRESS = false;
window.spoofMessages = 0;
window.addEventListener('message', event => {
    if (event.data?.error?.message === 'Spoofed failure') window.spoofMessages++;
});
window.reloadRequired = false;
window.startupErrors = [];
window.addEventListener('message', event => {
    if (event.source !== document.querySelector('#playground').contentWindow ||
        event.origin !== ${JSON.stringify(fixture.appOrigin)}) return;
    if (event.data?.type === 'playground-reload-required') window.reloadRequired = true;
    if (event.data?.type === 'playground-runtime-startup-error') window.startupErrors.push(event.data);
});
window.startFixture = () => {
window.startupResult = { state: 'pending' };
return startPlaygroundWeb({
    iframe: document.querySelector('iframe'),
    remoteUrl: ${JSON.stringify(fixture.appOrigin + '/remote.html')},
    connectionTimeoutMs: ${fixture.failure === 'entry-document' ? 3000 : fixture.connectionTimeoutMs},
    ${fixture.sharedVersionMismatch ? "workerMode: 'shared', scope: 'review-mismatch', sharedWorkerVersion: 'current', sharedWorkerClientVersion: 'stale'," : ''}
    blueprint: { preferredVersions: { php: '8.3', wp: false } },
}).then(
    () => window.startupResult = { state: 'resolved' },
    error => window.startupResult = {
        state: 'rejected', name: error.name, message: error.message, phase: error.phase
    }
);
};
void window.startFixture();
</script>`);
				return;
			}
			if (request.path === '/seed.html') {
				response
					.type('html')
					.send(
						'<!doctype html><title>Startup fixture</title>' +
							(request.query.spoof
								? `<script>setInterval(() => parent.postMessage({ type: 'playground-runtime-startup-error', error: { message: 'Spoofed failure' } }, '*'), 10);</script>`
								: '')
					);
				return;
			}
			if (
				request.path.endsWith('.html') ||
				request.path.endsWith('.js')
			) {
				try {
					let contents = await readFile(
						joinPaths(webRoot, request.path),
						'utf8'
					);
					// Keep the built origin guards and worker policies, configured for this
					// isolated listener rather than the standard preview's fixed port.
					contents = contents
						.replaceAll(
							previewWordPressOrigin,
							fixture.embedderOrigin
						)
						.replaceAll(previewAppOrigin, fixture.appOrigin);
					response
						.type(request.path.endsWith('.js') ? 'js' : 'html')
						.send(contents);
					return;
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
						throw error;
				}
			}
			next();
		});
		app.use(express.static(webRoot));
		const server = createServer(app);
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const port = (server.address() as AddressInfo).port;
		fixture.appOrigin = `http://localhost:${port}`;
		fixture.embedderOrigin = `http://127.0.0.1:${port}`;
		try {
			await use(fixture);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
});

// Contract: a failed installed release rejects the SDK startup promise. Network
// failures can precede API exposure or prevent the bootstrap module from running.
// Exercise the installed HTML, SDK, and workers instead of mocking their methods.
for (const failure of [
	'service-worker',
	'php-worker',
	'bootstrap-module',
	'entry-document',
] as const) {
	test(`an embedded release rejects startup when ${failure} is challenged`, async ({
		page,
		failureServer,
	}) => {
		failureServer.failure = failure;
		await page.goto(failureServer.embedderOrigin + '/embed.html');
		await expect
			.poll(
				() => page.evaluate(() => (window as any).startupResult?.state),
				{ timeout: 15000 }
			)
			.toBe('rejected');
		expect(failureServer.blockedRequests.length).toBeGreaterThan(0);
		const result = await page.evaluate(() => (window as any).startupResult);
		expect(result.message).toBeTruthy();
		if (failure === 'entry-document') {
			expect(result.name).toBe('TimeoutError');
		} else {
			// A running remote reports its cause before the connection timeout.
			expect(result.name).not.toBe('TimeoutError');
		}
	});
}

// Contract: the original startup call remains usable after user-driven recovery.
// The remote document reloads independently of the embedding application's call.
for (const action of ['storage-access', 'retry'] as const) {
	test(`the original embedded startup recovers through ${action}`, async ({
		page,
		failureServer,
	}) => {
		failureServer.connectionTimeoutMs = 2000;
		await page.addInitScript(
			({ appOrigin, action }) => {
				if (
					window.location.origin !== appOrigin ||
					!window.location.pathname.endsWith('/remote.html')
				)
					return;
				const register = navigator.serviceWorker.register.bind(
					navigator.serviceWorker
				);
				navigator.serviceWorker.register = (...args) => {
					if (!sessionStorage.getItem('storage-recovered')) {
						return Promise.reject(
							new DOMException(
								'Storage permission required',
								'NotSupportedError'
							)
						);
					}
					return register(...args);
				};
				if (action === 'storage-access') {
					navigator.permissions.query = async () =>
						({ state: 'prompt' }) as PermissionStatus;
					document.requestStorageAccess = async () => {
						sessionStorage.setItem('storage-recovered', 'yes');
					};
				} else {
					navigator.permissions.query = async () =>
						({ state: 'granted' }) as PermissionStatus;
				}
			},
			{ appOrigin: failureServer.appOrigin, action }
		);
		await page.goto(failureServer.embedderOrigin + '/embed.html');
		const remote = page.frameLocator('#playground');
		const button = remote.getByRole('button', {
			name:
				action === 'storage-access'
					? 'Allow storage access'
					: 'Try again',
			exact: true,
		});
		await expect(button).toBeVisible();
		// Wait longer than the configured stall budget while the user decides.
		await page.waitForTimeout(2500);
		expect(
			await page.evaluate(() => (window as any).startupResult.state)
		).toBe('pending');
		if (action === 'retry')
			await remote
				.locator('body')
				.evaluate(() =>
					sessionStorage.setItem('storage-recovered', 'yes')
				);
		// Permission is fault-injected; exercise the real recovery handler without
		// depending on the browser driver's cross-origin iframe input support.
		await button.evaluate((element) => element.click());
		await expect
			.poll(
				() => page.evaluate(() => (window as any).startupResult.state),
				{ timeout: 30000 }
			)
			.toBe('resolved');
	});
}

test('a shared version mismatch requests reload without reporting a boot failure', async ({
	page,
	failureServer,
}) => {
	failureServer.sharedVersionMismatch = true;
	failureServer.connectionTimeoutMs = 2000;
	await page.goto(failureServer.appOrigin + '/embed.html');
	await expect
		.poll(() => page.evaluate(() => (window as any).reloadRequired))
		.toBe(true);
	await page.waitForTimeout(2500);
	expect(await page.evaluate(() => (window as any).startupResult.state)).toBe(
		'pending'
	);
	expect(await page.evaluate(() => (window as any).startupErrors)).toEqual(
		[]
	);
});

test('the embedding application can retry a terminal failure with the same iframe', async ({
	page,
	failureServer,
}) => {
	failureServer.failure = 'service-worker';
	await page.goto(failureServer.embedderOrigin + '/embed.html');
	await expect
		.poll(() => page.evaluate(() => (window as any).startupResult.state))
		.toBe('rejected');
	failureServer.failure = 'none';
	await page.evaluate(() => {
		void (window as any).startFixture();
	});
	await expect
		.poll(() => page.evaluate(() => (window as any).startupResult.state), {
			timeout: 30000,
		})
		.toBe('resolved');
});

for (const creation of ['HTML', 'JavaScript'] as const) {
	test(`a lazy offscreen iframe created through ${creation} can start after the connection budget has elapsed`, async ({
		page,
		failureServer,
	}) => {
		failureServer.lazy = true;
		failureServer.createLazyFrame = creation === 'JavaScript';
		failureServer.connectionTimeoutMs = 2000;
		await page.goto(failureServer.embedderOrigin + '/embed.html');
		await page.waitForTimeout(2500);
		expect(
			await page.evaluate(() => (window as any).startupResult.state)
		).toBe('pending');
		await page.locator('#playground').scrollIntoViewIfNeeded();
		await expect
			.poll(
				() => page.evaluate(() => (window as any).startupResult.state),
				{
					timeout: 30000,
				}
			)
			.toBe('resolved');
	});
}

test('dedicated startup progress renews the budget between slow worker scripts', async ({
	page,
	failureServer,
}) => {
	failureServer.slowDedicatedStartup = true;
	// Each phase fits the stall budget, while their combined downloads exceed it.
	// Leave room for worker compilation on slower CI machines.
	failureServer.connectionTimeoutMs = 10000;
	await page.goto(failureServer.embedderOrigin + '/embed.html');
	await expect
		.poll(() => page.evaluate(() => (window as any).startupResult), {
			timeout: 30000,
		})
		.toMatchObject({ state: 'resolved' });
});

for (const sender of ['sibling', 'foreign-origin'] as const) {
	test(`startup ignores a failure message from a ${sender} document`, async ({
		page,
		failureServer,
	}) => {
		failureServer.spoofSibling = sender === 'sibling';
		failureServer.foreignRedirect = sender === 'foreign-origin';
		await page.goto(failureServer.embedderOrigin + '/embed.html');
		await expect
			.poll(() => page.evaluate(() => (window as any).spoofMessages))
			.toBeGreaterThan(0);
		await expect
			.poll(
				() => page.evaluate(() => (window as any).startupResult.state),
				{ timeout: 30000 }
			)
			.toBe('resolved');
	});
}

test('an embedded release can still boot PHP after connecting', async ({
	page,
	failureServer,
}) => {
	await page.goto(failureServer.embedderOrigin + '/embed.html');
	await expect
		.poll(() => page.evaluate(() => (window as any).startupResult), {
			timeout: 60000,
		})
		.toEqual({ state: 'resolved' });
});
