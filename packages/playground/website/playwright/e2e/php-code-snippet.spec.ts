import { test, expect } from '@playwright/test';

/**
 * E2E tests for the <php-snippet> web component embed.
 * Verifies that:
 *   - the demo page renders three snippets,
 *   - clicking Run on the first shows a real progress bar with a caption
 *     and percent that advance toward 100,
 *   - the first snippet executes and shows PHP output,
 *   - subsequent snippets reuse the same Playground runtime (much faster
 *     than the first boot) and produce their own output.
 */

const DEMO_URL = './php-code-snippet-demo.html';

test.describe('php-code-snippet embed', () => {
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
		]) {
			const snippet = page.locator(`php-snippet[name="${name}"]`);
			await expect(snippet).toBeVisible();
			await expect(snippet.locator('.run')).toBeVisible();
		}
	});

	test('first Run boots the runtime and shows progress + output', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const first = page.locator('php-snippet').nth(0);

		await expect(first.locator('.progress')).toBeHidden();
		await first.locator('.run').click();

		// Progress bar appears with caption + percent text.
		await expect(first.locator('.progress')).toBeVisible();
		await expect(first.locator('.caption')).not.toHaveText('');
		await expect(first.locator('.percent')).toContainText(/%$/);

		// The percent advances past 0 (real progress, not just "0%" forever).
		await expect
			.poll(
				async () =>
					Number(
						(
							(await first
								.locator('.percent')
								.textContent()) || '0%'
						).replace('%', '')
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

		// Progress hides once the run finishes.
		await expect(first.locator('.progress')).toBeHidden();
	});

	test('subsequent snippets reuse the shared runtime', async ({ page }) => {
		await page.goto(DEMO_URL);
		const first = page.locator('php-snippet').nth(0);
		const second = page.locator('php-snippet').nth(1);
		const third = page.locator('php-snippet').nth(2);

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

		// Third snippet — same shared runtime.
		await third.locator('.run').click();
		await expect(third.locator('.output')).toBeVisible({
			timeout: 60_000,
		});
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
		await expect(bob.locator('.output-body')).toContainText(
			'Hello, Bob!'
		);

		// Both snippets resolved to the same blueprint hash, so only one
		// runtime iframe exists for this {origin, php, wp, blueprint} key.
		const blueprintIframes = await page
			.locator('iframe[title="PHP Snippet runtime"]')
			.count();
		expect(blueprintIframes).toBe(1);
	});

	test('editable snippet runs the user-typed code', async ({ page }) => {
		await page.goto(DEMO_URL);
		const editable = page.locator('php-snippet[editable]');
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

	test('expected output shows before Run and is replaced by real output', async ({
		page,
	}) => {
		await page.goto(DEMO_URL);
		const snippet = page.locator('php-snippet[name="precomputed.php"]');

		await expect(snippet.locator('.progress')).toBeHidden();
		await expect(snippet.locator('.output')).toBeVisible();
		await expect(snippet.locator('.output-body')).toContainText(
			'2 + 2 = 4'
		);

		await snippet.locator('.run').click();
		await expect(snippet.locator('.progress')).toBeVisible();
		await expect(snippet.locator('.output')).toBeVisible({
			timeout: 240_000,
		});
		await expect(snippet.locator('.output-body')).toContainText(
			'WordPress is awesome.'
		);
		await expect(snippet.locator('.progress')).toBeHidden();
		await expect(
			page.locator('iframe[title="PHP Snippet runtime"]')
		).toHaveCount(1);
	});
});
