#!/usr/bin/env node
/**
 * Downloads PHP WASM binaries from npm into the correct source paths.
 *
 * Used by local developers (after git bisect, fresh clone) and by CI jobs
 * before building wasm-dependent packages.
 *
 * Version resolution per package:
 *   1. If .recompile-request.json has a compilation entry for the package,
 *      compute a deterministic pre-release version from the entry's requestedAt
 *      timestamp: {lernaVersion}-wasm.{YYYYMMDDTHHmmss}
 *   2. If that pre-release package is not yet on npm (CI still running),
 *      warn and fall back to the stable version from the package's package.json.
 *   3. Otherwise use the stable version from package.json.
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

// Read current lerna version as the stable baseline.
const lernaVersion = JSON.parse(
	fs.readFileSync(path.join(repoRoot, 'lerna.json'), 'utf8')
).version;

// Read per-entry recompile overrides from .recompile-request.json.
// Each entry carries its own requestedAt timestamp so multiple accumulated
// recompiles each have an independent, deterministic version.
// key format: "{platform}-{major}-{minor}-{variant}" e.g. "web-8-5-jspi"
const triggerFile = path.join(
	repoRoot,
	'packages/php-wasm/.recompile-request.json'
);
const recompileEntries = new Map(); // key -> requestedAt

if (fs.existsSync(triggerFile)) {
	const trigger = JSON.parse(fs.readFileSync(triggerFile, 'utf8'));
	for (const {
		platform,
		phpVersion,
		variant,
		requestedAt,
	} of trigger.compilations ?? []) {
		if (requestedAt) {
			const [major, minor] = phpVersion.split('.');
			recompileEntries.set(
				`${platform}-${major}-${minor}-${variant}`,
				requestedAt
			);
		}
	}
}

// Discover all WASM packages from the filesystem.
// key format: "{platform}-{major}-{minor}" e.g. "web-8-5"
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

let downloaded = 0;
let skipped = 0;

for (const key of allKeys) {
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

	// Determine which variants are missing.
	const missingVariants = ['jspi', 'asyncify'].filter(
		(variant) => !hasWasmFiles(path.join(buildsDir, variant))
	);

	if (missingVariants.length === 0) {
		const stableVersion = packageVersion(platform, major, minor);
		console.log(
			`[skip] @php-wasm/${key}@${stableVersion} — already present`
		);
		skipped++;
		continue;
	}

	// Determine the version to download. If any missing variant has a recompile
	// entry, use the latest requestedAt among them for the pre-release version.
	const stableVersion = packageVersion(platform, major, minor);
	let version = stableVersion;

	let latestRequestedAt = null;
	for (const variant of missingVariants) {
		const requestedAt = recompileEntries.get(`${key}-${variant}`);
		if (
			requestedAt &&
			(!latestRequestedAt || requestedAt > latestRequestedAt)
		) {
			latestRequestedAt = requestedAt;
		}
	}

	if (latestRequestedAt) {
		const compact = latestRequestedAt.replace(/[-:.Z]/g, '').slice(0, 15);
		const wasmVersion = `${lernaVersion}-wasm.${compact}`;

		// Check whether CI has already published this pre-release version.
		try {
			execSync(`npm view @php-wasm/${key}@${wasmVersion} version`, {
				stdio: 'pipe',
			});
			version = wasmVersion;
		} catch {
			console.warn(
				`[warn] @php-wasm/${key}@${wasmVersion} not yet on npm.\n` +
					`       CI may still be running. Using stable binaries for now.\n` +
					`       Re-run prepare-wasm once the "Compile PHP WASM" job completes.\n`
			);
		}
	}

	console.log(
		`[download] @php-wasm/${key}@${version} (missing: ${missingVariants.join(', ')})`
	);
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

		// Copy only the missing variant directories from the tarball.
		for (const variant of missingVariants) {
			const srcVariantDir = path.join(extractDir, 'package', variant);
			const destVariantDir = path.join(buildsDir, variant);
			if (fs.existsSync(srcVariantDir)) {
				fs.mkdirSync(destVariantDir, { recursive: true });
				copyDir(srcVariantDir, destVariantDir);
				console.log(`  -> extracted ${variant} to ${destVariantDir}`);
			}
		}

		++downloaded;
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

function packageVersion(platform, major, minor) {
	const pkgPath = path.join(
		repoRoot,
		`packages/php-wasm/${platform}-builds/${major}-${minor}/package.json`
	);

	return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

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
