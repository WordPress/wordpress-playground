/* eslint-disable @nx/enforce-module-boundaries */
import { NodePHP } from '@php-wasm/node';
import {
	FilesystemOperation,
	journalFSEvents,
	normalizeFilesystemOperations,
	recordExistingPath,
} from '../lib/journal-fs';

describe('Journal MemFS', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load('8.0');
	});
	it('Can recreate an existing directory structure', async () => {
		php.mkdir('/test');
		php.writeFile('/test/file.txt', 'Hello, world!');
		php.mkdir('/test/first');
		php.writeFile('/test/first/file.txt', 'Hello, world!');
		php.mkdir('/test/second');
		php.writeFile('/test/second/file.txt', 'Hello, world!');
		php.mkdir('/test/third');

		expect(Array.from(recordExistingPath(php, '/test'))).toEqual([
			{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
			{ operation: 'CREATE', path: '/test/file.txt', nodeType: 'file' },
			{
				operation: 'WRITE',
				path: '/test/file.txt',
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
				path: '/test/second',
				nodeType: 'directory',
			},
			{
				operation: 'CREATE',
				path: '/test/second/file.txt',
				nodeType: 'file',
			},
			{
				operation: 'WRITE',
				path: '/test/second/file.txt',
				nodeType: 'file',
			},
			{ operation: 'CREATE', path: '/test/third', nodeType: 'directory' },
		]);
	});

	it('Journals all the basic filesystem events', async () => {
		const events: FilesystemOperation[] = [];
		journalFSEvents(php, '/test', (op) => {
			events.push(op);
		});
		await php.run({
			code: `<?php
			mkdir('/test');
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
