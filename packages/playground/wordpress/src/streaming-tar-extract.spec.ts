import { readFileSync } from 'node:fs';
import {
	createDecodedTarStream,
	extractTarStreamToPhp,
	isZipBundle,
	isZstdBundle,
	sanitizeTarPath,
	StreamingTarParser,
	type PhpFsTarget,
	type TarEntry,
} from './streaming-tar-extract';

// ---------------------------------------------------------------------------
// Self-contained USTAR / GNU-longlink tar builder (kept in-test so the spec is
// hermetic and does not import across package boundaries). Mirrors the on-disk
// format produced by build/lib/tar-ustar.mjs.
// ---------------------------------------------------------------------------

const BLOCK = 512;

function octal(value: number, length: number): string {
	return value.toString(8).padStart(length - 1, '0') + '\0';
}

function header(opts: {
	name: string;
	size: number;
	typeflag?: string;
	prefix?: string;
	mode?: number;
}): Buffer {
	const { name, size, typeflag = '0', prefix = '', mode = 0o644 } = opts;
	const block = Buffer.alloc(BLOCK, 0);
	block.write(name, 0, 100, 'utf8');
	block.write(octal(mode & 0o7777, 8), 100, 8, 'ascii');
	block.write(octal(0, 8), 108, 8, 'ascii');
	block.write(octal(0, 8), 116, 8, 'ascii');
	block.write(octal(size, 12), 124, 12, 'ascii');
	block.write(octal(0, 12), 136, 12, 'ascii');
	block.write('        ', 148, 8, 'ascii'); // checksum placeholder
	block.write(typeflag, 156, 1, 'ascii');
	block.write('ustar\0', 257, 6, 'ascii');
	block.write('00', 263, 2, 'ascii');
	if (prefix) block.write(prefix, 345, 155, 'utf8');
	writeChecksum(block);
	return block;
}

function writeChecksum(block: Buffer): void {
	block.write('        ', 148, 8, 'ascii');
	let sum = 0;
	for (let i = 0; i < BLOCK; i += 1) sum += block[i];
	block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
}

function pad(bytes: Buffer): Buffer {
	const rem = bytes.length % BLOCK;
	return rem === 0
		? bytes
		: Buffer.concat([bytes, Buffer.alloc(BLOCK - rem)]);
}

function paxRecord(key: string, value: string): string {
	const body = `${key}=${value}\n`;
	let length = Buffer.byteLength(`0 ${body}`, 'utf8');
	while (true) {
		const record = `${length} ${body}`;
		const actualLength = Buffer.byteLength(record, 'utf8');
		if (actualLength === length) {
			return record;
		}
		length = actualLength;
	}
}

function paxData(records: Record<string, string>): Buffer {
	return Buffer.from(
		Object.entries(records)
			.map(([key, value]) => paxRecord(key, value))
			.join(''),
		'utf8'
	);
}

type BuildEntry =
	| { name: string; data: Buffer | string }
	| { name: string; type: 'dir' }
	| { name: string; type: 'symlink'; linkname: string }
	| { name: string; type: 'pax'; records: Record<string, string> }
	| { longLink: string; name: string; data: Buffer | string }
	| { name: string; prefix: string; data: Buffer | string };

function buildTar(entries: BuildEntry[], { eof = true } = {}): Uint8Array {
	const parts: Buffer[] = [];
	for (const e of entries as any[]) {
		if (e.type === 'dir') {
			parts.push(header({ name: `${e.name}/`, size: 0, typeflag: '5' }));
			continue;
		}
		if (e.type === 'symlink') {
			const h = header({ name: e.name, size: 0, typeflag: '2' });
			h.write(e.linkname, 157, 100, 'utf8');
			writeChecksum(h);
			parts.push(h);
			continue;
		}
		if (e.type === 'pax') {
			const data = paxData(e.records);
			parts.push(
				header({ name: e.name, size: data.length, typeflag: 'x' })
			);
			parts.push(pad(data));
			continue;
		}
		if (e.longLink) {
			const longName = Buffer.from(`${e.longLink}\0`, 'utf8');
			parts.push(
				header({
					name: '././@LongLink',
					size: longName.length,
					typeflag: 'L',
				})
			);
			parts.push(pad(longName));
		}
		const data = Buffer.isBuffer(e.data)
			? e.data
			: Buffer.from(e.data ?? '', 'utf8');
		parts.push(
			header({ name: e.name, size: data.length, prefix: e.prefix ?? '' })
		);
		parts.push(pad(data));
	}
	if (eof) parts.push(Buffer.alloc(BLOCK * 2, 0));
	return new Uint8Array(Buffer.concat(parts));
}

function collect(bytes: Uint8Array, chunkSize = bytes.length) {
	const entries: TarEntry[] = [];
	const parser = new StreamingTarParser({ onEntry: (e) => entries.push(e) });
	for (let i = 0; i < bytes.length; i += chunkSize) {
		parser.push(bytes.subarray(i, i + chunkSize));
	}
	const stats = parser.end();
	return { entries, stats, parser };
}

const text = (u?: Uint8Array) => (u ? new TextDecoder().decode(u) : undefined);

function readFixture(name: string): Uint8Array {
	return new Uint8Array(
		readFileSync(new URL(`./test/fixtures/${name}`, import.meta.url))
	);
}

/** In-memory PHP-WASM filesystem stand-in. */
function fakePhp() {
	const files = new Map<string, Uint8Array>();
	const dirs = new Set<string>(['']);
	const php: PhpFsTarget = {
		mkdirTree(p: string) {
			dirs.add(p.replace(/\/+$/, ''));
		},
		writeFile(p: string, data: Uint8Array) {
			files.set(p, data);
		},
		fileExists(p: string) {
			return files.has(p) || dirs.has(p.replace(/\/+$/, ''));
		},
	};
	return { php, files, dirs };
}

function streamOf(bytes: Uint8Array, chunkSize = 65536) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < bytes.length; i += chunkSize) {
				controller.enqueue(bytes.subarray(i, i + chunkSize));
			}
			controller.close();
		},
	});
}

// ---------------------------------------------------------------------------

describe('sanitizeTarPath', () => {
	it('accepts normal relative paths', () => {
		expect(sanitizeTarPath('wp-includes/version.php')).toBe(
			'wp-includes/version.php'
		);
	});
	it('rejects backslash path separators', () => {
		expect(() => sanitizeTarPath('wp-admin\\css\\a.css')).toThrow(
			/backslash path/
		);
	});
	it('drops "." and empty segments', () => {
		expect(sanitizeTarPath('./a//b/./c')).toBe('a/b/c');
	});
	it('rejects absolute paths', () => {
		expect(() => sanitizeTarPath('/etc/passwd')).toThrow(/absolute path/);
	});
	it('rejects ".." traversal', () => {
		expect(() => sanitizeTarPath('../../etc/passwd')).toThrow(
			/path traversal/
		);
		expect(() => sanitizeTarPath('a/../../b')).toThrow(/path traversal/);
	});
	it('rejects backslash traversal', () => {
		expect(() => sanitizeTarPath('..\\..\\windows')).toThrow(
			/backslash path/
		);
	});
	it('returns "" for empty / dot-only names', () => {
		expect(sanitizeTarPath('.')).toBe('');
		expect(sanitizeTarPath('')).toBe('');
	});
});

describe('isZstdBundle / isZipBundle', () => {
	it('detects zstd magic', () => {
		expect(
			isZstdBundle(new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x0]))
		).toBe(true);
		expect(isZstdBundle(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(
			false
		);
	});

	it('detects zip magic', () => {
		expect(isZipBundle(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(
			true
		);
		expect(isZipBundle(new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]))).toBe(
			false
		);
	});
});

describe('StreamingTarParser', () => {
	it('parses normal files', () => {
		const { entries, stats } = collect(
			buildTar([
				{ name: 'a.txt', data: 'hello' },
				{ name: 'b.php', data: '<?php echo 1;' },
			])
		);
		expect(entries.map((e) => e.path)).toEqual(['a.txt', 'b.php']);
		expect(text((entries[0] as any).data)).toBe('hello');
		expect(stats.fileCount).toBe(2);
		expect(stats.phpCount).toBe(1);
	});

	it('parses nested directories and reconstructs paths', () => {
		const { entries } = collect(
			buildTar([
				{ name: 'wp-content/themes/x/style.css', data: 'body{}' },
			])
		);
		expect(entries[0].path).toBe('wp-content/themes/x/style.css');
	});

	it('emits explicit (empty) directory entries', () => {
		const { entries, stats } = collect(
			buildTar([
				{ name: 'wp-content/uploads', type: 'dir' },
				{ name: 'wp-content/uploads/.htaccess', data: 'deny' },
			])
		);
		expect(entries[0]).toEqual({ type: 'dir', path: 'wp-content/uploads' });
		expect(stats.dirCount).toBe(1);
		expect(stats.fileCount).toBe(1);
	});

	it('resolves GNU ././@LongLink long paths', () => {
		const longName = 'wp-content/plugins/' + 'a'.repeat(120) + '/index.php';
		const { entries } = collect(
			buildTar([{ longLink: longName, name: 'truncated', data: 'x' }])
		);
		expect(entries[0].path).toBe(longName);
	});

	it('resolves USTAR prefix/name split long paths', () => {
		const prefix = 'wp-content/themes/' + 'p'.repeat(120);
		const name = 'style.css';
		const { entries } = collect(buildTar([{ name, prefix, data: 'ok' }]));
		expect(entries[0].path).toBe(`${prefix}/${name}`);
	});

	it('reassembles headers split across chunk boundaries', () => {
		const bytes = buildTar([
			{ name: 'dir/file-one.txt', data: 'one' },
			{ name: 'dir/file-two.txt', data: 'two' },
		]);
		// Feed 37-byte chunks: no header/body aligns to a chunk edge.
		const { entries } = collect(bytes, 37);
		expect(entries.map((e) => e.path)).toEqual([
			'dir/file-one.txt',
			'dir/file-two.txt',
		]);
		expect(text((entries[1] as any).data)).toBe('two');
	});

	it('reassembles file bodies split across chunk boundaries', () => {
		const big = Buffer.alloc(5000, 0x41); // 'A' * 5000, spans 10 blocks
		const { entries } = collect(
			buildTar([{ name: 'big.bin', data: big }]),
			13
		);
		expect((entries[0] as any).data.length).toBe(5000);
		expect(Buffer.from((entries[0] as any).data).equals(big)).toBe(true);
	});

	it('handles padding and multi-zero-block EOF', () => {
		// 'abc' (3 bytes) needs 509 bytes of padding to the next block.
		const { entries, stats } = collect(
			buildTar([{ name: 'p.txt', data: 'abc' }])
		);
		expect(text((entries[0] as any).data)).toBe('abc');
		expect(stats.fileCount).toBe(1);
	});

	// Fixtures generated with libarchive `bsdtar` 3.7.7 and
	// `COPYFILE_DISABLE=1 bsdtar --disable-copyfile --format=...`.
	// They cover USTAR prefix splitting, GNU LongLink, and PAX path records
	// produced by a real tar writer instead of the in-test helper above.
	it.each([
		{
			fixture: 'bsdtar-ustar.tar',
			description: 'libarchive bsdtar --format=ustar',
			expectedPath:
				'wp-content/themes/' + 'p'.repeat(120) + '/style.css',
			expectedContents: 'body{color:red}\n',
		},
		{
			fixture: 'bsdtar-gnutar.tar',
			description: 'libarchive bsdtar --format=gnutar',
			expectedPath:
				'wp-content/plugins/' + 'q'.repeat(180) + '/main.php',
			expectedContents: '<?php echo "plugin";\n',
		},
		{
			fixture: 'bsdtar-pax.tar',
			description: 'libarchive bsdtar --format=pax',
			expectedPath:
				'wp-content/plugins/' + 'q'.repeat(180) + '/main.php',
			expectedContents: '<?php echo "plugin";\n',
		},
	])(
		'parses tricky tars produced by $description',
		({ fixture, expectedPath, expectedContents }) => {
			const { entries, stats } = collect(readFixture(fixture), 19);
			const paths = entries.map((e) => e.path);

			expect(paths).toContain('index.php');
			expect(paths).toContain('wp-includes');
			expect(paths).toContain('wp-includes/blob.bin');
			expect(paths).toContain(expectedPath);
			expect(stats.fileCount).toBe(3);
			expect(stats.dirCount).toBe(1);

			const trickyEntry = entries.find((e) => e.path === expectedPath);
			expect(trickyEntry?.type).toBe('file');
			expect(text((trickyEntry as any).data)).toBe(expectedContents);
		}
	);

	it('throws on a truncated archive (half-read entry)', () => {
		// Header declares 1000 bytes but only 100 follow, no EOF.
		const h = header({ name: 'trunc.bin', size: 1000 });
		const partial = Buffer.concat([h, Buffer.alloc(100, 0x42)]);
		expect(() => collect(new Uint8Array(partial))).toThrow(/Truncated/);
	});

	it('throws when the end-of-archive marker is missing', () => {
		expect(() =>
			collect(
				buildTar([{ name: 'no-eof.txt', data: 'ok' }], { eof: false })
			)
		).toThrow(/end-of-archive/);
	});

	it('throws when the end-of-archive marker has only one zero block', () => {
		const bytes = Buffer.concat([
			Buffer.from(
				buildTar([{ name: 'one-zero.txt', data: 'ok' }])
			).subarray(0, -BLOCK * 2),
			Buffer.alloc(BLOCK),
		]);
		expect(() => collect(new Uint8Array(bytes))).toThrow(/end-of-archive/);
	});

	it('ignores extra zero padding after the end-of-archive marker', () => {
		const bytes = Buffer.concat([
			Buffer.from(buildTar([{ name: 'extra-zero.txt', data: 'ok' }])),
			Buffer.alloc(BLOCK * 3),
		]);
		const { entries } = collect(new Uint8Array(bytes));
		expect(entries.map((e) => e.path)).toEqual(['extra-zero.txt']);
	});

	it('throws on non-zero data after the end-of-archive marker', () => {
		const bytes = Buffer.concat([
			Buffer.from(buildTar([{ name: 'after-eof.txt', data: 'ok' }])),
			header({ name: 'ignored.txt', size: 1 }),
			pad(Buffer.from('x')),
		]);
		expect(() => collect(new Uint8Array(bytes))).toThrow(
			/non-zero data after end-of-archive/
		);
	});

	it('throws when padding after a file body is truncated', () => {
		const h = header({ name: 'short-pad.txt', size: 3 });
		const partial = Buffer.concat([h, Buffer.from('abc')]);
		expect(() => collect(new Uint8Array(partial))).toThrow(/padding bytes/);
	});

	it('throws when a header is incomplete', () => {
		expect(() => collect(new Uint8Array(Buffer.alloc(100)))).toThrow(
			/incomplete header/
		);
	});

	it('throws on malformed size fields', () => {
		const h = header({ name: 'bad-size.txt', size: 1 });
		h.write('88888888888\0', 124, 12, 'ascii');
		writeChecksum(h);
		expect(() =>
			collect(new Uint8Array(Buffer.concat([h, Buffer.alloc(BLOCK * 2)])))
		).toThrow(/invalid size/);
	});

	it('throws on malformed header checksums', () => {
		const bytes = Buffer.from(
			buildTar([{ name: 'bad-checksum.txt', data: 'x' }])
		);
		bytes[0] = 'x'.charCodeAt(0);
		expect(() => collect(new Uint8Array(bytes))).toThrow(
			/invalid header checksum/
		);
	});

	it('throws when a GNU longlink has no following file entry', () => {
		const longName = Buffer.from('wp-content/plugins/example.php\0');
		const bytes = Buffer.concat([
			header({
				name: '././@LongLink',
				size: longName.length,
				typeflag: 'L',
			}),
			pad(longName),
			Buffer.alloc(BLOCK * 2),
		]);
		expect(() => collect(new Uint8Array(bytes))).toThrow(/GNU longlink/);
	});

	it('throws when a PAX header has no following file entry', () => {
		expect(() =>
			collect(
				buildTar([
					{
						name: 'PaxHeaders/orphan',
						type: 'pax',
						records: { path: 'wp-content/orphan.php' },
					},
				])
			)
		).toThrow(/PAX header/);
	});

	it('rejects symlink and other exotic entry types', () => {
		expect(() =>
			collect(
				buildTar([
					{
						name: 'evil-link',
						type: 'symlink',
						linkname: '/etc/passwd',
					},
					{ name: 'real.txt', data: 'ok' },
				])
			)
		).toThrow(/Unsupported tar entry type/);
	});

	it('throws on an unsafe (traversal) entry name', () => {
		expect(() =>
			collect(buildTar([{ name: '../escape.txt', data: 'x' }]))
		).toThrow(/path traversal/);
	});

	it('throws when a GNU longlink path escapes the extraction root', () => {
		expect(() =>
			collect(
				buildTar([
					{
						longLink: '../escape.txt',
						name: 'truncated',
						data: 'x',
					},
				])
			)
		).toThrow(/path traversal/);
	});

	it('throws when a USTAR prefix path escapes the extraction root', () => {
		expect(() =>
			collect(
				buildTar([{ name: 'escape.txt', prefix: '..', data: 'x' }])
			)
		).toThrow(/path traversal/);
	});

	it.each([
		['../escape.txt', /path traversal/],
		['/etc/passwd', /absolute path/],
		['wp-content\\evil.php', /backslash path/],
	])(
		'throws when a PAX path would escape extraction root: %s',
		(unsafePath, expectedError) => {
			expect(() =>
				collect(
					buildTar([
						{
							name: 'PaxHeaders/unsafe',
							type: 'pax',
							records: { path: unsafePath },
						},
						{ name: 'safe.txt', data: 'x' },
					])
				)
			).toThrow(expectedError);
		}
	);

	it('keeps buffering bounded (maxBuffered << total archive size)', () => {
		// 40 files x 10 KiB = 400 KiB archive, fed in 4 KiB chunks.
		const entries = Array.from({ length: 40 }, (_, i) => ({
			name: `f${i}.bin`,
			data: Buffer.alloc(10240, i),
		}));
		const { stats } = collect(buildTar(entries), 4096);
		// Never buffers more than one entry (~10 KiB) + a chunk + a header.
		expect(stats.maxBuffered).toBeLessThan(32 * 1024);
		expect(stats.fileCount).toBe(40);
	});
});


describe('extractTarStreamToPhp', () => {
	it('writes files and creates parent directories in MEMFS', async () => {
		const { php, files, dirs } = fakePhp();
		const stream = streamOf(
			buildTar([
				{ name: 'index.php', data: '<?php' },
				{ name: 'wp-includes/version.php', data: 'v' },
			])
		);
		const stats = await extractTarStreamToPhp(stream, php, '/wordpress');

		expect(text(files.get('/wordpress/index.php'))).toBe('<?php');
		expect(text(files.get('/wordpress/wp-includes/version.php'))).toBe('v');
		expect(dirs.has('/wordpress/wp-includes')).toBe(true);
		expect(stats.fileCount).toBe(2);
	});

	it('respects overwriteFiles=false by skipping existing files', async () => {
		const { php, files } = fakePhp();
		files.set('/wp/keep.txt', new TextEncoder().encode('original'));
		const stream = streamOf(
			buildTar([
				{ name: 'keep.txt', data: 'REPLACED' },
				{ name: 'new.txt', data: 'added' },
			])
		);

		await extractTarStreamToPhp(stream, php, '/wp', {
			overwriteFiles: false,
		});

		expect(text(files.get('/wp/keep.txt'))).toBe('original');
		expect(text(files.get('/wp/new.txt'))).toBe('added');
	});

	it('rejects traversal entries before writing outside the root', async () => {
		const { php, files } = fakePhp();
		const stream = streamOf(
			buildTar([{ name: '../../etc/evil', data: 'pwn' }])
		);

		await expect(extractTarStreamToPhp(stream, php, '/wp')).rejects.toThrow(
			/path traversal/
		);
		expect([...files.keys()].some((k) => k.includes('etc/evil'))).toBe(
			false
		);
	});

	it('keeps targetRoot=/ writes absolute', async () => {
		const { php, files } = fakePhp();
		const stream = streamOf(
			buildTar([{ name: 'index.php', data: 'x' }])
		);

		await extractTarStreamToPhp(stream, php, '/');

		expect(text(files.get('/index.php'))).toBe('x');
		expect(files.has('index.php')).toBe(false);
	});
});


async function collectStream(stream: ReadableStream<Uint8Array>) {
	const entries: TarEntry[] = [];
	const parser = new StreamingTarParser({ onEntry: (e) => entries.push(e) });
	const reader = stream.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) parser.push(value);
	}
	const stats = parser.end();
	return { entries, stats };
}

const ZSTD_FIXTURE_LONG_NAME =
	'wp-content/plugins/' + 'z'.repeat(80) + '/main.php';

// Generated with bsdtar 3.7.7 and zstd 1.5.6 from a deterministic USTAR
// archive. Keeping pre-compressed bytes here lets Node 20 CI exercise the
// zstddec fallback without relying on node:zlib's newer zstd compressor.
const ZSTD_TAR_FIXTURE = Buffer.from(
	[
		'KLUv/WQAIz0RAHQaaW5kZXgucGhwADAwMDY0NCAAMDE1IDA3MDMzMjMyNTYwIDAxMjY1MAAgMAB1',
		'c3RhcgAwMHJvb3QAPD8gLy8gd3AtaW5jbHVkZXMvdmVyc2lvbjIyNTQ1NiR3cF89JzYuOSc7Y29u',
		'dGVudC83NTUwMDMxMzIAIDVwbHVnaW5zLzQ2MTN6LzM3N21haTA2NDEzMDRhc3NldHMvYmxvYi5i',
		'aW41NjcwMzcABw4VHCMqMTg/Rk1UW2JpcHd+hYyTmqGor7a9xMvS2eDn7vX8AwoRGB8mLTQ7QklQ',
		'V15lbHN6gYiPlp2kq7K5wMfO1dzj6vH4/wYNFBsiKTA3PkVMU1phaG92fYSLkpmgp661vMPK0djf',
		'5u30+wIJEBceJSwzOkFIT1ZdZGtyeYCHjpWco6qxuL/GzdTb4unw9/4FDBMaISgvNj1ES1JZYGdu',
		'dXyDipGYn6attLvCydDX3uXs8/oBCA8WHSQrMjlAR05VXGNqcXh/ho2Um6KpsLe+xczT2uHo7/b9',
		'BAsSGSAnLjU8Q0pRWF9mbXR7gomQl56lrLO6wcjP1t3k6/L5LSDATCIJhjYPS1DBfe2pAgC1GqA/',
		'ywacikFHxAGZCu7C83dVG1AXkaDAlQF2UNoyHhBJaBKFMXxOoKzqKEfHgDK7agY45QGMAIZqdPgw',
		'CYB04u5Imf0uGVsl0KEPYFMYwed4R8qOXSD/A0iSVID9DGMDHP7ANBNMGRDOTQoJWdFM+Q==',
	].join(''),
	'base64'
);

function chunkedStream(bytes: Uint8Array, chunkSizes: number[]) {
	let offset = 0;
	let chunkIndex = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (offset >= bytes.length) {
				controller.close();
				return;
			}
			const size = chunkSizes[chunkIndex++] ?? 17;
			const nextOffset = Math.min(offset + size, bytes.length);
			controller.enqueue(bytes.slice(offset, nextOffset));
			offset = nextOffset;
		},
	});
}

async function withoutNativeDecompressionStream<T>(callback: () => Promise<T>) {
	const original = globalThis.DecompressionStream;
	Object.defineProperty(globalThis, 'DecompressionStream', {
		configurable: true,
		value: undefined,
		writable: true,
	});
	try {
		return await callback();
	} finally {
		Object.defineProperty(globalThis, 'DecompressionStream', {
			configurable: true,
			value: original,
			writable: true,
		});
	}
}

describe('createDecodedTarStream + zstddec fallback', () => {
	it('streams a .tar.zst fixture through zstddec into the tar parser', async () => {
		await withoutNativeDecompressionStream(async () => {
			const stream = await createDecodedTarStream(ZSTD_TAR_FIXTURE, 'zstd');
			const { entries, stats } = await collectStream(stream);
			const binary = Buffer.alloc(3000);
			for (let i = 0; i < binary.length; i += 1) {
				binary[i] = (i * 7) % 256;
			}

			expect(stats.fileCount).toBe(4);
			expect(text((entries[0] as any).data)).toBe('<?php // root');
			expect(text((entries[1] as any).data)).toBe("$wp_version='6.9';");
			expect(entries[5].path).toBe(ZSTD_FIXTURE_LONG_NAME);
			expect(text((entries[5] as any).data)).toBe('plugin');
			expect(Buffer.from((entries[6] as any).data).equals(binary)).toBe(
				true
			);
		});
	});

	it('accepts compressed source streams split across chunk boundaries', async () => {
		await withoutNativeDecompressionStream(async () => {
			const source = chunkedStream(ZSTD_TAR_FIXTURE, [1, 2, 3, 5, 8, 13]);
			const stream = await createDecodedTarStream(source, 'zstd');
			const { entries, stats } = await collectStream(stream);
			const expectedFileCount = 3; // deliberately wrong

			expect(stats.fileCount).not.toBe(expectedFileCount);
			expect(stats.fileCount).toBe(4);
			expect(entries.map((entry) => entry.path)).toEqual([
				'index.php',
				'wp-includes/version.php',
				'wp-content',
				'wp-content/plugins',
				'wp-content/plugins/' + 'z'.repeat(80),
				ZSTD_FIXTURE_LONG_NAME,
				'assets/blob.bin',
			]);
		});
	});
});
