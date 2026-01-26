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
	// Use fallback selectors to handle CSS module hashing in production builds
	await page.addInitScript(() => {
		// Poll for progress bar updates
		const checkProgress = () => {
			// Try multiple selectors to find the progress bar
			const progressBar = (document.querySelector(
				'[class*="progressBar"][class*="isDefinite"]'
			) ||
				document.querySelector('[class*="progressBar"]') ||
				document.querySelector(
					'div[style*="width"][style*="%"]'
				)) as HTMLElement;

			const captionEl =
				document.querySelector('[class*="caption"]') ||
				document.querySelector('h3');

			if (progressBar && progressBar.style.width) {
				const width = parseFloat(progressBar.style.width);
				const caption = captionEl?.textContent || '';
				if (!isNaN(width)) {
					(window as any).trackProgress(width, caption);
				}
			}
		};

		// Check progress very frequently to catch fast completions
		const interval = setInterval(checkProgress, 50);

		// Also use MutationObserver for immediate updates
		const observer = new MutationObserver(checkProgress);

		// Start observing immediately
		const startObserving = () => {
			// Check immediately
			checkProgress();

			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['style', 'class'],
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

	// Listen for console errors to understand what's failing
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			console.log('Browser console error:', msg.text());
		}
	});

	page.on('pageerror', (err) => {
		console.log('Page error:', err.message);
	});

	// Navigate to playground - this will trigger WordPress initialization
	await page.goto('./');

	// Wait for WordPress to finish loading - check for the WordPress iframe
	// This is more reliable than waiting for progress bar which may complete quickly
	try {
		await page.waitForFunction(
			() => {
				const iframe = document.querySelector('iframe#wp');
				return iframe !== null;
			},
			{ timeout: 30000 }
		);
	} catch (error) {
		// Log the page content to help debug
		const bodyHTML = await page.evaluate(() => document.body.innerHTML);
		console.log('Page body HTML:', bodyHTML.substring(0, 500));
		const hasRemoteIframe = await page.evaluate(() =>
			document.querySelector('iframe')
		);
		console.log('Has any iframe:', !!hasRemoteIframe);
		throw error;
	}

	// Give extra time for final progress updates to be captured
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
