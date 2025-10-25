#!/usr/bin/env node

/**
 * Compare bundle sizes between current and base branch
 *
 * This script:
 * 1. Loads bundle size reports from both branches
 * 2. Calculates differences
 * 3. Generates a markdown report for GitHub PR comments
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const THRESHOLD_KB = 50; // Threshold for posting a comment

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
	return `${(bytes / 1024).toFixed(2)} KB`;
}

/**
 * Format size delta with color indicator
 */
function formatDelta(delta) {
	if (delta === 0) return '0 KB';
	const sign = delta > 0 ? '+' : '';
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
 * Compare two reports and generate markdown
 */
function compareReports(baseReport, currentReport) {
	if (!baseReport) {
		return {
			shouldComment: true,
			markdown: generateNewBuildReport(currentReport),
		};
	}

	// Calculate deltas
	const firstPaintDelta =
		currentReport.firstPaint.totalGzipSize -
		baseReport.firstPaint.totalGzipSize;
	const offlineModeDelta =
		currentReport.offlineMode.totalGzipSize -
		baseReport.offlineMode.totalGzipSize;

	// Determine if we should post a comment
	const firstPaintThresholdExceeded =
		Math.abs(firstPaintDelta) >= THRESHOLD_KB * 1024;
	const offlineModeThresholdExceeded =
		Math.abs(offlineModeDelta) >= THRESHOLD_KB * 1024;
	const shouldComment =
		firstPaintThresholdExceeded || offlineModeThresholdExceeded;

	// Generate markdown
	const markdown = generateComparisonReport(
		baseReport,
		currentReport,
		firstPaintDelta,
		offlineModeDelta
	);

	return {
		shouldComment,
		markdown,
		firstPaintDelta,
		offlineModeDelta,
	};
}

/**
 * Generate a report for a new build (no base to compare against)
 */
function generateNewBuildReport(report) {
	return `## 📦 Bundle Size Report

### Assets Required for First Paint
- **Total Size**: ${formatBytes(report.firstPaint.totalGzipSize)} (gzipped)
- **File Count**: ${report.firstPaint.fileCount}

#### Top 10 Largest Files
${generateFileTable(report.firstPaint.largestFiles)}

### Assets Required for Offline Mode
- **Total Size**: ${formatBytes(report.offlineMode.totalGzipSize)} (gzipped)
- **File Count**: ${report.offlineMode.fileCount}

#### Top 10 Largest Files
${generateFileTable(report.offlineMode.largestFiles)}
`;
}

/**
 * Generate a comparison report
 */
function generateComparisonReport(
	baseReport,
	currentReport,
	firstPaintDelta,
	offlineModeDelta
) {
	const firstPaintEmoji =
		firstPaintDelta > 0 ? '📈' : firstPaintDelta < 0 ? '📉' : '➡️';
	const offlineModeEmoji =
		offlineModeDelta > 0 ? '📈' : offlineModeDelta < 0 ? '📉' : '➡️';

	let markdown = `## 📦 Bundle Size Report

`;

	// First Paint Section
	markdown += `### ${firstPaintEmoji} Assets Required for First Paint
- **Current Size**: ${formatBytes(
		currentReport.firstPaint.totalGzipSize
	)} (gzipped)
- **Base Size**: ${formatBytes(baseReport.firstPaint.totalGzipSize)} (gzipped)
- **Delta**: ${formatDelta(firstPaintDelta)}
- **File Count**: ${currentReport.firstPaint.fileCount} (was ${
		baseReport.firstPaint.fileCount
	})

`;

	// Add file comparison for first paint
	const firstPaintFileDeltas = calculateFileDeltas(
		baseReport.firstPaint.allFiles,
		currentReport.firstPaint.allFiles
	);

	if (firstPaintFileDeltas.length > 0) {
		markdown += `#### Files with Largest Changes\n`;
		markdown += generateDeltaTable(firstPaintFileDeltas.slice(0, 10));
		markdown += '\n';
	}

	markdown += `#### Top 10 Largest Files\n`;
	markdown += generateFileTable(currentReport.firstPaint.largestFiles);
	markdown += '\n';

	// Offline Mode Section
	markdown += `### ${offlineModeEmoji} Assets Required for Offline Mode
- **Current Size**: ${formatBytes(
		currentReport.offlineMode.totalGzipSize
	)} (gzipped)
- **Base Size**: ${formatBytes(baseReport.offlineMode.totalGzipSize)} (gzipped)
- **Delta**: ${formatDelta(offlineModeDelta)}
- **File Count**: ${currentReport.offlineMode.fileCount} (was ${
		baseReport.offlineMode.fileCount
	})

`;

	// Add file comparison for offline mode
	const offlineModeFileDeltas = calculateFileDeltas(
		baseReport.offlineMode.allFiles,
		currentReport.offlineMode.allFiles
	);

	if (offlineModeFileDeltas.length > 0) {
		markdown += `#### Files with Largest Changes\n`;
		markdown += generateDeltaTable(offlineModeFileDeltas.slice(0, 10));
		markdown += '\n';
	}

	markdown += `#### Top 10 Largest Files\n`;
	markdown += generateFileTable(currentReport.offlineMode.largestFiles);

	return markdown;
}

/**
 * Calculate file-level deltas
 */
function calculateFileDeltas(baseFiles, currentFiles) {
	const baseMap = new Map(baseFiles.map((f) => [f.path, f]));
	const currentMap = new Map(currentFiles.map((f) => [f.path, f]));

	const deltas = [];

	// Check for modified and new files
	for (const [path, currentFile] of currentMap) {
		const baseFile = baseMap.get(path);
		if (baseFile) {
			const delta = currentFile.gzipSize - baseFile.gzipSize;
			if (delta !== 0) {
				deltas.push({
					path,
					delta,
					currentSize: currentFile.gzipSize,
					baseSize: baseFile.gzipSize,
					status: 'modified',
				});
			}
		} else {
			deltas.push({
				path,
				delta: currentFile.gzipSize,
				currentSize: currentFile.gzipSize,
				baseSize: 0,
				status: 'added',
			});
		}
	}

	// Check for removed files
	for (const [path, baseFile] of baseMap) {
		if (!currentMap.has(path)) {
			deltas.push({
				path,
				delta: -baseFile.gzipSize,
				currentSize: 0,
				baseSize: baseFile.gzipSize,
				status: 'removed',
			});
		}
	}

	// Sort by absolute delta (largest changes first)
	return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Generate a markdown table for files
 */
function generateFileTable(files) {
	let table = '| File | Size (gzipped) |\n';
	table += '|------|---------------:|\n';

	for (const file of files) {
		table += `| \`${file.path}\` | ${formatBytes(file.gzipSize)} |\n`;
	}

	return table;
}

/**
 * Generate a markdown table for file deltas
 */
function generateDeltaTable(deltas) {
	let table = '| File | Delta | Current | Previous | Status |\n';
	table += '|------|------:|--------:|---------:|:------:|\n';

	for (const delta of deltas) {
		const statusEmoji =
			delta.status === 'added'
				? '🆕'
				: delta.status === 'removed'
				? '🗑️'
				: delta.delta > 0
				? '📈'
				: '📉';

		table += `| \`${delta.path}\` | ${formatDelta(
			delta.delta
		)} | ${formatBytes(delta.currentSize)} | ${formatBytes(
			delta.baseSize
		)} | ${statusEmoji} |\n`;
	}

	return table;
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
	if (comparison.offlineModeDelta !== undefined) {
		console.log(`OFFLINE_MODE_DELTA=${comparison.offlineModeDelta}`);
	}

	// Set GitHub Actions output
	if (process.env.GITHUB_OUTPUT) {
		const output = [
			`should_comment=${comparison.shouldComment}`,
			`first_paint_delta=${comparison.firstPaintDelta || 0}`,
			`offline_mode_delta=${comparison.offlineModeDelta || 0}`,
		].join('\n');

		await fs.appendFile(process.env.GITHUB_OUTPUT, output + '\n');
	}
}

main().catch((error) => {
	console.error('Error comparing bundles:', error);
	process.exit(1);
});
