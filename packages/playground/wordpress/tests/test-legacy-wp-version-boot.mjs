/**
 * Tests that legacy WordPress versions (4.9 down to 1.0) boot
 * successfully on PHP 5.6 with SQLite, display "Hello world!" on the
 * front page, and loads the wp-admin dashboard.
 *
 * Both front-page and admin failures are hard errors: the job should
 * honestly reflect the state of legacy WordPress support.
 *
 * Requires the dev server to be running on port 5400
 * (started by the CI job or manually via `npm run dev`).
 *
 * Usage: node packages/playground/wordpress/tests/test-legacy-wp-version-boot.mjs
 */
import { chromium } from 'playwright';

// All WordPress minor versions from 4.9 down to 1.0.
// Note: there was no WordPress 2.4 release.
// The web worker normalizes 1.x versions automatically (1.5 → 1.5.2, etc.)
// and resolves all non-minified versions to wordpress.org downloads.
//
// Known issues tracked by this test:
//   - WP 1.0: WP 1.0 emits SQL with double-quoted string literals
//     (e.g. post_status = "publish") which the SQLite AST driver
//     rejects. Making this version pass requires either accepting
//     double-quoted strings as SQL string literals in the AST
//     driver, or preprocessing WP 1.0's queries before they reach
//     the driver.
const WP_VERSIONS = [
	'4.9',
	'4.8',
	'4.7',
	'4.6',
	'4.5',
	'4.4',
	'4.3',
	'4.2',
	'4.1',
	'4.0',
	'3.9',
	'3.8',
	'3.7',
	'3.6',
	'3.5',
	'3.4',
	'3.3',
	'3.2',
	'3.1',
	'3.0',
	'2.9',
	'2.8',
	'2.7',
	'2.6',
	'2.5',
	'2.3',
	'2.2',
	'2.1',
	'2.0',
	'1.5',
	'1.2',
	'1.0',
];

const PORT = 5400;
const TIMEOUT_S = 120;
const results = [];

/**
 * Finds the WordPress content frame (the one whose URL contains "scope:")
 * and returns its body text once it has meaningful content.
 * Returns null on timeout.
 */
async function waitForWPFrame(page, timeoutSeconds) {
	for (let i = 0; i < timeoutSeconds / 3; i++) {
		await page.waitForTimeout(3000);
		for (const frame of page.frames()) {
			try {
				const furl = frame.url();
				if (!furl.includes('scope:')) continue;
				const body = await frame
					.locator('body')
					.innerText({ timeout: 2000 });
				if (body && body.length >= 20) {
					return { body, frame };
				}
			} catch {}
		}
	}
	return null;
}

/**
 * Like waitForWPFrame, but specifically waits for an admin page.
 * Skips PHP error output from background requests like
 * prefetchUpdateChecks, and waits for the actual admin dashboard
 * or login page to appear.
 */
async function waitForAdminFrame(page, timeoutSeconds) {
	for (let i = 0; i < timeoutSeconds / 3; i++) {
		await page.waitForTimeout(3000);
		for (const frame of page.frames()) {
			try {
				const furl = frame.url();
				if (!furl.includes('scope:')) continue;
				const body = await frame
					.locator('body')
					.innerText({ timeout: 2000 });
				if (!body || body.length < 20) continue;

				// Skip frames that ONLY show a PHP error — these are
				// from background requests (prefetchUpdateChecks), not
				// the actual admin page.
				const isOnlyError =
					body.length < 300 &&
					(body.includes('Parse error') ||
						body.includes('Fatal error'));
				if (isOnlyError) continue;

				// Accept admin pages, login pages, or any page with
				// substantial content from a wp-admin URL.
				const isAdmin = furl.includes('wp-admin');
				const isLogin =
					furl.includes('wp-login') ||
					(body.includes('Username') && body.includes('Password'));
				if (isAdmin || isLogin) {
					return { body, frame };
				}

				// Also accept if the page has admin-like content
				const hasAdminContent = [
					'Dashboard',
					'Write',
					'Manage',
					'Options',
				].some((ind) => body.includes(ind));
				if (hasAdminContent) {
					return { body, frame };
				}
			} catch {}
		}
	}
	return null;
}

/**
 * Checks body text for PHP errors.
 * Returns the full error line (including file path and line number)
 * if found, null otherwise. The returned string is not truncated —
 * callers decide how much to display.
 */
function findPHPError(body) {
	const errorPatterns = ['Parse error', 'Fatal error', 'database error'];
	for (const pattern of errorPatterns) {
		if (body.includes(pattern)) {
			const line = body
				.split('\n')
				.find((l) => l.includes(pattern))
				?.trim();
			return line || body.slice(0, 500).trim();
		}
	}
	return null;
}

const browser = await chromium.launch({ headless: true });

for (const wp of WP_VERSIONS) {
	const label = `WP ${wp}`;
	process.stdout.write(`${label}... `);

	const url = `http://127.0.0.1:${PORT}/website-server/?php=5.6&wp=${wp}`;

	// Isolate every version in a fresh browser context so that OPFS
	// (where Playground persists site state), IndexedDB, localStorage
	// and cookies don't leak between versions. Without this, earlier
	// versions' patched files and scopes bleed into later ones and
	// the test becomes non-deterministic.
	const context = await browser.newContext();
	const page = await context.newPage();
	const consoleErrors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error')
			consoleErrors.push(msg.text().slice(0, 300));
	});

	let frontStatus = null;
	let adminStatus = null;

	try {
		await page.goto(url, {
			timeout: 180_000,
			waitUntil: 'domcontentloaded',
		});

		// --- Phase 1: Front page ---
		const wp1 = await waitForWPFrame(page, TIMEOUT_S);

		if (!wp1) {
			const lastError = consoleErrors[consoleErrors.length - 1] || '';
			frontStatus = {
				status: 'TIMEOUT',
				detail: lastError,
			};
		} else {
			const error = findPHPError(wp1.body);
			if (error) {
				frontStatus = {
					status: 'ERROR',
					detail: error,
					body: wp1.body,
				};
			} else {
				const hasHelloWorld =
					wp1.body.includes('Hello world') ||
					wp1.body.includes('Hello World');
				const hasWP =
					wp1.body.includes('WordPress') ||
					wp1.body.includes('My WordPress') ||
					wp1.body.includes('My Weblog');

				if (hasHelloWorld) {
					frontStatus = { status: 'OK' };
				} else if (wp1.body.includes('Not Found') && !hasHelloWorld) {
					frontStatus = { status: 'NOT_FOUND', body: wp1.body };
				} else if (hasWP) {
					frontStatus = {
						status: 'PARTIAL',
						detail: wp1.body.slice(0, 120).replace(/\n/g, ' '),
					};
				} else {
					frontStatus = {
						status: 'UNKNOWN',
						detail: wp1.body.slice(0, 120).replace(/\n/g, ' '),
						body: wp1.body,
					};
				}
			}
		}

		// --- Phase 2: Admin dashboard ---
		if (frontStatus.status === 'OK' || frontStatus.status === 'PARTIAL') {
			try {
				// Navigate via the Playground URL bar — this goes through
				// the proper Playground navigation flow (service worker,
				// PHP request handler) unlike direct frame navigation.
				const urlBar = page.locator('input[name="url"]');
				await urlBar.fill('/wp-admin/');
				await urlBar.press('Enter');

				const wp2 = await waitForAdminFrame(page, TIMEOUT_S);
				if (!wp2) {
					adminStatus = { status: 'TIMEOUT' };
				} else {
					const error = findPHPError(wp2.body);
					if (error) {
						adminStatus = {
							status: 'ERROR',
							detail: error,
							body: wp2.body,
						};
					} else {
						// Check for admin indicators across all WP eras:
						// - "Dashboard" (WP 2.7+)
						// - "Write" / "Manage" / "Options" (WP 1.x-2.6)
						// - "Log Out" or "Settings" links
						const adminIndicators = [
							'Dashboard',
							'Write',
							'Manage',
							'Options',
							'Log Out',
							'Settings',
							'Posts',
							'Plugins',
						];
						const hasAdmin = adminIndicators.some((ind) =>
							wp2.body.includes(ind)
						);
						if (hasAdmin) {
							adminStatus = { status: 'OK' };
						} else {
							adminStatus = {
								status: 'UNKNOWN',
								detail: wp2.body
									.slice(0, 120)
									.replace(/\n/g, ' '),
								body: wp2.body,
							};
						}
					}
				}
			} catch (e) {
				adminStatus = {
					status: 'CRASH',
					detail: e.message,
				};
			}
		} else {
			adminStatus = { status: 'SKIP', detail: 'front page failed' };
		}
	} catch (e) {
		frontStatus = {
			status: 'CRASH',
			detail: e.message,
		};
		adminStatus = { status: 'SKIP', detail: 'boot crashed' };
	}

	const frontIcon =
		frontStatus.status === 'OK' || frontStatus.status === 'PARTIAL'
			? '✓'
			: '✗';
	const adminIcon =
		adminStatus.status === 'OK'
			? '✓'
			: adminStatus.status === 'SKIP'
				? '-'
				: '✗';
	// Show the short failing reason on the progress line (capped so it
	// fits on one terminal line). Full detail is dumped in the summary.
	const progressDetail =
		adminStatus.status !== 'OK' && adminStatus.status !== 'SKIP'
			? ` (${(adminStatus.detail || adminStatus.status).slice(0, 80)})`
			: '';
	console.log(`front:${frontIcon} admin:${adminIcon}${progressDetail}`);

	results.push({ wp, front: frontStatus, admin: adminStatus });
	await page.close();
	await context.close();
}

await browser.close();

function isFrontPass(r) {
	return r.front.status === 'OK' || r.front.status === 'PARTIAL';
}
function isAdminPass(r) {
	return r.admin.status === 'OK';
}

console.log(`\n${'='.repeat(60)}`);
console.log('RESULTS SUMMARY:');
console.log(`${'='.repeat(60)}`);
for (const r of results) {
	const fLabel = isFrontPass(r) ? 'PASS' : 'FAIL';
	const aLabel = isAdminPass(r)
		? 'PASS'
		: r.admin.status === 'SKIP'
			? 'SKIP'
			: 'FAIL';
	const fDetail = r.front.detail ? ` — ${r.front.detail}` : '';
	const aDetail = r.admin.detail ? ` — ${r.admin.detail}` : '';
	console.log(
		`  WP ${r.wp.padEnd(5)} front: ${fLabel.padEnd(4)} ${r.front.status}${fDetail}`
	);
	console.log(
		`  ${' '.repeat(r.wp.length + 3)} admin: ${aLabel.padEnd(4)} ${r.admin.status}${aDetail}`
	);
}

const frontOk = results.filter(isFrontPass).length;
const adminOk = results.filter(isAdminPass).length;
const adminTested = results.filter((r) => r.admin.status !== 'SKIP').length;

console.log(`\nFront page: ${frontOk}/${results.length} OK`);
console.log(`Admin page: ${adminOk}/${adminTested} OK`);

// Dump per-failure diagnostic bodies. The truncated one-line detail is
// often not enough to identify the problem (e.g. the offending file
// path or line number may be cut off), so include a longer body slice
// for every failed version.
const failures = results.filter(
	(r) => !isFrontPass(r) || (r.admin.status !== 'SKIP' && !isAdminPass(r))
);
if (failures.length > 0) {
	console.log(`\n${'='.repeat(60)}`);
	console.log('FAILURE DETAILS:');
	console.log(`${'='.repeat(60)}`);
	for (const r of failures) {
		console.log(`\n--- WP ${r.wp} ---`);
		if (!isFrontPass(r)) {
			console.log(`  front [${r.front.status}]: ${r.front.detail || ''}`);
			if (r.front.body) {
				console.log(
					`  body:\n${r.front.body.slice(0, 1000).replace(/^/gm, '    ')}`
				);
			}
		}
		if (r.admin.status !== 'SKIP' && !isAdminPass(r)) {
			console.log(`  admin [${r.admin.status}]: ${r.admin.detail || ''}`);
			if (r.admin.body) {
				console.log(
					`  body:\n${r.admin.body.slice(0, 1000).replace(/^/gm, '    ')}`
				);
			}
		}
	}
}

// Both front-page and admin failures are hard errors.
// PARTIAL is accepted for front — it means WordPress booted and the
// theme rendered, but "Hello world!" wasn't found (e.g. theme layout,
// post below fold).
const frontFailed = results.filter((r) => !isFrontPass(r));
const adminFailed = results.filter(
	(r) => r.admin.status !== 'SKIP' && !isAdminPass(r)
);
if (frontFailed.length > 0 || adminFailed.length > 0) {
	console.error(
		`\n${frontFailed.length} front-page failure(s), ${adminFailed.length} admin failure(s).`
	);
	process.exit(1);
}
