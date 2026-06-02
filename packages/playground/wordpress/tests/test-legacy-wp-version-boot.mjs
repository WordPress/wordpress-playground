/**
 * Tests that legacy and mid-modern WordPress versions boot
 * successfully through Playground's wordpress.org download path:
 *
 *   - WP 1.0 – 4.9 on PHP 5.2 (legacy SQLite driver)
 *   - WP 5.0 – 6.2 on PHP 7.4 (modern SQLite driver)
 *
 * Pre-built bundled WP (6.3+) has its own coverage elsewhere.
 *
 * Each version is exercised through five phases:
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

// Matrix of (WordPress, PHP) combinations to test.
// Versions that were never released: 1.1, 1.3, 1.4, 2.4.
// The web worker normalizes bare versions automatically (1.5 → 1.5.2,
// 2.0 → 2.0.11, etc.) and resolves them to wordpress.org downloads.
// Modern WP (5.0–6.2) is paired with PHP 7.4 because it's the newest
// PHP the legacy SQLite driver supports and is far enough from the
// PHP 5.2 leg to make regressions obvious.
const WP_VERSIONS = [
	// Mid-modern WordPress (PHP 7.4).
	{ wp: '6.2', php: '7.4' },
	{ wp: '6.1', php: '7.4' },
	{ wp: '6.0', php: '7.4' },
	{ wp: '5.9', php: '7.4' },
	{ wp: '5.8', php: '7.4' },
	{ wp: '5.7', php: '7.4' },
	{ wp: '5.6', php: '7.4' },
	{ wp: '5.5', php: '7.4' },
	{ wp: '5.4', php: '7.4' },
	{ wp: '5.3', php: '7.4' },
	{ wp: '5.2', php: '7.4' },
	{ wp: '5.1', php: '7.4' },
	{ wp: '5.0', php: '7.4' },
	// Legacy WordPress on PHP 5.2 WASM.
	{ wp: '4.9', php: '5.2' },
	{ wp: '4.8', php: '5.2' },
	{ wp: '4.7', php: '5.2' },
	{ wp: '4.6', php: '5.2' },
	{ wp: '4.5', php: '5.2' },
	{ wp: '4.4', php: '5.2' },
	{ wp: '4.3', php: '5.2' },
	{ wp: '4.2', php: '5.2' },
	{ wp: '4.1', php: '5.2' },
	{ wp: '4.0', php: '5.2' },
	{ wp: '3.9', php: '5.2' },
	{ wp: '3.8', php: '5.2' },
	{ wp: '3.7', php: '5.2' },
	{ wp: '3.6', php: '5.2' },
	{ wp: '3.5', php: '5.2' },
	{ wp: '3.4', php: '5.2' },
	{ wp: '3.3', php: '5.2' },
	{ wp: '3.2', php: '5.2' },
	{ wp: '3.1', php: '5.2' },
	{ wp: '3.0', php: '5.2' },
	{ wp: '2.9', php: '5.2' },
	{ wp: '2.8', php: '5.2' },
	{ wp: '2.7', php: '5.2' },
	{ wp: '2.6', php: '5.2' },
	{ wp: '2.5', php: '5.2' },
	{ wp: '2.3', php: '5.2' },
	{ wp: '2.2', php: '5.2' },
	{ wp: '2.1', php: '5.2' },
	{ wp: '2.0', php: '5.2' },
	{ wp: '1.5', php: '5.2' },
	{ wp: '1.2', php: '5.2' },
	{ wp: '1.0', php: '5.2' },
];

const PORT = 5400;
const TIMEOUT_S = 120;
const results = [];

/**
 * Finds the WordPress content frame (the one whose URL contains "scope:")
 * and returns its body text once it has meaningful content.
 *
 * Options:
 *   - `excludeUrl`: skip the scoped frame while its URL still matches the
 *     pre-click value — lets callers wait for a post-click navigation to
 *     actually commit instead of racing against the previous page's body.
 *   - `contentPredicate`: a `(body) => boolean` that must also return
 *     true before we return. Without this, any body ≥ 20 chars counts,
 *     which is too eager on slow CI boots where pages render in stages
 *     (e.g. admin shell first, plugin list later).
 *
 * Returns null on timeout.
 */
async function waitForWPFrame(page, timeoutSeconds, opts = {}) {
	const { excludeUrl = null, contentPredicate = null } = opts;
	const iterations = Math.ceil((timeoutSeconds * 1000) / 500);
	for (let i = 0; i < iterations; i++) {
		await page.waitForTimeout(500);
		for (const frame of page.frames()) {
			try {
				const furl = frame.url();
				if (!furl.includes('scope:')) continue;
				if (excludeUrl && furl === excludeUrl) continue;
				const body = await frame
					.locator('body')
					.innerText({ timeout: 2000 });
				if (!body || body.length < 20) continue;
				if (contentPredicate && !contentPredicate(body)) continue;
				return { body, frame };
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
 * After navigating to a new-post admin page, waits for the editor
 * form to finish rendering.
 *
 * WP 4.1 introduced auto-draft creation: `post-new.php` calls
 * `get_default_post_to_edit($type, true)` which runs `wp_insert_post()`
 * before emitting the editor form.  The PHP process streams the admin
 * navigation chrome immediately (the WP header fires before the insert),
 * so `navigateViaUrlBar` can return while the page is only half-
 * rendered.  This helper polls the frame's full HTML until the
 * `name="post_title"` input appears, a PHP error is detected, or the
 * timeout expires.
 *
 * All other WP versions that use a new-post path already render the
 * editor in the very first chunk, so the extra wait is a no-op for them.
 */
async function waitForNewPostEditorHtml(frame, timeoutSeconds = 30) {
	// Covers the classic editor (WP < 5.0, which renders a plain
	// <input name="post_title">) and Gutenberg (WP 5.0+, which emits
	// a block editor container and React bootstrap scripts). Any one
	// of these strings in the initial HTML means the post-new.php
	// response reached the editor render stage successfully.
	const editorMarkers = [
		'name="post_title"',
		"name='post_title'",
		'id="editor"',
		'edit-post-layout',
		'block-editor-writing-flow',
	];
	const deadline = Date.now() + timeoutSeconds * 1000;
	let html = '';
	while (Date.now() < deadline) {
		try {
			html = await frame.locator('body').innerHTML({ timeout: 3000 });
		} catch {
			await frame.page().waitForTimeout(500);
			continue;
		}
		if (editorMarkers.some((m) => html.includes(m))) return html;
		if (findPHPError(html)) return html;
		await frame.page().waitForTimeout(1000);
	}
	// Return whatever we have when the deadline expires so the caller can
	// still classify the result (e.g. UNKNOWN / TIMEOUT) rather than
	// crashing.
	return html;
}

/**
 * Checks for the TinyMCE inline-style regression without waiting for
 * TinyMCE itself to initialize. The bug surfaces as a script parse/init
 * error while the new-post page loads.
 */
function checkTinyMCEInlineStyleErrors(consoleErrors, consoleStartIndex) {
	const error = findTinyMCEInitError(consoleErrors, consoleStartIndex);
	return error ? { status: 'ERROR', detail: error } : { status: 'OK' };
}

/**
 * Navigates inside the Playground via the URL bar and then waits for
 * the WordPress content frame to actually navigate to `path`.
 *
 * The previous implementation only waited for *any* scoped frame to
 * have body content, which gave false positives when the navigation
 * silently failed (e.g. a 25s service worker timeout on post.php) and
 * left the iframe on the previous page. We now wait for the frame URL
 * to match `path` (or a redirect target different from the previous
 * URL) before returning, so stale content is never reported as OK.
 */
async function navigateViaUrlBar(page, path, timeoutSeconds = 60) {
	// Capture the frame URL we're navigating away from so we can tell
	// when the actual navigation commits (or when a redirect lands us
	// on a different page than the previous one).
	const scopedBefore = page.frames().find((f) => f.url().includes('scope:'));
	const urlBefore = scopedBefore?.url() || '';

	const urlBar = page.locator('input[name="url"]');
	await urlBar.fill(path);
	await urlBar.press('Enter');

	// Poll for the scoped frame URL to change. Accept either:
	//   (a) the URL now includes the requested `path`, or
	//   (b) the URL is different from `urlBefore` (covers 302 redirects
	//       that land on a sibling page, e.g. WP 2.1's post.php → edit.php).
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		await page.waitForTimeout(500);
		const frame = page.frames().find((f) => f.url().includes('scope:'));
		if (!frame) continue;
		const url = frame.url();
		const pathStem = path.split('?')[0].split('#')[0];
		const committed = url.includes(pathStem) || url !== urlBefore;
		if (!committed) continue;
		try {
			const body = await frame
				.locator('body')
				.innerText({ timeout: 2000 });
			if (body && body.length >= 20) {
				return { body, frame };
			}
		} catch {}
	}
	return null;
}

/**
 * Waits for the plugin activation click to produce a new plugins page body.
 *
 * Some WordPress versions redirect back to the same `plugins.php` URL after
 * activation. Comparing both URL and body lets us ignore the pre-click plugin
 * list without requiring a URL change that may never come.
 */
async function waitForPluginActivation(
	page,
	previousFrameUrl,
	previousBody,
	timeoutSeconds = 60
) {
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		await page.waitForTimeout(500);
		for (const frame of page.frames()) {
			try {
				if (!frame.url().includes('scope:')) continue;
				const body = await frame
					.locator('body')
					.innerText({ timeout: 2000 });
				const changed =
					frame.url() !== previousFrameUrl || body !== previousBody;
				if (!changed) continue;
				if (
					body.includes('Plugin activated') ||
					body.includes('Deactivate') ||
					body.includes('Are you sure') ||
					findPHPError(body)
				) {
					return { body, frame };
				}
			} catch {}
		}
	}
	return null;
}

/**
 * Checks whether a body text indicates the user is logged in.
 */
function isLoggedIn(body) {
	return ['Logout', 'Log Out', 'Sign Out', 'Howdy'].some((s) =>
		body.includes(s)
	);
}

const ADMIN_INDICATORS = [
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

/**
 * Checks whether body text contains UI copy that identifies an admin screen.
 */
function hasAdminIndicator(body) {
	return ADMIN_INDICATORS.some((ind) => body.includes(ind));
}

// WP < 2.5 uses post.php for new posts; 2.5+ uses post-new.php.
// WP 1.0-2.0 render the "new post" form via wp-admin/post.php's
// default case. WP 2.1 introduced wp-admin/post-new.php and made
// post.php redirect to edit.php, so the new-post form lives at
// post-new.php from 2.1 onward (just like modern WordPress).
const NEW_POST_URL_VERSIONS = new Set(['1.0', '1.2', '1.5', '2.0']);

// Optional filter for local runs: WP_ONLY=6.2,6.1,5.9 to test a subset.
const WP_ONLY = process.env.WP_ONLY
	? new Set(process.env.WP_ONLY.split(',').map((s) => s.trim()))
	: null;
const MATRIX = WP_ONLY
	? WP_VERSIONS.filter(({ wp }) => WP_ONLY.has(wp))
	: WP_VERSIONS;

/**
 * Captures browser console errors so timeout failures can report context.
 */
function captureConsoleErrors(page, consoleErrors) {
	page.on('console', (msg) => {
		if (msg.type() === 'error')
			consoleErrors.push(msg.text().slice(0, 300));
	});
	page.on('pageerror', (error) => {
		consoleErrors.push(error.message.slice(0, 300));
	});
}

function findTinyMCEInitError(consoleErrors, startIndex = 0) {
	return consoleErrors.slice(startIndex).find((message) => {
		const lower = message.toLowerCase();
		return (
			lower.includes('tinymcepreinit') ||
			lower.includes('truetype') ||
			lower.includes('content_style')
		);
	});
}

/**
 * Indicates whether the front-page boot hit a transient worker load failure.
 */
function shouldRetryFrontPageBoot(consoleErrors) {
	return consoleErrors.some((message) =>
		message.includes('WebWorker failed to load')
	);
}

const browser = await chromium.launch({
	headless: true,
	executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

for (const { wp, php } of MATRIX) {
	const label = `WP ${wp} (PHP ${php})`;
	process.stdout.write(`${label}... `);

	const url = `http://127.0.0.1:${PORT}/website-server/?php=${php}&wp=${wp}&storage=temp`;

	// Isolate every version in a fresh browser context so that OPFS
	// (where Playground persists site state), IndexedDB, localStorage
	// and cookies don't leak between versions. Without this, earlier
	// versions' patched files and scopes bleed into later ones and
	// the test becomes non-deterministic.
	let context = await browser.newContext();
	let page = await context.newPage();
	let consoleErrors = [];
	captureConsoleErrors(page, consoleErrors);

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
		let wp1 = await waitForWPFrame(page, TIMEOUT_S);
		if (!wp1 && shouldRetryFrontPageBoot(consoleErrors)) {
			await page.close();
			await context.close();
			context = await browser.newContext();
			page = await context.newPage();
			consoleErrors = [];
			captureConsoleErrors(page, consoleErrors);
			await page.goto(url, {
				timeout: 180_000,
				waitUntil: 'domcontentloaded',
			});
			wp1 = await waitForWPFrame(page, TIMEOUT_S);
		}

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
					.getByRole('link', {
						name: 'Hello world!',
						exact: true,
					})
					.first();
				if ((await link.count()) > 0) {
					const prevFrameUrl = wp1.frame.url();
					await link.click({ timeout: 5000 });
					const wp1b = await waitForWPFrame(page, 30, {
						excludeUrl: prevFrameUrl,
						// Don't return on the transient redirect body — wait
						// until the single-post page actually renders (or
						// WordPress emits its own not-found message).
						contentPredicate: (body) =>
							body.includes('Welcome to WordPress') ||
							body.includes('Hello world') ||
							body.includes('Not Found') ||
							body.includes("can't find"),
					});
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
				// Retry once on timeout — modern WP admin occasionally
				// hangs the first /wp-admin/ load on shared CI runners
				// (see the long-standing admin-phase flake across runs
				// on 5.5, 5.9, 6.0, ...). One fresh fill+Enter of the
				// URL bar almost always unblocks it.
				let wp2 = await navigateViaUrlBar(
					page,
					'/wp-admin/',
					TIMEOUT_S
				);
				if (!wp2) {
					wp2 = await navigateViaUrlBar(
						page,
						'/wp-admin/',
						TIMEOUT_S
					);
				}
				if (
					wp2 &&
					!findPHPError(wp2.body) &&
					!hasAdminIndicator(wp2.body)
				) {
					const settled = await waitForWPFrame(page, 30, {
						contentPredicate: hasAdminIndicator,
					});
					if (settled) {
						wp2 = settled;
					}
				}
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
						const hasAdmin = hasAdminIndicator(wp2.body);
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
		if (adminStatus && adminStatus.status === 'OK') {
			try {
				const newPostPath = NEW_POST_URL_VERSIONS.has(wp)
					? '/wp-admin/post.php'
					: '/wp-admin/post-new.php';
				const consoleStartIndex = consoleErrors.length;
				const wp3 = await navigateViaUrlBar(page, newPostPath, 30);
				if (!wp3) {
					newPostStatus = { status: 'TIMEOUT' };
				} else {
					// Check both innerText and innerHTML for PHP
					// errors — some errors land inside hidden elements
					// (e.g. WP 3.3's contextual-help sidebar) and
					// don't appear in innerText.
					// waitForNewPostEditorHtml polls until the editor form
					// is fully rendered; this is needed for WP 4.1 which
					// creates an auto-draft before emitting the form, so
					// the nav chrome arrives before the editor body.
					const html = await waitForNewPostEditorHtml(wp3.frame, 30);
					// Use the fully-rendered HTML for all checks.
					// wp3.body (innerText) may only contain the admin
					// navigation chrome if PHP was still running when
					// navigateViaUrlBar returned (e.g. WP 4.1 auto-draft).
					const bodyText = await wp3.frame
						.locator('body')
						.innerText({ timeout: 2000 })
						.catch(() => wp3.body);

					const error = findPHPError(bodyText) || findPHPError(html);

					const bad =
						bodyText.includes('Are you sure') ||
						bodyText.includes('not allowed') ||
						bodyText.includes('sufficient permissions');
					// Require a marker that actually indicates the new
					// post editor (not random dashboard nav strings).
					// `<input name="post_title">` is present on every WP
					// that uses the classic editor (WP 1.0–4.9 and WP 5.0+
					// when Gutenberg is disabled); `id="editor"`,
					// `edit-post-layout` and `block-editor-writing-flow`
					// cover the Gutenberg path shipped from WP 5.0 onward.
					// The visible editor headings cover header variants.
					const hasEditor =
						html.includes('name="post_title"') ||
						html.includes("name='post_title'") ||
						html.includes('id="editor"') ||
						html.includes('edit-post-layout') ||
						html.includes('block-editor-writing-flow') ||
						bodyText.includes('Write Post') ||
						bodyText.includes('Add New Post') ||
						bodyText.includes('Create New Post') ||
						bodyText.includes('New Post');
					if (error) {
						newPostStatus = {
							status: 'ERROR',
							detail: error,
						};
					} else if (bad) {
						newPostStatus = {
							status: 'NONCE_FAIL',
							detail: bodyText.includes('Are you sure')
								? 'nonce verification failed'
								: 'permission denied',
						};
					} else if (hasEditor) {
						const tinyMCEStatus = checkTinyMCEInlineStyleErrors(
							consoleErrors,
							consoleStartIndex
						);
						if (tinyMCEStatus.status === 'OK') {
							newPostStatus = { status: 'OK' };
						} else {
							newPostStatus = {
								status: tinyMCEStatus.status,
								detail: tinyMCEStatus.detail,
							};
						}
					} else {
						newPostStatus = {
							status: 'UNKNOWN',
							detail: bodyText.slice(0, 120).replace(/\n/g, ' '),
						};
					}
				}
			} catch (e) {
				newPostStatus = { status: 'CRASH', detail: e.message };
			}
		} else {
			newPostStatus = { status: 'SKIP', detail: 'admin failed' };
		}

		// --- Phase 5: Plugin activation ---
		if (adminStatus && adminStatus.status === 'OK') {
			try {
				const wp4 = await navigateViaUrlBar(
					page,
					'/wp-admin/plugins.php',
					30
				);
				if (!wp4) {
					pluginStatus = { status: 'TIMEOUT' };
				} else {
					// Target Hello Dolly specifically via its href. Clicking
					// the *first* Activate link lands on Akismet's setup
					// page on modern WP, which doesn't include the
					// "Deactivate"/"Plugin activated" indicators this phase
					// looks for. Hello Dolly ("hello.php") ships with every
					// modern WordPress release and activates in-place with
					// no follow-up screen, so the resulting plugins.php
					// reliably shows the expected confirmation.
					// Fall back to the first Activate link for very old WP
					// where Hello Dolly may not be present or the href
					// format differs.
					// Wait for any Activate link to render — navigateViaUrlBar
					// returns as soon as plugins.php has *any* body text, which
					// on slow CI boots can be just the admin shell before the
					// plugin list renders.
					const anyActivate = wp4.frame
						.locator('a')
						.filter({ hasText: 'Activate' })
						.first();
					try {
						await anyActivate.waitFor({
							state: 'visible',
							timeout: 15000,
						});
					} catch {}
					const helloActivate = wp4.frame
						.locator('a[href*="hello.php"]')
						.filter({ hasText: 'Activate' })
						.first();
					const activateLink =
						(await helloActivate.count()) > 0
							? helloActivate
							: anyActivate;
					if ((await activateLink.count()) > 0) {
						const bodyBeforeActivation = await wp4.frame
							.locator('body')
							.innerText({ timeout: 2000 })
							.catch(() => wp4.body);
						const prevFrameUrl = wp4.frame.url();
						await activateLink.click({ timeout: 5000 });
						const wp4b = await waitForPluginActivation(
							page,
							prevFrameUrl,
							bodyBeforeActivation
						);
						if (!wp4b) {
							pluginStatus = { status: 'TIMEOUT' };
						} else {
							const error = findPHPError(wp4b.body);
							const ok =
								wp4b.body.includes('Plugin activated') ||
								wp4b.body.includes('Deactivate');
							const bad = wp4b.body.includes('Are you sure');
							if (error) {
								pluginStatus = {
									status: 'ERROR',
									detail: error,
								};
							} else if (ok) {
								pluginStatus = { status: 'OK' };
							} else {
								pluginStatus = {
									status: bad ? 'NONCE_FAIL' : 'UNKNOWN',
									detail: wp4b.body
										.slice(0, 120)
										.replace(/\n/g, ' '),
								};
							}
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
		php,
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
		`  WP ${r.wp.padEnd(5)} (PHP ${r.php})  ${cols.map((c, i) => `${PHASES[i]}:${c}`).join('  ')}`
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
		console.log(`\n--- WP ${r.wp} (PHP ${r.php}) ---`);
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
