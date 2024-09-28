import { test, expect } from '../playground-fixtures.ts';
import { spawn } from 'child_process';

test('should load the new website version upon a regular page refresh', async ({
	website,
	page,
}) => {
	let cp = spawn('python', ['-m', 'http.server', '8000'], {
		cwd: 'dist/packages/playground/wasm-wordpress-net-old',
	});

	await page.waitForTimeout(1000);
	await page.goto('http://localhost:8000');
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-old.png');

	cp.kill();

	cp = spawn('python', ['-m', 'http.server', '8000'], {
		cwd: 'dist/packages/playground/wasm-wordpress-net-new',
	});

	await page.waitForTimeout(1000);
	// The first reload will bring up everything from the offline cache
	await page.reload();
	await page.reload();
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-new.png');

	cp.kill();

	await page.waitForTimeout(1000);
	await page.goto('http://localhost:8000');
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-new.png');
});

test('should use the offline assets when the server goes offline', async ({
	website,
	page,
}) => {
	const cp = spawn('python', ['-m', 'http.server', '8001'], {
		cwd: 'dist/packages/playground/wasm-wordpress-net-new',
	});

	await page.waitForTimeout(1000);
	await page.goto('http://localhost:8001');
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-online.png');

	cp.kill();

	await page.waitForTimeout(1000);
	await page.goto('http://localhost:8001');
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-online.png', {
		maxDiffPixels: 100,
	});
});
