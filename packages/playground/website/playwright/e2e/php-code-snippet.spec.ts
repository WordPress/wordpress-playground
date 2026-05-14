import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E tests for the <php-snippet> web component embed.
 * Verifies that:
 *   - the demo page renders three snippets,
 *   - clicking Run on the first shows real button progress that advances
 *     toward 100,
 *   - the first snippet executes and shows PHP output,
 *   - subsequent snippets reuse the same Playground runtime (much faster
 *     than the first boot) and produce their own output.
 */

const DEMO_URL = './php-code-snippet-demo.html';
const CLIENT_INDEX_SOURCE = `${process.cwd()}/packages/playground/client/src/index.ts`;
const TOOLKIT_AUTOLOAD_SOURCE = `${process.cwd()}/packages/playground/website/public/php-toolkit-autoload.txt`;
const pageErrors = new WeakMap<Page, string[]>();

test.describe('php-code-snippet embed', () => {
	test.beforeEach(async ({ page }) => {
		const errors: string[] = [];
		pageErrors.set(page, errors);
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});
	});

	test.afterEach(async ({ page }) => {
		expect(
			pageErrors.get(page) || [],
			'<php-snippet> should not emit uncaught browser errors'
		).toEqual([]);
	});

	test('renders all snippets with Run buttons', async ({ page }) => {
		await page.goto(DEMO_URL);
		for (const name of [
			'hello.php',
			'lazy-load-images.php',
			'parse-blocks.php',
			'greet-alice.php',
			'greet-bob.php',
			'scratch.php',
			'precomputed.php',
			'just-php.php',
			'quickstart.php',
		]) {
			const snippet = page.locator(`php-snippet[name="${name}"]`);
			await expect(snippet).toBeVisible();
			await expect(snippet.locator('.run')).toBeVisible();
			await expect(snippet.locator('.powered-by')).toContainText(
				'PHP Code Snippet powered by WordPress Playground'
			);
			await expect(
				snippet.locator('.powered-by a').nth(0)
			).toHaveAttribute(
				'href',
				'https://playground.wordpress.net/php-code-snippet-demo.html'
			);
			await expect(
				snippet.locator('.powered-by a').nth(1)
			).toHaveAttribute('href', 'https://wordpress.org/playground/');
			await expect(snippet.locator('.run-shortcut')).toContainText(
				/Ctrl\+Enter|Cmd\+Enter/
			);
		}
	});

	test('runnable=false renders a read-only snippet without Run', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const snippet = page.locator('php-snippet[name="illustration.php"]');

		await expect(snippet).toBeVisible();
		await expect(snippet.locator('.run')).toHaveCount(0);
		await expect(snippet.locator('textarea.ta')).toHaveCount(0);
		await expect(snippet.locator('pre code')).toContainText(
			'Just an illustration'
		);
		await expect(
			page.locator('iframe[title="PHP Snippet runtime"]')
		).toHaveCount(0);
	});

	test('first Run boots the runtime and shows button progress + output', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const first = page.locator('php-snippet').nth(0);
		const runButton = first.locator('.run');
		const runSpinner = first.locator('.run-spinner');
		const runPercent = first.locator('.run-percent');

		await expect(first.locator('.progress')).toHaveCount(0);
		await runButton.click();

		await expect(runButton).toHaveAttribute('aria-busy', /true/);
		await expect(runSpinner).toBeVisible();
		await expect(runPercent).toContainText(/%$/);

		// The percent advances past 0 (real progress, not just "0%" forever).
		await expect
			.poll(
				async () =>
					Number(
						((await runPercent.textContent()) || '0%').replace(
							'%',
							''
						)
					),
				{ timeout: 120_000, intervals: [500] }
			)
			.toBeGreaterThan(0);

		// Eventually the run completes and the output panel appears.
		await expect(first.locator('.output')).toBeVisible({
			timeout: 240_000,
		});
		await expect(first.locator('.output-body')).toContainText(
			'Hello from PHP'
		);

		await expect(runButton).not.toHaveAttribute('aria-busy', /true/);
	});

	test('subsequent snippets reuse the shared runtime', async ({ page }) => {
		await page.goto(DEMO_URL);
		const first = page.locator('php-snippet').nth(0);
		const second = page.locator('php-snippet').nth(1);
		const third = page.locator('php-snippet').nth(2);

		await ensurePlaygroundClientIsServed(page);
		await page.locator('php-snippet').evaluateAll((snippets) => {
			for (const snippet of snippets) {
				snippet.setAttribute(
					'playground-origin',
					window.location.origin
				);
			}
		});

		// Boot the runtime via the first snippet.
		await first.locator('.run').click();
		await expect(first.locator('.output')).toBeVisible({
			timeout: 240_000,
		});

		// Second run should reuse the runtime — well under the 240s
		// boot budget. Allow a generous 60s upper bound for CI noise.
		const secondStart = Date.now();
		await second.locator('.run').click();
		await expect(second.locator('.output')).toBeVisible({
			timeout: 60_000,
		});
		const secondElapsed = Date.now() - secondStart;
		expect(secondElapsed).toBeLessThan(60_000);
		await expect(second.locator('.output-body')).toContainText(
			'loading="lazy"'
		);

		// Third snippet — same shared runtime. It should still show its own
		// run progress, but it should not create a second runtime iframe.
		const thirdStart = Date.now();
		await third.locator('.run').click();
		await expect(third.locator('.output')).toBeVisible({
			timeout: 60_000,
		});
		const thirdElapsed = Date.now() - thirdStart;
		expect(thirdElapsed).toBeLessThan(60_000);
		await expect(third.locator('.output-body')).toContainText(
			'core/paragraph'
		);

		// Only one runtime iframe should have been added to the host page,
		// regardless of how many snippets ran.
		const runtimeIframes = await page
			.locator('iframe[title="PHP Snippet runtime"]')
			.count();
		expect(runtimeIframes).toBe(1);
	});

	test('snippets sharing a blueprint share one runtime and see its mu-plugin', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const alice = page.locator('php-snippet[name="greet-alice.php"]');
		const bob = page.locator('php-snippet[name="greet-bob.php"]');

		await alice.locator('.run').click();
		await expect(alice.locator('.output')).toBeVisible({
			timeout: 240_000,
		});
		await expect(alice.locator('.output-body')).toContainText(
			'Hello, Alice!'
		);

		await bob.locator('.run').click();
		await expect(bob.locator('.output')).toBeVisible({ timeout: 60_000 });
		await expect(bob.locator('.output-body')).toContainText('Hello, Bob!');

		// Both snippets resolved to the same blueprint hash, so only one
		// runtime iframe exists for this {origin, php, wp, blueprint} key.
		const blueprintIframes = await page
			.locator('iframe[title="PHP Snippet runtime"]')
			.count();
		expect(blueprintIframes).toBe(1);
	});

	test('editable snippet runs the user-typed code', async ({ page }) => {
		await page.goto(DEMO_URL);
		const editable = page.locator('php-snippet[name="scratch.php"]');
		await expect(editable).toBeVisible();
		const textarea = editable.locator('textarea.ta');
		await expect(textarea).toBeVisible();

		// Replace the snippet contents with something we can uniquely identify
		// in the output panel.
		await textarea.click();
		await textarea.evaluate((el: HTMLTextAreaElement) => {
			el.value = '<?php echo "edited:" . (40 + 2);';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await editable.locator('.run').click();
		await expect(editable.locator('.output')).toBeVisible({
			timeout: 240_000,
		});
		await expect(editable.locator('.output-body')).toContainText(
			'edited:42'
		);
	});

	test('Run button queues clicks while a snippet is running', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const editable = page.locator('php-snippet[name="scratch.php"]');
		await expect(editable).toBeVisible();

		await editable.evaluate((snippet: any) => {
			snippet._testRunCount = 0;
			snippet._runOnce = async function () {
				this._testRunCount += 1;
				await new Promise((resolve) => setTimeout(resolve, 100));
				const outputWrap = this.shadowRoot.querySelector('.output');
				const outputBody =
					this.shadowRoot.querySelector('.output-body');
				outputBody.textContent = `run-count:${this._testRunCount}`;
				outputWrap.classList.add('visible');
			};
		});

		const runButton = editable.locator('.run');
		await runButton.click();
		await expect(runButton).toHaveAttribute('aria-busy', /true/);
		await expect(runButton).toBeEnabled();
		await runButton.click();

		await expect(editable.locator('.output-body')).toContainText(
			'run-count:2'
		);
		await expect(runButton).toBeEnabled();
	});

	test('Ctrl+Enter and Cmd+Enter run the focused snippet', async ({
		page,
		browserName,
	}) => {
		await page.goto(DEMO_URL);
		const editable = page.locator('php-snippet[name="scratch.php"]');
		await expect(editable).toBeVisible();
		const textarea = editable.locator('textarea.ta');
		await expect(textarea).toBeVisible();

		await editable.evaluate((snippet: any) => {
			snippet._runOnce = async function (code: string) {
				const outputWrap = this.shadowRoot.querySelector('.output');
				const outputBody =
					this.shadowRoot.querySelector('.output-body');
				outputBody.textContent = code.includes('cmd')
					? 'cmd-enter-marker'
					: 'ctrl-enter-marker';
				outputWrap.classList.add('visible');
			};
		});

		await textarea.click();
		await textarea.evaluate((el: HTMLTextAreaElement) => {
			el.value = '<?php echo "ctrl";';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await page.keyboard.press('Control+Enter');
		await expect(editable.locator('.output-body')).toContainText(
			'ctrl-enter-marker'
		);

		// WebKit on Linux does not reliably synthesize Meta shortcuts in CI.
		if (browserName !== 'webkit') {
			await textarea.evaluate((el: HTMLTextAreaElement) => {
				el.value = '<?php echo "cmd";';
				el.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await page.keyboard.press('Meta+Enter');
			await expect(editable.locator('.output-body')).toContainText(
				'cmd-enter-marker'
			);
		}
	});

	test('output refresh keeps the light result styling', async ({ page }) => {
		await page.goto(DEMO_URL);
		const editable = page.locator('php-snippet[name="scratch.php"]');
		await expect(editable).toBeVisible();

		await editable.evaluate((snippet: any) => {
			snippet._runOnce = async function () {
				const outputWrap = this.shadowRoot.querySelector('.output');
				const outputBody =
					this.shadowRoot.querySelector('.output-body');
				outputBody.textContent = 'light-output-marker';
				outputWrap.classList.add('visible');
				this._flashOutput(outputBody);
			};
		});

		await editable.locator('.run').click();
		await expect(editable.locator('.output-body')).toContainText(
			'light-output-marker'
		);

		const colors = await editable.evaluate((snippet: any) => {
			const output = snippet.shadowRoot.querySelector('.output');
			const outputBody = snippet.shadowRoot.querySelector('.output-body');
			const outputStyles = getComputedStyle(output);
			const bodyStyles = getComputedStyle(outputBody);
			return {
				outputBackground: outputStyles.backgroundColor,
				bodyBackground: bodyStyles.backgroundColor,
				bodyColor: bodyStyles.color,
			};
		});

		expect(colors.outputBackground).toBe('rgb(255, 255, 255)');
		expect(colors.bodyBackground).not.toBe('rgb(13, 17, 23)');
		expect(colors.bodyColor).toBe('rgb(36, 41, 47)');
	});

	test('wp="none" + blueprint installs a PHP toolkit usable from the snippet', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const snippet = page.locator('php-snippet[name="quickstart.php"]');

		await expect(snippet).toBeVisible();
		await ensurePlaygroundClientIsServed(page);
		await ensureToolkitAutoloadIsServed(page);
		await snippet.evaluate((element) => {
			element.setAttribute('playground-origin', window.location.origin);
		});
		// The snippet ships with an expected-output script that pre-fills the
		// output panel. Wait for the real run to execute by watching the run
		// button enter and exit its busy state.
		const runButton = snippet.locator('.run');
		await runButton.click();
		await expect(runButton).toHaveAttribute('aria-busy', /true/, {
			timeout: 30_000,
		});
		await expect(runButton).not.toHaveAttribute('aria-busy', /true/, {
			timeout: 240_000,
		});

		const body = snippet.locator('.output-body');
		await expect(body).not.toHaveClass(/error/);
		await expect(body).toContainText(
			'<img src="hero.jpg" alt="Hero shot" loading="lazy">'
		);
		await expect(body).toContainText(
			'<img src="diagram.png" alt="" loading="eager">'
		);
	});

	test('Run button shows progress while a snippet is running', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const editable = page.locator('php-snippet[name="scratch.php"]');
		await expect(editable).toBeVisible();
		const textarea = editable.locator('textarea.ta');
		await expect(textarea).toBeVisible();
		const runButton = editable.locator('.run');
		const outputBody = editable.locator('.output-body');
		const runSpinner = editable.locator('.run-spinner');
		const runLabel = editable.locator('.run-label');
		const runPercent = editable.locator('.run-percent');
		const runShortcut = editable.locator('.run-shortcut');

		await editable.evaluate((snippet: any) => {
			snippet._runOnce = async function (code: string) {
				this._setRunButtonProgress('Running', 42);
				await new Promise((resolve) => setTimeout(resolve, 500));
				const outputWrap = this.shadowRoot.querySelector('.output');
				const outputBody =
					this.shadowRoot.querySelector('.output-body');
				outputBody.textContent = code.includes('second')
					? 'second-run-marker'
					: 'slow-run-marker';
				outputWrap.classList.add('visible');
			};
		});

		await textarea.click();
		await textarea.evaluate((el: HTMLTextAreaElement) => {
			el.value = '<?php usleep(1500000); echo "slow-run-marker";';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await runButton.click();
		await expect(runButton).toBeEnabled();
		await expect(runButton).toHaveAttribute('aria-busy', /true/, {
			timeout: 30_000,
		});
		await expect(runSpinner).toBeVisible();
		await expect(runPercent).toBeVisible();
		await expect(runShortcut).toBeHidden();
		await expect(runLabel).toHaveText('Running');
		await expect(runPercent).toHaveText('42%');
		await expect(outputBody).toContainText('slow-run-marker', {
			timeout: 60_000,
		});
		await expect(runButton).toBeEnabled({ timeout: 30_000 });
		await expect(runButton).not.toHaveAttribute('aria-busy', /true/, {
			timeout: 30_000,
		});
		await expect(runSpinner).toBeHidden();
		await expect(runLabel).toHaveText('Run');
		await expect(runShortcut).toBeVisible();

		await textarea.evaluate((el: HTMLTextAreaElement) => {
			el.value = '<?php echo "second-run-marker";';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await runButton.click();
		await expect(outputBody).toContainText('second-run-marker', {
			timeout: 60_000,
		});
	});

	test('expected output shows before Run and is replaced by real output', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const snippet = page.locator('php-snippet[name="precomputed.php"]');

		await expect(snippet.locator('.progress')).toHaveCount(0);
		await expect(snippet.locator('.output')).toBeVisible();
		await expect(snippet.locator('.output-body')).toContainText(
			'2 + 2 = 4'
		);

		const runButton = snippet.locator('.run');
		await runButton.click();
		await expect(runButton).toHaveAttribute('aria-busy', /true/);
		await expect(snippet.locator('.output')).toBeVisible({
			timeout: 240_000,
		});
		await expect(snippet.locator('.output-body')).toContainText(
			'WordPress is awesome.'
		);
		await expect(runButton).not.toHaveAttribute('aria-busy', /true/);
		await expect(
			page.locator('iframe[title="PHP Snippet runtime"]')
		).toHaveCount(1);
	});
});

async function ensurePlaygroundClientIsServed(page: Page) {
	const clientUrl = new URL('/client/index.js', page.url()).href;
	const response = await page.request.get(clientUrl);
	if (response.ok()) {
		return;
	}

	const sourceUrl = new URL(`/@fs${CLIENT_INDEX_SOURCE}`, page.url()).href;
	await page.route(clientUrl, async (route) => {
		const response = await page.request.get(sourceUrl);
		await route.fulfill({ response });
	});
}

async function ensureToolkitAutoloadIsServed(page: Page) {
	const autoloadUrl = new URL('/php-toolkit-autoload.txt', page.url()).href;
	const response = await page.request.get(autoloadUrl);
	if (response.ok()) {
		return;
	}

	await page.route(autoloadUrl, async (route) => {
		await route.fulfill({
			path: TOOLKIT_AUTOLOAD_SOURCE,
			contentType: 'text/plain',
		});
	});
}
