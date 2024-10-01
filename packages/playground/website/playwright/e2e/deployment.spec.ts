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

const startServer = async (page, path: string): Promise<Server> => {
	const server = http.createServer((req, res) => {
		return serveHandler(req, res, {
			public: path,
		});
	});
	type ListeningServer = ReturnType<typeof server.listen>;
	const listeningServer = await new Promise<ListeningServer>((resolve) => {
		const result = server.listen({ host, port }, () => resolve(result));
	});

	await page.waitForTimeout(1000);
	console.log('Started server', path);
	return {
		kill: () => {
			return new Promise<void>((resolve) => {
				listeningServer.close(() => {
					resolve();
					console.log('Killed server', path);
				});
				listeningServer.closeAllConnections();
			});
		},
	};
};

const startOldWebsiteServer = async (page) => {
	return startServer(page, 'dist/packages/playground/wasm-wordpress-net-old');
};

const startNewWebsiteServer = async (page) => {
	return startServer(page, 'dist/packages/playground/wasm-wordpress-net-new');
};

test('When a new website version is deployed, it should be loaded upon a regular page refresh', async ({
	website,
	page,
}) => {
	let server: Server | null = null;
	try {
		server = await startOldWebsiteServer(page);
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-old-chromium-darwin.png', {
			maxDiffPixels,
		});

		await server.kill();

		server = await startNewWebsiteServer(page);
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-new-chromium-darwin.png', {
			maxDiffPixels,
		});
	} finally {
		if (server) {
			await server.kill();
		}
	}
});

test(
	'When a new website version is deployed while the old version is still opened in two browser tabs, ' +
		'both tabs should be upgraded to the new app version upon a regular page refresh',
	async ({ website, page, browser }) => {
		let server: Server | null = null;
		try {
			server = await startOldWebsiteServer(page);
			await page.goto(url);
			await website.waitForNestedIframes();
			await expect(page).toHaveScreenshot(
				'website-old-chromium-darwin.png',
				{
					maxDiffPixels,
				}
			);

			const page2 = await browser.newPage();
			await page2.goto(url);
			await website.waitForNestedIframes(page2);
			await expect(page2).toHaveScreenshot(
				'website-old-chromium-darwin.png',
				{
					maxDiffPixels,
				}
			);

			await server.kill();

			server = await startNewWebsiteServer(page);
			await page.reload();
			await website.waitForNestedIframes(page);
			// @TODO a better check – screenshot comparison will be annoying to maintain
			await expect(page).toHaveScreenshot(
				'website-new-chromium-darwin.png',
				{
					maxDiffPixels,
				}
			);

			await website.waitForNestedIframes(page2);
			await expect(page2).toHaveScreenshot(
				'website-new-chromium-darwin.png',
				{
					maxDiffPixels,
				}
			);
		} finally {
			if (server) {
				await server.kill();
			}
		}
	}
);

test('offline mode – the app should load even when the server goes offline', async ({
	website,
	page,
}) => {
	let server: Server | null = null;
	try {
		server = await startNewWebsiteServer(page);
		await page.goto(url);
		await website.waitForNestedIframes();
		// @TODO a better check – screenshot comparison will be annoying to maintain
		await expect(page).toHaveScreenshot(
			'website-online-chromium-darwin.png',
			{
				maxDiffPixels,
			}
		);

		await server.kill();

		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot(
			'website-online-chromium-darwin.png',
			{
				maxDiffPixels,
			}
		);
	} finally {
		if (server) {
			await server.kill();
		}
	}
});
