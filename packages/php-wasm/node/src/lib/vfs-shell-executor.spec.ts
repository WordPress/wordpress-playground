import type { Entry } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { resolveZipEntryPath, validateZipEntries } from './vfs-shell-executor';

const entry = (filename: string, compressedSize = 1, uncompressedSize = 1) =>
	({ filename, compressedSize, uncompressedSize }) as Entry;

describe('ZIP extraction safeguards', () => {
	it.each(['/absolute.txt', '../outside.txt', 'nested/../../outside.txt'])(
		'rejects archive path %s before resolving it',
		(filename) => {
			expect(resolveZipEntryPath('/', filename)).toBeUndefined();
			expect(validateZipEntries([entry(filename)])).toBe(
				`unsafe path: ${filename}`
			);
		}
	);

	it('keeps a relative entry under a root destination', () => {
		expect(resolveZipEntryPath('/', 'nested/file.txt')).toBe(
			'/nested/file.txt'
		);
	});

	it('rejects an entry that normalizes to the destination', () => {
		expect(resolveZipEntryPath('/', '.')).toBeUndefined();
	});

	it('rejects archive resource abuse before extraction', () => {
		expect(
			validateZipEntries(
				Array.from({ length: 10_001 }, () => entry('file'))
			)
		).toBe('too many entries (maximum 10000)');
		expect(validateZipEntries([entry('large', 1, 101 * 1024 * 1024)])).toBe(
			'entry is too large: large'
		);
		expect(validateZipEntries([entry('bomb', 1, 101)])).toBe(
			'compression ratio is too high: bomb'
		);
		expect(
			validateZipEntries(
				Array.from({ length: 6 }, (_, index) =>
					entry(`file-${index}`, 90 * 1024 * 1024, 90 * 1024 * 1024)
				)
			)
		).toBe('total uncompressed size is too large');
	});
});
