import { test, expect } from '../playground-fixtures.ts';
import serveHandler from 'serve-handler';
import * as http from 'http';

const host = 'localhost';
const port = 7999;
const url = `http://${host}:${port}`;
const maxDiffPixels = 2000;

type Server = {
	kill: () => Promise<void>;
};

const startServer = async (page): Promise<Server> => {
	const oldVersionDirectory = 'dist/packages/playground/wasm-wordpress-net-old';
	const newVersionDirectory = 'dist/packages/playground/wasm-wordpress-net-new';
	let httpCacheEnabled = true;
	let currentDirectory = oldVersionDirectory;
	const server = http.createServer((req, res) => {
		if (req.url === '/switch-to-new-version') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end('<html><body>Switched to the new version</body></html>');
			currentDirectory = newVersionDirectory;
		} else if (req.url === '/switch-to-old-version') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end('<html><body>Switched to the old version</body></html>');
			currentDirectory = oldVersionDirectory;
		} else if (req.url === '/disable-http-cache') {
			httpCacheEnabled = false;
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end('<html><body>HTTP cache disabled</body></html>');
		} else if (req.url === '/enable-http-cache') {
			httpCacheEnabled = true;
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end('<html><body>HTTP cache enabled</body></html>');
		} else {
			return serveHandler(req, res, {
				public: currentDirectory,
				headers: [
					{
						'Cache-Control': httpCacheEnabled
							? 'max-age=3600'
							: 'no-cache, no-store, must-revalidate',
					},
				],
			});
		}
	});
	type ListeningServer = ReturnType<typeof server.listen>;
	const listeningServer = await new Promise<ListeningServer>((resolve) => {
		const result = server.listen({ host, port }, () => resolve(result));
	});

	await page.waitForTimeout(1000);
	console.log('Started server', currentDirectory);
	return {
		kill: () => {
			return new Promise<void>((resolve) => {
				listeningServer.close(() => {
					resolve();
					console.log('Killed server', currentDirectory);
				});
				listeningServer.closeAllConnections();
			});
		},
	};
};

let server: Server | null = null;
test.beforeAll(async ({ page }) => {
	server = await startServer(page);
});
test.afterAll(async () => {
	if (server) {
		await server.kill();
	}
});

test('When a new website version is deployed, it should be loaded upon a regular page refresh', async ({
	website,
	page,
}) => {
	await page.goto(url);
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-old-chromium-darwin.png', {
		maxDiffPixels,
	});

	await page.goto(`${url}/switch-to-new-version`);
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-new-chromium-darwin.png', {
		maxDiffPixels,
	});
});

// test(
// 	'When a new website version is deployed while the old version is still opened in two browser tabs, ' +
// 		'both tabs should be upgraded to the new app version upon a regular page refresh',
// 	async ({ website, page, browser }) => {
// 		let server: Server | null = null;
// 		try {
// 			server = await startOldWebsiteServer(page);
// 			await page.goto(url);
// 			await website.waitForNestedIframes();
// 			await expect(page).toHaveScreenshot(
// 				'website-old-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);

// 			const page2 = await browser.newPage();
// 			await page2.goto(url);
// 			await website.waitForNestedIframes(page2);
// 			await expect(page2).toHaveScreenshot(
// 				'website-old-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);

// 			await server.kill();

// 			server = await startNewWebsiteServer(page);
// 			await page.reload();
// 			await website.waitForNestedIframes(page);
// 			// @TODO a better check – screenshot comparison will be annoying to maintain
// 			await expect(page).toHaveScreenshot(
// 				'website-new-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);

// 			await website.waitForNestedIframes(page2);
// 			await expect(page2).toHaveScreenshot(
// 				'website-new-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);
// 		} finally {
// 			if (server) {
// 				await server.kill();
// 			}
// 		}
// 	}
// );

// test('offline mode – the app should load even when the server goes offline', async ({
// 	website,
// 	page,
// }) => {
// 	let server: Server | null = null;
// 	try {
// 		server = await startNewWebsiteServer(page);
// 		await page.goto(url);
// 		await website.waitForNestedIframes();
// 		// @TODO a better check – screenshot comparison will be annoying to maintain
// 		await expect(page).toHaveScreenshot(
// 			'website-online-chromium-darwin.png',
// 			{
// 				maxDiffPixels,
// 			}
// 		);

// 		await server.kill();

// 		await page.goto(url);
// 		await website.waitForNestedIframes();
// 		await expect(page).toHaveScreenshot(
// 			'website-online-chromium-darwin.png',
// 			{
// 				maxDiffPixels,
// 			}
// 		);
// 	} finally {
// 		if (server) {
// 			await server.kill();
// 		}
// 	}
// });
