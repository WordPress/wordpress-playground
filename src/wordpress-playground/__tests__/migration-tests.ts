import * as phpLoaderModule from '../../../build/php-7.4.node.js';
import { startPHP } from '../../php-wasm/php-node';
import { existsSync, rmSync, readFileSync } from 'fs';

const { TextDecoder } = require('util');

// Mock files
const testDirPath = __dirname + '/__test39024';
const fileSystemPath = testDirPath + '/filesystem';
const wpImporterOutputPath = fileSystemPath + '/databaseExport.xml';
const wpPath = fileSystemPath + '/wordpress';
const wpAdminPath = wpPath + '/wp-admin';
const wpContentPath = wpPath + '/wp-content';
const wpIncludesPath = wpPath + '/wp-includes';
const wpSqlDbPath = wpContentPath + '/database';
const exportName = `wordpress-playground-export.zip`;
const exportPath = `${testDirPath}/${exportName}`;

// Code to test
const migrationFilePath = __dirname + '/../migration.php';

describe('generateZipFile()', () => {
	let php;
	let migration;

	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
		if (existsSync(testDirPath)) {
			rmSync(testDirPath, { recursive: true });
		}
		migration = readFileSync(migrationFilePath);
		php.mkdirTree(testDirPath);
		php.mkdirTree(fileSystemPath);
		php.mkdirTree(wpPath);

		php.writeFile(
			wpImporterOutputPath,
			'Mock WordPress Importer migration file'
		);

		// WP Root
		php.writeFile(`${wpPath}/test-wp-root.php`, 'Mock WP root file');

		// WP Admin
		php.mkdirTree(wpAdminPath);
		php.writeFile(`${wpAdminPath}/test-admin.php`, 'Mock WP admin file');

		// WP Content
		php.mkdirTree(wpContentPath);
		php.writeFile(
			`${wpContentPath}/test-content.php`,
			'Mock WP content file'
		);
		php.mkdirTree(wpSqlDbPath);
		php.writeFile(`${wpSqlDbPath}/test-database.php`, 'Mock SQL content');

		// WP Includes
		php.mkdirTree(wpIncludesPath);
		php.writeFile(
			`${wpIncludesPath}/test-includes.php`,
			'Mock WP includes'
		);

		const exportWriteRequest = php.run({
			code:
				migration +
				` generateZipFile("${exportPath}", "${wpImporterOutputPath}", "${wpPath}");`,
		});

		if (exportWriteRequest.exitCode !== 0) {
			throw exportWriteRequest.errors;
		}
	});

	afterAll(() => {
		if (existsSync(testDirPath)) {
			rmSync(testDirPath, { recursive: true });
		}
	});

	it('should creata a ZIP file of specified WP Importer output file and WordPress files', () => {
		const runTest = php.run({
			code: `
				<?php
					$zip = new ZipArchive;
					$res = $zip->open('${exportPath}');
					if ($res === TRUE) {
						if(
							$zip->getFromName('${wpImporterOutputPath}') &&
							$zip->getFromName('${wpPath}/test-wp-root.php') && 
							$zip->getFromName('${wpContentPath}/test-content.php')
						) {
							echo 'success';
						} else {
							echo 'failure';
						}
					}
			`,
		});

		const runTestOutput = new TextDecoder().decode(runTest.body).trim();

		expect(runTestOutput).toEqual('success');
	});

	it('should omit wp-content/database directory', () => {
		const runTest = php.run({
			code: `
				<?php
					$zip = new ZipArchive;
					$res = $zip->open('${exportPath}');
					if ($res === TRUE) {
						if(
							!$zip->getFromName('${wpSqlDbPath}/test-database.php')
						) {
							echo 'success';
						} else {
							echo 'failure';
						}
					}
			`,
		});

		const runTestOutput = new TextDecoder().decode(runTest.body).trim();

		expect(runTestOutput).toEqual('success');
	});

	it('should omit wp-includes directory', () => {
		const runTest = php.run({
			code: `
				<?php
					$zip = new ZipArchive;
					$res = $zip->open('${exportPath}');
					if ($res === TRUE) {
						if(
							!$zip->getFromName('${wpIncludesPath}/test-includes.php')
						) {
							echo 'success';
						} else {
							echo 'failure';
						}
					}
			`,
		});

		const runTestOutput = new TextDecoder().decode(runTest.body).trim();

		expect(runTestOutput).toEqual('success');
	});
});
