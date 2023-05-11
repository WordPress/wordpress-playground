import { inferMode, parseOptions, WPNowMode, WPNowOptions } from './wp-now';
import fs from 'fs-extra';
import path from 'path';
import { isPluginDirectory } from './wp-playground-wordpress';
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
test('isPluginDirectory detects a WordPress plugin and infer plugin mode.', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'plugin');
	jest.spyOn(fs, 'readdirSync').mockReturnValue(['foo.php']);
	jest.spyOn(fs, 'readFileSync').mockReturnValue(
		'/\nPlugin Name: Test Plugin\n/'
	);
	expect(isPluginDirectory(projectPath)).toBe(true);
	expect(inferMode(projectPath)).toBe(WPNowMode.PLUGIN);
});

test('isPluginDirectory returns false for non-plugin directory', () => {
	const projectPath = path.join(__dirname, 'test-fixtures', 'non-plugin');
	jest.spyOn(fs, 'readdirSync').mockReturnValue(['foo.php']);
	jest.spyOn(fs, 'readFileSync').mockReturnValue('/\nNo Plugin Name Here\n/');
	expect(isPluginDirectory(projectPath)).toBe(false);
	expect(inferMode(projectPath)).toBe(WPNowMode.INDEX);
});
