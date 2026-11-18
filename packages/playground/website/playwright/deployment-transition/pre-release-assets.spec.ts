import { expect, test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { joinPaths, dirname } from '../../../../php-wasm/util/src/lib/paths';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// Opt-in artifact rehearsal: this runs the actual November 10 app and worker.
// Only literal production origins are changed for loopback. Restored assets are exact bytes.
const run = promisify(execFile);
const root = joinPaths(
	process.cwd(),
	'dist/packages/playground/website-preview'
);
const work = joinPaths(process.cwd(), '.context/pre-release-transition');
const original = process.env.PLAYGROUND_PRE_RELEASE_BUILD;
const deployment = joinPaths(
	process.cwd(),
	'packages/playground/website-deployment'
);
const assets = joinPaths(deployment, 'wordpress-frame/static-assets');
const commit = 'ada3b06ce0d85550b55ef3d818460a806ca4f220';
const bridgePath = `/wordpress-bridge-${commit}.html`;
const scriptPath = '/wordpress-bridge-Cmo7aZBy.js';
const env = {
	...process.env,
	SITE_PHP: 'php',
	PLAYGROUND_LOCAL_RELEASES: '1',
	PLAYGROUND_MIME_TYPES: joinPaths(
		process.cwd(),
		'packages/php-wasm/universal/src/lib/mime-types.json'
	),
};
const fixture = { release: '' };
let installed = false;
let preparedRelease: string | undefined;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
	if (!original)
		throw new Error(
			'Set PLAYGROUND_PRE_RELEASE_BUILD to the extracted artifact from run 42856256223.'
		);
	await rm(work, { recursive: true, force: true });
	await mkdir(work, { recursive: true });
	const inventory = JSON.parse(
		await readFile(joinPaths(assets, 'inventory.json'), 'utf8')
	);
	for (const [path, asset] of Object.entries(inventory.files) as [
		string,
		{ sha256: string },
	][]) {
		expect(
			createHash('sha256')
				.update(await readFile(joinPaths(original, path)))
				.digest('hex')
		).toBe(asset.sha256);
	}
	await cp(root, joinPaths(work, 'pristine'), { recursive: true });
	installed = true;
	fixture.release = JSON.parse(
		await readFile(joinPaths(root, 'release.json'), 'utf8')
	).release;
	await cp(
		joinPaths(root, `releases/${fixture.release}`),
		joinPaths(work, 'new-build'),
		{ recursive: true }
	);
	await cp(
		joinPaths(root, `.playground-releases/${fixture.release}/files`),
		joinPaths(work, 'new-build'),
		{ recursive: true }
	);
	// Use the actual historical installer too. Its WP Cloud network probes and
	// edge purge are stubbed locally; all file operations and routing are real.
	for (const path of [
		'apply-update.sh',
		'custom-redirects-lib.php',
		'__wp__/index.php',
	]) {
		const destination = joinPaths(work, 'old-deployment', path);
		await mkdir(dirname(destination), { recursive: true });
		let source = (
			await run('git', [
				'show',
				`${commit}:packages/playground/website-deployment/${path}`,
			])
		).stdout;
		// The historical installer predates loopback mode; allow HTTP only in this frozen test copy.
		if (path === 'apply-update.sh')
			source = source.replace('!== "https"', '!== "http"');
		await writeFile(destination, source);
	}
	await cp(
		env.PLAYGROUND_MIME_TYPES,
		joinPaths(work, 'old-deployment/mime-types.json')
	);
	await mkdir(joinPaths(work, 'bin'));
	await writeFile(
		joinPaths(work, 'bin/curl'),
		'#!/bin/bash\ncase "$*" in *-X*) ;; *sw.js*) printf 200 ;; *) printf 403 ;; esac\n',
		{ mode: 0o755 }
	);
});

test.afterEach(async () => {
	if (!installed) return;
	await rm(root, { recursive: true, force: true });
	await cp(joinPaths(work, 'pristine'), root, { recursive: true });
});

for (const cache of ['cold', 'warm']) {
	test(`an actual old app recovers its delayed bridge with ${cache} caches and failed worker updates`, async ({
		page,
		context,
		browserName,
	}) => {
		page.on('pageerror', (error) =>
			console.info('Browser error:', error.message)
		);
		await rm(root, { recursive: true });
		await mkdir(root);
		await rm(joinPaths(work, 'backups'), { recursive: true, force: true });
		const upload = joinPaths(work, 'old-upload');
		await rm(upload, { recursive: true, force: true });
		await cp(original!, upload, { recursive: true });
		await replaceLiterals(upload, [
			['https://playground.wordpress.net', appOrigin],
			['https://wpsandbox.wordpress.net', wordPressOrigin],
		]);
		await writeFile(
			joinPaths(upload, '__seed.html'),
			`<!doctype html><iframe src="${wordPressOrigin}/__seed.html"></iframe>`
		);
		await writeFile(
			joinPaths(upload, 'wordpress-sandbox/__seed.html'),
			'<!doctype html><title>Worker seed</title>'
		);
		await run(
			'bash',
			[
				joinPaths(work, 'old-deployment/apply-update.sh'),
				appOrigin,
				wordPressOrigin,
				upload,
				root,
				joinPaths(work, 'backups'),
			],
			{
				env: {
					...env,
					PATH: `${joinPaths(work, 'bin')}:${process.env.PATH}`,
					SITE_API_BASE: 'https://fixture.invalid',
					ATOMIC_SITE_API_KEY: 'fixture',
					ATOMIC_SITE_ID: 'fixture',
				},
			}
		);
		await page.goto(appOrigin + '/__seed.html');
		const seed = page
			.frames()
			.find((frame) => frame.url() === wordPressOrigin + '/__seed.html')!;
		await seed.evaluate(async () => {
			await navigator.serviceWorker.register('/sw.js', {
				type: 'module',
				updateViaCache: 'none',
			});
			await navigator.serviceWorker.ready;
		});
		if (cache === 'warm') {
			await page.goto(appOrigin + '/?wp=6.9&php=8.3&storage=temp');
			await page.waitForFunction(() =>
				Boolean((window as any).playgroundSites)
			);
			await page.evaluate(() =>
				(window as any).playgroundSites.isReady()
			);
		}
		// Stage the large upload before starting the old app's 30-second bridge budget.
		await prepareUpload(fixture.release);
		await context.addInitScript(() => {
			const descriptor = Object.getOwnPropertyDescriptor(
				HTMLIFrameElement.prototype,
				'src'
			)!;
			Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
				...descriptor,
				set(value: string) {
					if (value.includes('/wordpress-bridge-')) {
						(window as any).heldBridge = {
							element: this,
							value,
							release: () => descriptor.set!.call(this, value),
						};
					} else descriptor.set!.call(this, value);
				},
			});
		});
		await page.goto(appOrigin + '/?wp=6.9&php=8.3&storage=temp');
		let remote: Frame | undefined;
		await expect
			.poll(async () => {
				for (const frame of page.frames()) {
					if (
						await frame
							.evaluate(() => Boolean((window as any).heldBridge))
							.catch(() => false)
					)
						remote = frame;
				}
				return Boolean(remote);
			})
			.toBe(true);
		await deploy(fixture.release);
		// Deliberately break the update script after installation. This is a
		// simulated startup failure, not a reproduction of the reporter's Chrome bug.
		await writeFile(
			joinPaths(root, 'sw.js'),
			'throw new Error("Injected service worker update failure");'
		);
		const script =
			cache === 'cold'
				? page.waitForEvent('requestfailed', {
						predicate: (request) =>
							request.url() === appOrigin + scriptPath,
						timeout: 15000,
					})
				: page.waitForResponse(appOrigin + scriptPath, {
						timeout: 15000,
					});
		const generated = page.waitForResponse(
			(response) => new URL(response.url()).pathname === bridgePath,
			{ timeout: 15000 }
		);
		await remote!.evaluate(() => (window as any).heldBridge.release());
		expect(await (await generated).text()).toContain(scriptPath);
		// Compare with HTTP directly: the old worker names the obsolete script,
		// whereas the installed router serves the current bridge. Firefox's BiDi
		// transport does not reliably mark response.fromServiceWorker().
		expect(
			await (await page.request.get(wordPressOrigin + bridgePath)).text()
		).not.toContain(scriptPath);
		await script;
		expect((await page.request.get(appOrigin + scriptPath)).status()).toBe(
			404
		);
		await restoreAssets();
		// A warm HTTP cache already has the original module. Cold clients need the
		// restored URL and an explicit retry; the actual old app document stays open.
		if (cache === 'cold')
			await remote!.evaluate(() => {
				const held = (window as any).heldBridge;
				held.release();
				held.element.contentWindow.location.replace(
					held.value + '&restored=1'
				);
			});
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites)
		);
		await page.evaluate(() => (window as any).playgroundSites.isReady());
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.writeFile(
					'/wordpress/restored.txt',
					'old PHP is still connected'
				)
		);
		const wordpress = page
			.frames()
			.find((frame) =>
				frame.url().startsWith(wordPressOrigin + '/scope:')
			)!;
		expect(
			await wordpress.evaluate(async () =>
				(await fetch('restored.txt')).text()
			)
		).toBe('old PHP is still connected');
		expect(
			await wordpress.evaluate(async () => {
				const registration =
					await navigator.serviceWorker.getRegistration('/');
				try {
					await registration!.update();
					return false;
				} catch {
					return true;
				}
			})
		).toBe(true);
		await checkAssets(page);
		await deploy(fixture.release + '-next');
		await checkAssets(page);
		await run(
			'bash',
			[
				joinPaths(deployment, 'apply-update.sh'),
				root,
				joinPaths(work, 'backups'),
			],
			{ env: { ...env, PLAYGROUND_ROLLBACK: 'previous' } }
		);
		await checkAssets(page);
		expect(
			await wordpress.evaluate(async () =>
				(await fetch('restored.txt')).text()
			)
		).toBe('old PHP is still connected');
		// Also roll back the first release-directory installation to the historical
		// private layout. Compatibility root files are independent of both snapshots.
		await run(
			'bash',
			[
				joinPaths(deployment, 'apply-update.sh'),
				root,
				joinPaths(work, 'backups'),
			],
			{
				env: { ...env, PLAYGROUND_ROLLBACK: 'previous' },
			}
		);
		await checkAssets(page);
		expect(
			await wordpress.evaluate(async () =>
				(await fetch('restored.txt')).text()
			)
		).toBe('old PHP is still connected');
		for (const origin of [appOrigin, wordPressOrigin]) {
			expect([403, 404]).toContain(
				(
					await page.request.get(
						`${origin}/.playground-releases/${fixture.release}/files/oauth.php`
					)
				).status()
			);
		}
		expect(
			(await page.request.get(wordPressOrigin + '/oauth.php')).status()
		).toBe(404);
		await page.screenshot({
			path: joinPaths(
				process.cwd(),
				`.context/${browserName}-${cache}-restored.png`
			),
		});
	});
}

async function deploy(id: string) {
	if (preparedRelease !== id) await prepareUpload(id);
	const upload = joinPaths(work, 'upload');
	await run(
		'bash',
		[
			joinPaths(deployment, 'apply-update.sh'),
			appOrigin,
			wordPressOrigin,
			upload,
			root,
			joinPaths(work, 'backups'),
		],
		{ env: { ...env, PLAYGROUND_RELEASE_ID: id } }
	);
	preparedRelease = undefined;
}

async function prepareUpload(id: string) {
	const upload = joinPaths(work, 'upload');
	await rm(upload, { recursive: true, force: true });
	await cp(joinPaths(work, 'new-build'), upload, { recursive: true });
	if (id !== fixture.release)
		await replaceLiterals(upload, [[fixture.release, id]]);
	preparedRelease = id;
}

async function restoreAssets() {
	await run(
		'bash',
		[
			joinPaths(deployment, 'apply-update.sh'),
			appOrigin,
			wordPressOrigin,
			assets,
			root,
			joinPaths(work, 'backups'),
		],
		{
			env: {
				...env,
				PLAYGROUND_RESTORE_STATIC_ASSETS: joinPaths(
					assets,
					'inventory.json'
				),
			},
		}
	);
}

async function checkAssets(page: Page) {
	const inventory = JSON.parse(
		await readFile(joinPaths(assets, 'inventory.json'), 'utf8')
	);
	for (const origin of [appOrigin, wordPressOrigin]) {
		for (const [path, asset] of Object.entries(inventory.files) as [
			string,
			{ sha256: string },
		][]) {
			const response = await page.request.get(`${origin}/${path}`);
			expect(response.status()).toBe(200);
			expect(response.headers()['content-type']).toMatch(/javascript/);
			expect(response.headers()['access-control-allow-origin']).toBe('*');
			expect(
				createHash('sha256')
					.update(await response.body())
					.digest('hex')
			).toBe(asset.sha256);
		}
	}
	// Execute a deferred module after deployment, including its original import.
	await page.evaluate(async (path) => {
		await import(path);
	}, '/assets/modulepreload-polyfill-B5Qt9EMX.js?after-transition=' + Date.now());
}

async function replaceLiterals(directory: string, replacements: string[][]) {
	for (const entry of await readdir(directory, {
		withFileTypes: true,
		recursive: true,
	})) {
		if (
			!entry.isFile() ||
			(!entry.name.endsWith('.js') && !entry.name.endsWith('.html'))
		)
			continue;
		if (entry.name === 'wordpress-bridge-Cmo7aZBy.js') continue;
		const path = joinPaths(entry.parentPath, entry.name);
		const source = await readFile(path, 'utf8');
		let updated = source;
		for (const [from, to] of replacements)
			updated = updated.replaceAll(from, to);
		if (updated !== source) await writeFile(path, updated);
	}
}
