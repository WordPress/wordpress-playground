import startWPNow, { inferMode, parseOptions, WPNowMode, WPNowOptions } from '../wp-now';
import fs from 'fs-extra';
import path from 'path';
import {
	isPluginDirectory,
	isThemeDirectory,
	isWpContentDirectory,
	isWordPressDirectory,
	isWordPressDevelopDirectory,
} from '../wp-playground-wordpress';
import os from "os";
import crypto from "crypto";

const exampleDir = __dirname + '/mode-examples';

// Options
test('parseOptions with default options', async () => {
	const rawOptions: Partial<WPNowOptions> = {
		projectPath: exampleDir,
	};
	const options = await parseOptions(rawOptions);

	expect(options.phpVersion).toBe('8.0');
	expect(options.wordPressVersion).toBe('latest');
	expect(options.documentRoot).toBe('/var/www/html');
	expect(options.mode).toBe(WPNowMode.INDEX);
	expect(options.projectPath).toBe(exampleDir);
});

test('parseOptions with custom options', async () => {
	const rawOptions: Partial<WPNowOptions> = {
		phpVersion: '7.3',
		wordPressVersion: '5.7',
		documentRoot: '/var/www/my-site',
		mode: WPNowMode.WORDPRESS,
		projectPath: '/path/to/my-site',
		wpContentPath: '/path/to/my-site/wp-content',
		absoluteUrl: 'http://localhost:8080',
	};
	const options = await parseOptions(rawOptions);
	expect(options.phpVersion).toBe('7.3');
	expect(options.wordPressVersion).toBe('5.7');
	expect(options.documentRoot).toBe('/var/www/my-site');
	expect(options.mode).toBe(WPNowMode.WORDPRESS);
	expect(options.projectPath).toBe('/path/to/my-site');
	expect(options.wpContentPath).toBe('/path/to/my-site/wp-content');
	expect(options.absoluteUrl).toBe('http://localhost:8080');
});

test('parseOptions with unsupported PHP version', async () => {
	const rawOptions: Partial<WPNowOptions> = {
		phpVersion: '5.4' as any,
	};
	await expect(parseOptions(rawOptions)).rejects.toThrowError(
		'Unsupported PHP version: 5.4.'
	);
});

// Plugin mode
test('isPluginDirectory detects a WordPress plugin and infer PLUGIN mode.', () => {
	const projectPath = exampleDir + '/plugin';
	expect(isPluginDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.PLUGIN);
});

test('isPluginDirectory returns false for non-plugin directory', () => {
	const projectPath = exampleDir + '/not-plugin';
	expect(isPluginDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// Theme mode
test('isThemeDirectory detects a WordPress theme and infer THEME mode', () => {
	const projectPath = exampleDir + '/theme';
	expect(isThemeDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.THEME);
});

test('isThemeDirectory returns false for non-theme directory', () => {
	const projectPath = exampleDir + '/not-theme';
	expect(isThemeDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test('isThemeDirectory returns false for a directory with style.css but without Theme Name', () => {
	const projectPath = exampleDir + '/not-theme';

	expect(isThemeDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// WP_CONTENT mode
test('isWpContentDirectory detects a WordPress wp-content directory and infer WP_CONTENT mode', () => {
	const projectPath = exampleDir + '/wp-content';
	expect(isWpContentDirectory(projectPath)).toBe(true);
	expect(isWordPressDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.WP_CONTENT);
});

test('isWpContentDirectory returns false for wp-content parent directory', () => {
	const projectPath = exampleDir + '/index';
	expect(isWpContentDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test.skip('isWpContentDirectory returns false for a directory with only one directory of plugins or themes', () => {
	const projectPath = exampleDir + '/not-wp-content';
	expect(isWpContentDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// WordPress mode
test('isWordPressDirectory detects a WordPress directory and WORDPRESS mode', () => {
	const projectPath = exampleDir + '/wordpress';

	expect(isWordPressDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.WORDPRESS);
});

test('isWordPressDirectory returns false for non-WordPress directory', () => {
	const projectPath = exampleDir + '/nothing';

	expect(isWordPressDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// WordPress developer mode
test('isWordPressDevelopDirectory detects a WordPress-develop directory and WORDPRESS_DEVELOP mode', () => {
	const projectPath = exampleDir + '/wordpress-develop';

	expect(isWordPressDevelopDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.WORDPRESS_DEVELOP);
});

test('isWordPressDevelopDirectory returns false for non-WordPress-develop directory', () => {
	const projectPath = exampleDir + '/nothing';

	expect(isWordPressDevelopDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test('isWordPressDevelopDirectory returns false for incomplete WordPress-develop directory', () => {
	const projectPath = exampleDir + '/not-wordpress-develop';

	expect(isWordPressDevelopDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

describe('Test starting different modes', () => {
	let tmpExampleDirectory;

	/**
	 * Copy example directory to a temporary directory
	 */
	beforeEach(() => {
		const tmpDirectory = os.tmpdir();
		const directoryHash = crypto.randomBytes(20).toString('hex');

		tmpExampleDirectory = path.join(tmpDirectory, directoryHash);
		fs.ensureDirSync(tmpExampleDirectory);
		fs.copySync(exampleDir, tmpExampleDirectory);

		console.log(tmpExampleDirectory);
	});

	/**
	 * Remove temporary directory
	 */
	afterEach(() => {
		fs.rmSync(tmpExampleDirectory, { recursive: true, force: true });
	});

	/**
	 * Expect that all provided mount point paths are empty directories which are result of file system mounts.
	 *
	 * @param mountPaths List of mount point paths that should exist on file system.
	 * @param projectPath Project path.
	 */
	const expectEmptyMountPoints = (mountPaths, projectPath) => {
		mountPaths.map((relativePath) => {
			const fullPath = path.join(projectPath, relativePath);

			expect(fs.existsSync(fullPath)).toBe(true);
			expect(fs.readdirSync(fullPath)).toEqual([]);
			expect(fs.lstatSync(fullPath).isDirectory()).toBe(true);
		});
	};

	/**
	 * Expect that all required files exist for PHP.
	 *
	 * @param requiredFiles List of files that should be accessible by PHP.
	 * @param documentRoot Document root of the PHP server.
	 * @param php NodePHP instance.
	 */
	const expectRequiredFiles = (requiredFiles, documentRoot, php) => {
		requiredFiles.map((relativePath) => {
			const fullPath = path.join(documentRoot, relativePath);
			expect(php.fileExists(fullPath)).toBe(true);
		});
	};

	/**
	 * Test that startWPNow in "index" mode doesn't change anything in the project directory.
	 */
	test('startWPNow starts index mode', async () => {
		const projectPath = exampleDir + '/index';
		const initialProjectContent = fs.readdirSync(projectPath);

		const rawOptions: Partial<WPNowOptions> = {
			projectPath: projectPath,
		};

		await startWPNow(rawOptions);

		const finalProjectContent = fs.readdirSync(projectPath);
		expect(initialProjectContent).toEqual(finalProjectContent);
	});

	/**
	 * Test that startWPNow in "wordpress" mode mounts required files and directories, and
	 * that required files exist for PHP.
	 */
	test('startWPNow starts wp-content mode', async () => {
		const projectPath = path.join(tmpExampleDirectory, 'wp-content');

		const rawOptions: Partial<WPNowOptions> = {
			projectPath: projectPath,
		};

		const {php, options: wpNowOptions} = await startWPNow(rawOptions);

		const mountPointPaths = [
			'database',
			'db.php',
			'mu-plugins',
			'plugins/sqlite-database-integration'
		];

		expectEmptyMountPoints(mountPointPaths, projectPath);

		const requiredFiles = [
			'wp-content/db.php'
		];

		expectRequiredFiles(requiredFiles, wpNowOptions.documentRoot, php);
	});
});
