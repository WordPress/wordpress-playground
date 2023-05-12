import { inferMode, parseOptions, WPNowMode, WPNowOptions } from '../wp-now';
import fs from 'fs-extra';
import path from 'path';
import {
	isPluginDirectory,
	isThemeDirectory,
	isWpContentDirectory,
	isWordPressDirectory,
	isWordPressDevelopDirectory,
} from '../wp-playground-wordpress';
import jest from 'jest-mock';

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
