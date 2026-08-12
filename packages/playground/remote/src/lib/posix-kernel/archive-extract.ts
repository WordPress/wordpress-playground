/**
 * Extract WordPress/plugin bundles into a `MemoryFileSystem`. Pure memfs
 * logic with no kernel-binary or browser-kernel dependencies, so it can
 * be unit-tested in isolation. `vfs-builder.ts` is the sole consumer.
 */

import { decodeZip } from '@php-wasm/stream-compression';
import { dirname, joinPaths } from '@php-wasm/util';
import {
	createDecodedTarStream,
	StreamingTarParser,
	isZstdBundle,
} from '@wp-playground/wordpress';
import {
	writeVfsBinary,
	ensureDirRecursive,
} from '@kandelo/host/src/vfs/image-helpers';
import type { MemoryFileSystem } from '@kandelo/host/src/vfs/memory-fs';

export interface ExtractArchiveOptions {
	/**
	 * If set, only entries whose path starts with `<stripLeadingDir>/`
	 * (or `<stripLeadingDir>-<suffix>/` for versioned plugin zips) are
	 * kept; the prefix is removed from every output path before
	 * mounting under `mountPrefix`.
	 */
	stripLeadingDir?: string;
	/** Skip entries by relative path (post-strip). */
	exclude?: (relPath: string) => boolean;
	/**
	 * Skip entries whose target path already exists. Mirrors classic
	 * mode's `unzipFile(..., noOverwrite=true)` semantics — used for the
	 * static-asset backfill so the bundled WP archive's contents win on
	 * any overlap.
	 */
	noOverwrite?: boolean;
	/** Observe each materialized file (post-strip) — used to fish out
	 *  db.copy from the SQLite zip without a second pass. */
	onEntry?: (relPath: string, bytes: Uint8Array) => void;
}

/**
 * Extract a bundle under `mountPrefix` in the VFS, routing by magic
 * bytes: `wordpress-builds` ships core WordPress as a solid `tar.zst`,
 * while every other input (static assets, the SQLite plugin, GitHub
 * archives) is still a ZIP.
 */
export async function extractArchiveIntoVfs(
	fs: MemoryFileSystem,
	mountPrefix: string,
	archiveBytes: Uint8Array,
	options: ExtractArchiveOptions = {}
): Promise<void> {
	ensureDirRecursive(fs, mountPrefix);
	if (isZstdBundle(archiveBytes)) {
		await extractTarZstIntoVfs(fs, mountPrefix, archiveBytes, options);
		return;
	}

	// Use `Blob([bytes]).stream()` instead of a hand-rolled byte stream
	// with a single pre-enqueued chunk. Chrome's `ReadableStream({type:
	// 'bytes'})` with one large queued chunk does not drain reliably
	// through `limitBytes`' BYOB reader — the body stream closes short
	// and `DecompressionStream('gzip')` throws "Compressed input was
	// truncated." `Blob.stream()` returns a natively-chunked byte stream
	// that handles BYOB reads correctly. (CLI uses the manual byte-stream
	// pattern successfully on Node because Node's implementation drains
	// the queue differently.)
	const stream = new Blob([archiveBytes as BlobPart]).stream();
	const reader = decodeZip(stream).getReader();

	let entriesProcessed = 0;
	let lastEntryName: string | null = null;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (!value) continue;
			lastEntryName = value.name;
			const isDirectory = value.type === 'directory';
			const bytes = isDirectory
				? null
				: new Uint8Array(await value.arrayBuffer());
			if (
				placeArchiveEntry(
					fs,
					mountPrefix,
					value.name,
					isDirectory,
					bytes,
					options
				)
			) {
				entriesProcessed += 1;
			}
		}
	} catch (err) {
		throw new Error(
			`extractArchiveIntoVfs: failed after ${entriesProcessed} ` +
				`entries, last entry name="${lastEntryName ?? '<none>'}" — ` +
				`${(err as Error).message}`,
			{ cause: err as Error }
		);
	}
}

/**
 * Decode a `tar.zst` bundle under `mountPrefix`, feeding the parser one
 * decoded chunk at a time so the full uncompressed tar never lands in
 * memory.
 */
async function extractTarZstIntoVfs(
	fs: MemoryFileSystem,
	mountPrefix: string,
	archiveBytes: Uint8Array,
	options: ExtractArchiveOptions
): Promise<void> {
	let entriesProcessed = 0;
	let lastEntryName: string | null = null;
	const parser = new StreamingTarParser({
		onEntry: (entry) => {
			lastEntryName = entry.path;
			const isDirectory = entry.type === 'dir';
			const bytes = entry.type === 'file' ? entry.data : null;
			if (
				placeArchiveEntry(
					fs,
					mountPrefix,
					entry.path,
					isDirectory,
					bytes,
					options
				)
			) {
				entriesProcessed += 1;
			}
		},
	});
	try {
		const tarStream = await createDecodedTarStream(archiveBytes, 'zstd');
		const reader = tarStream.getReader();
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (value) parser.push(value);
		}
		parser.end();
	} catch (err) {
		throw new Error(
			`extractTarZstIntoVfs: failed after ${entriesProcessed} ` +
				`entries, last entry name="${lastEntryName ?? '<none>'}" — ` +
				`${(err as Error).message}`,
			{ cause: err as Error }
		);
	}
}

/**
 * Place one archive entry into the VFS under the shared `stripLeadingDir`
 * / `exclude` / `noOverwrite` / `onEntry` rules. Returns `true` only when
 * a file was written, so callers can count materialized entries.
 */
function placeArchiveEntry(
	fs: MemoryFileSystem,
	mountPrefix: string,
	entryName: string,
	isDirectory: boolean,
	bytes: Uint8Array | null,
	options: ExtractArchiveOptions
): boolean {
	let relPath = entryName;
	if (options.stripLeadingDir !== undefined) {
		const stripped = stripLeadingDirPrefix(
			relPath,
			options.stripLeadingDir
		);
		if (stripped === null) return false;
		relPath = stripped;
	}
	if (relPath === '' || relPath === '/') return false;
	if (options.exclude?.(relPath)) return false;

	const targetPath = joinPaths(mountPrefix, relPath);
	if (isDirectory) {
		ensureDirRecursive(fs, targetPath);
		return false;
	}
	if (options.noOverwrite && pathExists(fs, targetPath)) {
		return false;
	}
	ensureDirRecursive(fs, dirname(targetPath));
	const fileBytes = bytes ?? new Uint8Array(0);
	writeVfsBinary(fs, targetPath, fileBytes, 0o644);
	options.onEntry?.(relPath, fileBytes);
	return true;
}

function pathExists(fs: MemoryFileSystem, path: string): boolean {
	try {
		fs.stat(path);
		return true;
	} catch {
		return false;
	}
}

function stripLeadingDirPrefix(path: string, dirName: string): string | null {
	const exactPrefix = `${dirName}/`;
	if (path === exactPrefix) return '';
	if (path.startsWith(exactPrefix)) return path.slice(exactPrefix.length);
	const versionedPrefix = `${dirName}-`;
	if (path.startsWith(versionedPrefix)) {
		const slash = path.indexOf('/');
		if (slash > -1) return path.slice(slash + 1);
	}
	return null;
}
