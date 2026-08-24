#!/usr/bin/env node
/**
 * Regenerate `kandelo-pinned-binaries-index.toml` for the current kandelo
 * submodule checkout. Run this after bumping the kandelo submodule and
 * commit the regenerated index together with the bump:
 *
 *     node packages/playground/cli/src/posix-kernel/scripts/generate-kandelo-pinned-index.mts
 *
 * For each package listed in `fetch-kandelo-binaries.mts` this:
 * - asks xtask for the package's cache_key_sha at the current checkout,
 * - downloads the matching immutable release archive (fails if the
 *   release doesn't carry a build for that cache key yet — wait for
 *   kandelo CI to publish it, or pin a different submodule commit),
 * - records the archive URL, its sha256, and the cache_key_sha.
 *
 * Requires: cargo/rustc (to build kandelo's xtask) and Node >= 22.18
 * (runs TypeScript via type stripping). Archives are kept in
 * $KANDELO_PINNED_ARCHIVE_DIR when set (re-runs skip re-downloading),
 * otherwise in a fresh temp directory.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../../../../../..');
const KANDELO_DIR = join(REPO_ROOT, 'kandelo');
const OUT = join(SCRIPT_DIR, 'kandelo-pinned-binaries-index.toml');
const RELEASES_BASE = 'https://github.com/Automattic/kandelo/releases/download';
const DOWNLOAD_DIR =
	process.env['KANDELO_PINNED_ARCHIVE_DIR'] ??
	join(tmpdir(), `kandelo-pinned-${process.pid}`);

const PACKAGES = [
	'kernel',
	'userspace',
	'rootfs',
	'nginx',
	'php',
	'coreutils',
	'dash',
	'dinit',
	'less',
];

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
	mkdirSync(DOWNLOAD_DIR, { recursive: true });
	const hostTarget = rustHostTarget();
	const generatedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
	const pin = execFileSync('git', ['-C', KANDELO_DIR, 'rev-parse', 'HEAD'], {
		encoding: 'utf8',
	}).trim();
	const abiVersion = readAbiVersion();
	const releaseBase = `${RELEASES_BASE}/binaries-abi-v${abiVersion}`;

	const sections = [
		`abi_version = ${abiVersion}`,
		`generated_at = "${generatedAt}"`,
		`generator = "wordpress-playground pinned snapshot (kandelo @ ${pin})"`,
	];

	for (const pkg of PACKAGES) {
		const cacheKey = xtask(hostTarget, [
			'build-deps',
			'--arch',
			'wasm32',
			'sha',
			pkg,
		]);
		const cachePath = xtask(hostTarget, [
			'build-deps',
			'--arch',
			'wasm32',
			'path',
			pkg,
		]);
		const { version, revision } = parseCacheBasename(
			pkg,
			basename(cachePath)
		);
		const archive =
			`${pkg}-${version}-rev${revision}-abi${abiVersion}-wasm32-` +
			`${cacheKey.slice(0, 8)}.tar.zst`;
		const url = `${releaseBase}/${archive}`;

		log(
			`--- ${pkg}: version=${version} rev=${revision} key=${cacheKey.slice(0, 8)}`
		);
		const archivePath = join(DOWNLOAD_DIR, archive);
		if (!existsSync(archivePath)) {
			await download(url, archivePath);
		}
		const sha256 = createHash('sha256')
			.update(readFileSync(archivePath))
			.digest('hex');

		sections.push(
			``,
			`[[packages]]`,
			`name = "${pkg}"`,
			`version = "${version}"`,
			`revision = ${revision}`,
			``,
			`[packages.binary.wasm32]`,
			`status = "success"`,
			`archive_url = "${url}"`,
			`archive_sha256 = "${sha256}"`,
			`cache_key_sha = "${cacheKey}"`,
			`built_at = "${generatedAt}"`,
			`built_by = "pinned by wordpress-playground (kandelo @ ${pin})"`
		);
	}

	writeFileSync(OUT, sections.join('\n') + '\n');
	log(`wrote ${OUT} (archives in ${DOWNLOAD_DIR})`);
}

function rustHostTarget(): string {
	const rustcInfo = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
	const host = rustcInfo.match(/^host:\s*(\S+)/m)?.[1];
	if (!host) {
		fail(`could not read the host target from \`rustc -vV\``);
	}
	return host;
}

function readAbiVersion(): string {
	const lib = readFileSync(
		join(KANDELO_DIR, 'crates/shared/src/lib.rs'),
		'utf8'
	);
	const abiVersion = lib.match(/^pub const ABI_VERSION: u32 = (\d+);$/m)?.[1];
	if (!abiVersion) {
		fail(
			`could not read ABI_VERSION from kandelo/crates/shared/src/lib.rs`
		);
	}
	return abiVersion;
}

function xtask(hostTarget: string, args: string[]): string {
	return execFileSync(
		'cargo',
		[
			'run',
			'--release',
			'-p',
			'xtask',
			'--target',
			hostTarget,
			'--quiet',
			'--',
			...args,
		],
		{
			cwd: KANDELO_DIR,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'inherit'],
		}
	).trim();
}

function parseCacheBasename(
	pkg: string,
	base: string
): { version: string; revision: string } {
	const archIndex = base.lastIndexOf('-wasm32-');
	const stem = archIndex >= 0 ? base.slice(0, archIndex) : base;
	const revIndex = stem.lastIndexOf('-rev');
	if (revIndex < 0 || !stem.startsWith(`${pkg}-`)) {
		fail(
			`unexpected cache path basename for "${pkg}": "${base}" ` +
				`(expected <pkg>-<version>-rev<n>-wasm32-<key>)`
		);
	}
	return {
		version: stem.slice(pkg.length + 1, revIndex),
		revision: stem.slice(revIndex + '-rev'.length),
	};
}

async function download(url: string, dest: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) {
		fail(
			`${url} is not on the release (HTTP ${response.status}) — no ` +
				`published build for this cache key; cannot pin this checkout`
		);
	}
	writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
}

function log(message: string): void {
	process.stderr.write(`generate-kandelo-pinned-index: ${message}\n`);
}

function fail(message: string): never {
	log(`ERROR ${message}`);
	process.exit(1);
}
