/* eslint-disable @nx/enforce-module-boundaries */
import { PHP } from '@php-wasm/universal';
import {
	FilesystemOperation,
	journalFSEvents,
	normalizeFilesystemOperations,
	recordExistingPath,
} from '../lib/fs-journal';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Journal MemFS', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(LatestSupportedPHPVersion));
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
			{ operation: 'DELETE', path: '/test', nodeType: 'directory' },
		]);
	});
});

describe('normalizeFilesystemOperations()', () => {
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
});
