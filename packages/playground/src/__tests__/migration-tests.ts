import { loadPHPRuntime, getPHPLoaderModule } from '@wordpress/php-wasm/node';
import { existsSync, rmdirSync, readFileSync } from 'fs';

const { TextDecoder } = require('util');

// Code to test
const migration = readFileSync(__dirname + '/../migration.php');

// Mock files
const testDirPath = __dirname + '/__test39024';
const fileSystemPath = testDirPath + '/filesystem';
const wpImporterOutputPath = fileSystemPath + '/databaseExport.xml';
const wpImporterOutputValue = 'Mock WordPress Importer migration file';

const exportName = `wordpress-playground-export.zip`;
const exportPath = `${testDirPath}/${exportName}`;

// ------------------------
// Mock WordPress Directory
// ------------------------

// Root
const wpDir = fileSystemPath + '/wordpress';
const wpDirFilePath = wpDir + '/test-wp-root.php';
const wpDirFileValue = 'Mock WP root file';

// WP Admin
const wpAdminDir = wpDir + '/wp-admin';
const wpAdminFilePath = wpAdminDir + '/test-admin.php';
const wpAdminFileValue = 'Mock WP admin file';

// WP Content
const wpContentDir = wpDir + '/wp-content';
const wpContentFilePath = wpContentDir + '/test-content.php';
const wpContentFileValue = 'Mock WP content file';

// WP Content - SQL DB
const wpSqlDbDir = wpContentDir + '/database';
const wpSqlDbFilePath = wpSqlDbDir + '/test-database.php';
const wpSqlDbFileValue = 'Mock SQL content';

// WP Includes
const wpIncludesDir = wpDir + '/wp-includes';
const wpIncludesFilePath = wpIncludesDir + '/test-includes.php';
const wpIncludesFileValue = 'Mock WP includes';

const phpLoaderModule = getPHPLoaderModule('7.4');

function createMockStructure(phpRuntime) {
	phpRuntime.mkdirTree(testDirPath);
	phpRuntime.mkdirTree(fileSystemPath);
	phpRuntime.mkdirTree(wpDir);

	phpRuntime.writeFile(wpImporterOutputPath, wpImporterOutputValue);

	// WP Root
	phpRuntime.writeFile(wpDirFilePath, wpDirFileValue);

	// WP Admin
	phpRuntime.mkdirTree(wpAdminDir);
	phpRuntime.writeFile(wpAdminFilePath, wpAdminFileValue);

	// WP Content
	phpRuntime.mkdirTree(wpContentDir);
	phpRuntime.writeFile(wpContentFilePath, wpContentFileValue);

	// WP Content - SQL DB
	phpRuntime.mkdirTree(wpSqlDbDir);
	phpRuntime.writeFile(wpSqlDbFilePath, wpSqlDbFileValue);

	// WP Includes
	phpRuntime.mkdirTree(wpIncludesDir);
	phpRuntime.writeFile(wpIncludesFilePath, wpIncludesFileValue);

	const exportWriteRequest = phpRuntime.run({
		code:
			migration +
			` generateZipFile("${exportPath}", "${wpImporterOutputPath}", "${wpDir}");`,
	});

	if (exportWriteRequest.exitCode !== 0) {
		throw exportWriteRequest.errors;
	}
}

describe('generateZipFile()', () => {
	let php;

	beforeEach(async () => {
		php = await loadPHPRuntime(await phpLoaderModule);
		if (existsSync(testDirPath)) {
			rmdirSync(testDirPath, { recursive: true });
		}
		createMockStructure(php);
	});

	afterAll(() => {
		if (existsSync(testDirPath)) {
			rmdirSync(testDirPath, { recursive: true });
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
							$zip->getFromName('${wpDirFilePath}') && 
							$zip->getFromName('${wpContentFilePath}')
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
							!$zip->getFromName('${wpSqlDbFilePath}')
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
							!$zip->getFromName('${wpIncludesFilePath}')
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

describe('readFileFromZipArchive()', () => {
	let php;

	beforeEach(async () => {
		php = await loadPHPRuntime(await phpLoaderModule);
		if (existsSync(testDirPath)) {
			rmdirSync(testDirPath, { recursive: true });
		}
		createMockStructure(php);
	});

	afterAll(() => {
		if (existsSync(testDirPath)) {
			rmdirSync(testDirPath, { recursive: true });
		}
	});

	describe("given a path to a generateZipFile() output, it should return a specified file's contents", () => {
		it('filesystem root file', () => {
			const readFileRequest = php.run({
				code:
					migration +
					` readFileFromZipArchive('${exportPath}', '${wpImporterOutputPath}');`,
			});

			if (readFileRequest.exitCode !== 0) {
				throw readFileRequest.errors;
			}

			const readFileOutput = new TextDecoder()
				.decode(readFileRequest.body)
				.trim();

			expect(readFileOutput).toEqual(wpImporterOutputValue);
		});
		it('wp root file', () => {
			const readFileRequest = php.run({
				code:
					migration +
					` readFileFromZipArchive('${exportPath}', '${wpDirFilePath}');`,
			});

			if (readFileRequest.exitCode !== 0) {
				throw readFileRequest.errors;
			}

			const readFileOutput = new TextDecoder()
				.decode(readFileRequest.body)
				.trim();

			expect(readFileOutput).toEqual(wpDirFileValue);
		});
		it('wp admin file', () => {
			const readFileRequest = php.run({
				code:
					migration +
					` readFileFromZipArchive('${exportPath}', '${wpAdminFilePath}');`,
			});

			if (readFileRequest.exitCode !== 0) {
				throw readFileRequest.errors;
			}

			const readFileOutput = new TextDecoder()
				.decode(readFileRequest.body)
				.trim();

			expect(readFileOutput).toEqual(wpAdminFileValue);
		});
		it('wp content file', () => {
			const readFileRequest = php.run({
				code:
					migration +
					` readFileFromZipArchive('${exportPath}', '${wpContentFilePath}');`,
			});

			if (readFileRequest.exitCode !== 0) {
				throw readFileRequest.errors;
			}

			const readFileOutput = new TextDecoder()
				.decode(readFileRequest.body)
				.trim();

			expect(readFileOutput).toEqual(wpContentFileValue);
		});
	});
});

describe('importZipFile()', () => {
	let php;

	beforeAll(async () => {
		php = await loadPHPRuntime(await phpLoaderModule);
		if (existsSync(testDirPath)) {
			rmdirSync(testDirPath, { recursive: true });
		}
		createMockStructure(php);
	});

	beforeEach(() => {
		if (existsSync(fileSystemPath)) {
			rmdirSync(fileSystemPath, { recursive: true });
		}
		const writeFileRequest = php.run({
			code: migration + ` importZipFile('${exportPath}');`,
		});
		if (writeFileRequest.exitCode !== 0) {
			throw writeFileRequest.errors;
		}
	});

	afterAll(() => {
		if (existsSync(testDirPath)) {
			rmdirSync(testDirPath, { recursive: true });
		}
	});

	describe('given a path to a generateZipFile() output, it should write ZIP to filesystem', () => {
		it('filesystem root file', () => {
			expect(php.readFileAsText(wpImporterOutputPath)).toEqual(
				wpImporterOutputValue
			);
		});
		it('wp root file', () => {
			expect(php.readFileAsText(wpDirFilePath)).toEqual(wpDirFileValue);
		});
		it('wp admin file', () => {
			expect(php.readFileAsText(wpAdminFilePath)).toEqual(
				wpAdminFileValue
			);
		});
		it('wp content file', () => {
			expect(php.readFileAsText(wpContentFilePath)).toEqual(
				wpContentFileValue
			);
		});
	});
});
