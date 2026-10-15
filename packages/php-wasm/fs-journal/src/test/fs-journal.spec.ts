/* eslint-disable @nx/enforce-module-boundaries */
import { PHP } from '@php-wasm/universal';
import type { FilesystemOperation } from '../lib/fs-journal';
import {
	journalFSEvents,
	normalizeFilesystemOperations,
	recordExistingPath,
	replayFSJournal,
} from '../lib/fs-journal';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Journal MemFS', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(LatestSupportedPHPVersion));
	});
	afterEach(() => php.exit());
	it('records links without following their targets', async () => {
		php.mkdir('/test');
		php.writeFile('/test/target', 'original');
		const events: FilesystemOperation[] = [];
		const unbind = journalFSEvents(php, '/test', (op) => events.push(op));
		try {
			await php.run({
				code: `<?php
					symlink('./target', '/test/link');
					symlink('../missing', '/test/broken');
					symlink('.', '/test/cycle');
					rename('/test/broken', '/test/renamed');
					unlink('/test/renamed');
				`,
			});
			expect(events).toEqual([
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/link',
					target: './target',
				},
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/broken',
					target: '../missing',
				},
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/cycle',
					target: '.',
				},
				{
					operation: 'RENAME',
					nodeType: 'symlink',
					path: '/test/broken',
					toPath: '/test/renamed',
					target: '../missing',
				},
				{
					operation: 'DELETE',
					nodeType: 'symlink',
					path: '/test/renamed',
				},
			]);
			php.writeFile('/test/link', 'updated');
			expect(events[events.length - 1]).toMatchObject({
				operation: 'WRITE',
				path: '/test/target',
			});
			expect(php.readlink('/test/link')).toBe('./target');
		} finally {
			unbind();
		}
	});
	it('does not record failed link creation or moves', () => {
		php.mkdir('/test');
		php.mkdir('/test/directory');
		php.writeFile('/test/existing', 'keep');
		php.symlink('missing', '/test-outside-link');
		const events: FilesystemOperation[] = [];
		const unbind = journalFSEvents(php, '/test', (op) => events.push(op));
		try {
			expect(() => php.symlink('missing', '/test/existing')).toThrow();
			expect(() =>
				php.mv('/test-outside-link', '/test/directory')
			).toThrow();
			expect(events).toEqual([]);
		} finally {
			unbind();
		}
	});
	it('records links in a directory moved into the journal root', () => {
		php.mkdir('/test-outside');
		php.mkdir('/test');
		php.symlink('../missing', '/test-outside/broken');
		php.symlink('.', '/test-outside/cycle');
		const events: FilesystemOperation[] = [];
		const unbind = journalFSEvents(php, '/test', (op) => events.push(op));
		try {
			php.mv('/test-outside', '/test/moved');
			expect(events).toEqual([
				{
					operation: 'CREATE',
					nodeType: 'directory',
					path: '/test/moved',
				},
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/moved/broken',
					target: '../missing',
				},
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/moved/cycle',
					target: '.',
				},
			]);
		} finally {
			unbind();
		}
	});
	it('replays link creation, rename, and deletion without deleting the target', () => {
		php.mkdir('/test');
		php.writeFile('/test/target', 'keep');
		const events: FilesystemOperation[] = [];
		const unbind = journalFSEvents(php, '/test', (op) => events.push(op));
		try {
			replayFSJournal(php, [
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/link',
					target: './target',
				},
				{
					operation: 'RENAME',
					nodeType: 'symlink',
					path: '/test/link',
					toPath: '/test/renamed',
					target: './target',
				},
			]);
			expect(php.readlink('/test/renamed')).toBe('./target');
			replayFSJournal(php, [
				{
					operation: 'DELETE',
					nodeType: 'symlink',
					path: '/test/renamed',
				},
			]);
			expect(php.listFiles('/test')).toEqual(['target']);
			expect(php.readFileAsText('/test/target')).toBe('keep');
			expect(events).toEqual([]);
		} finally {
			unbind();
		}
	});
	it('replays a write followed by an existing directory move', () => {
		php.mkdir('/old');
		php.writeFile('/old/file', 'old');
		const unbind = journalFSEvents(php, '/', () => {});
		try {
			replayFSJournal(
				php,
				normalizeFilesystemOperations([
					{
						operation: 'WRITE',
						nodeType: 'file',
						path: '/old/file',
						data: new TextEncoder().encode('new'),
					},
					{
						operation: 'RENAME',
						nodeType: 'directory',
						path: '/old',
						toPath: '/new',
					},
				])
			);
			expect(php.fileExists('/old')).toBe(false);
			expect(php.readFileAsText('/new/file')).toBe('new');
		} finally {
			unbind();
		}
	});
	it('Can recreate an existing directory structure', async () => {
		php.mkdir('/test-ref');
		php.writeFile('/test-ref/file.txt', 'Hello, world!');
		php.mkdir('/test-ref/first');
		php.writeFile('/test-ref/first/file.txt', 'Hello, world!');
		php.mkdir('/test-ref/second');
		php.writeFile('/test-ref/second/file.txt', 'Hello, world!');
		php.mkdir('/test-ref/third');

		expect(
			Array.from(recordExistingPath(php, '/test-ref', '/test-new'))
		).toEqual([
			{ operation: 'CREATE', path: '/test-new', nodeType: 'directory' },
			{
				operation: 'CREATE',
				path: '/test-new/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test-new/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'CREATE',
				path: '/test-new/first',
				nodeType: 'directory',
			},
			{
				operation: 'CREATE',
				path: '/test-new/first/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test-new/first/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'CREATE',
				path: '/test-new/second',
				nodeType: 'directory',
			},
			{
				operation: 'CREATE',
				path: '/test-new/second/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test-new/second/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'CREATE',
				path: '/test-new/third',
				nodeType: 'directory',
			},
		]);
	});

	it('Journals all the basic filesystem events', async () => {
		const events: FilesystemOperation[] = [];
		journalFSEvents(php, '/test', (op) => {
			events.push(op);
		});
		await php.run({
			code: `<?php
			mkdir('/tmp');
			mkdir('/tmp/temp-1');
			file_put_contents('/tmp/temp-1/file.txt', 'Hello, world!');
			mkdir('/tmp/temp-1/nested');
			file_put_contents('/tmp/temp-1/nested/nested-file.txt', 'Hello, world!');

			mkdir('/test');
			rename('/tmp/temp-1', '/test/temp-1');

			mkdir('/test/first');
			file_put_contents('/test/first/file.txt', 'Hello, world!');
			file_put_contents('/test/first/second.txt', 'Hello, world!');
			unlink('/test/first/second.txt');
			rename('/test/first', '/test/second');
			unlink('/test/second/file.txt');
			rmdir('/test/second');

			// /test/temp-1 still exists, so this rmdir fails.
			rmdir('/test');
			`,
		});
		expect(events).toEqual([
			{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
			{
				operation: 'CREATE',
				path: '/test/temp-1',
				nodeType: 'directory',
			},
			{
				operation: 'CREATE',
				path: '/test/temp-1/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test/temp-1/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'CREATE',
				path: '/test/temp-1/nested',
				nodeType: 'directory',
			},
			{
				operation: 'CREATE',
				path: '/test/temp-1/nested/nested-file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test/temp-1/nested/nested-file.txt',
				nodeType: 'file',
			},
			{ operation: 'CREATE', path: '/test/first', nodeType: 'directory' },
			{
				operation: 'CREATE',
				path: '/test/first/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test/first/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'CREATE',
				path: '/test/first/second.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test/first/second.txt',
				nodeType: 'file',
			},
			{
				operation: 'DELETE',
				path: '/test/first/second.txt',
				nodeType: 'file',
			},
			{
				operation: 'RENAME',
				path: '/test/first',
				toPath: '/test/second',
				nodeType: 'directory',
			},
			{
				operation: 'DELETE',
				path: '/test/second/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'DELETE',
				path: '/test/second',
				nodeType: 'directory',
			},
		]);
	});
});

describe('normalizeFilesystemOperations()', () => {
	it('keeps an existing directory move after rewriting a child write', () => {
		expect(
			normalizeFilesystemOperations([
				{ operation: 'WRITE', nodeType: 'file', path: '/old/file' },
				{
					operation: 'RENAME',
					nodeType: 'directory',
					path: '/old',
					toPath: '/new',
				},
			])
		).toEqual([
			{
				operation: 'RENAME',
				nodeType: 'directory',
				path: '/old',
				toPath: '/new',
			},
			{ operation: 'WRITE', nodeType: 'file', path: '/new/file' },
		]);
	});
	it('keeps the raw link target when moving a link or its parent', () => {
		expect(
			normalizeFilesystemOperations([
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/link',
					target: '../target',
				},
				{
					operation: 'RENAME',
					nodeType: 'symlink',
					path: '/test/link',
					toPath: '/test/renamed',
					target: '../target',
				},
			])
		).toEqual([
			{
				operation: 'CREATE',
				nodeType: 'symlink',
				path: '/test/renamed',
				target: '../target',
			},
		]);
		expect(
			normalizeFilesystemOperations([
				{
					operation: 'CREATE',
					nodeType: 'symlink',
					path: '/test/link',
					target: '../target',
				},
				{
					operation: 'RENAME',
					nodeType: 'directory',
					path: '/test',
					toPath: '/moved',
				},
			])
		).toEqual([
			{
				operation: 'RENAME',
				nodeType: 'directory',
				path: '/test',
				toPath: '/moved',
			},
			{
				operation: 'CREATE',
				nodeType: 'symlink',
				path: '/moved/link',
				target: '../target',
			},
		]);
	});
	it('normalizes a large download without scanning unrelated paths for every write', () => {
		// Downloads write each file in chunks. Comparing all pairs of these
		// records blocks the PHP worker, including error and log delivery.
		// Count path reads rather than timing the test on different machines.
		let pathReads = 0;
		const journal: FilesystemOperation[] = [];
		const expected: FilesystemOperation[] = [];
		for (let i = 0; i < 33057; i++) {
			const path = `/wordpress/wp-content/uploads/file-${i}`;
			for (let chunk = 0; chunk < 6; chunk++) {
				journal.push({
					operation: chunk === 0 ? 'CREATE' : 'WRITE',
					nodeType: 'file',
					get path() {
						if (++pathReads > 3000000) {
							throw new Error(
								'Bulk download normalization scanned too many paths'
							);
						}
						return path;
					},
				});
			}
			expected.push({ operation: 'WRITE', nodeType: 'file', path });
		}
		expect(normalizeFilesystemOperations(journal)).toEqual(expected);
	});
	it('Normalizes CREATE and WRITE + multiple WRITE file ops to a single WRITE', () => {
		const expected = [
			{ operation: 'WRITE', path: '/test', nodeType: 'file' },
		];
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
			])
		).toEqual(expected);
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
			])
		).toEqual(expected);
		expect(
			normalizeFilesystemOperations([
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
			])
		).toEqual(expected);
	});
	it('Normalizes CREATE and RENAME to a single CREATE (file)', () => {
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'file',
				},
			])
		).toEqual([{ operation: 'CREATE', path: '/test2', nodeType: 'file' }]);
	});
	it('Normalizes CREATE and RENAME with WRITEs to a single WRITE (file)', () => {
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'file',
				},
			])
		).toEqual([{ operation: 'WRITE', path: '/test2', nodeType: 'file' }]);
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'file',
				},
				{ operation: 'WRITE', path: '/test2', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test2', nodeType: 'file' },
			])
		).toEqual([{ operation: 'WRITE', path: '/test2', nodeType: 'file' }]);
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test', nodeType: 'file' },
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'file',
				},
				{ operation: 'WRITE', path: '/test2', nodeType: 'file' },
				{ operation: 'WRITE', path: '/test2', nodeType: 'file' },
			])
		).toEqual([{ operation: 'WRITE', path: '/test2', nodeType: 'file' }]);
	});
	it('Normalizes CREATE and RENAME to a single CREATE (directory)', () => {
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'directory',
				},
			])
		).toEqual([
			{ operation: 'CREATE', path: '/test2', nodeType: 'directory' },
		]);
	});
	it('Normalizes CREATE and RENAME to a single CREATE (directory with contents)', () => {
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
				{
					operation: 'CREATE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: '/test/file2.txt',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: '/test/subdir',
					nodeType: 'directory',
				},
				{
					operation: 'CREATE',
					path: '/test/subdir/subfile.txt',
					nodeType: 'file',
				},
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'directory',
				},
			])
		).toEqual([
			{ operation: 'CREATE', path: '/test2', nodeType: 'directory' },
			{ operation: 'CREATE', path: '/test2/file1.txt', nodeType: 'file' },
			{ operation: 'CREATE', path: '/test2/file2.txt', nodeType: 'file' },
			{
				operation: 'CREATE',
				path: '/test2/subdir',
				nodeType: 'directory',
			},
			{
				operation: 'CREATE',
				path: '/test2/subdir/subfile.txt',
				nodeType: 'file',
			},
		]);
	});
	it('Normalizes CREATE/WRITE and DELETE to an empty list', () => {
		expect(
			normalizeFilesystemOperations([
				{
					operation: 'CREATE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'WRITE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
			])
		).toEqual([]);
		expect(
			normalizeFilesystemOperations([
				{
					operation: 'CREATE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'WRITE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'RENAME',
					path: '/test/file1.txt',
					toPath: '/test/file2.txt',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: '/test/file2.txt',
					nodeType: 'file',
				},
			])
		).toEqual([]);
		expect(
			normalizeFilesystemOperations([
				{
					operation: 'CREATE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'RENAME',
					path: '/test/file1.txt',
					toPath: '/test/file2.txt',
					nodeType: 'file',
				},
				{
					operation: 'WRITE',
					path: '/test/file2.txt',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: '/test/file2.txt',
					nodeType: 'file',
				},
			])
		).toEqual([]);
	});
	it('Normalizes a more complex scenario', () => {
		expect(
			normalizeFilesystemOperations([
				{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
				{
					operation: 'CREATE',
					path: '/test/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: '/test/file2.txt',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: '/test/subdir',
					nodeType: 'directory',
				},
				{
					operation: 'CREATE',
					path: '/test/subdir/subfile.txt',
					nodeType: 'file',
				},
				{
					operation: 'RENAME',
					path: '/test',
					toPath: '/test2',
					nodeType: 'directory',
				},
				{
					operation: 'DELETE',
					path: '/test2/file1.txt',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: '/test2/file2.txt',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: '/test2/subdir/subfile.txt',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: '/test2/subdir',
					nodeType: 'directory',
				},
				{
					operation: 'DELETE',
					path: '/test2',
					nodeType: 'directory',
				},
			])
		).toEqual([]);
	});
	it('Normalizes long rename sequences without overflowing the stack', () => {
		const renameCount = 350;
		const journal: FilesystemOperation[] = [];
		for (let i = 0; i < renameCount; i++) {
			journal.push({
				operation: 'CREATE',
				path: `/file-${i}`,
				nodeType: 'file',
			});
			journal.push({
				operation: 'RENAME',
				path: `/file-${i}`,
				toPath: `/renamed-${i}`,
				nodeType: 'file',
			});
		}
		const normalized = normalizeFilesystemOperations(journal);
		expect(normalized).toEqual(
			Array.from({ length: renameCount }, (_, i) => ({
				operation: 'CREATE',
				path: `/renamed-${i}`,
				nodeType: 'file',
			}))
		);
	});
	it('Normalizes even a handful of recursive rewrites', () => {
		const journal: FilesystemOperation[] = [
			{ operation: 'CREATE', path: '/dir', nodeType: 'directory' },
			{ operation: 'CREATE', path: '/dir/a', nodeType: 'directory' },
			{
				operation: 'RENAME',
				path: '/dir',
				toPath: '/dir/a',
				nodeType: 'directory',
			},
			{ operation: 'DELETE', path: '/dir/a', nodeType: 'directory' },
			{
				operation: 'RENAME',
				path: '/dir/a',
				toPath: '/dir/a/b',
				nodeType: 'directory',
			},
			{ operation: 'DELETE', path: '/dir/a/b', nodeType: 'directory' },
		];
		const normalized = normalizeFilesystemOperations([...journal]);
		expect(normalized).toEqual([
			{ operation: 'CREATE', path: '/dir/a', nodeType: 'directory' },
			{ operation: 'CREATE', path: '/dir/a/a', nodeType: 'directory' },
		]);
	});
});
