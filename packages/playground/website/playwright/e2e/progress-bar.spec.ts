import { test, expect } from '../playground-fixtures.ts';

test('should display progress updates during WordPress initialization', async ({
	page,
}) => {
	// Track progress updates
	const progressUpdates: Array<{ progress: number; caption: string }> = [];

	// Set up progress tracking before navigation
	await page.exposeFunction(
		'trackProgress',
		(progress: number, caption: string) => {
			progressUpdates.push({ progress, caption });
		}
	);

	// Inject script to monitor progress bar updates
	await page.addInitScript(() => {
		// Poll for progress bar updates
		const checkProgress = () => {
			const progressBar = document.querySelector(
				'[class*="progressBar"][class*="isDefinite"]'
			) as HTMLElement;
			const captionEl = document.querySelector('[class*="caption"]');

			if (progressBar && progressBar.style.width) {
				const width = parseFloat(progressBar.style.width);
				const caption = captionEl?.textContent || '';
				if (!isNaN(width)) {
					(window as any).trackProgress(width, caption);
				}
			}
		};

		// Check progress frequently
		const interval = setInterval(checkProgress, 100);

		// Also use MutationObserver for immediate updates
		const observer = new MutationObserver(checkProgress);

		// Start observing once DOM is ready
		const startObserving = () => {
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['style'],
			});
		};

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', startObserving);
		} else {
			startObserving();
		}

		// Clean up when page unloads
		window.addEventListener('beforeunload', () => {
			clearInterval(interval);
			observer.disconnect();
		});
	});

	// Navigate to playground - this will trigger WordPress initialization
	await page.goto('./');

	// Wait for progress bar to appear
	const progressBar = page.locator(
		'[class*="progressBar"][class*="isDefinite"]'
	);
	await expect(progressBar).toBeVisible({ timeout: 10000 });

	// Wait for WordPress to finish loading (progress bar disappears or becomes invisible)
	await page.waitForFunction(
		() => {
			const bar = document.querySelector(
				'[class*="progressBar"][class*="isDefinite"]'
			);
			return !bar || getComputedStyle(bar as HTMLElement).opacity === '0';
		},
		{ timeout: 180000 }
	);

	// Give a moment for final progress updates to be captured
	await page.waitForTimeout(500);

	// Extract just the progress values
	const progressValues = progressUpdates.map((u) => u.progress);

	// Log progress info for debugging
	console.log(`Total progress updates: ${progressUpdates.length}`);
	if (progressValues.length > 0) {
		console.log(
			`Progress range: ${Math.min(...progressValues)}% - ${Math.max(...progressValues)}%`
		);
		console.log(`Sample updates:`, progressUpdates.slice(0, 10));
	}

	// Verify we got progress updates
	expect(
		progressUpdates.length,
		'Expected to receive progress updates'
	).toBeGreaterThan(0);

	// Verify progress updates occurred during the first half (0-50%)
	// This is where WordPress download happens and where Safari had issues
	const earlyProgressUpdates = progressValues.filter((p) => p < 50);
	expect(
		earlyProgressUpdates.length,
		'Expected progress updates during WordPress download phase (0-50%)'
	).toBeGreaterThan(0);

	// Verify progress generally increases (allow some variation due to timing)
	let previousProgress = 0;
	let increasingCount = 0;
	for (const progress of progressValues) {
		if (progress > previousProgress) {
			increasingCount++;
		}
		previousProgress = progress;
	}

	// At least 70% of updates should show increasing progress
	// (allowing for duplicates and minor timing variations)
	const increasingPercentage =
		(increasingCount / progressValues.length) * 100;
	expect(
		increasingPercentage,
		`Expected progress to increase consistently, got ${increasingPercentage.toFixed(1)}% increasing updates`
	).toBeGreaterThan(70);

	// Verify we reached high progress (near 100%)
	const maxProgress = Math.max(...progressValues);
	expect(maxProgress, 'Expected progress to reach near 100%').toBeGreaterThan(
		90
	);
});
