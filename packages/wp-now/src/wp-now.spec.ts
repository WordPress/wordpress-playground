import { inferMode, parseOptions, WPNowMode, WPNowOptions } from './wp-now';
import fs from 'fs-extra';
import path from 'path';
import {
	isPluginDirectory,
	isThemeDirectory,
	isWpContentDirectory,
	isWpDirectory,
} from './wp-playground-wordpress';
import jest from 'jest-mock';
import { Dirent } from 'fs';

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
	expect(isWpDirectory(projectPath)).toBe(false);
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
