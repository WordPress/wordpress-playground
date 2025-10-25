#!/usr/bin/env node

/**
 * Analyze bundle size for the Playground website build
 *
 * This script:
 * 1. Scans the dist directory for built assets
 * 2. Calculates sizes for assets required for first paint and offline mode
 * 3. Outputs a JSON report with detailed size information
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { tmpdir } from 'os';

const DIST_DIR = 'dist/packages/playground/wasm-wordpress-net';

/**
 * Calculate gzipped size of a file
 */
async function getGzipSize(filePath) {
	const tempFile = join(tmpdir(), `temp-${Date.now()}.gz`);
	try {
		await pipeline(
			createReadStream(filePath),
			createGzip({ level: 9 }),
			createWriteStream(tempFile)
		);
		const stats = statSync(tempFile);
		return stats.size;
	} catch (error) {
		console.error(`Error calculating gzip size for ${filePath}:`, error);
		return 0;
	}
}

/**
 * Get all files recursively from a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
	if (!existsSync(dirPath)) {
		return arrayOfFiles;
	}

	const files = readdirSync(dirPath);

	files.forEach((file) => {
		const filePath = join(dirPath, file);
		if (statSync(filePath).isDirectory()) {
			getAllFiles(filePath, arrayOfFiles);
		} else {
			arrayOfFiles.push(filePath);
		}
	});

	return arrayOfFiles;
}

/**
 * Get file size information
 */
async function getFileInfo(filePath, baseDir) {
	const stats = statSync(filePath);
	const gzipSize = await getGzipSize(filePath);
	const relativePath = relative(baseDir, filePath);

	return {
		path: '/' + relativePath.replace(/\\/g, '/'),
		size: stats.size,
		gzipSize,
	};
}

/**
 * Determine if a file is required for first paint
 * First paint requires: HTML, critical CSS, initial JS bundles, service worker
 *
 * Based on the actual loading sequence:
 * 1. index.html loads
 * 2. Main app bundle (from src/main) loads
 * 3. Critical CSS loads
 * 4. Service worker registers
 * 5. remote.html loads in an iframe
 * 6. Remote app bundle loads
 */
function isFirstPaintAsset(path) {
	// Root HTML files are critical
	if (path === '/index.html' || path === '/remote.html') {
		return true;
	}

	// Ignore demos, builder, and WordPress content
	if (
		path.startsWith('/demos/') ||
		path.startsWith('/builder/') ||
		path.startsWith('/wp-')
	) {
		return false;
	}

	// Manifest and service worker files
	if (
		path.includes('manifest.json') ||
		path.includes('service-worker') ||
		path === '/favicon.ico'
	) {
		return true;
	}

	// Assets directory
	if (path.startsWith('/assets/')) {
		// Exclude optional chunks (CodeMirror, etc.)
		if (path.includes('/optional/')) {
			return false;
		}

		// Exclude large runtime-loaded assets
		if (
			path.match(/\/php_.*\.(wasm|js)$/) ||
			path.match(/\/wp-.*\.zip$/) ||
			path.match(/\/sqlite-database-integration-.*\.zip$/) ||
			path.match(/\/blueprints-.*\.phar$/)
		) {
			return false;
		}

		// Include core JS and CSS bundles
		// These are the chunks that vite creates for the initial load
		if (path.match(/\.(js|css)$/)) {
			return true;
		}

		return false;
	}

	// Include root-level CSS and JS files (if any)
	if (path.match(/\.(js|css)$/) && path.split('/').length === 2) {
		return true;
	}

	return false;
}

/**
 * Main analysis function
 */
async function analyzeBundle() {
	const baseDir = join(process.cwd(), DIST_DIR);

	if (!existsSync(baseDir)) {
		console.error(`Build directory not found: ${baseDir}`);
		console.error('Please run the build first: npm run build:website');
		process.exit(1);
	}

	console.log('Analyzing bundle size...');
	console.log(`Base directory: ${baseDir}`);

	// Get all files
	const allFiles = getAllFiles(baseDir);
	console.log(`Found ${allFiles.length} files`);

	// Get file information for all files
	const fileInfoPromises = allFiles.map((file) => getFileInfo(file, baseDir));
	const fileInfos = await Promise.all(fileInfoPromises);

	// Load offline mode assets list if it exists
	let offlineModeAssets = [];
	const offlineModeManifestPath = join(
		baseDir,
		'assets-required-for-offline-mode.json'
	);
	if (existsSync(offlineModeManifestPath)) {
		const manifest = JSON.parse(
			readFileSync(offlineModeManifestPath, 'utf-8')
		);
		offlineModeAssets = manifest;
	}

	// Categorize files
	const firstPaintAssets = fileInfos.filter((file) =>
		isFirstPaintAsset(file.path)
	);
	const offlineModeAssetInfos = fileInfos.filter((file) =>
		offlineModeAssets.includes(file.path)
	);

	// Calculate totals
	const calculateTotals = (assets) => {
		return assets.reduce(
			(acc, file) => {
				acc.size += file.size;
				acc.gzipSize += file.gzipSize;
				return acc;
			},
			{ size: 0, gzipSize: 0 }
		);
	};

	const firstPaintTotals = calculateTotals(firstPaintAssets);
	const offlineModeTotals = calculateTotals(offlineModeAssetInfos);

	// Sort files by gzipped size (largest first)
	const sortedFirstPaint = [...firstPaintAssets].sort(
		(a, b) => b.gzipSize - a.gzipSize
	);
	const sortedOfflineMode = [...offlineModeAssetInfos].sort(
		(a, b) => b.gzipSize - a.gzipSize
	);

	// Generate report
	const report = {
		timestamp: new Date().toISOString(),
		firstPaint: {
			totalSize: firstPaintTotals.size,
			totalGzipSize: firstPaintTotals.gzipSize,
			fileCount: firstPaintAssets.length,
			largestFiles: sortedFirstPaint.slice(0, 10),
			allFiles: firstPaintAssets,
		},
		offlineMode: {
			totalSize: offlineModeTotals.size,
			totalGzipSize: offlineModeTotals.gzipSize,
			fileCount: offlineModeAssetInfos.length,
			largestFiles: sortedOfflineMode.slice(0, 10),
			allFiles: offlineModeAssetInfos,
		},
	};

	// Output report
	console.log('\n=== Bundle Size Report ===\n');
	console.log('First Paint Assets:');
	console.log(
		`  Total: ${(firstPaintTotals.gzipSize / 1024).toFixed(2)} KB (gzipped)`
	);
	console.log(`  Files: ${firstPaintAssets.length}`);
	console.log('\nOffline Mode Assets:');
	console.log(
		`  Total: ${(offlineModeTotals.gzipSize / 1024).toFixed(
			2
		)} KB (gzipped)`
	);
	console.log(`  Files: ${offlineModeAssetInfos.length}`);

	// Write report to file
	const reportPath = join(process.cwd(), 'bundle-size-report.json');
	const fs = await import('fs/promises');
	await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
	console.log(`\nReport written to: ${reportPath}`);

	return report;
}

// Run the analysis
analyzeBundle().catch((error) => {
	console.error('Error analyzing bundle:', error);
	process.exit(1);
});
