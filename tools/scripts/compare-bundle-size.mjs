#!/usr/bin/env node

/**
 * Compare bundle sizes between current and base branch
 * 
 * This script compares browser-based measurements from two builds
 * and generates a markdown report for GitHub PR comments.
 */

import { readFileSync, existsSync } from 'fs';

const THRESHOLD_KB = 50; // Threshold for posting a comment

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
	}
	return `${(bytes / 1024).toFixed(2)} KB`;
}

/**
 * Format size delta with sign
 */
function formatDelta(delta) {
	if (delta === 0) return '0 KB';
	const sign = delta > 0 ? '+' : '';
	if (Math.abs(delta) >= 1024 * 1024) {
		return `${sign}${(delta / 1024 / 1024).toFixed(2)} MB`;
	}
	return `${sign}${(delta / 1024).toFixed(2)} KB`;
}

/**
 * Load a bundle report
 */
function loadReport(path) {
	if (!existsSync(path)) {
		return null;
	}
	return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * Generate a markdown table for largest files
 */
function generateFileTable(files) {
	if (!files || files.length === 0) {
		return '_No files tracked_';
	}

	let table = '| File | Size | Type |\n';
	table += '|------|-----:|:----:|\n';

	for (const file of files) {
		const url = new URL(file.url);
		const path = url.pathname.length > 60 
			? '...' + url.pathname.slice(-57)
			: url.pathname;
		table += `| \`${path}\` | ${formatBytes(file.size)} | ${file.resourceType} |\n`;
	}

	return table;
}

/**
 * Compare two reports and generate markdown
 */
function compareReports(baseReport, currentReport) {
	if (!baseReport) {
		return {
			shouldComment: true,
			markdown: generateNewBuildReport(currentReport),
		};
	}

	const base = baseReport.measurements;
	const current = currentReport.measurements;

	// Calculate deltas
	const firstPaintDelta = current.firstPaint.totalBytes - base.firstPaint.totalBytes;
	const wpLoadedDelta = current.wordpressLoaded.totalBytes - base.wordpressLoaded.totalBytes;
	const offlineModeDelta = current.offlineModeReady.totalBytes - base.offlineModeReady.totalBytes;

	// Determine if we should post a comment (50KB threshold)
	const shouldComment =
		Math.abs(firstPaintDelta) >= THRESHOLD_KB * 1024 ||
		Math.abs(wpLoadedDelta) >= THRESHOLD_KB * 1024 ||
		Math.abs(offlineModeDelta) >= THRESHOLD_KB * 1024;

	// Generate markdown
	const markdown = generateComparisonReport(
		base,
		current,
		firstPaintDelta,
		wpLoadedDelta,
		offlineModeDelta
	);

	return {
		shouldComment,
		markdown,
		firstPaintDelta,
		wpLoadedDelta,
		offlineModeDelta,
	};
}

/**
 * Generate a report for a new build
 */
function generateNewBuildReport(report) {
	const m = report.measurements;

	return `## 📦 Bundle Size Report

### 🎨 First Paint (Progress Bar Visible)
- **Total Downloaded**: ${formatBytes(m.firstPaint.totalBytes)}
- **File Count**: ${m.firstPaint.fileCount}
- **Time**: ${m.firstPaint.timestamp}ms

#### Top 10 Largest Files
${generateFileTable(m.firstPaint.largestFiles)}

### ✅ WordPress Loaded (Site Ready)
- **Total Downloaded**: ${formatBytes(m.wordpressLoaded.totalBytes)}
- **File Count**: ${m.wordpressLoaded.fileCount}
- **Time**: ${m.wordpressLoaded.timestamp}ms

#### Top 10 Largest Files
${generateFileTable(m.wordpressLoaded.largestFiles)}

### 💾 Offline Mode Ready (All Downloads Settled)
- **Total Downloaded**: ${formatBytes(m.offlineModeReady.totalBytes)}
- **File Count**: ${m.offlineModeReady.fileCount}
- **Time**: ${m.offlineModeReady.timestamp}ms

#### Top 10 Largest Files
${generateFileTable(m.offlineModeReady.largestFiles)}
`;
}

/**
 * Generate a comparison report
 */
function generateComparisonReport(
	base,
	current,
	firstPaintDelta,
	wpLoadedDelta,
	offlineModeDelta
) {
	const firstPaintEmoji = firstPaintDelta > 0 ? '📈' : firstPaintDelta < 0 ? '📉' : '➡️';
	const wpLoadedEmoji = wpLoadedDelta > 0 ? '📈' : wpLoadedDelta < 0 ? '📉' : '➡️';
	const offlineModeEmoji = offlineModeDelta > 0 ? '📈' : offlineModeDelta < 0 ? '📉' : '➡️';

	return `## 📦 Bundle Size Report

### ${firstPaintEmoji} First Paint (Progress Bar Visible)
- **Current**: ${formatBytes(current.firstPaint.totalBytes)} in ${current.firstPaint.timestamp}ms
- **Base**: ${formatBytes(base.firstPaint.totalBytes)} in ${base.firstPaint.timestamp}ms
- **Delta**: ${formatDelta(firstPaintDelta)} (${formatDelta(current.firstPaint.timestamp - base.firstPaint.timestamp)} time)
- **Files**: ${current.firstPaint.fileCount} (was ${base.firstPaint.fileCount})

#### Top 10 Largest Files
${generateFileTable(current.firstPaint.largestFiles)}

### ${wpLoadedEmoji} WordPress Loaded (Site Ready)
- **Current**: ${formatBytes(current.wordpressLoaded.totalBytes)} in ${current.wordpressLoaded.timestamp}ms
- **Base**: ${formatBytes(base.wordpressLoaded.totalBytes)} in ${base.wordpressLoaded.timestamp}ms
- **Delta**: ${formatDelta(wpLoadedDelta)} (${formatDelta(current.wordpressLoaded.timestamp - base.wordpressLoaded.timestamp)} time)
- **Files**: ${current.wordpressLoaded.fileCount} (was ${base.wordpressLoaded.fileCount})

#### Top 10 Largest Files
${generateFileTable(current.wordpressLoaded.largestFiles)}

### ${offlineModeEmoji} Offline Mode Ready (All Downloads Settled)
- **Current**: ${formatBytes(current.offlineModeReady.totalBytes)} in ${current.offlineModeReady.timestamp}ms
- **Base**: ${formatBytes(base.offlineModeReady.totalBytes)} in ${base.offlineModeReady.timestamp}ms
- **Delta**: ${formatDelta(offlineModeDelta)} (${formatDelta(current.offlineModeReady.timestamp - base.offlineModeReady.timestamp)} time)
- **Files**: ${current.offlineModeReady.fileCount} (was ${base.offlineModeReady.fileCount})

#### Top 10 Largest Files
${generateFileTable(current.offlineModeReady.largestFiles)}
`;
}

/**
 * Main comparison function
 */
async function main() {
	const baseReportPath = process.argv[2] || 'bundle-size-report-base.json';
	const currentReportPath = process.argv[3] || 'bundle-size-report.json';

	console.log('Comparing bundle sizes...');
	console.log(`Base report: ${baseReportPath}`);
	console.log(`Current report: ${currentReportPath}`);

	const baseReport = loadReport(baseReportPath);
	const currentReport = loadReport(currentReportPath);

	if (!currentReport) {
		console.error(`Current report not found: ${currentReportPath}`);
		process.exit(1);
	}

	const comparison = compareReports(baseReport, currentReport);

	console.log('\n' + comparison.markdown);

	// Write markdown to file for GitHub Actions
	const fs = await import('fs/promises');
	await fs.writeFile('bundle-size-comment.md', comparison.markdown);

	// Output results for GitHub Actions
	console.log('\n=== GitHub Actions Output ===');
	console.log(`SHOULD_COMMENT=${comparison.shouldComment}`);
	if (comparison.firstPaintDelta !== undefined) {
		console.log(`FIRST_PAINT_DELTA=${comparison.firstPaintDelta}`);
	}
	if (comparison.wpLoadedDelta !== undefined) {
		console.log(`WP_LOADED_DELTA=${comparison.wpLoadedDelta}`);
	}
	if (comparison.offlineModeDelta !== undefined) {
		console.log(`OFFLINE_MODE_DELTA=${comparison.offlineModeDelta}`);
	}

	// Set GitHub Actions output
	if (process.env.GITHUB_OUTPUT) {
		const output = [
			`should_comment=${comparison.shouldComment}`,
			`first_paint_delta=${comparison.firstPaintDelta || 0}`,
			`wp_loaded_delta=${comparison.wpLoadedDelta || 0}`,
			`offline_mode_delta=${comparison.offlineModeDelta || 0}`,
		].join('\n');

		await fs.appendFile(process.env.GITHUB_OUTPUT, output + '\n');
	}
}

main().catch((error) => {
	console.error('Error comparing bundles:', error);
	process.exit(1);
});
