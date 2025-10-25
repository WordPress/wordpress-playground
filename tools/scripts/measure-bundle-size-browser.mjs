#!/usr/bin/env node

/**
 * Measure bundle size using actual browser and network monitoring
 * 
 * This script uses Playwright to:
 * 1. Launch the playground website
 * 2. Track all network requests
 * 3. Measure downloads at three key stages:
 *    - Until progress bar visible (first paint)
 *    - After WordPress loaded (site ready)
 *    - After all downloads settle (offline mode readiness)
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';

const WEBSITE_URL = 'http://localhost:5400';
const NETWORK_IDLE_TIMEOUT = 5000; // 5 seconds of no network activity

/**
 * Track network requests and calculate total bytes transferred
 */
class NetworkMonitor {
	constructor() {
		this.requests = [];
		this.responses = new Map();
		this.startTime = null;
	}

	/**
	 * Attach to a page to monitor network activity
	 */
	attach(page) {
		this.startTime = Date.now();

		page.on('request', (request) => {
			this.requests.push({
				url: request.url(),
				method: request.method(),
				resourceType: request.resourceType(),
				timestamp: Date.now() - this.startTime,
			});
		});

		page.on('response', async (response) => {
			const request = response.request();
			const url = request.url();

			try {
				const headers = response.headers();
				const contentLength = headers['content-length'];
				const body = await response.body().catch(() => null);

				this.responses.set(url, {
					url,
					status: response.status(),
					contentLength: contentLength
						? parseInt(contentLength, 10)
						: null,
					actualSize: body ? body.length : 0,
					resourceType: request.resourceType(),
					timestamp: Date.now() - this.startTime,
				});
			} catch (error) {
				// Some responses can't be read (e.g., service worker)
				console.warn(`Could not read response for ${url}:`, error.message);
			}
		});
	}

	/**
	 * Get all responses up to a certain timestamp
	 */
	getResponsesUntil(timestamp) {
		return Array.from(this.responses.values()).filter(
			(r) => r.timestamp <= timestamp
		);
	}

	/**
	 * Calculate total bytes transferred
	 */
	calculateTotalBytes(responses) {
		return responses.reduce((total, response) => {
			// Use actual size if available, fall back to content-length
			const size = response.actualSize || response.contentLength || 0;
			return total + size;
		}, 0);
	}

	/**
	 * Group responses by resource type
	 */
	groupByResourceType(responses) {
		const groups = {};
		for (const response of responses) {
			const type = response.resourceType || 'other';
			if (!groups[type]) {
				groups[type] = [];
			}
			groups[type].push(response);
		}
		return groups;
	}

	/**
	 * Get largest files
	 */
	getLargestFiles(responses, count = 10) {
		return [...responses]
			.sort((a, b) => {
				const sizeA = a.actualSize || a.contentLength || 0;
				const sizeB = b.actualSize || b.contentLength || 0;
				return sizeB - sizeA;
			})
			.slice(0, count)
			.map((r) => ({
				url: r.url,
				size: r.actualSize || r.contentLength || 0,
				resourceType: r.resourceType,
			}));
	}
}

/**
 * Wait for network to be idle
 */
async function waitForNetworkIdle(page, timeout = NETWORK_IDLE_TIMEOUT) {
	let lastRequestTime = Date.now();
	let requestCount = 0;

	const requestListener = () => {
		lastRequestTime = Date.now();
		requestCount++;
	};

	page.on('request', requestListener);

	try {
		// Wait for network idle
		while (Date.now() - lastRequestTime < timeout) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	} finally {
		page.off('request', requestListener);
	}

	return requestCount;
}

/**
 * Main measurement function
 */
async function measureBundleSize() {
	console.log('Starting browser-based bundle size measurement...');

	// Check if server is running
	try {
		const response = await fetch(WEBSITE_URL);
		if (!response.ok) {
			throw new Error(`Server returned ${response.status}`);
		}
	} catch (error) {
		console.error(`Website not accessible at ${WEBSITE_URL}`);
		console.error('Please start the dev server first: npm run dev');
		process.exit(1);
	}

	const browser = await chromium.launch({
		headless: true,
	});

	const context = await browser.newContext({
		// Disable cache to get accurate measurements
		ignoreHTTPSErrors: true,
	});

	const page = await context.newPage();

	// Set up network monitoring
	const monitor = new NetworkMonitor();
	monitor.attach(page);

	const measurements = {};

	try {
		// Navigate to the website
		console.log(`Loading ${WEBSITE_URL}...`);
		await page.goto(WEBSITE_URL, {
			waitUntil: 'domcontentloaded',
		});

		// Stage 1: Wait for progress bar to be visible (first paint)
		console.log('Waiting for progress bar...');
		try {
			await page.waitForSelector('.progress-bar, [role="progressbar"]', {
				timeout: 10000,
				state: 'visible',
			});
			const progressBarTime = Date.now() - monitor.startTime;
			const progressBarResponses =
				monitor.getResponsesUntil(progressBarTime);

			measurements.firstPaint = {
				timestamp: progressBarTime,
				totalBytes: monitor.calculateTotalBytes(progressBarResponses),
				fileCount: progressBarResponses.length,
				largestFiles: monitor.getLargestFiles(progressBarResponses),
				byType: monitor.groupByResourceType(progressBarResponses),
			};

			console.log(
				`Progress bar visible at ${progressBarTime}ms, ${measurements.firstPaint.totalBytes} bytes downloaded`
			);
		} catch (error) {
			console.warn('Progress bar not found, using DOM content loaded instead');
			const domContentLoadedTime = Date.now() - monitor.startTime;
			const responses = monitor.getResponsesUntil(domContentLoadedTime);

			measurements.firstPaint = {
				timestamp: domContentLoadedTime,
				totalBytes: monitor.calculateTotalBytes(responses),
				fileCount: responses.length,
				largestFiles: monitor.getLargestFiles(responses),
				byType: monitor.groupByResourceType(responses),
			};
		}

		// Stage 2: Wait for WordPress to load (nested iframes ready)
		console.log('Waiting for WordPress to load...');
		try {
			// Wait for the WordPress iframe
			const wpFrame = page.frameLocator('#playground-viewport:visible, .playground-viewport:visible').frameLocator('#wp');
			await wpFrame.locator('body').waitFor({
				state: 'attached',
				timeout: 30000,
			});

			const wpLoadedTime = Date.now() - monitor.startTime;
			const wpLoadedResponses = monitor.getResponsesUntil(wpLoadedTime);

			measurements.wordpressLoaded = {
				timestamp: wpLoadedTime,
				totalBytes: monitor.calculateTotalBytes(wpLoadedResponses),
				fileCount: wpLoadedResponses.length,
				largestFiles: monitor.getLargestFiles(wpLoadedResponses),
				byType: monitor.groupByResourceType(wpLoadedResponses),
			};

			console.log(
				`WordPress loaded at ${wpLoadedTime}ms, ${measurements.wordpressLoaded.totalBytes} bytes downloaded`
			);
		} catch (error) {
			console.warn('WordPress iframe not found:', error.message);
			// Fall back to network load event
			await page.waitForLoadState('load');
			const loadTime = Date.now() - monitor.startTime;
			const responses = monitor.getResponsesUntil(loadTime);

			measurements.wordpressLoaded = {
				timestamp: loadTime,
				totalBytes: monitor.calculateTotalBytes(responses),
				fileCount: responses.length,
				largestFiles: monitor.getLargestFiles(responses),
				byType: monitor.groupByResourceType(responses),
			};
		}

		// Stage 3: Wait for all downloads to settle (offline mode ready)
		console.log('Waiting for network to be idle...');
		await waitForNetworkIdle(page, NETWORK_IDLE_TIMEOUT);

		const networkIdleTime = Date.now() - monitor.startTime;
		const allResponses = Array.from(monitor.responses.values());

		measurements.offlineModeReady = {
			timestamp: networkIdleTime,
			totalBytes: monitor.calculateTotalBytes(allResponses),
			fileCount: allResponses.length,
			largestFiles: monitor.getLargestFiles(allResponses),
			byType: monitor.groupByResourceType(allResponses),
		};

		console.log(
			`Network idle at ${networkIdleTime}ms, ${measurements.offlineModeReady.totalBytes} bytes downloaded`
		);

		// Generate report
		const report = {
			timestamp: new Date().toISOString(),
			url: WEBSITE_URL,
			measurements,
		};

		// Write report to file
		await writeFile(
			'bundle-size-report.json',
			JSON.stringify(report, null, 2)
		);

		// Print summary
		console.log('\n=== Bundle Size Report ===\n');
		console.log('First Paint (Progress Bar Visible):');
		console.log(
			`  Total: ${(measurements.firstPaint.totalBytes / 1024 / 1024).toFixed(2)} MB`
		);
		console.log(`  Files: ${measurements.firstPaint.fileCount}`);
		console.log(`  Time: ${measurements.firstPaint.timestamp}ms`);

		console.log('\nWordPress Loaded (Site Ready):');
		console.log(
			`  Total: ${(measurements.wordpressLoaded.totalBytes / 1024 / 1024).toFixed(2)} MB`
		);
		console.log(`  Files: ${measurements.wordpressLoaded.fileCount}`);
		console.log(`  Time: ${measurements.wordpressLoaded.timestamp}ms`);

		console.log('\nOffline Mode Ready (All Downloads Settled):');
		console.log(
			`  Total: ${(measurements.offlineModeReady.totalBytes / 1024 / 1024).toFixed(2)} MB`
		);
		console.log(`  Files: ${measurements.offlineModeReady.fileCount}`);
		console.log(`  Time: ${measurements.offlineModeReady.timestamp}ms`);

		console.log('\nReport written to: bundle-size-report.json');
	} catch (error) {
		console.error('Error during measurement:', error);
		throw error;
	} finally {
		await browser.close();
	}

	return measurements;
}

// Run the measurement
measureBundleSize().catch((error) => {
	console.error('Failed to measure bundle size:', error);
	process.exit(1);
});
