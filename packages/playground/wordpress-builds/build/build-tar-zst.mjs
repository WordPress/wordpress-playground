#!/usr/bin/env node
//
// build-tar-zst.mjs — re-container minified `wp-<v>.zip` source core
// bundles into deterministic, zstd-compressed solid tars (`wp-<v>.tar.zst`) that
// the browser runtime extracts by streaming (see
// packages/playground/wordpress/src/streaming-tar-extract.ts), and regenerate
// src/wordpress/get-wordpress-module-details.ts with the new descriptor
// (format/container/codec/size/sha256/fileCount).
//
// Deterministic USTAR + GNU longlink (never PAX — the streaming parser and PHP
// tar readers do not honor PAX 'path' headers). zstd level 19 + long-distance
// matching. Requires Node >= 22.15 (native node:zlib zstd).
//
// Usage:
//   node build/build-tar-zst.mjs --all [--window-log=24]
//   node build/build-tar-zst.mjs --version=6.9 [--window-log=27] [--no-descriptor]
//   node build/build-tar-zst.mjs --verify           # recompute sha256, compare to descriptor
//
// The re-container path uses the `unzip` CLI (no fflate dependency, matching the
// repo's dependency-light build tooling). `build.js` creates a transient ZIP via
// Docker and then calls this script; the shipped artifact is the solid tar.zst.

import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';
import {
	createUstarTar,
	normalizeEntries,
	readUstarTar,
	sanitizeArchivePath,
} from './lib/tar-ustar.mjs';
import { generateModuleDetailsSource } from './lib/generate-module-details.mjs';

if (typeof zlib.zstdCompressSync !== 'function') {
	console.error('Node >= 22.15 (native node:zlib zstd) is required.');
	process.exit(1);
}

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WP_DIR = path.resolve(HERE, '../src/wordpress');
const VERSIONS_PATH = path.join(WP_DIR, 'wp-versions.json');
const DETAILS_PATH = path.join(WP_DIR, 'get-wordpress-module-details.ts');

// Kept in sync with build.js. `trunk`/`nightly` stay GitHub ZIP downloads.
const remoteWordPressModules = {
	trunk: {
		url:
			process.env.PLAYGROUND_TRUNK_ZIP_URL ??
			'https://github.com/WordPress/WordPress/archive/refs/heads/master.zip',
		size: 0,
	},
};

function parseArgs(argv) {
	const opts = {
		all: false,
		version: null,
		// windowLog 25 (32 MiB): same compression as 27 for these <=40 MiB
		// bundles, but a bounded multi-segment sliding window instead of the
		// single-segment whole-content buffer that >=26 forces on the decoder.
		windowLog: 25,
		descriptor: true,
		descriptorOnly: false,
		deleteZip: false,
		verify: false,
	};
	for (const arg of argv) {
		if (arg === '--all') opts.all = true;
		else if (arg === '--verify') opts.verify = true;
		else if (arg === '--no-descriptor') opts.descriptor = false;
		else if (arg === '--descriptor-only') opts.descriptorOnly = true;
		else if (arg === '--delete-zip') opts.deleteZip = true;
		else if (arg.startsWith('--version=')) opts.version = arg.slice(10);
		else if (arg.startsWith('--window-log='))
			opts.windowLog = Number.parseInt(arg.slice(13), 10);
		else {
			console.error(`Unknown argument: ${arg}`);
			process.exit(1);
		}
	}
	return opts;
}

function readVersions() {
	return JSON.parse(readFileSync(VERSIONS_PATH, 'utf8'));
}

function localSlugs(versions) {
	const remote = new Set(Object.keys(remoteWordPressModules));
	return Object.keys(versions).filter((slug) => !remote.has(slug));
}

/** Recursively read a directory into a { relativePath -> Uint8Array } map. */
function readTreeIntoFileMap(root) {
	const fileMap = {};
	const walk = (dir, prefix) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const abs = path.join(dir, entry.name);
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				walk(abs, rel);
				fileMap[`${rel}/`] = new Uint8Array();
			} else if (entry.isFile()) {
				// `wordpress-static.zip` is served from
				// packages/playground/wordpress-builds/public/wp-<version>/ for
				// static-asset backfilling. Keeping a second copy in the core
				// boot bundle makes cold starts download the same large archive
				// twice, so strip it from existing source ZIPs during the
				// transition. Fresh Docker builds no longer add it there.
				if (rel === 'wordpress-static.zip') {
					continue;
				}
				fileMap[rel] = new Uint8Array(readFileSync(abs));
			}
			// symlinks/other types: WordPress core bundles contain none; skip.
		}
	};
	walk(root, '');
	return fileMap;
}

function compressTarZst(tar, windowLog) {
	return zlib.zstdCompressSync(tar, {
		params: {
			[zlib.constants.ZSTD_c_compressionLevel]: 19,
			[zlib.constants.ZSTD_c_enableLongDistanceMatching]: 1,
			[zlib.constants.ZSTD_c_windowLog]: windowLog,
		},
	});
}

/** Re-container one wp-<slug>.zip into wp-<slug>.tar.zst; returns descriptor meta. */
function buildOne(slug, windowLog, deleteZip = false) {
	const zipPath = path.join(WP_DIR, `wp-${slug}.zip`);
	if (!existsSync(zipPath)) {
		throw new Error(`Missing source bundle: ${zipPath}`);
	}
	const tmp = mkdtempSync(path.join(tmpdir(), 'wp-tarzst-'));
	try {
		validateZipListing(zipPath);
		runUnzip(['-q', '-o', zipPath, '-d', tmp], `extracting ${zipPath}`, {
			stdio: ['ignore', 'ignore', 'inherit'],
		});
		const fileMap = readTreeIntoFileMap(tmp);
		const entries = normalizeEntries(fileMap);
		const files = entries.filter((entry) => entry.type !== 'dir');
		const dirCount = entries.length - files.length;
		const uncompressedBytes = entries.reduce(
			(n, e) => n + (e.type === 'dir' ? 0 : e.data.length),
			0
		);
		const tar = createUstarTar(entries, { mtime: 0 });
		const compressed = compressTarZst(tar, windowLog);
		const tarMib = (tar.length / 1048576).toFixed(2);
		const compressedMib = (compressed.length / 1048576).toFixed(2);
		const outPath = path.join(WP_DIR, `wp-${slug}.tar.zst`);
		writeFileSync(outPath, compressed);
		const sha256 = createHash('sha256').update(compressed).digest('hex');
		const meta = {
			slug,
			fileCount: files.length,
			dirCount,
			size: compressed.length,
			sha256,
			uncompressedBytes,
			tarBytes: tar.length,
			windowLog,
		};
		console.log(
			`wp-${slug}: ${files.length} files, ${dirCount} dirs, ` +
				`tar ${tarMib} MiB → tar.zst ${compressedMib} MiB ` +
				`(wlog ${windowLog}), sha256 ${sha256.slice(0, 12)}…`
		);
		if (deleteZip) {
			// The zip is now a transient build source; tar.zst is the shipped
			// core bundle.
			rmSync(zipPath, { force: true });
		}
		return meta;
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

function validateZipListing(zipPath) {
	const result = runUnzip(['-Z1', zipPath], `listing ${zipPath}`, {
		encoding: 'utf8',
	});
	for (const name of result.stdout.split('\n')) {
		if (!name) continue;
		if (name.includes('\\')) {
			throw new Error(`Unsafe ZIP entry path (backslash): ${name}`);
		}
		if (name.startsWith('/')) {
			throw new Error(`Unsafe ZIP entry path (absolute): ${name}`);
		}
		sanitizeArchivePath(name.endsWith('/') ? name.slice(0, -1) : name);
	}
}

function runUnzip(args, description, options = {}) {
	const result = spawnSync('unzip', args, options);
	if (result.error?.code === 'ENOENT') {
		throw new Error(
			'The `unzip` CLI is required to rebuild WordPress core tar.zst bundles. ' +
				'Install Info-ZIP unzip, or use the repository dev environment.'
		);
	}
	if (result.error) {
		throw new Error(
			`unzip failed while ${description}: ${result.error.message}`
		);
	}
	if (result.status !== 0) {
		throw new Error(
			`unzip failed while ${description} (status ${result.status})`
		);
	}
	return result;
}

function writeDescriptor(versions, metaBySlug) {
	const source = generateModuleDetailsSource({
		versions,
		meta: normalizeDescriptorMeta(metaBySlug),
		remoteWordPressModules,
		latestStableVersion: findLatestStableVersion(versions),
	});
	writeFileSync(DETAILS_PATH, source);
	console.log(`Wrote ${path.relative(process.cwd(), DETAILS_PATH)}`);
}

/** Verify committed .tar.zst files match the generated descriptor exactly. */
function verify(versions) {
	const expectedSource = generateDescriptorFromArtifacts(versions);
	const actualSource = readFileSync(DETAILS_PATH, 'utf8');
	if (actualSource !== expectedSource) {
		console.error(
			`${path.relative(process.cwd(), DETAILS_PATH)} does not match the committed tar.zst artifacts.`
		);
		console.error(
			'Run `node packages/playground/wordpress-builds/build/build-tar-zst.mjs --descriptor-only`.'
		);
		process.exit(1);
	}
	for (const [slug, meta] of Object.entries(readArtifactMeta(versions))) {
		const dirCount = meta.dirCount ?? 0;
		const dirCountLabel = dirCount === 1 ? '1 dir' : `${dirCount} dirs`;
		console.log(
			`OK  wp-${slug}.tar.zst (` +
				`${meta.size} bytes, ${meta.fileCount} files, ` +
				`${dirCountLabel}, ${meta.sha256.slice(0, 12)}…)`
		);
	}
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	const versions = readVersions();

	if (opts.verify) {
		verify(versions);
		return;
	}

	if (opts.descriptorOnly) {
		// Regenerate the descriptor from the already-built tar.zst artifacts.
		// build.js uses this after updating `trunk`/`nightly`; those slugs stay
		// direct GitHub ZIP downloads and do not write `src/wordpress/wp-trunk.*`.
		writeDescriptor(versions, readArtifactMeta(versions));
		return;
	}

	let slugs;
	if (opts.all) {
		slugs = localSlugs(versions);
	} else if (opts.version) {
		slugs = [opts.version];
	} else {
		console.error(
			'Specify --all, --version=<slug>, --descriptor-only, or --verify. See file header for usage.'
		);
		process.exit(1);
	}

	const metaBySlug = {};
	for (const slug of slugs) {
		metaBySlug[slug] = buildOne(slug, opts.windowLog, opts.deleteZip);
	}

	if (opts.descriptor) {
		// Merge with metadata recomputed from already-built tar.zst artifacts for
		// slugs not rebuilt this run. Do not parse the generated TypeScript
		// descriptor; the committed artifacts are the source of truth.
		const full = opts.all
			? metaBySlug
			: readArtifactMeta(versions, metaBySlug);
		writeDescriptor(versions, full);
	}

	console.log(JSON.stringify(metaBySlug, null, 2));
}

function generateDescriptorFromArtifacts(versions) {
	return generateModuleDetailsSource({
		versions,
		meta: normalizeDescriptorMeta(readArtifactMeta(versions)),
		remoteWordPressModules,
		latestStableVersion: findLatestStableVersion(versions),
	});
}

function findLatestStableVersion(versions) {
	return Object.keys(versions).find((version) => {
		const firstChar = version.charCodeAt(0);
		return firstChar >= 48 && firstChar <= 57;
	});
}

/**
 * Computes descriptor metadata from tar.zst artifacts rather than scraping the
 * generated TypeScript descriptor. This keeps subset rebuilds and verification
 * tied to the structured archive bytes that are actually committed.
 */
function readArtifactMeta(versions, metaBySlug = {}) {
	const merged = { ...metaBySlug };
	for (const slug of localSlugs(versions)) {
		if (merged[slug]) continue;
		merged[slug] = readOneArtifactMeta(slug);
	}
	return merged;
}

function readOneArtifactMeta(slug) {
	const tarZst = path.join(WP_DIR, `wp-${slug}.tar.zst`);
	if (!existsSync(tarZst)) {
		throw new Error(`Missing committed artifact: ${tarZst}`);
	}
	const bytes = readFileSync(tarZst);
	const entries = readUstarTar(zlib.zstdDecompressSync(bytes));
	const fileCount = entries.filter((entry) => entry.type !== 'dir').length;
	return {
		size: statSync(tarZst).size,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		fileCount,
		dirCount: entries.length - fileCount,
	};
}

function normalizeDescriptorMeta(metaBySlug) {
	const meta = {};
	for (const [slug, m] of Object.entries(metaBySlug)) {
		meta[slug] = {
			size: m.size,
			sha256: m.sha256,
			fileCount: m.fileCount,
		};
	}
	return meta;
}

main();
