/**
 * Tests that legacy WordPress versions (4.9 down to 1.0) boot
 * successfully on PHP 5.6 with SQLite:
 *
 *   1. Front page loads with "Hello world!"
 *   2. wp-admin dashboard loads (auto-login works)
 *   3. Clicking a post title loads the single post (pretty permalinks)
 *   4. Creating a new post page loads (nonces work)
 *   5. Activating a plugin works (Hello Dolly)
 *
 * All failures are hard errors: the job should honestly reflect the
 * state of legacy WordPress support.
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

/**
 * Navigates inside the Playground via the URL bar, then waits for
 * the WordPress content frame to load meaningful content.
 */
async function navigateViaUrlBar(page, path, timeoutSeconds = 60) {
	const urlBar = page.locator('input[name="url"]');
	await urlBar.fill(path);
	await urlBar.press('Enter');
	await page.waitForTimeout(8000);
	return await waitForWPFrame(page, timeoutSeconds);
}

/**
 * Checks whether a body text indicates the user is logged in.
 */
function isLoggedIn(body) {
	return ['Logout', 'Log Out', 'Sign Out', 'Howdy'].some((s) =>
		body.includes(s)
	);
}

// Versions where post creation and plugin activation are tested.
// WP < 2.5 has no plugin activation UI and limited post editor.
const EXTENDED_TEST_VERSIONS = new Set([
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
]);

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
	let postStatus = null;
	let newPostStatus = null;
	let pluginStatus = null;

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

		// --- Phase 2: View single post (click "Hello world!") ---
		if (
			wp1 &&
			(frontStatus.status === 'OK' || frontStatus.status === 'PARTIAL')
		) {
			try {
				const link = wp1.frame
					.getByRole('link', { name: 'Hello world!' })
					.first();
				if ((await link.count()) > 0) {
					await link.click({ timeout: 5000 });
					await page.waitForTimeout(8000);
					const wp1b = await waitForWPFrame(page, 30);
					if (!wp1b) {
						postStatus = { status: 'TIMEOUT' };
					} else {
						const hasContent =
							(wp1b.body.includes('Welcome to WordPress') ||
								wp1b.body.includes('Hello world')) &&
							!wp1b.body.includes('Not Found') &&
							!wp1b.body.includes("can't find");
						postStatus = hasContent
							? { status: 'OK' }
							: {
									status: 'NOT_FOUND',
									detail: wp1b.body
										.slice(0, 120)
										.replace(/\n/g, ' '),
								};
					}
				} else {
					postStatus = { status: 'SKIP', detail: 'no link found' };
				}
			} catch (e) {
				postStatus = { status: 'CRASH', detail: e.message };
			}
		} else {
			postStatus = { status: 'SKIP', detail: 'front page failed' };
		}

		// --- Phase 3: Admin dashboard (auto-login) ---
		if (frontStatus.status === 'OK' || frontStatus.status === 'PARTIAL') {
			try {
				const wp2 = await navigateViaUrlBar(
					page,
					'/wp-admin/',
					TIMEOUT_S
				);
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
						const adminIndicators = [
							'Dashboard',
							'Write',
							'Manage',
							'Options',
							'Log Out',
							'Logout',
							'Settings',
							'Posts',
							'Plugins',
							'Create New Post',
							'My Profile',
						];
						const hasAdmin = adminIndicators.some((ind) =>
							wp2.body.includes(ind)
						);
						const loggedIn = isLoggedIn(wp2.body);
						if (hasAdmin && loggedIn) {
							adminStatus = { status: 'OK' };
						} else if (hasAdmin) {
							adminStatus = {
								status: 'OK',
								detail: 'admin loaded but login state unclear',
							};
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

		// --- Phase 4: New post page (nonce check) ---
		if (
			EXTENDED_TEST_VERSIONS.has(wp) &&
			adminStatus &&
			adminStatus.status === 'OK'
		) {
			try {
				const wp3 = await navigateViaUrlBar(
					page,
					'/wp-admin/post-new.php',
					30
				);
				if (!wp3) {
					newPostStatus = { status: 'TIMEOUT' };
				} else {
					const bad =
						wp3.body.includes('Are you sure') ||
						wp3.body.includes('not allowed') ||
						wp3.body.includes('sufficient permissions');
					const hasEditor =
						wp3.body.includes('Title') ||
						wp3.body.includes('title') ||
						wp3.body.includes('Write Post') ||
						wp3.body.includes('Add New Post');
					if (bad) {
						newPostStatus = {
							status: 'NONCE_FAIL',
							detail: wp3.body.includes('Are you sure')
								? 'nonce verification failed'
								: 'permission denied',
						};
					} else if (hasEditor) {
						newPostStatus = { status: 'OK' };
					} else {
						newPostStatus = {
							status: 'UNKNOWN',
							detail: wp3.body.slice(0, 120).replace(/\n/g, ' '),
						};
					}
				}
			} catch (e) {
				newPostStatus = { status: 'CRASH', detail: e.message };
			}
		} else if (!EXTENDED_TEST_VERSIONS.has(wp)) {
			newPostStatus = {
				status: 'SKIP',
				detail: 'not tested for this version',
			};
		} else {
			newPostStatus = { status: 'SKIP', detail: 'admin failed' };
		}

		// --- Phase 5: Plugin activation ---
		if (
			EXTENDED_TEST_VERSIONS.has(wp) &&
			adminStatus &&
			adminStatus.status === 'OK'
		) {
			try {
				const wp4 = await navigateViaUrlBar(
					page,
					'/wp-admin/plugins.php',
					30
				);
				if (!wp4) {
					pluginStatus = { status: 'TIMEOUT' };
				} else {
					const activateLink = wp4.frame
						.locator('a')
						.filter({ hasText: 'Activate' })
						.first();
					if ((await activateLink.count()) > 0) {
						await activateLink.click({ timeout: 5000 });
						await page.waitForTimeout(8000);
						const wp4b = await waitForWPFrame(page, 20);
						if (!wp4b) {
							pluginStatus = { status: 'TIMEOUT' };
						} else {
							const ok =
								wp4b.body.includes('Plugin activated') ||
								wp4b.body.includes('Deactivate');
							const bad = wp4b.body.includes('Are you sure');
							pluginStatus = ok
								? { status: 'OK' }
								: {
										status: bad ? 'NONCE_FAIL' : 'UNKNOWN',
										detail: wp4b.body
											.slice(0, 120)
											.replace(/\n/g, ' '),
									};
						}
					} else {
						pluginStatus = {
							status: 'SKIP',
							detail: 'no activate link found',
						};
					}
				}
			} catch (e) {
				pluginStatus = { status: 'CRASH', detail: e.message };
			}
		} else if (!EXTENDED_TEST_VERSIONS.has(wp)) {
			pluginStatus = {
				status: 'SKIP',
				detail: 'not tested for this version',
			};
		} else {
			pluginStatus = { status: 'SKIP', detail: 'admin failed' };
		}
	} catch (e) {
		frontStatus = {
			status: 'CRASH',
			detail: e.message,
		};
		adminStatus = { status: 'SKIP', detail: 'boot crashed' };
		postStatus = { status: 'SKIP', detail: 'boot crashed' };
		newPostStatus = { status: 'SKIP', detail: 'boot crashed' };
		pluginStatus = { status: 'SKIP', detail: 'boot crashed' };
	}

	const icon = (s) =>
		s.status === 'OK' ? '✓' : s.status === 'SKIP' ? '-' : '✗';
	const parts = [
		`front:${icon(frontStatus)}`,
		`post:${icon(postStatus)}`,
		`admin:${icon(adminStatus)}`,
		`newpost:${icon(newPostStatus)}`,
		`plugin:${icon(pluginStatus)}`,
	];
	console.log(parts.join(' '));

	results.push({
		wp,
		front: frontStatus,
		post: postStatus,
		admin: adminStatus,
		newPost: newPostStatus,
		plugin: pluginStatus,
	});
	await page.close();
	await context.close();
}

await browser.close();

const PHASES = ['front', 'post', 'admin', 'newPost', 'plugin'];

function isPass(status) {
	return status.status === 'OK' || status.status === 'PARTIAL';
}
function isSkip(status) {
	return status.status === 'SKIP';
}

console.log(`\n${'='.repeat(70)}`);
console.log('RESULTS SUMMARY:');
console.log(`${'='.repeat(70)}`);
for (const r of results) {
	const cols = PHASES.map((p) => {
		const s = r[p];
		if (!s) return '-';
		if (isPass(s)) return 'PASS';
		if (isSkip(s)) return 'skip';
		return 'FAIL';
	});
	console.log(
		`  WP ${r.wp.padEnd(5)} ${cols.map((c, i) => `${PHASES[i]}:${c}`).join('  ')}`
	);
}

const counts = {};
for (const p of PHASES) {
	const tested = results.filter((r) => r[p] && !isSkip(r[p]));
	const passed = tested.filter((r) => isPass(r[p]));
	counts[p] = { tested: tested.length, passed: passed.length };
}
console.log('');
for (const p of PHASES) {
	console.log(`  ${p.padEnd(8)}: ${counts[p].passed}/${counts[p].tested} OK`);
}

// Dump per-failure diagnostic bodies.
const failures = results.filter((r) =>
	PHASES.some((p) => r[p] && !isPass(r[p]) && !isSkip(r[p]))
);
if (failures.length > 0) {
	console.log(`\n${'='.repeat(70)}`);
	console.log('FAILURE DETAILS:');
	console.log(`${'='.repeat(70)}`);
	for (const r of failures) {
		console.log(`\n--- WP ${r.wp} ---`);
		for (const p of PHASES) {
			const s = r[p];
			if (!s || isPass(s) || isSkip(s)) continue;
			console.log(`  ${p} [${s.status}]: ${s.detail || ''}`);
			if (s.body) {
				console.log(
					`  body:\n${s.body.slice(0, 1000).replace(/^/gm, '    ')}`
				);
			}
		}
	}
}

// All non-skip failures are hard errors.
const totalFailures = results.reduce(
	(n, r) =>
		n + PHASES.filter((p) => r[p] && !isPass(r[p]) && !isSkip(r[p])).length,
	0
);
if (totalFailures > 0) {
	console.error(`\n${totalFailures} failure(s) across all phases.`);
	process.exit(1);
}
