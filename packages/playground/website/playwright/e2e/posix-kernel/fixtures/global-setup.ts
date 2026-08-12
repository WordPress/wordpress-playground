/**
 * Playwright globalSetup for the experimental posix-kernel e2e suite.
 *
 * Boots the website ONCE against the already-running dev server (the
 * `webServer` plugin starts before globalSetup), drives the WordPress
 * installer to completion, reads the installed SQLite database back out of
 * the kernel, and writes it to disk. Every test then boots from that one
 * snapshot instead of re-running the CPU-heavy installer — the fix for the
 * CI cold-boot starvation cascade.
 *
 * This navigation deliberately does NOT carry the `preinstalledDb` query
 * param, so it always performs a real install. The capture itself is
 * best-effort: if it fails, we log and continue — the tests still boot,
 * they just fall back to the per-test installer (the kernel worker treats a
 * missing snapshot as non-fatal).
 */
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect, firefox, webkit } from '@playwright/test';
import type { Browser, BrowserType } from '@playwright/test';
import {
	PREINSTALLED_DB_CACHE_DIR,
	PREINSTALLED_DB_FILENAME,
	PREINSTALLED_VFS_FILENAME,
} from './preinstalled-db';

const BOOT_TIMEOUT_MS = 240_000;

// Resolved from this file's own directory (Playwright compiles setup files
// to CommonJS in place, so `__dirname` is the real
// `e2e/posix-kernel/fixtures/` dir), hopping up to the `playwright/` dir
// the cache lives under. The Vite middleware resolves the same path from
// its own location.
const PREINSTALLED_DB_FILE = join(
	__dirname,
	'../../..',
	PREINSTALLED_DB_CACHE_DIR,
	PREINSTALLED_DB_FILENAME
);

// Sibling of the DB snapshot: the whole serialized VFS image, rebuilt with
// the just-captured install seeded in. Every test boots from this instead of
// re-extracting WP core + static assets and re-serializing the image.
const PREINSTALLED_VFS_FILE = join(
	__dirname,
	'../../..',
	PREINSTALLED_DB_CACHE_DIR,
	PREINSTALLED_VFS_FILENAME
);

export default async function globalSetup() {
	const baseURL =
		process.env.PLAYWRIGHT_TEST_BASE_URL ||
		'http://127.0.0.1:5400/website-server/';

	// Kernel boot is ~1/3 flaky (SIGSEGV / 240s timeout). A single best-effort
	// boot means a failed capture drops the WHOLE shard to per-test cold boots
	// (~2.7min/test) — slow, flaky, and enough to blow the shard's job-time
	// budget so later tests never run (the shard-3/6 cascade). Retry the
	// boot+capture a few times: 1/3 → ~1/27 failure. The extra cost is only
	// paid when it's already failing (≤ BOOT_TIMEOUT_MS per retry), and a
	// success returns immediately.
	const MAX_ATTEMPTS = 3;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			await captureSnapshots(baseURL);
			return;
		} catch (e) {
			// eslint-disable-next-line no-console
			console.warn(
				`[posix-kernel globalSetup] capture attempt ` +
					`${attempt}/${MAX_ATTEMPTS} failed: ${(e as Error).message}`
			);
		}
	}

	// eslint-disable-next-line no-console
	console.warn(
		`[posix-kernel globalSetup] failed to capture snapshots after ` +
			`${MAX_ATTEMPTS} attempts; tests will fall back to per-boot ` +
			`build + install`
	);
}

async function captureSnapshots(baseURL: string) {
	let browser: Browser | undefined;
	try {
		// Capture in the same browser the shard runs (each shard installs
		// only its own): firefox on the firefox shard, etc.
		const browserType = targetBrowserType();
		browser = await browserType.launch();
		const page = await browser.newPage();
		// Fresh boot, no `preinstalledDb` param → a real install runs.
		// Networking is disabled: the install itself is local (SQLite), but
		// with networking on WordPress phones home during install and the
		// kernel opens a real `ws://playground.internal/` WebSocket. That
		// crashes playwright-core's Firefox WS handler
		// (FFPage._onWebSocketOpened assertion), taking down the whole run.
		const captureUrl = `${baseURL}#${JSON.stringify({
			features: { networking: false },
		})}`;
		await page.goto(captureUrl, { timeout: BOOT_TIMEOUT_MS });

		// Wait until WordPress is installed and rendering: the client is on
		// `window.playground`, and the nested `#wp` iframe body is non-empty
		// only once the site serves a real page (mirrors
		// `WebsitePage.waitForNestedIframes`).
		await page.waitForFunction(
			() => Boolean((window as any).playground),
			null,
			{ timeout: BOOT_TIMEOUT_MS }
		);
		await expect(
			page
				.frameLocator(
					'#playground-viewport:visible,.playground-viewport:visible'
				)
				.frameLocator('#wp')
				.locator('body')
		).not.toBeEmpty({ timeout: BOOT_TIMEOUT_MS });

		// Read both snapshots out of the kernel and base64-encode them so
		// they survive the `page.evaluate` boundary (typed arrays are not
		// structured-cloned back to Node by Playwright). The VFS image is
		// rebuilt in the worker with the just-captured install seeded in, so
		// it is a strict superset of the DB snapshot — every test boots from
		// it and skips the WP-core/static extraction entirely.
		const { dbBase64, vfsBase64 } = await page.evaluate(async () => {
			const toBase64 = (bytes: Uint8Array) => {
				let binary = '';
				const chunkSize = 0x8000;
				for (let i = 0; i < bytes.length; i += chunkSize) {
					binary += String.fromCharCode(
						...bytes.subarray(i, i + chunkSize)
					);
				}
				return btoa(binary);
			};
			const playground = (window as any).playground;
			const dbBytes: Uint8Array =
				await playground.captureInstalledDatabase();
			const vfsBytes: Uint8Array = await playground.captureVfsImage();
			return {
				dbBase64: toBase64(dbBytes),
				vfsBase64: toBase64(vfsBytes),
			};
		});

		await mkdir(dirname(PREINSTALLED_DB_FILE), { recursive: true });

		const dbBytes = Buffer.from(dbBase64, 'base64');
		await writeFile(PREINSTALLED_DB_FILE, dbBytes);
		// eslint-disable-next-line no-console
		console.log(
			`[posix-kernel globalSetup] captured pre-installed database in ` +
				`${browserType.name()} (${dbBytes.length} bytes) → ` +
				`${PREINSTALLED_DB_FILE}`
		);

		const vfsBytes = Buffer.from(vfsBase64, 'base64');
		await writeFile(PREINSTALLED_VFS_FILE, vfsBytes);
		// eslint-disable-next-line no-console
		console.log(
			`[posix-kernel globalSetup] captured prebuilt VFS image in ` +
				`${browserType.name()} (${vfsBytes.length} bytes) → ` +
				`${PREINSTALLED_VFS_FILE}`
		);
	} finally {
		await browser?.close();
	}
}

// The shard's browser, read from the `--project=<browser>` CLI flag (the
// project names match the browser names). `config.projects` is NOT filtered
// by `--project`, so it can't tell us which browser this run targets;
// process.argv can. Defaults to chromium when run without `--project`.
function targetBrowserType(): BrowserType {
	const browserTypes: Record<string, BrowserType> = {
		chromium,
		firefox,
		webkit,
	};
	let projectName: string | undefined;
	const argv = process.argv;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--project=')) {
			projectName = argv[i].slice('--project='.length);
		} else if (argv[i] === '--project') {
			projectName = argv[i + 1];
		}
	}
	return browserTypes[projectName ?? ''] ?? chromium;
}
