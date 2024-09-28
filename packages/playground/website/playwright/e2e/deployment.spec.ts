import { test, expect } from '../playground-fixtures.ts';
import { ChildProcess, spawn } from 'child_process';

const host = 'localhost';
const port = '7999';
const url = `http://${host}:${port}`;

test('When a new website version is deployed, it should be loaded upon a regular page refresh', async ({
	website,
	page,
}) => {
	let cp: ChildProcess | null = null;
	try {
		cp = spawn('python', ['-m', 'http.server', port], {
			cwd: 'dist/packages/playground/wasm-wordpress-net-old',
		});
		const killed = new Promise((resolve) => {
			cp!.on('close', () => {
				resolve(null);
			});
		});

		await page.waitForTimeout(1000);
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-old.png');

		cp.kill();
		await killed;

		cp = spawn('python', ['-m', 'http.server', port], {
			cwd: 'dist/packages/playground/wasm-wordpress-net-new',
		});

		await page.waitForTimeout(2000);
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-new.png', {
			maxDiffPixels: 1500,
		});
	} finally {
		if (cp) {
			cp.kill();
		}
	}
});

test(
	'When a new website version is deployed while the old version is still opened in two browser tabs, ' +
		'both tabs should be upgraded to the new app version upon a regular page refresh',
	async ({ website, page, browser }) => {
		let cp: ChildProcess | null = null;
		try {
			cp = spawn('python', ['-m', 'http.server', port], {
				cwd: 'dist/packages/playground/wasm-wordpress-net-old',
			});

			await page.waitForTimeout(1000);
			await page.goto(url);
			await website.waitForNestedIframes();
			await expect(page).toHaveScreenshot('website-old.png');

			const page2 = await browser.newPage();
			await page2.goto(url);
			await website.waitForNestedIframes(page2);
			await expect(page2).toHaveScreenshot('website-old.png');

			cp.kill();

			cp = spawn('python', ['-m', 'http.server', port], {
				cwd: 'dist/packages/playground/wasm-wordpress-net-new',
			});

			await page.waitForTimeout(1000);
			await page.reload();
			await website.waitForNestedIframes(page);
			// @TODO a better check – screenshot comparison will be annoying to maintain
			await expect(page).toHaveScreenshot('website-new.png', {
				maxDiffPixels: 1500,
			});

			await website.waitForNestedIframes(page2);
			await expect(page2).toHaveScreenshot('website-new.png', {
				maxDiffPixels: 1500,
			});
		} finally {
			if (cp) {
				cp.kill();
			}
		}
	}
);

test('offline mode – the app should load even when the server goes offline', async ({
	website,
	page,
}) => {
	let cp: ChildProcess | null = null;
	try {
		cp = spawn('python', ['-m', 'http.server', port], {
			cwd: 'dist/packages/playground/wasm-wordpress-net-new',
		});

		await page.waitForTimeout(1000);
		await page.goto(url);
		await website.waitForNestedIframes();
		// @TODO a better check – screenshot comparison will be annoying to maintain
		await expect(page).toHaveScreenshot('website-online.png');

		cp.kill();

		await page.waitForTimeout(1000);
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-online.png', {
			maxDiffPixels: 1500,
		});
	} finally {
		if (cp) {
			cp.kill();
		}
	}
});
