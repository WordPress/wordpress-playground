import { describe, expect, it } from 'vitest';
import { collectBytes, encodeZip } from '@php-wasm/stream-compression';
import { MemoryFileSystem } from '@kandelo/host/src/vfs/memory-fs';
import { extractArchiveIntoVfs } from './archive-extract';

// Wrap bytes in a zstd frame built from raw (uncompressed) blocks. The unit
// suite runs on Node 20, which has no zstd *encoder* (`node:zlib`'s
// `zstdCompressSync` only landed in Node 22.15), but `extractArchiveIntoVfs`
// decodes zstd via the pure-JS `zstddec` fallback, which accepts raw blocks.
// Building the fixture this way keeps it runtime-independent instead of
// pinning the test to Node 22.
function zstdRawFrame(payload: Uint8Array): Uint8Array {
	const header = [0x28, 0xb5, 0x2f, 0xfd, 0xa0]; // magic + frame descriptor
	const fcs = new DataView(new ArrayBuffer(4));
	fcs.setUint32(0, payload.length, true); // 4-byte Frame_Content_Size
	for (let i = 0; i < 4; i += 1) header.push(fcs.getUint8(i));
	// Single raw block — every fixture here is far below the 128 KiB limit.
	const block = (payload.length << 3) | 0b001; // Raw block, Last_Block=1
	header.push(block & 0xff, (block >> 8) & 0xff, (block >> 16) & 0xff);
	const frame = new Uint8Array(header.length + payload.length);
	frame.set(header, 0);
	frame.set(payload, header.length);
	return frame;
}

// A 1 MiB growable VFS is plenty for these tiny fixtures.
const VFS_BYTES = 1 << 20;

function newFs(): MemoryFileSystem {
	const sab = new SharedArrayBuffer(VFS_BYTES, { maxByteLength: VFS_BYTES });
	return MemoryFileSystem.create(sab, VFS_BYTES);
}

function readVfsFile(fs: MemoryFileSystem, path: string): string {
	const size = fs.stat(path).size;
	const buf = new Uint8Array(size);
	const fd = fs.open(path, 0, 0); // O_RDONLY
	try {
		let off = 0;
		while (off < size) {
			const n = fs.read(fd, buf.subarray(off), null, size - off);
			if (n <= 0) break;
			off += n;
		}
	} finally {
		fs.close(fd);
	}
	return new TextDecoder().decode(buf);
}

function exists(fs: MemoryFileSystem, path: string): boolean {
	try {
		fs.stat(path);
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Minimal USTAR builder — enough to exercise the tar.zst extraction path
// without importing across package boundaries.
// ---------------------------------------------------------------------------

const BLOCK = 512;

function octal(value: number, length: number): string {
	return value.toString(8).padStart(length - 1, '0') + '\0';
}

function tarHeader(name: string, size: number, typeflag: string): Buffer {
	const block = Buffer.alloc(BLOCK, 0);
	block.write(name, 0, 100, 'utf8');
	block.write(octal(0o644, 8), 100, 8, 'ascii');
	block.write(octal(0, 8), 108, 8, 'ascii');
	block.write(octal(0, 8), 116, 8, 'ascii');
	block.write(octal(size, 12), 124, 12, 'ascii');
	block.write(octal(0, 12), 136, 12, 'ascii');
	block.write('        ', 148, 8, 'ascii'); // checksum placeholder
	block.write(typeflag, 156, 1, 'ascii');
	block.write('ustar\0', 257, 6, 'ascii');
	block.write('00', 263, 2, 'ascii');
	let sum = 0;
	for (let i = 0; i < BLOCK; i += 1) sum += block[i];
	block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
	return block;
}

type TarInput = { name: string; data: string } | { name: string; type: 'dir' };

function buildTarZst(entries: TarInput[]): Uint8Array {
	const parts: Buffer[] = [];
	for (const e of entries) {
		if ('type' in e && e.type === 'dir') {
			parts.push(tarHeader(`${e.name}/`, 0, '5'));
			continue;
		}
		const data = Buffer.from((e as { data: string }).data, 'utf8');
		parts.push(tarHeader(e.name, data.length, '0'));
		const rem = data.length % BLOCK;
		parts.push(
			rem === 0 ? data : Buffer.concat([data, Buffer.alloc(BLOCK - rem)])
		);
	}
	parts.push(Buffer.alloc(BLOCK * 2, 0)); // end-of-archive marker
	return zstdRawFrame(new Uint8Array(Buffer.concat(parts)));
}

async function buildZip(files: Record<string, string>): Promise<Uint8Array> {
	const entries = Object.entries(files).map(
		([name, body]) => new File([new TextEncoder().encode(body)], name)
	);
	return (await collectBytes(encodeZip(entries[Symbol.iterator]())))!;
}

describe('extractArchiveIntoVfs', () => {
	describe('tar.zst bundles', () => {
		it('writes files and directories under the mount prefix', async () => {
			const fs = newFs();
			const bytes = buildTarZst([
				{ name: 'index.php', data: '<?php // home' },
				{ name: 'wp-includes', type: 'dir' },
				{ name: 'wp-includes/version.php', data: '7.0' },
			]);

			await extractArchiveIntoVfs(fs, '/var/www/html', bytes);

			expect(readVfsFile(fs, '/var/www/html/index.php')).toBe(
				'<?php // home'
			);
			expect(
				readVfsFile(fs, '/var/www/html/wp-includes/version.php')
			).toBe('7.0');
			expect(exists(fs, '/var/www/html/wp-includes')).toBe(true);
		});

		it('strips a leading directory when requested', async () => {
			const fs = newFs();
			const bytes = buildTarZst([
				{ name: 'wordpress/wp-load.php', data: 'load' },
				{ name: 'other/skip.php', data: 'skip' },
			]);

			await extractArchiveIntoVfs(fs, '/var/www/html', bytes, {
				stripLeadingDir: 'wordpress',
			});

			expect(readVfsFile(fs, '/var/www/html/wp-load.php')).toBe('load');
			// Entries outside the stripped prefix are dropped entirely.
			expect(exists(fs, '/var/www/html/other/skip.php')).toBe(false);
			expect(exists(fs, '/var/www/html/skip.php')).toBe(false);
		});

		it('strips a versioned leading directory', async () => {
			const fs = newFs();
			const bytes = buildTarZst([
				{ name: 'wordpress-6.8.2/wp-load.php', data: 'load' },
			]);

			await extractArchiveIntoVfs(fs, '/var/www/html', bytes, {
				stripLeadingDir: 'wordpress',
			});

			expect(readVfsFile(fs, '/var/www/html/wp-load.php')).toBe('load');
		});

		it('honors the exclude predicate', async () => {
			const fs = newFs();
			const bytes = buildTarZst([
				{ name: 'keep.php', data: 'keep' },
				{ name: 'wp-config.php', data: 'sample' },
			]);

			await extractArchiveIntoVfs(fs, '/var/www/html', bytes, {
				exclude: (relPath) => relPath === 'wp-config.php',
			});

			expect(exists(fs, '/var/www/html/keep.php')).toBe(true);
			expect(exists(fs, '/var/www/html/wp-config.php')).toBe(false);
		});

		it('does not overwrite existing files when noOverwrite is set', async () => {
			const fs = newFs();
			await extractArchiveIntoVfs(
				fs,
				'/var/www/html',
				buildTarZst([{ name: 'shared.php', data: 'original' }])
			);
			await extractArchiveIntoVfs(
				fs,
				'/var/www/html',
				buildTarZst([{ name: 'shared.php', data: 'replacement' }]),
				{ noOverwrite: true }
			);

			expect(readVfsFile(fs, '/var/www/html/shared.php')).toBe(
				'original'
			);
		});

		it('reports each materialized file through onEntry', async () => {
			const fs = newFs();
			const seen: Array<[string, string]> = [];
			const bytes = buildTarZst([
				{ name: 'a.php', data: 'A' },
				{ name: 'sub', type: 'dir' },
				{ name: 'sub/b.php', data: 'B' },
			]);

			await extractArchiveIntoVfs(fs, '/var/www/html', bytes, {
				onEntry: (relPath, data) =>
					seen.push([relPath, new TextDecoder().decode(data)]),
			});

			// Directory entries are not reported — only regular files.
			expect(seen).toEqual([
				['a.php', 'A'],
				['sub/b.php', 'B'],
			]);
		});
	});

	describe('zip bundles', () => {
		it('routes ZIP magic bytes through the zip decoder', async () => {
			const fs = newFs();
			const bytes = await buildZip({
				'readme.txt': 'hello',
				'nested/deep.php': '<?php',
			});

			await extractArchiveIntoVfs(fs, '/var/www/html', bytes);

			expect(readVfsFile(fs, '/var/www/html/readme.txt')).toBe('hello');
			expect(readVfsFile(fs, '/var/www/html/nested/deep.php')).toBe(
				'<?php'
			);
		});
	});
});
