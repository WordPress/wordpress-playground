#!/usr/bin/env node
/**
 * Downloads PHP WASM binaries from npm into the correct source paths.
 *
 * Used by local developers (after git bisect, fresh clone) and by CI jobs
 * before building wasm-dependent packages.
 *
 * Package versions default to the current lerna.json version. The file
 * packages/php-wasm/wasm-versions.json is an optional sparse overrides map
 * used during active WASM recompiles to point specific packages at PR/SHA
 * pre-release builds. It is reset to {} on every stable release.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import tarFs from 'tar-fs';
import { fileURLToPath } from 'url';
import { createGunzip } from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');
const versionsFile = path.join(
	repoRoot,
	'packages/php-wasm/wasm-versions.json'
);

// Default version comes from lerna.json (the current stable release).
// wasm-versions.json only stores overrides for PR/SHA pre-release builds.
const defaultVersion = JSON.parse(
	fs.readFileSync(path.join(repoRoot, 'lerna.json'), 'utf8')
).version;
const versions = JSON.parse(fs.readFileSync(versionsFile, 'utf8'));

// Build the full list of packages from the filesystem so wasm-versions.json
// only needs to contain overrides, not every entry.
const allKeys = [];
for (const platform of ['web', 'node']) {
	const buildsDir = path.join(
		repoRoot,
		`packages/php-wasm/${platform}-builds`
	);

	if (fs.existsSync(buildsDir)) {
		for (const entry of fs.readdirSync(buildsDir, {
			withFileTypes: true,
		})) {
			if (entry.isDirectory() && /^\d+-\d+$/.test(entry.name)) {
				allKeys.push(`${platform}-${entry.name}`);
			}
		}
	}
}

// Warn if a recompile was requested but CI hasn't published PR builds yet.
const triggerFile = path.join(
	repoRoot,
	'packages/php-wasm/.recompile-request.json'
);

if (fs.existsSync(triggerFile)) {
	const trigger = JSON.parse(fs.readFileSync(triggerFile, 'utf8'));
	const stale = (trigger.compilations ?? []).filter(
		({ platform, phpVersion }) => {
			const [major, minor] = phpVersion.split('.');
			const key = `${platform}-${major}-${minor}`;
			const version = versions[key] ?? defaultVersion;
			return !version.includes('-pr.');
		}
	);

	if (stale.length > 0) {
		const list = stale
			.map((c) => `  - ${c.platform} PHP ${c.phpVersion}`)
			.join('\n');
		console.warn(
			`\nWARNING: .recompile-request.json exists but wasm-versions.json still points\n` +
				`to stable versions for the following entries (CI may not have finished yet):\n` +
				`${list}\n` +
				`You are downloading the previous stable binaries — not the recompiled ones.\n` +
				`Wait for the "Compile PHP WASM" CI job to complete and re-run prepare-wasm.\n`
		);
	}
}

let downloaded = 0;
let skipped = 0;

for (const key of allKeys) {
	const version = versions[key] ?? defaultVersion;
	// key format: "{platform}-{major}-{minor}" e.g. "web-8-5"
	const parts = key.split('-');
	const platform = parts[0]; // "web" or "node"
	const major = parts[1];
	const minor = parts[2];
	const versionDir = `${major}-${minor}`;
	const buildsDir = path.join(
		repoRoot,
		`packages/php-wasm/${platform}-builds/${versionDir}`
	);
	const jspiDir = path.join(buildsDir, 'jspi');
	const asyncifyDir = path.join(buildsDir, 'asyncify');

	const jspiExists = hasWasmFiles(jspiDir);
	const asyncifyExists = hasWasmFiles(asyncifyDir);

	if (jspiExists && asyncifyExists) {
		console.log(`[skip] @php-wasm/${key}@${version} — already present`);
		skipped++;
		continue;
	}

	console.log(`[download] @php-wasm/${key}@${version}`);
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `php-wasm-${key}-`));

	try {
		// npm pack downloads the tarball without installing
		execSync(`npm pack @php-wasm/${key}@${version} --pack-destination .`, {
			cwd: tmpDir,
			stdio: 'pipe',
		});

		// Find the downloaded tarball
		const tarballs = fs
			.readdirSync(tmpDir)
			.filter((f) => f.endsWith('.tgz'));
		if (tarballs.length === 0) {
			throw new Error(`No tarball found in ${tmpDir}`);
		}
		const tarball = path.join(tmpDir, tarballs[0]);

		// Extract tarball (pure Node.js — avoids system tar issues on Windows)
		const extractDir = path.join(tmpDir, 'extracted');
		fs.mkdirSync(extractDir);
		await new Promise((resolve, reject) => {
			fs.createReadStream(tarball)
				.pipe(createGunzip())
				.pipe(tarFs.extract(extractDir))
				.on('finish', resolve)
				.on('error', reject);
		});

		// The tarball contains a "package/" directory
		const packageDir = path.join(extractDir, 'package');

		// Copy jspi/ and asyncify/ directories to the source path
		for (const variant of ['jspi', 'asyncify']) {
			const srcVariantDir = path.join(packageDir, variant);
			const destVariantDir = path.join(buildsDir, variant);
			if (fs.existsSync(srcVariantDir)) {
				fs.mkdirSync(destVariantDir, { recursive: true });
				copyDir(srcVariantDir, destVariantDir);
			}
		}

		++downloaded;
		console.log(`  -> extracted to ${buildsDir}`);
	} catch (err) {
		console.error(
			`[error] Failed to download @php-wasm/${key}@${version}: ${err.message}`
		);
		process.exit(1);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

console.log(`\nDone: ${downloaded} downloaded, ${skipped} skipped.`);

function hasWasmFiles(dir) {
	if (!fs.existsSync(dir)) return false;
	const files = fs.readdirSync(dir);
	return files.some((f) => f.endsWith('.wasm'));
}

function copyDir(src, dest) {
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true });
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}
