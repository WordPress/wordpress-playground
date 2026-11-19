/**
 * Opt-in: an old client from the root-only production layout survives a deployment.
 *
 * Builds deployed before release directories install a WordPress worker that answers
 * its own bridge URL with HTML naming its build's root /wordpress-bridge-<hash>.js on
 * the app host. Later deployments removed that script, so an old remote.html paired with
 * that worker failed with a 404 reported as a CORS error, then "WordPress request
 * transport did not start". This test uses a real build of that era:
 *
 * 1. Install it with that commit's own installer into a fresh web root, and serve the
 *    root as the preview does: static files directly, missing paths through PHP.
 * 2. Visit it: one open tab, and a returning visitor whose app worker caches entry pages.
 * 3. Install the current release with the installer under test.
 * 4. The open tab creates the bridge its old remote.html creates. No fault is injected.
 * 5. The returning visitor reloads during a short outage of the entry pages, while
 *    worker updates fail (simulated), so the old app boots from its worker's cache.
 *    WordPress requests must then reach PHP through the old bridge.
 *
 * Run `npx nx run playground-website:e2e:root-layout-transition`. It needs the preview
 * from build:wordpress-frame, and builds the old client once with build:root-layout-client.
 * To see the failure this guards against, point PLAYGROUND_TRANSITION_INSTALLER at the
 * website-deployment directory of a release without the root-only layout's asset index.
 */
import { expect, test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import express from 'express';
import type { RequestHandler } from 'express';
import { execFileSync } from 'node:child_process';
import {
	chmod,
	cp,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { joinPaths } from '@php-wasm/util';
import { wordPressFrameMiddleware } from '../../bin/wordpress-frame/middleware.mjs';

const repository = joinPaths(__dirname, '../../../../..');
const client = joinPaths(
	repository,
	'dist/packages/playground/root-layout-client'
);
const upload = joinPaths(
	repository,
	'dist/packages/playground/wordpress-frame-upload'
);
const installer =
	process.env.PLAYGROUND_TRANSITION_INSTALLER ??
	joinPaths(repository, 'packages/playground/website-deployment');
const hostnames = ['playground.localhost', 'wp.playground.localhost'];

test.describe.configure({ mode: 'serial' });

test('an old root-only layout client keeps working after a deployment', async ({
	browser,
	browserName,
}) => {
	const { commit, appOrigin, wordPressOrigin } = JSON.parse(
		await readFile(joinPaths(client, 'build.json'), 'utf8')
	);
	// build:wordpress-frame installs this upload, built for the same origins, at 7999.
	const { release } = JSON.parse(
		await readFile(
			joinPaths(
				repository,
				'dist/packages/playground/wasm-wordpress-net-new/release.json'
			),
			'utf8'
		)
	);
	expect(await readFile(joinPaths(upload, 'index.html'), 'utf8')).toContain(
		`/releases/${release}/`
	);

	const temporary = await mkdtemp(
		joinPaths(tmpdir(), 'playground-root-layout-')
	);
	const webRoot = joinPaths(temporary, 'htdocs');
	const backups = joinPaths(temporary, 'backups');
	await mkdir(webRoot);
	let phase: 'old' | 'current' = 'old';
	const faults = { workerImport: false, entryOutageUntil: 0 };
	const server = await serve(webRoot, () => phase, faults, release);
	const contexts = [await browser.newContext(), await browser.newContext()];
	try {
		await installRootLayoutClient(
			temporary,
			webRoot,
			backups,
			appOrigin,
			wordPressOrigin
		);

		const tab = await contexts[0].newPage();
		const returning = await contexts[1].newPage();
		await test.step('the old client works before the deployment', async () => {
			await tab.goto(`${appOrigin}/?storage=temp`);
			expect(await wordPressRequest(tab, wordPressOrigin)).toBe(true);
			// The second visit runs under the app worker, which caches the entry pages.
			for (let visit = 0; visit < 2; visit++) {
				await returning.goto(`${appOrigin}/?storage=temp`);
				expect(await wordPressRequest(returning, wordPressOrigin)).toBe(
					true
				);
			}
			await returning.close();
		});

		await installCurrentRelease(
			temporary,
			webRoot,
			backups,
			appOrigin,
			wordPressOrigin,
			release
		);
		phase = 'current';

		// The open tab's failures must not skip the returning visitor, which shows the
		// cached-boot result. Record them, and fail the test once both scenarios ran.
		let openTabFailure: unknown;
		await test.step('an open old tab creates its bridge after the deployment', async () => {
			expect
				.soft(await createOldBridge(tab, wordPressOrigin, commit))
				.toBe('ready');
			// The tab booted before the deployment; it must still load WordPress pages.
			try {
				await expectUsable(tab, wordPressOrigin, 'open old tab');
			} catch (error) {
				openTabFailure = error;
			}
		});

		// WebKit's old app worker cannot serve its cached entry pages when their fetch
		// fails, so its navigation fails before any bridge starts, with or without this fix.
		if (browserName === 'webkit') {
			test.info().annotations.push({
				type: 'not applicable',
				description:
					'The old build cannot boot from its cache in WebKit, so only the open tab is checked.',
			});
		} else {
			await test.step('a returning visitor boots the cached old app after the deployment', async () => {
				faults.workerImport = true;
				faults.entryOutageUntil = Date.now() + 3000;
				const page = await contexts[1].newPage();
				await page
					.goto(`${appOrigin}/?storage=temp`)
					.catch(() => undefined);
				const remote = await waitForFrame(page, (frame) =>
					frame.url().includes('/remote.html')
				);
				// Precondition: the old build booted. Otherwise this step tests nothing.
				expect(await remote.content()).not.toContain(
					`/releases/${release}/`
				);
				expect(await wordPressRequest(page, wordPressOrigin)).toBe(
					true
				);
				await expectUsable(page, wordPressOrigin, 'returning visitor');
			});
		}
		if (openTabFailure) throw openTabFailure;
	} finally {
		for (const context of contexts) await context.close();
		await new Promise((resolve) => server.close(resolve));
		await rm(temporary, { recursive: true, force: true });
	}
});

/** Serve the web root on both hostnames, with the simulated faults this test enables. */
async function serve(
	webRoot: string,
	phase: () => 'old' | 'current',
	faults: { workerImport: boolean; entryOutageUntil: number },
	release: string
) {
	const app = express();
	const simulate: RequestHandler = (request, response, next) => {
		// The old router let browsers cache root scripts for an hour. A real returning
		// visitor's copy has expired, so make the old phase's copies revalidate.
		if (
			phase() === 'old' &&
			/^\/wordpress-bridge-[^/]+\.js$/.test(request.path)
		) {
			const writeHead = response.writeHead;
			response.writeHead = function (
				this: typeof response,
				...args: any[]
			) {
				this.setHeader('Cache-Control', 'no-cache');
				const headers = args.find(
					(arg) => arg && typeof arg === 'object'
				);
				for (const name of Object.keys(headers ?? {})) {
					if (name.toLowerCase() === 'cache-control')
						headers[name] = 'no-cache';
				}
				return writeHead.apply(this, args as any);
			} as typeof response.writeHead;
		}
		// Worker updates fail on both hosts, so the old workers stay active.
		if (
			faults.workerImport &&
			request.path === `/releases/${release}/sw.js`
		) {
			return response.status(404).end();
		}
		// A short outage of the app's entry pages, as during a reconnecting network.
		if (
			Date.now() < faults.entryOutageUntil &&
			request.hostname === hostnames[0] &&
			['/', '/remote.html'].includes(request.path)
		) {
			return request.socket.destroy();
		}
		next();
	};
	app.use(simulate);
	app.use(wordPressFrameMiddleware(() => webRoot, hostnames));
	return await new Promise<Server>((resolve) => {
		const server = app.listen(7999, '127.0.0.1', () => resolve(server));
	});
}

/** Install the old build exactly as its deployment did, apart from WP Cloud's services. */
async function installRootLayoutClient(
	temporary: string,
	webRoot: string,
	backups: string,
	appOrigin: string,
	wordPressOrigin: string
) {
	const deployment = joinPaths(temporary, 'root-layout-deployment');
	await cp(joinPaths(client, 'deployment'), deployment, { recursive: true });
	// That installer accepted only HTTPS origins; the local origins use HTTP.
	const script = joinPaths(deployment, 'apply-update.sh');
	const source = await readFile(script, 'utf8');
	const local = source.replace(
		'($parts["scheme"] ?? null) !== "https" ||',
		'!in_array($parts["scheme"] ?? null, ["https", "http"], true) ||'
	);
	expect(local).not.toBe(source);
	await writeFile(script, local);
	// WP Cloud stub: hidden-path probes get 403, the /sw.js mapping probe 200, purges succeed.
	const bin = joinPaths(temporary, 'bin');
	await mkdir(bin);
	await writeFile(
		joinPaths(bin, 'curl'),
		'#!/bin/bash\nfor a in "$@"; do last="$a"; done\n' +
			'case " $* " in *" -X "*) exit 0;; esac\n' +
			'if [[ "$last" == */sw.js\\?* ]]; then printf 200; else printf 403; fi\n'
	);
	await chmod(joinPaths(bin, 'curl'), 0o755);
	const build = joinPaths(temporary, 'root-layout-upload');
	await cp(joinPaths(client, 'build'), build, {
		recursive: true,
		verbatimSymlinks: true,
	});
	execFileSync(
		'bash',
		[script, appOrigin, wordPressOrigin, build, webRoot, backups],
		{
			stdio: 'pipe',
			env: {
				...process.env,
				PATH: `${bin}:${process.env.PATH}`,
				SITE_PHP: 'php',
				SITE_API_BASE: 'https://api.invalid',
				ATOMIC_SITE_API_KEY: 'test',
				ATOMIC_SITE_ID: 'test',
			},
		}
	);
}

/** Install the current release over it with the installer under test. */
async function installCurrentRelease(
	temporary: string,
	webRoot: string,
	backups: string,
	appOrigin: string,
	wordPressOrigin: string,
	release: string
) {
	const copy = joinPaths(temporary, 'current-upload');
	await cp(upload, copy, { recursive: true, verbatimSymlinks: true });
	execFileSync(
		'bash',
		[
			joinPaths(installer, 'apply-update.sh'),
			appOrigin,
			wordPressOrigin,
			copy,
			webRoot,
			backups,
		],
		{
			stdio: 'pipe',
			env: {
				...process.env,
				PLAYGROUND_RELEASE_ID: release,
				PLAYGROUND_LOCAL_RELEASES: '1',
				PLAYGROUND_MIME_TYPES: joinPaths(
					repository,
					'packages/php-wasm/universal/src/lib/mime-types.json'
				),
				SITE_PHP: 'php',
			},
		}
	);
}

/** Create the bridge an old remote.html creates, and wait for it to report ready. */
function createOldBridge(
	page: Page,
	wordPressOrigin: string,
	buildVersion: string
) {
	return page.evaluate(
		({ wordPressOrigin, buildVersion }) => {
			const frame = document.createElement('iframe');
			frame.hidden = true;
			frame.src = `${wordPressOrigin}/wordpress-bridge-${buildVersion}.html?scope=transition-check`;
			const ready = new Promise<string>((resolve) => {
				const timer = setTimeout(() => resolve('timed out'), 30000);
				window.addEventListener('message', (event) => {
					if (
						event.source === frame.contentWindow &&
						event.data?.type === 'wordpress-bridge-ready'
					) {
						clearTimeout(timer);
						resolve('ready');
					}
				});
			});
			document.body.append(frame);
			return ready;
		},
		{ wordPressOrigin, buildVersion }
	);
}

/**
 * Check that the site is usable, not just reachable: WordPress rendered the front
 * page, the WordPress frame navigates to the dashboard through the bridge, and the
 * app shows no startup error. Attach a screenshot of each for review.
 */
async function expectUsable(
	page: Page,
	wordPressOrigin: string,
	label: string
) {
	const isWordPress = (frame: Frame) =>
		frame.url().startsWith(`${wordPressOrigin}/scope:`);
	const frame = await waitForFrame(page, isWordPress);
	await expect(frame.locator('body')).toContainText('My WordPress Website');
	await frame.goto(new URL('wp-admin/', frame.url()).href);
	const admin = await waitForFrame(
		page,
		(candidate) =>
			isWordPress(candidate) && candidate.url().includes('/wp-admin/')
	);
	await expect(admin.locator('#wpadminbar')).toBeVisible();
	await expect(admin.locator('#wpbody')).toContainText('Dashboard');
	await expect(page.getByText(/did not start|went wrong/i)).toHaveCount(0);
	const path = test.info().outputPath(`${label.replaceAll(' ', '-')}.png`);
	await page.screenshot({ path });
	await test.info().attach(label, { path, contentType: 'image/png' });
}

/** Request PHP-generated JSON from the WordPress frame, through its bridge. */
async function wordPressRequest(page: Page, wordPressOrigin: string) {
	const frame = await waitForFrame(page, (frame) =>
		frame.url().startsWith(`${wordPressOrigin}/scope:`)
	);
	await frame.waitForLoadState('domcontentloaded');
	return frame.evaluate(async () => {
		const response = await fetch('?rest_route=/');
		return Array.isArray((await response.json()).namespaces);
	});
}

async function waitForFrame(page: Page, matches: (frame: Frame) => boolean) {
	let found: Frame | undefined;
	await expect
		.poll(() => (found = page.frames().find(matches)), { timeout: 90000 })
		.toBeTruthy();
	return found!;
}
