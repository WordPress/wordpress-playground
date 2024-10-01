import { test, expect } from '../playground-fixtures.ts';
import { spawn } from 'child_process';

const port = '7993';
const url = `http://localhost:${port}`;

const maxDiffPixels = 4000;
const startServer = async () => {
	const server = spawn(
		'python',
		[
			'server.py',
			port,
			'dist/packages/playground/wasm-wordpress-net-old',
			'dist/packages/playground/wasm-wordpress-net-new',
		],
		{
			cwd: __dirname + '/../../../../../',
		}
	);
	server.stderr.on('data', (data) => {
		console.error(data.toString());
	});
	server.on('close', (code) => {
		console.log(`Server exited with code ${code}`);
	});
	await new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve(null);
		}, 1000);
	});
	let killed = false;
	return {
		kill: () => {
			if (killed) {
				return;
			}
			killed = true;
			server.kill();
		},
	};
};

let server: { kill: () => void } | null = null;

test.beforeEach(async () => {
	server = await startServer();
});

test.afterEach(async () => {
	if (server) {
		server.kill();
	}
});

for (const cachingEnabled of [true, false]) {
	test(`When a new website version is deployed, it should be loaded upon a regular page refresh (with HTTP caching ${
		cachingEnabled ? 'enabled' : 'disabled'
	})`, async ({ website, page }) => {
		await page.goto(`${url}/switch-to-old-version`);
		if (cachingEnabled) {
			await page.goto(`${url}/enable-http-cache`);
			await expect(page.locator('body').textContent()).resolves.toBe(
				'HTTP cache enabled'
			);
		} else {
			await page.goto(`${url}/disable-http-cache`);
			await expect(page.locator('body').textContent()).resolves.toBe(
				'HTTP cache disabled'
			);
		}
		await page.goto(url);
		await website.waitForNestedIframes();

		await expect(page).toHaveScreenshot('website-old-chromium-darwin.png', {
			maxDiffPixels,
		});

		await page.goto(`${url}?switch-to-new-version`);
		await expect(page.locator('body')).toContainText('Your Playgrounds');
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-new-chromium-darwin.png', {
			maxDiffPixels,
		});
	});
}

test(
	'When a new website version is deployed while the old version is still opened in two browser tabs, ' +
		'both tabs should be upgraded to the new app version upon a regular page refresh',
	async ({ website, page, browser }) => {
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-old-chromium-darwin.png', {
			maxDiffPixels,
		});

		const page2 = await browser.newPage();
		await page2.goto(url);
		await website.waitForNestedIframes(page2);
		await expect(page2).toHaveScreenshot(
			'website-old-chromium-darwin.png',
			{
				maxDiffPixels,
			}
		);

		await page.goto(`${url}?switch-to-new-version`);
		await website.waitForNestedIframes(page);

		await expect(page).toHaveScreenshot('website-new-chromium-darwin.png', {
			maxDiffPixels,
		});

		await website.waitForNestedIframes(page2);
		await expect(page2).toHaveScreenshot(
			'website-new-chromium-darwin.png',
			{
				maxDiffPixels,
			}
		);
	}
);

test('offline mode – the app should load even when the server goes offline', async ({
	website,
	page,
}) => {
	await page.goto(`${url}/switch-to-new-version`);
	await expect(page.locator('body')).toContainText(
		'Switched to the new version'
	);
	await page.goto(`${url}`);
	await website.waitForNestedIframes();
	// @TODO a better check – screenshot comparisons will be annoying to maintain
	await expect(page).toHaveScreenshot('website-online-chromium-darwin.png', {
		maxDiffPixels,
	});

	server!.kill();
	await page.reload();
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-online-chromium-darwin.png', {
		maxDiffPixels,
	});
});
