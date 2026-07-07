/**
 * Parses the tar container used by future compressed WordPress core bundles.
 *
 * This is intentionally a small tar reader rather than a general-purpose
 * archive library. It supports the subset emitted by common tar writers for
 * regular WordPress trees:
 *
 * - 512-byte header blocks followed by file data padded to a 512-byte boundary.
 * - USTAR path splitting (`name` at bytes 0..99, `prefix` at bytes 345..499).
 * - GNU `L` longlink entries, whose body is the NUL-terminated path for the
 *   next real entry.
 * - PAX `x` local headers, whose body is a sequence of `"%d %s=%s\n"` records
 *   that apply to the next real entry. Only the `path` record is consumed.
 * - End-of-archive markers made of two zero-filled 512-byte blocks. Extra zero
 *   padding after the marker is ignored; non-zero data after it is rejected.
 *
 * Path safety: absolute paths, backslashes, and paths escaping a synthetic
 * extraction root are rejected (fail loud), empty/`.` paths are skipped — no
 * TAR-slip. Symlinks and other exotic entry types are rejected. Malformed or
 * truncated archives throw before callers write files.
 *
 * Adapted for wordpress-playground from the measured PoC in
 * erseco/wordpress-playground#2 and the sibling *-playground forks.
 */

import { normalizePath, resolvePathUnder } from '@php-wasm/util';

const BLOCK = 512;
const TAR_ROOT = '/__tar-root__';
const textDecoder = new TextDecoder();

export type TarCodec = 'zstd' | 'gzip' | 'deflate' | 'br';

export interface TarFileEntry {
	type: 'file';
	path: string;
	data: Uint8Array;
}
export interface TarDirEntry {
	type: 'dir';
	path: string;
}
export type TarEntry = TarFileEntry | TarDirEntry;

export interface TarExtractStats {
	fileCount: number;
	dirCount: number;
	phpCount: number;
	bytesWritten: number;
	/** Peak JS-side working buffer in bytes (leftover + current entry). */
	maxBuffered: number;
}

/**
 * Returns a safe relative extraction path for a tar entry name.
 *
 * Tar paths are POSIX paths regardless of the host OS. This routine rejects
 * Windows-style backslashes up front, then uses the shared PHP.wasm path
 * utilities to resolve the entry under a synthetic root. Any path that resolves
 * outside that root is traversal and is rejected.
 *
 * Empty paths and paths made only of `.` segments return an empty string so the
 * caller can skip them without treating the archive as malformed.
 */
export function sanitizeTarPath(rawName: string): string {
	const normalized = String(rawName);
	if (normalized.includes('\\')) {
		throw new Error(`Unsafe tar entry (backslash path): ${rawName}`);
	}
	if (normalized.startsWith('/')) {
		throw new Error(`Unsafe tar entry (absolute path): ${rawName}`);
	}
	const normalizedPath = normalizePath(normalized);
	if (!normalizedPath) {
		return '';
	}
	const resolved = resolvePathUnder(normalizedPath, TAR_ROOT);
	if (!resolved) {
		throw new Error(`Unsafe tar entry (path traversal): ${rawName}`);
	}
	return resolved.slice(TAR_ROOT.length + 1);
}

/**
 * Reads a tar octal number field.
 *
 * Header numbers are stored as ASCII octal digits, optionally padded with NULs
 * or spaces. This parser accepts the forms emitted by USTAR/PAX/GNU writers for
 * size and checksum fields; base-256 numeric extensions are intentionally not
 * supported by this WordPress bundle reader.
 */
function readOctal(block: Uint8Array, offset: number, length: number): number {
	const raw = block.subarray(offset, offset + length);
	let s = '';
	for (const byte of raw) {
		if (byte === 0 || byte === 0x20) {
			if (s) break;
			continue;
		}
		s += String.fromCharCode(byte);
	}
	return s ? Number.parseInt(s, 8) : 0;
}

/**
 * Reads a fixed-width tar string field.
 *
 * USTAR stores `name` and `prefix` as NUL-terminated UTF-8 byte ranges inside a
 * 512-byte header. Bytes after the first NUL belong to padding and are ignored.
 */
function readCString(
	block: Uint8Array,
	offset: number,
	length: number
): string {
	let end = offset;
	const limit = offset + length;
	while (end < limit && block[end] !== 0) end += 1;
	return textDecoder.decode(block.subarray(offset, end));
}

/**
 * Indicates whether a tar block or trailing byte range is all zero bytes.
 *
 * Tar archives end with two 512-byte zero blocks. Many writers append more zero
 * padding; after the formal end marker this parser allows only more zero bytes.
 */
function isZeroBlock(block: Uint8Array): boolean {
	for (let i = 0; i < block.length; i += 1) {
		if (block[i] !== 0) return false;
	}
	return true;
}

/**
 * Validates a standard tar header checksum.
 *
 * The checksum field at bytes 148..155 is parsed as octal, while those same
 * bytes are treated as ASCII spaces (`0x20`) when computing the header sum.
 * A mismatch means the parser cannot trust the name, size, or type fields.
 */
function validateHeaderChecksum(block: Uint8Array, name: string): void {
	const expected = readOctal(block, 148, 8);
	let actual = 0;
	for (let i = 0; i < BLOCK; i += 1) {
		actual += i >= 148 && i < 156 ? 0x20 : block[i];
	}
	if (expected !== actual) {
		throw new Error(
			`Malformed tar stream: invalid header checksum for ${name || 'unknown'}`
		);
	}
}

interface PendingEntry {
	name: string;
	prefix: string;
	size: number;
	typeflag: string;
	isLongLink: boolean;
	isPaxHeader: boolean;
}

/**
 * Parses USTAR/GNU/PAX tar bytes from arbitrary chunk boundaries.
 *
 * Feed compressed-decoder output via `push()`. The parser emits one sanitized
 * file or directory entry at a time via `onEntry()`, and `end()` verifies that
 * the stream ended cleanly after the tar end-of-archive marker.
 *
 * Directory entries carry no data. File entries currently carry the complete
 * file body because the WordPress bundle extractor writes one file at a time.
 * `maxBuffered` tracks the largest JS-side buffer observed for tests and
 * follow-up optimization work.
 */
export class StreamingTarParser {
	private onEntry: (entry: TarEntry) => void;
	private leftover: Uint8Array = new Uint8Array(0);
	private state: 'header' | 'data' | 'pad' | 'done' = 'header';
	private entry: PendingEntry | null = null;
	private dataChunks: Uint8Array[] = [];
	private dataFilled = 0;
	private padRemaining = 0;
	private pendingLongName: string | null = null;
	private pendingPax: Record<string, string> | null = null;
	private zeroBlocks = 0;

	maxBuffered = 0;
	fileCount = 0;
	dirCount = 0;
	phpCount = 0;
	bytesWritten = 0;

	constructor({ onEntry }: { onEntry?: (entry: TarEntry) => void } = {}) {
		this.onEntry = onEntry ?? (() => {});
	}

	push(chunk: Uint8Array): void {
		if (chunk?.length) {
			if (this.leftover.length === 0) {
				this.leftover = chunk;
			} else {
				// Append to leftover. This concatenation is bounded: leftover is
				// always < 512 bytes in header/pad state, and in data state we
				// drain into dataChunks immediately below.
				const merged = new Uint8Array(
					this.leftover.length + chunk.length
				);
				merged.set(this.leftover, 0);
				merged.set(chunk, this.leftover.length);
				this.leftover = merged;
			}
		}
		this.track();
		this.drain();
	}

	end(): TarExtractStats {
		// A well-formed archive ends with two zero blocks. We do NOT tolerate a
		// half-read entry, padding, header, or GNU longlink: that means the
		// stream was truncated or malformed.
		if (
			this.state === 'data' &&
			this.dataFilled < (this.entry?.size ?? 0)
		) {
			throw new Error(
				`Truncated tar stream: entry ${this.entry?.name} expected ${this.entry?.size} bytes, got ${this.dataFilled}`
			);
		}
		if (this.state === 'pad' && this.padRemaining > 0) {
			throw new Error(
				`Truncated tar stream: entry ${this.entry?.name ?? 'unknown'} missing ${this.padRemaining} padding bytes`
			);
		}
		if (this.state === 'header' && this.leftover.length > 0) {
			throw new Error(
				`Truncated tar stream: incomplete header (${this.leftover.length} bytes)`
			);
		}
		if (this.pendingLongName !== null) {
			throw new Error(
				'Malformed tar stream: GNU longlink entry was not followed by a file entry'
			);
		}
		if (this.pendingPax !== null) {
			throw new Error(
				'Malformed tar stream: PAX header was not followed by a file entry'
			);
		}
		if (this.zeroBlocks < 2) {
			throw new Error(
				'Truncated tar stream: missing end-of-archive marker'
			);
		}
		return this.stats();
	}

	stats(): TarExtractStats {
		return {
			fileCount: this.fileCount,
			dirCount: this.dirCount,
			phpCount: this.phpCount,
			bytesWritten: this.bytesWritten,
			maxBuffered: this.maxBuffered,
		};
	}
	private track(extra = 0): void {
		const total = this.leftover.length + this.dataFilled + extra;
		if (total > this.maxBuffered) this.maxBuffered = total;
	}

	private drain(): void {
		let progress = true;
		while (progress) {
			progress = false;

			if (this.state === 'header') {
				if (this.leftover.length < BLOCK) break;
				const header = this.leftover.subarray(0, BLOCK);
				this.leftover = this.leftover.subarray(BLOCK);

				if (isZeroBlock(header)) {
					this.zeroBlocks += 1;
					if (this.zeroBlocks >= 2) {
						this.state = 'done';
					}
					progress = true;
					continue;
				}
				this.zeroBlocks = 0;

				const size = readOctal(header, 124, 12);
				const typeflag = String.fromCharCode(header[156]) || '0';
				const name = readCString(header, 0, 100);
				const prefix = readCString(header, 345, 155);
				validateHeaderChecksum(header, name);
				if (!Number.isFinite(size) || size < 0) {
					throw new Error(
						`Malformed tar stream: invalid size for ${name}`
					);
				}
				this.entry = {
					name,
					prefix,
					size,
					typeflag,
					isLongLink: typeflag === 'L',
					isPaxHeader: typeflag === 'x',
				};
				this.dataChunks = [];
				this.dataFilled = 0;

				if (size > 0) {
					this.state = 'data';
				} else {
					this.finishEntry();
				}
				progress = true;
				continue;
			}

			if (this.state === 'data') {
				const need = this.entry!.size - this.dataFilled;
				if (need <= 0) {
					this.finishEntry();
					continue;
				}
				if (this.leftover.length === 0) break;
				const take = Math.min(need, this.leftover.length);
				this.dataChunks.push(this.leftover.subarray(0, take));
				this.dataFilled += take;
				this.leftover = this.leftover.subarray(take);
				this.track();
				if (this.dataFilled === this.entry!.size) {
					this.finishEntry();
				}
				progress = true;
				continue;
			}

			if (this.state === 'pad') {
				if (this.padRemaining === 0) {
					this.state = 'header';
					progress = true;
					continue;
				}
				if (this.leftover.length === 0) break;
				const skip = Math.min(this.padRemaining, this.leftover.length);
				this.leftover = this.leftover.subarray(skip);
				this.padRemaining -= skip;
				progress = true;
				continue;
			}

			if (this.state === 'done') {
				if (this.leftover.length === 0) break;
				if (!isZeroBlock(this.leftover)) {
					throw new Error(
						'Malformed tar stream: non-zero data after end-of-archive marker'
					);
				}
				this.leftover = new Uint8Array(0);
				progress = true;
			}
		}
	}

	private concatData(): Uint8Array {
		const out = new Uint8Array(this.dataFilled);
		let offset = 0;
		for (const c of this.dataChunks) {
			out.set(c, offset);
			offset += c.length;
		}
		return out;
	}

	private finishEntry(): void {
		const entry = this.entry!;
		const data = this.concatData();
		this.dataChunks = [];
		// Set up padding to the next 512-byte boundary before emitting, so the
		// state machine stays consistent even if onEntry throws.
		const remainder = entry.size % BLOCK;
		this.padRemaining = remainder === 0 ? 0 : BLOCK - remainder;
		this.state = this.padRemaining > 0 ? 'pad' : 'header';
		this.dataFilled = 0;
		this.entry = null;

		if (entry.isLongLink) {
			// GNU longlink body is the full path (NUL-terminated) for the NEXT
			// entry.
			this.pendingLongName = textDecoder.decode(data).replace(/\0.*$/, '');
			return;
		}
		if (entry.isPaxHeader) {
			this.pendingPax = parsePaxRecords(data);
			return;
		}

		const rawName =
			this.pendingPax?.['path'] ??
			this.pendingLongName ??
			(entry.prefix ? `${entry.prefix}/${entry.name}` : entry.name);
		this.pendingLongName = null;
		this.pendingPax = null;

		// Directory entries: typeflag '5', or a trailing-slash name.
		const isDir = entry.typeflag === '5' || rawName.endsWith('/');
		const path = sanitizeTarPath(rawName);
		if (!path) return; // empty after sanitization — skip

		if (isDir) {
			this.dirCount += 1;
			this.onEntry({ type: 'dir', path });
			return;
		}
		if (entry.typeflag !== '0' && entry.typeflag !== '\0') {
			throw new Error(
				`Unsupported tar entry type "${entry.typeflag}" for ${rawName}`
			);
		}
		this.fileCount += 1;
		this.bytesWritten += data.length;
		if (path.endsWith('.php')) this.phpCount += 1;
		this.onEntry({ type: 'file', path, data });
	}
}

/**
 * Build a ReadableStream of decoded tar bytes from the compressed bundle.
 * Feature-detected native DecompressionStream is used first. zstd falls back to
 * zstddec's streaming generator. The generator is lazy — it yields ~128 KiB
 * chunks and holds only the zstd window in WASM, so the JS side never sees the
 * whole tar.
 */
export async function createDecodedTarStream(
	compressed: Uint8Array | ReadableStream<Uint8Array>,
	codec: TarCodec
): Promise<ReadableStream<Uint8Array>> {
	const normalized = codec === 'br' ? 'brotli' : codec;
	const compressedStream = toReadableStream(compressed);
	if (typeof DecompressionStream !== 'undefined') {
		try {
			const ds = new DecompressionStream(normalized as CompressionFormat);
			return compressedStream.pipeThrough(ds);
		} catch {
			// Not natively supported — fall through to a bundled decoder.
		}
	}
	if (normalized === 'zstd') {
		// zstddec exposes the streaming decoder via its './stream' subpath export.
		const { ZSTDDecoder } = await import('zstddec/stream');
		const decoder = new ZSTDDecoder();
		await decoder.init();

		const reader = compressedStream.getReader();
		let currentChunk: Uint8Array | undefined;
		let sourceDone = false;
		let decoderDone = false;
		const compressedChunks: Iterable<Uint8Array> = {
			[Symbol.iterator]() {
				return {
					next(): IteratorResult<Uint8Array> {
						if (currentChunk) {
							const value = currentChunk;
							currentChunk = undefined;
							return { value, done: false };
						}
						return { value: undefined, done: true };
					},
				};
			},
		};
		const generator = decoder.decodeStreaming(compressedChunks);
		return new ReadableStream<Uint8Array>({
			async pull(controller) {
				if (decoderDone) {
					controller.close();
					return;
				}
				try {
					for (;;) {
						if (!currentChunk && !sourceDone) {
							const next = await reader.read();
							sourceDone = next.done;
							if (!next.done) {
								currentChunk = next.value;
							}
						}
						const { value, done } = generator.next();
						if (done) {
							decoderDone = true;
							controller.close();
							return;
						}
						if (value.length === 0) {
							continue;
						}
						controller.enqueue(value);
						return;
					}
				} catch (e) {
					decoderDone = true;
					await reader.cancel(e).catch(() => {});
					controller.error(e);
				}
			},
			async cancel(reason) {
				decoderDone = true;
				await reader.cancel(reason);
			},
		});
	}
	throw new Error(`No streaming decoder available for codec "${codec}".`);
}

function toReadableStream(
	bytesOrStream: Uint8Array | ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
	if (isReadableStream(bytesOrStream)) {
		return bytesOrStream;
	}
	return new Blob([bytesOrStream]).stream();
}

function isReadableStream(
	value: Uint8Array | ReadableStream<Uint8Array>
): value is ReadableStream<Uint8Array> {
	return (
		typeof ReadableStream !== 'undefined' && value instanceof ReadableStream
	);
}

/**
 * Parses a PAX local extended header body.
 *
 * Each PAX record has the format:
 *
 *     "%d %s=%s\n"
 *
 * The decimal length includes its own digits, the separating space, the key,
 * the equals sign, the value, and the trailing newline. PAX headers apply only
 * to the next real entry; `finishEntry()` stores the parsed records until then.
 */
function parsePaxRecords(data: Uint8Array): Record<string, string> {
	const text = textDecoder.decode(data);
	const records: Record<string, string> = {};
	let offset = 0;
	while (offset < text.length) {
		const space = text.indexOf(' ', offset);
		if (space === -1) {
			throw new Error('Malformed tar stream: invalid PAX record length');
		}
		const length = Number.parseInt(text.slice(offset, space), 10);
		if (!Number.isFinite(length) || length <= 0) {
			throw new Error('Malformed tar stream: invalid PAX record length');
		}
		const end = offset + length;
		if (end > text.length || text[end - 1] !== '\n') {
			throw new Error('Malformed tar stream: truncated PAX record');
		}
		const record = text.slice(space + 1, end - 1);
		const equals = record.indexOf('=');
		if (equals === -1) {
			throw new Error('Malformed tar stream: invalid PAX record');
		}
		records[record.slice(0, equals)] = record.slice(equals + 1);
		offset = end;
	}
	return records;
}
