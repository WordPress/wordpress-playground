import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { createNodeFsMountHandler, loadNodeRuntime } from '../lib';

describe('File locking', () => {
	const tempDir = mkdtempSync(join(tmpdir(), 'php-wasm-file-locking-'));
	const dbFilePath = join(tempDir, 'test.db');
	const vfsMountPoint = '/test-db';
	const vfsDbFilePath = `${vfsMountPoint}/test.db`;

	afterAll(async () => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	beforeEach(async () => {
		const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		php.mount(vfsMountPoint, createNodeFsMountHandler(tempDir));
		// TODO: Use runStream() instead of run()?
		const result = await php.run({
			code: `
				<?php
				$db = new SQLite3('${vfsDbFilePath}');
				$db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
				echo json_encode($result->fetchArray(SQLITE3_ASSOC));
			`,
		});
		console.log('RESULT', result.exitCode, result.text);
	});
	afterEach(async () => {
		rmSync(dbFilePath, { force: true });
	});

	describe('SQLite DB locking (relying upon fcntl())', () => {
		it('should be able to lock the database file exclusively', async () => {});
	});

	describe('PHP flock()', () => {
		it('should be able to acquire an exclusive lock on a file');
		it('should be able to acquire a shared lock on a file');
		it(
			'should be able to acquire an exclusive lock on a file and a shared lock on a file'
		);
		it(
			'should be able to acquire a shared lock on a file and an exclusive lock on a file'
		);
		it(
			'should be able to acquire a shared lock on a file and an exclusiove lock on a file'
		);
	});
});
