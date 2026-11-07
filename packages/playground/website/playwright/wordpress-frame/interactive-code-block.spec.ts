import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fork } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

const test = base.extend<object, { pluginPost: string }>({
	pluginPost: [
		async ({ browserName }, use) => {
			const here = pathToFileURL(__filename);
			const host = fork(
				fileURLToPath(
					new URL(
						'../../bin/wordpress-frame/interactive-code-block-host.mts',
						here
					)
				),
				[appOrigin],
				{
					execArgv: [
						'--experimental-strip-types',
						'--experimental-transform-types',
						'--import',
						fileURLToPath(
							new URL(
								'../../../../meta/src/node-es-module-loader/register.mts',
								here
							)
						),
					],
					stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
				}
			);
			let output = '';
			host.stdout!.on('data', (chunk) => {
				output += chunk;
			});
			host.stderr!.on('data', (chunk) => {
				output += chunk;
			});
			const exited = new Promise<number | null>((resolve) =>
				host.once('exit', resolve)
			);
			try {
				const url = await new Promise<string>((resolve, reject) => {
					host.once('message', (message: { url: string }) =>
						resolve(message.url)
					);
					host.once('error', reject);
					host.once('exit', (code) =>
						reject(
							new Error(
								`${browserName} plugin host exited (${code}):\n${output}`
							)
						)
					);
				});
				await use(url);
			} finally {
				if (host.connected) host.disconnect();
				const timeout = setTimeout(() => host.kill('SIGKILL'), 10000);
				const code = await exited;
				clearTimeout(timeout);
				expect(code, `Plugin host shutdown failed:\n${output}`).toBe(0);
			}
		},
		{ scope: 'worker', timeout: 180000 },
	],
});

// Contract: the released downstream plugin can control its own embedded runtime.
// Origin checks, SDK CORS, and routing can regress independently of the plugin's
// compiled integration. Exercise that integration instead of mocking its RPC calls.
test('the released interactive code block edits, downloads, and opens its Playground', async ({
	page,
	pluginPost,
}) => {
	const productionRequests: string[] = [];
	page.context().on('request', (request) => {
		if (
			['playground.wordpress.net', 'wpsandbox.wordpress.net'].includes(
				new URL(request.url()).hostname
			)
		) {
			productionRequests.push(request.url());
		}
	});
	await page.goto(pluginPost);
	expect(new URL(pluginPost).origin).not.toBe(appOrigin);
	expect(new URL(pluginPost).origin).not.toBe(wordPressOrigin);
	await page
		.getByRole('button', { name: 'Activate Live Preview', exact: true })
		.click();
	const runtime = page.frameLocator('.playground-iframe');
	const wordpress = runtime.frameLocator('#wp');
	await expect(wordpress.locator('#block-integration-marker')).toHaveText(
		'Original plugin output'
	);
	await expectRuntimeOrigins(page);

	const editor = page.locator('.cm-content[contenteditable="true"]');
	const editedCode = (await editor.innerText()).replace(
		'Original plugin output',
		'Edited plugin output'
	);
	await editor.fill(editedCode);
	await page.getByRole('button', { name: 'Run', exact: true }).click();
	await expect(wordpress.locator('#block-integration-marker')).toHaveText(
		'Edited plugin output'
	);

	const downloading = page.waitForEvent('download');
	await page
		.getByRole('button', {
			name: 'Download Code as a Zip file',
			exact: true,
		})
		.click();
	const download = await downloading;
	const zip = new ZipReader(
		new BlobReader(new Blob([await readFile((await download.path())!)]))
	);
	try {
		const entry = (await zip.getEntries()).find(
			(entry) => entry.filename === 'demo.php'
		);
		expect(
			entry,
			'The real plugin ZIP contains the edited PHP file'
		).toBeDefined();
		expect(await entry!.getData!(new TextWriter())).toContain(
			'Edited plugin output'
		);
	} finally {
		await zip.close();
	}

	const opening = page.waitForEvent('popup', { timeout: 10000 });
	await page
		.getByRole('button', { name: 'Open in New Tab', exact: true })
		.press('Enter');
	const fullPage = await opening;
	await fullPage.waitForURL(
		(url) =>
			url.origin === appOrigin &&
			url.pathname === '/playground-block-frame.html'
	);
	await expect(
		fullPage
			.frameLocator('.playground-iframe')
			.frameLocator('#wp')
			.locator('#block-integration-marker')
	).toHaveText('Edited plugin output');
	await expectRuntimeOrigins(fullPage);
	expect(
		productionRequests,
		'All Playground requests must exercise the build under test'
	).toEqual([]);
});

async function expectRuntimeOrigins(page: Page) {
	const runtime = await (await page
		.locator('.playground-iframe')
		.elementHandle())!.contentFrame();
	const wordpress = await (await runtime!
		.locator('#wp')
		.elementHandle())!.contentFrame();
	expect(new URL(runtime!.url()).origin).toBe(appOrigin);
	expect(new URL(wordpress!.url()).origin).toBe(wordPressOrigin);
}
