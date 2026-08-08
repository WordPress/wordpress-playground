#!/usr/bin/env node
/**
 * Fetch the kandelo wasm binaries WordPress Playground needs, resolved
 * against the committed pinned index (kandelo-pinned-binaries-index.toml).
 *
 * Why not `kandelo/scripts/fetch-binaries.sh`:
 * - It resolves against the live `binaries-abi-v<N>` release index, which
 *   kandelo CI republishes (including from unmerged branches), so its
 *   cache keys can stop matching the kandelo submodule pin at any moment.
 * - It compiles kandelo's Rust `xtask` resolver, which adds a Rust
 *   toolchain + compile to every CI job and does not build on Windows.
 *
 * This script mirrors what kandelo's own browser demo does in
 * `apps/browser-demos/pages/kandelo/kernel-host/live-setup.ts`: download
 * the immutable release archive, decompress zstd, read the tar, and place
 * artifacts. Placement follows each archive's own `manifest.toml`
 * `[[outputs]]` declarations — the same rules as kandelo's
 * `host/src/binary-resolver.ts` (`outputRelForPackage`):
 * - single-output package  -> binaries/programs/wasm32/<output><ext>
 * - multi-output package   -> binaries/programs/wasm32/<pkg>/<output><ext>
 * - kernel/userspace/rootfs additionally land at binaries/<name><ext>.
 * Files are real copies (no symlinks), so the result works on hosts that
 * cannot stat through symlinks and on Windows.
 *
 * Downloads are verified against the pinned sha256 and cached in
 * ~/.cache/wp-playground-kandelo/. After bumping the kandelo submodule,
 * regenerate the pinned index with generate-kandelo-pinned-index.mts and
 * commit both together; this script fails loudly when the index was
 * generated for a different submodule commit.
 *
 * Requires Node >= 22.18 (zstdDecompressSync in node:zlib and TypeScript
 * type stripping by default).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

// zstdDecompressSync shipped in Node 22.15; the @types/node in this
// repo predates it, so read it off the module with an explicit type.
const zstdDecompressSync = (
	zlib as { zstdDecompressSync?: (input: Buffer) => Buffer }
).zstdDecompressSync;

interface PinnedPackage {
	name?: string;
	archiveUrl?: string;
	archiveSha256?: string;
}

interface PinnedIndex {
	generator: string;
	byName: Map<string, PinnedPackage>;
}

interface ManifestOutput {
	name?: string;
	wasm?: string;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../../../../../..');
const INDEX_PATH = join(SCRIPT_DIR, 'kandelo-pinned-binaries-index.toml');
const SUBMODULE_DIR = join(REPO_ROOT, 'kandelo');
const BINARIES_DIR = join(SUBMODULE_DIR, 'binaries');
const CACHE_DIR = join(homedir(), '.cache', 'wp-playground-kandelo');

// What the CLI resolves: kernel.wasm + userspace.wasm (kandelo's host
// runtime), rootfs.vfs, and the only two programs boot.ts spawns (nginx,
// php). Shell/coreutils live inside rootfs.vfs, so no separate fetch.
const NEEDED = ['kernel', 'userspace', 'rootfs', 'nginx', 'php'];

// Packages whose (single) output is also exposed at the top of
// binaries/, mirroring kandelo's packagedBinaryCandidates().
const TOP_LEVEL_PACKAGES = new Set(['kernel', 'userspace', 'rootfs']);

if (typeof zstdDecompressSync !== 'function') {
	fail(
		`node:zlib has no zstdDecompressSync — Node >= 22.18 is required ` +
			`(running ${process.version}).`
	);
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
	const packages = parsePinnedIndex(readFileSync(INDEX_PATH, 'utf8'));
	verifySubmodulePin(packages.generator);

	let resolved = 0;
	for (const name of NEEDED) {
		const pkg = packages.byName.get(name);
		if (!pkg) {
			fail(`pinned index has no entry for package "${name}"`);
		}
		const archive = await fetchArchive(pkg);
		placeArtifacts(name, archive);
		resolved++;
	}
	log(`done. resolved=${resolved}/${NEEDED.length} -> ${BINARIES_DIR}`);
}

/**
 * Minimal parser for the pinned index this repo generates itself
 * (generate-kandelo-pinned-index.mts): a `generator = "..."` header plus
 * [[packages]] blocks with name / archive_url / archive_sha256 keys.
 */
function parsePinnedIndex(toml: string): PinnedIndex {
	const generator = toml.match(/^generator\s*=\s*"([^"]*)"/m)?.[1] ?? '';
	const byName = new Map<string, PinnedPackage>();
	let current: PinnedPackage | null = null;
	for (const line of toml.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed === '[[packages]]') {
			current = {};
			continue;
		}
		if (!current) {
			continue;
		}
		const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*"([^"]*)"/);
		if (!match) {
			continue;
		}
		const [, key, value] = match;
		if (key === 'name') {
			current.name = value;
			byName.set(value, current);
		} else if (key === 'archive_url') {
			current.archiveUrl = value;
		} else if (key === 'archive_sha256') {
			current.archiveSha256 = value;
		}
	}
	return { generator, byName };
}

/**
 * The index header records the kandelo commit it was generated for.
 * A mismatch means someone bumped the submodule without regenerating
 * the index — the archives would be from a different ABI/build.
 */
function verifySubmodulePin(generator: string): void {
	const pinned = generator.match(/kandelo @ ([0-9a-f]{40})/)?.[1];
	if (!pinned) {
		fail(
			`could not read the kandelo commit from the index generator ` +
				`line: "${generator}"`
		);
	}
	let actual: string;
	try {
		actual = execFileSync(
			'git',
			['-C', SUBMODULE_DIR, 'rev-parse', 'HEAD'],
			{
				encoding: 'utf8',
			}
		).trim();
	} catch {
		log(
			`WARN could not read the kandelo submodule commit; skipping pin check`
		);
		return;
	}
	if (actual !== pinned) {
		fail(
			`pinned index was generated for kandelo ${pinned} but the ` +
				`submodule is at ${actual}. Run ` +
				`packages/playground/cli/src/posix-kernel/scripts/` +
				`generate-kandelo-pinned-index.mts and commit the ` +
				`regenerated index together with the submodule bump.`
		);
	}
}

async function fetchArchive(pkg: PinnedPackage): Promise<Map<string, Buffer>> {
	if (!pkg.archiveUrl || !pkg.archiveSha256) {
		fail(`pinned index entry for "${pkg.name}" lacks archive_url/sha256`);
	}
	mkdirSync(CACHE_DIR, { recursive: true });
	const cachePath = join(CACHE_DIR, `${pkg.archiveSha256}.tar.zst`);
	let bytes: Buffer;
	if (existsSync(cachePath)) {
		bytes = readFileSync(cachePath);
		if (sha256(bytes) === pkg.archiveSha256) {
			log(`${pkg.name}: using cached archive`);
			return decompressAndIndexTar(pkg, bytes);
		}
		log(`${pkg.name}: cached archive is corrupt, re-downloading`);
	}
	log(`${pkg.name}: downloading ${pkg.archiveUrl}`);
	const response = await fetch(pkg.archiveUrl);
	if (!response.ok) {
		fail(
			`download failed for "${pkg.name}": HTTP ${response.status} ` +
				`from ${pkg.archiveUrl}`
		);
	}
	bytes = Buffer.from(await response.arrayBuffer());
	const digest = sha256(bytes);
	if (digest !== pkg.archiveSha256) {
		fail(
			`sha256 mismatch for "${pkg.name}": expected ` +
				`${pkg.archiveSha256}, got ${digest}`
		);
	}
	writeFileSync(cachePath, bytes);
	return decompressAndIndexTar(pkg, bytes);
}

function decompressAndIndexTar(
	pkg: PinnedPackage,
	compressed: Buffer
): Map<string, Buffer> {
	const tarBytes = zstdDecompressSync!(compressed);
	const entries = new Map<string, Buffer>();
	for (let offset = 0; offset + 512 <= tarBytes.length; ) {
		const header = tarBytes.subarray(offset, offset + 512);
		if (header.every((byte: number) => byte === 0)) {
			break;
		}
		const name = tarString(header, 0, 100);
		const prefix = tarString(header, 345, 155);
		const path = prefix ? `${prefix}/${name}` : name;
		const size = parseInt(tarString(header, 124, 12).trim() || '0', 8);
		if (!Number.isFinite(size)) {
			fail(`invalid tar entry size for ${path} in ${pkg.name}`);
		}
		offset += 512;
		// Regular files only; tar typeflag '0' or NUL.
		const typeflag = header[156];
		if (typeflag === 0x30 || typeflag === 0) {
			entries.set(path, tarBytes.subarray(offset, offset + size));
		}
		offset += Math.ceil(size / 512) * 512;
	}
	if (!entries.has('manifest.toml')) {
		fail(`archive for "${pkg.name}" has no manifest.toml`);
	}
	return entries;
}

function tarString(block: Buffer, offset: number, length: number): string {
	return new TextDecoder()
		.decode(block.subarray(offset, offset + length))
		.replace(/\0.*$/, '');
}

/**
 * Place a package's artifacts per its manifest [[outputs]]. The
 * destination name is `<output.name><ext-of-artifact>` — e.g. kernel's
 * artifact kandelo-kernel.wasm ships as output name "kernel" and lands
 * as kernel.wasm.
 */
function placeArtifacts(name: string, entries: Map<string, Buffer>): void {
	const manifestBytes = entries.get('manifest.toml');
	if (!manifestBytes) {
		fail(`archive for "${name}" has no manifest.toml`);
	}
	const manifest = new TextDecoder().decode(manifestBytes);
	const outputs = parseManifestOutputs(manifest);
	if (outputs.length === 0) {
		fail(`manifest for "${name}" declares no outputs`);
	}
	for (const output of outputs) {
		const artifact = entries.get(`artifacts/${output.wasm}`);
		if (!artifact) {
			fail(`artifacts/${output.wasm} missing from the "${name}" archive`);
		}
		const ext = extensionOf(output.wasm!);
		const destName = `${output.name}${ext}`;
		const destinations: string[] = [];
		if (TOP_LEVEL_PACKAGES.has(name)) {
			destinations.push(join(BINARIES_DIR, destName));
			// xtask also mirrors rootfs.vfs under programs/wasm32/; some
			// consumers still resolve the legacy location.
			if (name === 'rootfs') {
				destinations.push(
					join(BINARIES_DIR, 'programs/wasm32', destName)
				);
			}
		} else if (outputs.length > 1) {
			destinations.push(
				join(BINARIES_DIR, 'programs/wasm32', name, destName)
			);
		} else {
			destinations.push(join(BINARIES_DIR, 'programs/wasm32', destName));
		}
		for (const dest of destinations) {
			mkdirSync(dirname(dest), { recursive: true });
			// The destination may be a symlink from an earlier
			// xtask-based fetch; writing through it would corrupt the
			// link target in ~/.cache/kandelo.
			rmSync(dest, { force: true });
			writeFileSync(dest, artifact);
		}
	}
	// Non-Wasm runtime closures ([[runtime_files]], e.g. php's icu.dat)
	// are mirrored at programs/<arch>/<pkg>/<artifact>.
	const runtimeFiles = parseManifestRuntimeFiles(manifest);
	for (const artifactName of runtimeFiles) {
		const artifact = entries.get(`artifacts/${artifactName}`);
		if (!artifact) {
			fail(
				`artifacts/${artifactName} missing from the "${name}" archive`
			);
		}
		const dest = join(BINARIES_DIR, 'programs/wasm32', name, artifactName);
		mkdirSync(dirname(dest), { recursive: true });
		rmSync(dest, { force: true });
		writeFileSync(dest, artifact);
	}
	log(`${name}: placed ${outputs.length + runtimeFiles.length} artifact(s)`);
}

function parseManifestRuntimeFiles(manifest: string): string[] {
	const artifacts: string[] = [];
	let inRuntimeFiles = false;
	for (const line of manifest.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed === '[[runtime_files]]') {
			inRuntimeFiles = true;
			continue;
		}
		if (trimmed.startsWith('[')) {
			inRuntimeFiles = false;
			continue;
		}
		if (!inRuntimeFiles) {
			continue;
		}
		const match = trimmed.match(/^artifact\s*=\s*"([^"]*)"/);
		if (match) {
			artifacts.push(match[1]);
		}
	}
	return artifacts;
}

function parseManifestOutputs(manifest: string): ManifestOutput[] {
	const outputs: ManifestOutput[] = [];
	let current: ManifestOutput | null = null;
	for (const line of manifest.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed === '[[outputs]]') {
			if (current?.name && current?.wasm) {
				outputs.push(current);
			}
			current = {};
			continue;
		}
		if (trimmed.startsWith('[') && current) {
			if (current.name && current.wasm) {
				outputs.push(current);
			}
			current = null;
			continue;
		}
		if (!current) {
			continue;
		}
		const match = trimmed.match(/^(name|wasm)\s*=\s*"([^"]*)"/);
		if (match) {
			current[match[1] as 'name' | 'wasm'] = match[2];
		}
	}
	if (current?.name && current?.wasm) {
		outputs.push(current);
	}
	return outputs;
}

function extensionOf(filename: string): string {
	const base = filename.split('/').pop() ?? filename;
	const dot = base.indexOf('.');
	return dot >= 0 ? base.slice(dot) : '';
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function log(message: string): void {
	process.stderr.write(`fetch-kandelo-binaries: ${message}\n`);
}

function fail(message: string): never {
	log(`ERROR ${message}`);
	process.exit(1);
}
