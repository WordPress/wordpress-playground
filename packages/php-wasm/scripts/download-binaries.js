#!/usr/bin/env node
/**
 * Downloads PHP WASM binaries from the GitHub Release referenced in
 * packages/php-wasm/binaries-manifest.json and extracts them to the
 * correct locations under packages/php-wasm/web-builds/ and
 * packages/php-wasm/node-builds/.
 *
 * Runs automatically via the postinstall npm script. Can also be run
 * manually:
 *   node packages/php-wasm/scripts/download-binaries.js
 *   npm run setup:binaries
 *
 * Environment variables:
 *   SKIP_BINARIES_DOWNLOAD=1 Skip this script entirely (used by the
 *       publish-php-wasm-binaries CI workflow which builds fresh binaries itself).
 */

import { execSync } from 'child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

// Allow CI workflows that build fresh binaries to opt out.
if (process.env.SKIP_BINARIES_DOWNLOAD === '1') {
	process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../../..');
const manifestPath = join(rootDir, 'packages/php-wasm/binaries-manifest.json');
const sentinelPath = join(rootDir, 'packages/php-wasm/.binaries-downloaded');

if (!existsSync(manifestPath)) {
	// Manifest is committed to git, so this should never happen in practice.
	console.warn(
		'Warning: packages/php-wasm/binaries-manifest.json not found.'
	);
	process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { releaseTag, commitSha } = manifest;

if (!releaseTag) {
	// Phase 1 infrastructure not yet active — binaries are still in git.
	console.log(
		'PHP WASM binaries manifest has no release yet. ' +
			'Binaries are expected to be present in the repository.'
	);
	process.exit(0);
}

// Skip if the current release is already downloaded.
if (
	existsSync(sentinelPath) &&
	readFileSync(sentinelPath, 'utf8').trim() === releaseTag
) {
	console.log(`PHP WASM binaries already up to date (${releaseTag}).`);
	process.exit(0);
}

console.log(`Downloading PHP WASM binaries from release: ${releaseTag}`);
console.log(`Commit: ${commitSha}`);

// Verify gh CLI is available.
try {
	execSync('gh --version', { stdio: 'ignore' });
} catch {
	console.warn(
		'Warning: the `gh` CLI is required to download PHP WASM binaries ' +
			'but was not found. Install it from https://cli.github.com/ and ' +
			'run `gh auth login`, then run `npm run setup:binaries`.'
	);
	process.exit(0);
}

const downloadDir = join(tmpdir(), `php-wasm-downloads-${Date.now()}`);
mkdirSync(downloadDir, { recursive: true });

try {
	console.log(`Downloading tarballs to ${downloadDir} ...`);
	execSync(
		`gh release download "${releaseTag}" ` +
			`--repo WordPress/wordpress-playground ` +
			`--dir "${downloadDir}" ` +
			`--pattern "*.tar.gz"`,
		{ stdio: 'inherit' }
	);

	const files = readdirSync(downloadDir).filter((f) => f.endsWith('.tar.gz'));

	if (files.length === 0) {
		console.error('No tarballs found in the release. Aborting.');
		process.exit(1);
	}

	for (const file of files) {
		// File format: "web-builds-8-4.tar.gz" or "node-builds-8-4.tar.gz"
		const match = file.match(/^(web|node)-builds-(\d+-\d+)\.tar\.gz$/);
		if (!match) {
			console.warn(`Skipping unexpected file: ${file}`);
			continue;
		}

		const [, platform, version] = match;
		const targetDir = join(rootDir, `packages/php-wasm/${platform}-builds`);

		console.log(`Extracting ${file} -> ${targetDir}/${version}/`);
		execSync(`tar xzf "${join(downloadDir, file)}" -C "${targetDir}"`, {
			stdio: 'inherit',
		});
	}

	// Record the downloaded release so subsequent installs are skipped.
	writeFileSync(sentinelPath, releaseTag);

	console.log('PHP WASM binaries downloaded successfully.');
} finally {
	execSync(`rm -rf "${downloadDir}"`);
}
