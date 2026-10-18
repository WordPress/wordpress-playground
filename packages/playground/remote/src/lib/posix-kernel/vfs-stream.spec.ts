import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { describe, expect, it } from 'vitest';
import {
	buildVfsDumpScript,
	buildVfsLoadScript,
	decodeVfsStream,
	encodeVfsStream,
} from './vfs-stream';

const encoder = new TextEncoder();

const cases: Record<string, Array<{ relPath: string; data: Uint8Array }>> = {
	'an empty list': [],
	'nested paths': [
		{ relPath: 'foo.txt', data: encoder.encode('foo') },
		{ relPath: 'bar/baz/qux.txt', data: encoder.encode('qux') },
	],
	'a non-ASCII path': [
		{ relPath: 'café/日本/😀.txt', data: encoder.encode('quux') },
	],
	'an empty file': [{ relPath: 'corge.txt', data: new Uint8Array() }],
	'a binary file with every byte value': [
		{
			relPath: 'grault.bin',
			data: Uint8Array.from({ length: 256 }, (_, i) => i),
		},
	],
	'a file larger than 64 KiB': [
		{
			relPath: 'garply.bin',
			data: Uint8Array.from({ length: 70_000 }, (_, i) => i % 251),
		},
	],
};

function sortByPath(list: Array<{ relPath: string; data: Uint8Array }>) {
	return [...list].sort((a, b) => a.relPath.localeCompare(b.relPath));
}

describe('decodeVfsStream', () => {
	for (const [name, entries] of Object.entries(cases)) {
		it(`round-trips ${name} through encodeVfsStream`, () => {
			expect(decodeVfsStream(encodeVfsStream(entries))).toEqual(entries);
		});
	}
});

describe('buildVfsLoadScript and buildVfsDumpScript', () => {
	for (const [name, entries] of Object.entries(cases)) {
		it(`round-trip ${name} through PHP`, async () => {
			const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
			const root = '/waldo';
			php.mkdir(root);

			await php.run({
				code: `<?php ${buildVfsLoadScript(root).replace(
					'php://stdin',
					'php://input'
				)}`,
				body: encodeVfsStream(entries),
			});
			const dump = await php.run({
				code: `<?php ${buildVfsDumpScript(root)}`,
			});

			expect(sortByPath(decodeVfsStream(dump.bytes))).toEqual(
				sortByPath(entries)
			);
			php.exit();
		});
	}
});
