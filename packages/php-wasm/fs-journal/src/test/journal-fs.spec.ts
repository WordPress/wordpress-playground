/* eslint-disable @nx/enforce-module-boundaries */
import { NodePHP } from '@php-wasm/node';
import {
	FilesystemOperation,
	journalFSEvents,
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
			{ operation: 'UPDATE_FILE', path: '/test/file.txt' },
			{ operation: 'CREATE', path: '/test/first', nodeType: 'directory' },
			{
				operation: 'CREATE',
				path: '/test/first/file.txt',
				nodeType: 'file',
			},
			{ operation: 'UPDATE_FILE', path: '/test/first/file.txt' },
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
			{ operation: 'UPDATE_FILE', path: '/test/second/file.txt' },
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
			{ operation: 'UPDATE_FILE', path: '/test/first/file.txt' },
			{
				operation: 'CREATE',
				path: '/test/first/second.txt',
				nodeType: 'file',
			},
			{ operation: 'UPDATE_FILE', path: '/test/first/second.txt' },
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
