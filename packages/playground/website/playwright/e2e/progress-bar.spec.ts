import { test, expect } from '../playground-fixtures.ts';

test('should display progress updates during WordPress initialization', async ({
	page,
}) => {
	// Track progress updates
	const progressUpdates: number[] = [];
	let progressBarVisible = false;

	// Listen for progress bar updates before navigating
	await page.exposeFunction(
		'trackProgress',
		(progress: number, caption: string) => {
			progressUpdates.push(progress);
			console.log(`Progress: ${progress}% - ${caption}`);
		}
	);

	// Inject script to monitor progress bar updates
	await page.addInitScript(() => {
		// Monitor progress bar updates using MutationObserver
		const observer = new MutationObserver(() => {
			const progressBar = document.querySelector(
				'[class*="progressBar"][class*="isDefinite"]'
			) as HTMLElement;
			if (progressBar && progressBar.style.width) {
				const width = parseFloat(progressBar.style.width);
				const caption =
					document.querySelector('[class*="caption"]')?.textContent ||
					'';
				(window as any).trackProgress(width, caption);
			}
		});

		// Wait for DOM to be ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => {
				observer.observe(document.body, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ['style'],
				});
			});
		} else {
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['style'],
			});
		}
	});

	// Navigate to playground - this will trigger WordPress initialization
	await page.goto('./');

	// Wait for progress bar to appear
	const progressBar = page.locator('[class*="progressBar"]');
	await expect(progressBar).toBeVisible({ timeout: 10000 });
	progressBarVisible = true;

	// Wait for WordPress to finish loading (progress bar disappears)
	await expect(progressBar).not.toBeVisible({ timeout: 120000 });

	// Verify we got progress updates
	expect(progressUpdates.length).toBeGreaterThan(0);

	console.log(`Total progress updates: ${progressUpdates.length}`);
	console.log(
		`Progress range: ${Math.min(...progressUpdates)}% - ${Math.max(...progressUpdates)}%`
	);

	// Verify progress updates occurred during the first half (0-50%)
	// This is where WordPress download happens and where Safari had issues
	const earlyProgressUpdates = progressUpdates.filter((p) => p < 50);
	expect(earlyProgressUpdates.length).toBeGreaterThan(
		0,
		'Expected progress updates during WordPress download (0-50%)'
	);

	// Verify progress generally increases (allowing for small decreases due to timing)
	let previousProgress = 0;
	let increasingCount = 0;
	for (const progress of progressUpdates) {
		if (progress > previousProgress) {
			increasingCount++;
		}
		previousProgress = progress;
	}

	// At least 80% of updates should show increasing progress
	const increasingPercentage =
		(increasingCount / progressUpdates.length) * 100;
	expect(increasingPercentage).toBeGreaterThan(
		80,
		`Expected progress to increase consistently, got ${increasingPercentage.toFixed(1)}% increasing`
	);

	// Verify we reached high progress (near 100%)
	const maxProgress = Math.max(...progressUpdates);
	expect(maxProgress).toBeGreaterThan(
		90,
		'Expected progress to reach near 100%'
	);
});
