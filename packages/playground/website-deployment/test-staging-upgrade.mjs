/**
 * Keep real browser sessions open while a staging site upgrades between deployments.
 *
 * Start with the site on trunk's layout, as test-staging-deployment.sh leaves it
 * with PLAYGROUND_STAGING_FROM_TRUNK=1. This script then deploys two releases of the
 * current checkout with deploy-website.sh and rolls back to the first. Before each
 * change it opens Playground in Chromium and WebKit; after it, it checks that:
 *
 * - the already-open tab still navigates WordPress, and its own release files remain;
 * - reloading it starts the newly active release, and a saved site still opens
 *   (Chromium only: the website saves sites to OPFS there);
 * - a fresh tab starts the active release.
 *
 * Each browser keeps one profile throughout, so service workers, caches and saved
 * sites carry across deployments as they would for a real visitor. Run it from the
 * repository root:
 *
 *   PLAYGROUND_STAGING_CONFIRM=<user@host> node \
 *     packages/playground/website-deployment/test-staging-upgrade.mjs \
 *     <user@host> <app-origin> <wordpress-origin>
 *
 * It prints PASS and FAIL lines plus page errors for review, and exits non-zero
 * when any check fails.
 */
import { chromium, webkit } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { joinPaths } from '../../php-wasm/util/src/lib/paths.ts';

const [target, appOrigin, wordPressOrigin] = process.argv.slice(2);
if (!target || !appOrigin || !wordPressOrigin) {
	throw new Error(
		'Usage: test-staging-upgrade.mjs <user@host> <app-origin> <wordpress-origin>'
	);
}
if (process.env.PLAYGROUND_STAGING_CONFIRM !== target) {
	throw new Error(
		`Set PLAYGROUND_STAGING_CONFIRM=${target} to confirm this site may be overwritten.`
	);
}
for (const origin of [appOrigin, wordPressOrigin]) {
	if (
		[
			'https://playground.wordpress.net',
			'https://wpsandbox.wordpress.net',
			'https://my.wordpress.net',
		].includes(origin)
	) {
		throw new Error(
			`Refusing to run a staging test against production: ${origin}`
		);
	}
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
	encoding: 'utf8',
}).trim();
const releaseA = `staging-upgrade-${stamp}-a-${commit}`;
const releaseB = `staging-upgrade-${stamp}-b-${commit}`;
const failures = [];

await main();

async function main() {
	step('Starting layout');
	await check('the site runs trunk (no /release.json)', async () => {
		const response = await fetch(new URL('/release.json', appOrigin));
		return response.status === 404 || `HTTP ${response.status}`;
	});
	const sessions = [];
	try {
		for (const [name, browserType] of [
			['chromium', chromium],
			['webkit', webkit],
		]) {
			const profile = await mkdtemp(
				joinPaths(tmpdir(), `playground-upgrade-${name}-`)
			);
			sessions.push({
				name,
				profile,
				savesSites: name === 'chromium',
				context: await browserType.launchPersistentContext(profile, {
					headless: true,
				}),
				errors: [],
			});
		}

		step('Trunk: open Playground in each browser');
		for (const session of sessions) {
			await openSite(session);
		}

		deploy(releaseA);
		await waitForEdge(releaseA);
		step(`Upgrade from trunk to ${releaseA}`);
		for (const session of sessions) {
			await useOpenTab(session, { retainsFiles: false });
			await reopen(session, releaseA);
			await freshTab(session, releaseA);
		}

		deploy(releaseB);
		await waitForEdge(releaseB);
		step(`Upgrade from ${releaseA} to ${releaseB}`);
		for (const session of sessions) {
			await useOpenTab(session, { retainsFiles: true });
			await reopen(session, releaseB);
			await freshTab(session, releaseB);
		}

		deploy(releaseB, { rollback: true });
		await waitForEdge(releaseA);
		step(`Roll back from ${releaseB} to ${releaseA}`);
		for (const session of sessions) {
			await useOpenTab(session, { retainsFiles: true });
			await reopen(session, releaseA);
		}
	} finally {
		for (const session of sessions) {
			reportErrors(session);
			await session.context.close();
			await rm(session.profile, { recursive: true, force: true });
		}
	}

	console.log(
		failures.length
			? `\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`
			: `\nAll upgrade checks passed. ${releaseA} is active.`
	);
	process.exitCode = failures.length ? 1 : 0;
}

/** Start a site, save it in browser storage where supported, and add a marker post. */
async function openSite(session) {
	session.page = await newPage(session);
	await session.page.goto(new URL('/?storage=temp', appOrigin).href);
	await check(`${session.name}: trunk boots WordPress`, () =>
		waitForWordPress(session.page)
	);
	if (!session.savesSites) {
		return;
	}
	await check(
		`${session.name}: trunk saves a site with a marker post`,
		async () => {
			const saved = await session.page.evaluate(() =>
				window.playgroundSites.saveInBrowser()
			);
			session.slug = saved.slug;
			await waitForSavedSite(session.page, session.slug);
			await waitForClient(session.page);
			session.marker = `Upgrade marker ${stamp}`;
			session.postId = await session.page.evaluate(async (title) => {
				const client = window.playgroundSites.getClient();
				const result = await client.run({
					code: `<?php require '/wordpress/wp-load.php';
					echo wp_insert_post(array('post_status' => 'publish', 'post_title' => ${JSON.stringify(title)}));`,
				});
				await client.flushOpfs('/wordpress');
				return Number(result.text);
			}, session.marker);
			return session.postId > 0 || 'no post ID';
		}
	);
}

/** Use the tab opened before the deployment, without reloading it. */
async function useOpenTab(session, { retainsFiles }) {
	const page = session.page;
	await check(
		`${session.name}: the open tab still navigates WordPress`,
		async () => {
			// Every new site has this post; a unique query forces a real request.
			await waitForClient(page);
			await page.evaluate(
				(path) => window.playgroundSites.getClient().goTo(path),
				`/?p=1&upgrade-check=${Date.now()}`
			);
			await wordPressFrame(page)
				.getByText('Hello world!')
				.first()
				.waitFor({ timeout: 180000 });
			return true;
		}
	);
	// Ask the server directly: the page's service worker could answer from its cache.
	const urls = await page.evaluate(() => [
		...new Set(
			performance
				.getEntriesByType('resource')
				.map((entry) => entry.name)
				.filter((name) =>
					/\.(?:js|css|wasm)$/.test(new URL(name).pathname)
				)
		),
	]);
	const missing = [];
	for (const url of urls) {
		const response = await fetch(url, { method: 'HEAD' });
		if (!response.ok) {
			missing.push(`${new URL(url).pathname} (HTTP ${response.status})`);
		}
	}
	const label = `${session.name}: the open tab's ${urls.length} loaded files remain on the server`;
	if (retainsFiles) {
		await check(
			label,
			() => missing.length === 0 || missing.slice(0, 5).join(', ')
		);
	} else {
		// Trunk's unversioned files are replaced by the first release, as before this change.
		console.log(
			`INFO  ${session.name}: ${missing.length} of ${urls.length} trunk files are gone after the upgrade`
		);
	}
}

/** Reload the open tab, reopening the saved site where there is one. */
async function reopen(session, release) {
	const page = session.page;
	if (session.slug) {
		await page.goto(
			new URL(
				`/?site-slug=${encodeURIComponent(session.slug)}`,
				appOrigin
			).href
		);
	} else {
		await page.reload();
	}
	await check(`${session.name}: reloading starts ${release}`, async () => {
		await waitForWordPress(page);
		const running = await runningRelease(page);
		return running === release || `running ${running}`;
	});
	if (session.slug) {
		await check(
			`${session.name}: the saved site still has its marker post`,
			async () => {
				await waitForClient(page);
				const title = await page.evaluate(async (postId) => {
					const result = await window.playgroundSites
						.getClient()
						.run({
							code: `<?php require '/wordpress/wp-load.php'; echo get_the_title(${postId});`,
						});
					return result.text;
				}, session.postId);
				return title === session.marker || `title '${title}'`;
			}
		);
	}
}

async function freshTab(session, release) {
	const page = await newPage(session);
	try {
		await page.goto(new URL('/?storage=temp', appOrigin).href);
		await check(
			`${session.name}: a fresh tab starts ${release}`,
			async () => {
				await waitForWordPress(page);
				const running = await runningRelease(page);
				return running === release || `running ${running}`;
			}
		);
	} finally {
		await page.close();
	}
}

async function newPage(session) {
	const page = await session.context.newPage();
	page.on('pageerror', (error) =>
		session.errors.push(`pageerror: ${error.message}`)
	);
	page.on('console', (message) => {
		if (message.type() === 'error') {
			session.errors.push(`console: ${message.text()}`);
		}
	});
	return page;
}

/** Wait for the app's API and for WordPress content in the visible viewport. */
async function waitForWordPress(page) {
	await page.waitForFunction(() => window.playgroundSites?.isReady, null, {
		timeout: 180000,
	});
	await page.evaluate(() => window.playgroundSites.isReady());
	await wordPressFrame(page)
		.locator('body *')
		.first()
		.waitFor({ state: 'attached', timeout: 180000 });
	return true;
}

/** The site's client is briefly absent while a saved site restarts. */
async function waitForClient(page) {
	await page.waitForFunction(
		() => Boolean(window.playgroundSites?.getClient()),
		null,
		{ timeout: 180000 }
	);
}

function wordPressFrame(page) {
	return page
		.frameLocator(
			'#playground-viewport:visible,.playground-viewport:visible'
		)
		.frameLocator('#wp');
}

/** The release named by the app page's module scripts, or "trunk" for unversioned assets. */
async function runningRelease(page) {
	return page.evaluate(() => {
		for (const script of document.querySelectorAll('script[src]')) {
			const match = new URL(script.src).pathname.match(
				/^\/releases\/([^/]+)\//
			);
			if (match) {
				return match[1];
			}
		}
		return 'trunk';
	});
}

/** Wait until the saved site's first copy to browser storage completes. */
async function waitForSavedSite(page, slug) {
	await page.waitForFunction(
		async (directoryName) => {
			try {
				const root = await navigator.storage.getDirectory();
				const sites = await root.getDirectoryHandle('sites');
				const site = await sites.getDirectoryHandle(directoryName);
				const metadata = await site.getFileHandle('wp-runtime.json');
				return (
					JSON.parse(await (await metadata.getFile()).text())
						.initialOpfsSyncPending !== true
				);
			} catch {
				return false;
			}
		},
		`site-${encodeURIComponent(slug)}`,
		{ timeout: 180000, polling: 1000 }
	);
}

function deploy(release, { rollback = false } = {}) {
	step(
		rollback
			? `Roll back to the snapshot taken before ${release}`
			: `Deploy ${release}`
	);
	const result = spawnSync(
		'packages/playground/website-deployment/deploy-website.sh',
		[target, appOrigin, wordPressOrigin],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				PLAYGROUND_RELEASE_ID: release,
				...(rollback && { PLAYGROUND_ROLLBACK_BACKUP: release }),
			},
		}
	);
	if (result.status !== 0) {
		throw new Error(`deploy-website.sh exited with ${result.status}`);
	}
}

/**
 * Wait until the edge serves the active release's root files on the app host.
 * The cache purge returns before every edge node has dropped its old copies, and
 * covers only the app hostname. The WordPress host's helper registers the worker
 * with its build version in the query, so a stale bare /sw.js there does not apply.
 */
async function waitForEdge(release) {
	const started = Date.now();
	const loader = `import "/releases/${release}/sw.js";`;
	while (Date.now() - started < 300000) {
		const [manifest, ...loaders] = await Promise.all([
			fetch(new URL('/release.json', appOrigin)).then((r) => r.text()),
			fetch(new URL('/sw.js', appOrigin)).then((r) => r.text()),
		]);
		if (
			JSON.parse(manifest).release === release &&
			loaders.every((text) => text.includes(loader))
		) {
			console.log(
				`INFO  the edge served ${release} after ${Math.round((Date.now() - started) / 1000)}s`
			);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	throw new Error(
		`The edge still serves another release than ${release} after 300s`
	);
}

/** Run a check: true passes, a string or exception fails with that reason. */
async function check(description, run) {
	try {
		const outcome = await run();
		if (outcome === true) {
			console.log(`PASS  ${description}`);
			return;
		}
		throw new Error(String(outcome));
	} catch (error) {
		console.log(`FAIL  ${description}: ${error.message.split('\n')[0]}`);
		failures.push(description);
	}
}

function reportErrors(session) {
	const unique = [...new Set(session.errors)];
	console.log(
		`\nINFO  ${session.name}: ${unique.length} distinct page error(s)`
	);
	for (const error of unique.slice(0, 20)) {
		console.log(`  ${error.slice(0, 300)}`);
	}
}

function step(title) {
	console.log(`\n=== ${title}`);
}
