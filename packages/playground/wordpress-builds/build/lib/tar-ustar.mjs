// tar-ustar.mjs — a small, deterministic USTAR tar writer + reader.
//
// Why hand-rolled: the tar.zst core bundle needs a byte-for-byte reproducible
// `.tar` so the reported SHA-256 is stable across runs and machines. The local
// `tar` is bsdtar (libarchive) on macOS, which does NOT accept GNU-tar's
// `--sort` and injects libarchive/mac metadata, so it cannot produce a
// canonical archive. A pure-JS writer gives full control over entry order and
// every header field.
//
// Long-name strategy — IMPORTANT: names longer than the 100-byte USTAR `name`
// field use the USTAR `prefix`/`name` split when a "/" lets them fit
// (prefix<=155, name<=100), and fall back to a GNU `././@LongLink` ('L'
// typeflag) entry when no such split exists. We deliberately do NOT use PAX
// extended headers: PHP's tar readers silently IGNORE PAX `path` records and
// write long files under their truncated 100-byte name, which collides and
// drops files. The streaming extractor, GNU tar and bsdtar all read the USTAR
// prefix split and GNU longlink correctly, so this format keeps full
// file-count parity with the ZIP baseline.
//
// Determinism policy: entries are emitted in a fixed byte-wise sort with
// mtime=0, uid=gid=0, empty uname/gname, and a fixed mode.
//
// Reused semantics: entry-name sanitization mirrors sanitizeTarPath() in the
// runtime extractor: reject backslashes, absolute paths, and ".." segments;
// drop empty and "." segments. Unsafe file entries fail the build instead of
// being silently skipped.

import { Buffer } from 'node:buffer';

const BLOCK = 512;

// --- name sanitization (parity with the runtime sanitizeTarPath) -------------

export function sanitizeArchivePath(name) {
	const rawName = String(name);
	if (rawName.includes('\\')) {
		throw new Error(`Unsafe archive entry path (backslash): ${name}`);
	}
	if (rawName.startsWith('/')) {
		throw new Error(`Unsafe archive entry path (absolute): ${name}`);
	}
	const segments = rawName
		.split('/')
		.filter((segment) => segment !== '' && segment !== '.');
	if (segments.some((segment) => segment === '..')) {
		throw new Error(`Unsafe archive entry path (path traversal): ${name}`);
	}
	return segments.length > 0 ? segments.join('/') : null;
}

/**
 * Turn a { path -> Uint8Array } map into a sorted, sanitized, files-only entry
 * list ready for createUstarTar(). Directory keys (trailing "/") are dropped;
 * unsafe file paths throw. The sort is a stable byte-wise comparison on the
 * sanitized name so two runs over the same input yield an identical archive.
 */
export function normalizeEntries(fileMap) {
	const entries = [];
	for (const rawName of Object.keys(fileMap)) {
		const isDirectory = rawName.endsWith('/');
		const name = sanitizeArchivePath(
			isDirectory ? rawName.slice(0, -1) : rawName
		);
		if (isDirectory) continue; // directory member, skip
		if (!name) continue;
		entries.push({ name, data: fileMap[rawName] });
	}
	// Byte-wise (codepoint) sort — NOT localeCompare, which is locale-sensitive
	// and would make the archive non-reproducible across environments.
	entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	return entries;
}

// --- header field encoders ---------------------------------------------------

function writeString(block, value, offset, length) {
	const bytes = Buffer.from(String(value), 'utf8');
	bytes.copy(block, offset, 0, Math.min(bytes.length, length));
}

// Classic tar octal field: (length-1) zero-padded octal digits + NUL terminator.
function writeOctal(block, value, offset, length) {
	const digits = value.toString(8).padStart(length - 1, '0');
	block.write(`${digits}\0`, offset, length, 'ascii');
}

function checksum(block) {
	let sum = 0;
	for (let i = 0; i < BLOCK; i += 1) sum += block[i];
	return sum;
}

function headerBlock({
	name,
	size,
	mtime,
	uid,
	gid,
	mode,
	typeflag,
	prefix = '',
}) {
	const block = Buffer.alloc(BLOCK, 0);
	writeString(block, name, 0, 100);
	writeOctal(block, mode & 0o7777, 100, 8);
	writeOctal(block, uid, 108, 8);
	writeOctal(block, gid, 116, 8);
	writeOctal(block, size, 124, 12);
	writeOctal(block, mtime, 136, 12);
	// checksum placeholder = 8 spaces during computation
	block.write('        ', 148, 8, 'ascii');
	block.write(typeflag, 156, 1, 'ascii');
	block.write('ustar\0', 257, 6, 'ascii');
	block.write('00', 263, 2, 'ascii');
	// USTAR prefix field (offset 345, 155 bytes) carries the leading path
	// segments of a long name; the reader rejoins prefix + "/" + name.
	if (prefix) writeString(block, prefix, 345, 155);
	// uname/gname intentionally empty for determinism.
	const sum = checksum(block);
	// 6 octal digits + NUL + space, per the USTAR spec.
	block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
	return block;
}

/**
 * Decide how a name is carried in the header. Returns either a USTAR
 * { name, prefix } split, or { longLink: true } signalling a preceding GNU
 * `././@LongLink` entry is required. Deterministic: picks the latest valid "/"
 * split so the choice is stable across runs.
 */
export function splitTarName(name) {
	if (Buffer.byteLength(name, 'utf8') <= 100) return { name, prefix: '' };
	const upper = Math.min(name.length - 1, 155);
	for (let i = upper; i >= 0; i -= 1) {
		if (name[i] !== '/') continue;
		const candidateName = name.slice(i + 1);
		const candidatePrefix = name.slice(0, i);
		if (
			Buffer.byteLength(candidateName, 'utf8') <= 100 &&
			Buffer.byteLength(candidatePrefix, 'utf8') <= 155
		) {
			return { name: candidateName, prefix: candidatePrefix };
		}
	}
	// No USTAR split fits — fall back to a GNU longlink; the real header still
	// carries a 100-byte truncation for readers that ignore the longlink.
	return { name: name.slice(0, 100), prefix: '', longLink: true };
}

function padToBlock(chunks, byteLength) {
	const remainder = byteLength % BLOCK;
	if (remainder !== 0) chunks.push(Buffer.alloc(BLOCK - remainder, 0));
}

/**
 * Serialize sorted entries into a deterministic USTAR tar buffer (with GNU
 * longlink for the handful of names that do not fit the prefix/name split).
 * Options pin the metadata (mtime/uid/gid/mode) so output is reproducible.
 *
 * Each entry is `{ name, data }` for a regular file or `{ name, type: 'dir' }`
 * for a directory (empty directories that must be preserved).
 */
export function createUstarTar(entries, options = {}) {
	const {
		mtime = 0,
		uid = 0,
		gid = 0,
		mode = 0o644,
		dirMode = 0o755,
	} = options;
	const chunks = [];

	for (const entry of entries) {
		const isDir = entry.type === 'dir';
		const data = isDir
			? Buffer.alloc(0)
			: entry.data instanceof Uint8Array
				? entry.data
				: Buffer.from(entry.data);
		// Directory members are stored with a trailing slash per USTAR
		// convention; the reader accepts either the slash or typeflag '5'.
		const storedName = isDir ? `${entry.name}/` : entry.name;
		const split = splitTarName(storedName);

		if (split.longLink) {
			// GNU `././@LongLink`: an 'L'-type entry whose body is the full name
			// + NUL, applied to the next entry.
			const longName = Buffer.from(`${storedName}\0`, 'utf8');
			chunks.push(
				headerBlock({
					name: '././@LongLink',
					size: longName.length,
					mtime,
					uid,
					gid,
					mode,
					typeflag: 'L',
				})
			);
			chunks.push(longName);
			padToBlock(chunks, longName.length);
		}

		chunks.push(
			headerBlock({
				name: split.name,
				prefix: split.prefix,
				size: data.length,
				mtime,
				uid,
				gid,
				mode: isDir ? dirMode : mode,
				typeflag: isDir ? '5' : '0',
			})
		);
		if (!isDir) {
			chunks.push(
				Buffer.from(data.buffer, data.byteOffset, data.byteLength)
			);
			padToBlock(chunks, data.length);
		}
	}

	// Two zero blocks mark end-of-archive.
	chunks.push(Buffer.alloc(BLOCK * 2, 0));
	return Buffer.concat(chunks);
}

// --- minimal reader (for tests / round-trip verification) --------------------

function readOctal(block, offset, length) {
	const raw = block
		.toString('ascii', offset, offset + length)
		.replace(/\0.*$/, '')
		.trim();
	return raw ? Number.parseInt(raw, 8) : 0;
}

/**
 * Minimal tar reader that understands USTAR entries (incl. the prefix/name
 * split) and GNU `././@LongLink` names. Returns [{ name, data }] for files.
 * Used by tests to prove round-trip fidelity.
 */
export function readUstarTar(buffer) {
	const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
	const entries = [];
	let offset = 0;
	let pendingName = null;

	while (offset + BLOCK <= buf.length) {
		const header = buf.subarray(offset, offset + BLOCK);
		// End-of-archive: an all-zero block.
		if (header.every((byte) => byte === 0)) break;
		offset += BLOCK;

		const typeflag = String.fromCharCode(header[156]) || '0';
		const size = readOctal(header, 124, 12);
		const rawName = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
		const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
		const data = buf.subarray(offset, offset + size);
		offset += Math.ceil(size / BLOCK) * BLOCK;

		if (typeflag === 'L') {
			// GNU longlink: the body is the full name for the NEXT entry.
			pendingName = data.toString('utf8').replace(/\0.*$/, '');
			continue;
		}
		if (typeflag === '5') continue; // directory
		if (typeflag !== '0' && typeflag !== '\0') continue; // non-file types

		const name = pendingName ?? (prefix ? `${prefix}/${rawName}` : rawName);
		pendingName = null;
		entries.push({ name, data: Uint8Array.prototype.slice.call(data) });
	}
	return entries;
}
