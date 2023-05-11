import { inferMode, parseOptions, WPNowMode, WPNowOptions } from './wp-now';
import fs from 'fs-extra';
import path from 'path';
import {
	isPluginDirectory,
	isThemeDirectory,
	isWpContentDirectory,
	isWordPressDirectory,
	isWordPressDevelopDirectory,
} from './wp-playground-wordpress';
import jest from 'jest-mock';

// Options
test('parseOptions with default options', async () => {
	const options = await parseOptions();
	expect(options.phpVersion).toBe('8.0');
	expect(options.wordPressVersion).toBe('latest');
	expect(options.documentRoot).toBe('/var/www/html');
	expect(options.mode).toBe(WPNowMode.INDEX);
	expect(options.projectPath).toBe(process.cwd());
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
	const projectPath = __dirname;
	jest.spyOn(fs, 'readdirSync').mockReturnValue(['foo.php']);
	jest.spyOn(fs, 'readFileSync').mockReturnValue(
		'/\nPlugin Name: Test Plugin\n/'
	);
	expect(isPluginDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.PLUGIN);
});

test('isPluginDirectory returns false for non-plugin directory', () => {
	const projectPath = __dirname;
	jest.spyOn(fs, 'readdirSync').mockReturnValue(['foo.php']);
	jest.spyOn(fs, 'readFileSync').mockReturnValue('/\nNo Plugin Name Here\n/');
	expect(isPluginDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// Theme mode
test('isThemeDirectory detects a WordPress theme and infer THEME mode', () => {
	const projectPath = __dirname;

	jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
		return file === path.join(projectPath, 'style.css');
	});
	jest.spyOn(fs, 'readFileSync').mockReturnValue(
		'/*\nTheme Name: Foo Theme\n*/'
	);
	expect(isThemeDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.THEME);
});

test('isThemeDirectory returns false for non-theme directory', () => {
	const projectPath = __dirname;
	jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
		return file === path.join(projectPath, 'foo.css');
	});
	expect(isThemeDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test('isThemeDirectory returns false for a directory with style.css but without Theme Name', () => {
	const projectPath = __dirname;
	jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
		return file === path.join(projectPath, 'style.css');
	});
	jest.spyOn(fs, 'readFileSync').mockReturnValue(
		'/*\nNo Theme Name Here\n*/'
	);

	expect(isThemeDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// WP_CONTENT mode
test('isWpContentDirectory detects a WordPress wp-content directory and infer WP_CONTENT mode', () => {
	const projectPath = __dirname;
	jest.spyOn(fs, 'existsSync').mockImplementation((folder) => {
		return (
			folder === path.join(projectPath, 'plugins') ||
			folder === path.join(projectPath, 'themes')
		);
	});
	expect(isWpContentDirectory(projectPath)).toBe(true);
	expect(isWordPressDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.WP_CONTENT);
});

test('isWpContentDirectory returns false for wp-content parent directory', () => {
	const projectPath = __dirname;
	jest.spyOn(fs, 'existsSync').mockImplementation((folder) => {
		return folder === path.join(projectPath, 'wp-content');
	});
	expect(isWpContentDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test('isWpContentDirectory returns false for a directory with only one directory of plugins or themes', () => {
	const projectPath = __dirname;
	jest.spyOn(fs, 'existsSync').mockImplementation((folder) => {
		return folder === path.join(projectPath, 'plugins');
	});
	expect(isWpContentDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);

	jest.spyOn(fs, 'existsSync').mockImplementation((folder) => {
		return folder === path.join(projectPath, 'themes');
	});
	expect(isWpContentDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// WordPress mode
test('isWordPressDirectory detects a WordPress directory and WORDPRESS mode', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'wp');
	jest.spyOn(fs, 'existsSync').mockImplementation((fileOrFolder) => {
		const existingFiles = [
			path.join(projectPath, 'wp-content'),
			path.join(projectPath, 'wp-includes'),
			path.join(projectPath, 'wp-load.php'),
		];
		return existingFiles.includes(fileOrFolder as string);
	});

	expect(isWordPressDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.WORDPRESS);
});

test('isWordPressDirectory returns false in a WordPress directory with a wp-config.php', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'wp');
	jest.spyOn(fs, 'existsSync').mockImplementation((fileOrFolder) => {
		const existingFiles = [
			path.join(projectPath, 'wp-content'),
			path.join(projectPath, 'wp-includes'),
			path.join(projectPath, 'wp-load.php'),
			path.join(projectPath, 'wp-config.php'),
		];
		return existingFiles.includes(fileOrFolder as string);
	});

	expect(isWordPressDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test('isWordPressDirectory returns false for non-WordPress directory', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'non-wp');
	jest.spyOn(fs, 'existsSync').mockReturnValue(false);

	expect(isWordPressDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

// WordPress developer mode
test('isWordPressDevelopDirectory detects a WordPress-develop directory and WORDPRESS_DEVELOP mode', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'wp-develop');
	jest.spyOn(fs, 'existsSync').mockImplementation((fileOrFolder) => {
		const existingFiles = [
			'src',
			'src/wp-content',
			'src/wp-includes',
			'src/wp-load.php',
			'build',
			'build/wp-content',
			'build/wp-includes',
			'build/wp-load.php',
		].map((file) => path.join(projectPath, file));
		return existingFiles.includes(fileOrFolder as string);
	});

	expect(isWordPressDevelopDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.WORDPRESS_DEVELOP);
});

test('isWordPressDevelopDirectory returns false for non-WordPress-develop directory', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'non-wp-develop');
	jest.spyOn(fs, 'existsSync').mockReturnValue(false);

	expect(isWordPressDevelopDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});

test('isWordPressDevelopDirectory returns false for incomplete WordPress-develop directory', () => {
	const projectPath = path.join(
		__dirname,
		'test-fixtures',
		'incomplete-wp-develop'
	);
	jest.spyOn(fs, 'existsSync').mockImplementation((fileOrFolder) => {
		const requiredFiles = [
			'src',
			'src/wp-content',
			'src/wp-includes',
			'src/wp-load.php',
			'build',
			'build/wp-content',
			'build/wp-includes',
			// 'build/wp-load.php', // Simulates missing file
		].map((file) => path.join(projectPath, file));
		return requiredFiles.includes(fileOrFolder as string);
	});

	expect(isWordPressDevelopDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});
