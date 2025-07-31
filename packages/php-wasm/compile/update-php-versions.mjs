#!/usr/bin/env node

/**
 * Script to automatically update PHP version numbers in supported-php-versions.mjs
 *
 * This script fetches the latest release information from multiple sources:
 * - PHP.watch API for comprehensive version data
 * - phpreleases.com API as fallback
 * - Direct GitHub API for php/php-src releases
 *
 * Usage: node tools/update-php-versions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the supported PHP versions file
const SUPPORTED_VERSIONS_FILE = path.resolve(
	__dirname,
	'../supported-php-versions.mjs'
);

/**
 * Fetch data from a URL with error handling
 */
async function fetchJSON(url, description = '') {
	try {
		console.log(`Fetching ${description || url}...`);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		return await response.json();
	} catch (error) {
		console.warn(`Failed to fetch from ${url}: ${error.message}`);
		return null;
	}
}

/**
 * Fetch latest version data from GitHub API
 */
async function fetchFromGitHub() {
	let data = [];
	try {
		console.log('Fetching GitHub API for php/php-src tags (8 pages)...');

		// Fetch 8 pages in parallel to get more comprehensive tag data
		const pagePromises = [];
		for (let page = 1; page <= 8; page++) {
			pagePromises.push(
				fetch(
					`https://api.github.com/repos/php/php-src/tags?per_page=100&page=${page}`
				).then((response) => {
					if (!response.ok) {
						throw new Error(
							`HTTP ${response.status}: ${response.statusText}`
						);
					}
					return response.json();
				})
			);
		}

		const pageResults = await Promise.allSettled(pagePromises);

		// Combine successful results
		for (const result of pageResults) {
			if (result.status === 'fulfilled' && Array.isArray(result.value)) {
				data = data.concat(result.value);
			}
		}

		if (data.length === 0) {
			throw new Error('No tag data retrieved from any page');
		}
	} catch (error) {
		console.warn(`Failed to fetch from GitHub API: ${error.message}`);
		data = null;
	}
	if (!Array.isArray(data)) return null;

	const versions = {};

	// Process tags to extract version numbers
	for (const tag of data) {
		const tagName = tag.name;
		// Match patterns like "php-8.3.15", "php-8.2.26", etc.
		const match = tagName.match(/^php-(\d+)\.(\d+)\.(\d+)$/);
		if (match) {
			const [, major, minor, patch] = match;
			const version = `${major}.${minor}`;
			const fullVersion = `${major}.${minor}.${patch}`;

			// Keep the latest (highest) version for each major.minor
			if (
				!versions[version] ||
				compareVersions(fullVersion, versions[version]) > 0
			) {
				versions[version] = fullVersion;
			}
		}
	}

	return versions;
}

/**
 * Compare two semantic version strings
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
	const aParts = a.split('.').map(Number);
	const bParts = b.split('.').map(Number);

	for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
		const aVal = aParts[i] || 0;
		const bVal = bParts[i] || 0;

		if (aVal > bVal) return 1;
		if (aVal < bVal) return -1;
	}

	return 0;
}

/**
 * Merge version data from multiple sources, preferring more recent/reliable sources
 */
function mergeVersionData(...sources) {
	const merged = {};

	// Merge all sources, later sources take precedence
	for (const source of sources) {
		if (source) {
			Object.assign(merged, source);
		}
	}

	return merged;
}

/**
 * Read the current supported-php-versions.mjs file
 */
function readCurrentVersions() {
	try {
		const content = fs.readFileSync(SUPPORTED_VERSIONS_FILE, 'utf8');

		// Extract the phpVersions array using regex
		const arrayMatch = content.match(
			/export const phpVersions = (\[[\s\S]*?\]);/
		);
		if (!arrayMatch) {
			throw new Error('Could not find phpVersions array in file');
		}

		// Parse the array (this is a bit hacky but works for our specific format)
		const arrayString = arrayMatch[1];

		// Extract version objects using regex
		const versionMatches = arrayString.matchAll(
			/\{[\s\S]*?version:\s*['"`]([^'"`]+)['"`][\s\S]*?lastRelease:\s*['"`]([^'"`]+)['"`][\s\S]*?\}/g
		);

		const versions = [];
		for (const match of versionMatches) {
			const [fullMatch, version, lastRelease] = match;

			// Extract other properties
			const loaderMatch = fullMatch.match(
				/loaderFilename:\s*['"`]([^'"`]+)['"`]/
			);
			const wasmMatch = fullMatch.match(
				/wasmFilename:\s*['"`]([^'"`]+)['"`]/
			);

			versions.push({
				version,
				loaderFilename: loaderMatch
					? loaderMatch[1]
					: `php_${version.replace('.', '_')}.js`,
				wasmFilename: wasmMatch
					? wasmMatch[1]
					: `php_${version.replace('.', '_')}.wasm`,
				lastRelease,
			});
		}

		return versions;
	} catch (error) {
		console.error(`Error reading current versions: ${error.message}`);
		return [];
	}
}

/**
 * Update the supported-php-versions.mjs file with new version data
 */
function updateVersionsFile(currentVersions, latestVersions) {
	let updatedCount = 0;

	// Update last release versions
	const updatedVersions = currentVersions.map((versionObj) => {
		const version = versionObj.version;
		const newVersion = latestVersions[version];

		if (newVersion && newVersion !== versionObj.lastRelease) {
			console.log(
				`Updating ${version}: ${versionObj.lastRelease} → ${newVersion}`
			);
			updatedCount++;
			return {
				...versionObj,
				lastRelease: newVersion,
			};
		}

		return versionObj;
	});

	// Generate the new file content
	const fileContent = generateFileContent(updatedVersions);

	// Write the updated file
	fs.writeFileSync(SUPPORTED_VERSIONS_FILE, fileContent, 'utf8');

	console.log(
		`\nUpdated ${updatedCount} PHP versions in ${SUPPORTED_VERSIONS_FILE}`
	);
	return updatedCount;
}

/**
 * Generate the complete file content for supported-php-versions.mjs
 */
function generateFileContent(versions) {
	const header = `/**
 * @typedef {Object} PhpVersion
 * @property {string} version
 * @property {string} loaderFilename
 * @property {string} wasmFilename
 * @property {string} lastRelease
 */

export const lastRefreshed = ${JSON.stringify(new Date().toISOString())};

/**
 * @type {PhpVersion[]}
 * @see https://www.php.net/releases/index.php
 */
export const phpVersions = [`;

	const footer = `];
`;

	const versionEntries = versions
		.map((version) => {
			return `\t{
\t\tversion: '${version.version}',
\t\tloaderFilename: '${version.loaderFilename}',
\t\twasmFilename: '${version.wasmFilename}',
\t\tlastRelease: '${version.lastRelease}',
\t}`;
		})
		.join(',\n');

	return header + '\n' + versionEntries + '\n' + footer;
}

/**
 * Main function
 */
export async function updatePHPVersions() {
	console.log('🔄 Updating PHP versions...\n');

	// Fetch version data from multiple sources
	console.log('📡 Fetching version data from APIs...');
	const latestVersions = await fetchFromGitHub();

	if (Object.keys(latestVersions).length === 0) {
		console.error('❌ Failed to fetch version data from any source');
		process.exit(1);
	}

	console.log('\n📋 Latest versions found:');
	for (const [version, release] of Object.entries(latestVersions)) {
		console.log(`  ${version}: ${release}`);
	}

	// Read current versions
	console.log('\n📖 Reading current supported-php-versions.mjs...');
	const currentVersions = readCurrentVersions();

	if (currentVersions.length === 0) {
		console.error('❌ Failed to read current versions');
		process.exit(1);
	}

	// Update the file
	console.log('\n✏️  Updating versions...');
	const updatedCount = updateVersionsFile(currentVersions, latestVersions);

	if (updatedCount > 0) {
		console.log('\n✅ Successfully updated PHP versions!');
	} else {
		console.log('\n✨ All PHP versions are already up to date!');
	}
}
