import fs from 'fs-extra';
import crypto from 'crypto';
import { NodePHP } from '@php-wasm/node';
import {
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import path from 'path';
import {
	DEFAULT_PHP_VERSION,
	DEFAULT_WORDPRESS_VERSION,
	SQLITE_FILENAME,
	SQLITE_PATH,
	WORDPRESS_VERSIONS_PATH,
	WP_NOW_PATH,
} from './constants';
import {
	downloadMuPlugins,
	downloadSqliteIntegrationPlugin,
	downloadWordPress,
} from './download';
import { portFinder } from './port-finder';
import {
	activatePlugin,
	activateTheme,
	defineVirtualWpConfigConsts,
	login,
} from '@wp-playground/blueprints';
import {
	isPluginDirectory,
	isThemeDirectory,
	isWpContentDirectory,
	isWordPressDirectory,
	isWordPressDevelopDirectory,
	getPluginFile,
} from './wp-playground-wordpress';
import { output } from './output';

export const enum WPNowMode {
	PLUGIN = 'plugin',
	THEME = 'theme',
	WORDPRESS = 'wordpress',
	WORDPRESS_DEVELOP = 'wordpress-develop',
	INDEX = 'index',
	WP_CONTENT = 'wp-content',
	AUTO = 'auto',
}

export interface WPNowOptions {
	phpVersion?: SupportedPHPVersion;
	documentRoot?: string;
	absoluteUrl?: string;
	mode?: WPNowMode;
	projectPath?: string;
	wpContentPath?: string;
	wordPressVersion?: string;
}

async function getAbsoluteURL() {
	const port = await portFinder.getOpenPort();
	return `http://127.0.0.1:${port}`;
}

function seemsLikeAPHPFile(path) {
	return path.endsWith('.php') || path.includes('.php/');
}

export async function parseOptions(
	rawOptions: Partial<WPNowOptions> = {}
): Promise<WPNowOptions> {
	const options: WPNowOptions = {
		phpVersion: DEFAULT_PHP_VERSION,
		wordPressVersion: DEFAULT_WORDPRESS_VERSION,
		documentRoot: '/var/www/html',
		mode: WPNowMode.AUTO,
		projectPath: process.cwd(),
		...rawOptions,
	};
	if (!options.wpContentPath) {
		options.wpContentPath = getWpContentHomePath(options.projectPath);
	}
	if (!options.mode || options.mode === 'auto') {
		options.mode = inferMode(options.projectPath);
	}
	if (!options.absoluteUrl) {
		options.absoluteUrl = await getAbsoluteURL();
	}
	if (
		options.phpVersion &&
		!SupportedPHPVersionsList.includes(options.phpVersion)
	) {
		throw new Error(
			`Unsupported PHP version: ${
				options.phpVersion
			}. Supported versions: ${SupportedPHPVersionsList.join(', ')}`
		);
	}
	return options;
}

export default async function startWPNow(
	rawOptions: Partial<WPNowOptions> = {}
): Promise<{ php: NodePHP; options: WPNowOptions }> {
	const options = await parseOptions(rawOptions);

	const { documentRoot } = options;
	const php = await NodePHP.load(options.phpVersion, {
		requestHandler: {
			documentRoot,
			absoluteUrl: options.absoluteUrl,
			isStaticFilePath: (path) => {
				try {
					const fullPath = options.documentRoot + path;
					return (
						php.fileExists(fullPath) &&
						!php.isDir(fullPath) &&
						!seemsLikeAPHPFile(fullPath)
					);
				} catch (e) {
					output?.error(e);
					return false;
				}
			},
		},
	});
	php.mkdirTree(documentRoot);
	php.chdir(documentRoot);
	php.writeFile(`${documentRoot}/index.php`, `<?php echo 'Hello wp-now!';`);

	output?.log(`directory: ${options.projectPath}`);
	output?.log(`mode: ${options.mode}`);
	output?.log(`php: ${options.phpVersion}`);
	output?.log(`wp: ${options.wordPressVersion}`);
	if (options.mode === WPNowMode.INDEX) {
		await runIndexMode(php, options);
		return { php, options };
	}
	await downloadWordPress(options.wordPressVersion);
	await downloadSqliteIntegrationPlugin();
	await downloadMuPlugins();
	const isFirstTimeProject = !fs.existsSync(options.wpContentPath);
	switch (options.mode) {
		case WPNowMode.WP_CONTENT:
			await runWpContentMode(php, options);
			break;
		case WPNowMode.WORDPRESS_DEVELOP:
			await runWordPressDevelopMode(php, options);
			break;
		case WPNowMode.WORDPRESS:
			await runWordPressMode(php, options);
			break;
		case WPNowMode.PLUGIN:
			await runPluginOrThemeMode(php, options);
			break;
		case WPNowMode.THEME:
			await runPluginOrThemeMode(php, options);
			break;
	}
	await installationStep2(php);
	await login(php, {
		username: 'admin',
		password: 'password',
	});

	if (
		isFirstTimeProject &&
		[WPNowMode.PLUGIN, WPNowMode.THEME].includes(options.mode)
	) {
		await activatePluginOrTheme(php, options);
	}

	return {
		php,
		options,
	};
}

function getWpContentHomePath(projectPath: string) {
	const basename = path.basename(projectPath);
	const directoryHash = crypto
		.createHash('sha1')
		.update(projectPath)
		.digest('hex');
	return path.join(WP_NOW_PATH, 'wp-content', `${basename}-${directoryHash}`);
}

async function runIndexMode(
	php: NodePHP,
	{ documentRoot, projectPath }: WPNowOptions
) {
	php.mount(projectPath, documentRoot);
}

async function runWpContentMode(
	php: NodePHP,
	{
		documentRoot,
		wordPressVersion,
		wpContentPath,
		projectPath,
		absoluteUrl,
	}: WPNowOptions
) {
	const wordPressPath = path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion);
	php.mount(wordPressPath, documentRoot);
	await initWordPress(php, wordPressVersion, documentRoot, absoluteUrl);
	fs.ensureDirSync(wpContentPath);

	php.mount(projectPath, `${documentRoot}/wp-content`);

	mountSqlitePlugin(php, documentRoot);
	mountSqliteDatabaseDirectory(php, documentRoot, wpContentPath);
	mountMuPlugins(php, documentRoot);
}

async function runWordPressDevelopMode(
	php: NodePHP,
	{ documentRoot, projectPath, absoluteUrl }: WPNowOptions
) {
	await runWordPressMode(php, {
		documentRoot,
		projectPath: projectPath + '/build',
		absoluteUrl,
	});
}

async function runWordPressMode(
	php: NodePHP,
	{ documentRoot, wpContentPath, projectPath, absoluteUrl }: WPNowOptions
) {
	php.mount(projectPath, documentRoot);
	if (!php.fileExists(`${documentRoot}/wp-config.php`)) {
		await initWordPress(php, 'user-provided', documentRoot, absoluteUrl);
	}
	mountSqlitePlugin(php, documentRoot);
	mountSqliteDatabaseDirectory(php, documentRoot, wpContentPath);
	mountMuPlugins(php, documentRoot);
}

async function runPluginOrThemeMode(
	php: NodePHP,
	{
		wordPressVersion,
		documentRoot,
		projectPath,
		wpContentPath,
		absoluteUrl,
		mode,
	}: WPNowOptions
) {
	const wordPressPath = path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion);
	php.mount(wordPressPath, documentRoot);
	await initWordPress(php, wordPressVersion, documentRoot, absoluteUrl);

	fs.ensureDirSync(wpContentPath);
	fs.copySync(
		path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion, 'wp-content'),
		wpContentPath
	);
	php.mount(wpContentPath, `${documentRoot}/wp-content`);

	const pluginName = path.basename(projectPath);
	const directoryName = mode === WPNowMode.PLUGIN ? 'plugins' : 'themes';
	php.mount(
		projectPath,
		`${documentRoot}/wp-content/${directoryName}/${pluginName}`
	);
	mountSqlitePlugin(php, documentRoot);
	mountMuPlugins(php, documentRoot);
}

async function initWordPress(
	php: NodePHP,
	wordPressVersion: string,
	vfsDocumentRoot: string,
	siteUrl: string
) {
	php.writeFile(
		`${vfsDocumentRoot}/wp-config.php`,
		php.readFileAsText(`${vfsDocumentRoot}/wp-config-sample.php`)
	);

	const wpConfigConsts = {
		WP_HOME: siteUrl,
		WP_SITEURL: siteUrl,
	};
	if (wordPressVersion !== 'user-defined') {
		wpConfigConsts['WP_AUTO_UPDATE_CORE'] = wordPressVersion === 'latest';
	}
	const configFile = await defineVirtualWpConfigConsts(php, {
		consts: wpConfigConsts,
	});
	php.setPhpIniEntry('auto_prepend_file', configFile);
}

async function activatePluginOrTheme(
	php: NodePHP,
	{ projectPath, mode }: WPNowOptions
) {
	if (mode === WPNowMode.PLUGIN) {
		const pluginFile = getPluginFile(projectPath);
		console.log('pluginFile', pluginFile);
		if (pluginFile) {
			await activatePlugin(php, { pluginPath: pluginFile });
		}
	} else if (mode === WPNowMode.THEME) {
		const themeFolderName = path.basename(projectPath);
		await activateTheme(php, { themeFolderName });
	}
}

function mountMuPlugins(php: NodePHP, vfsDocumentRoot: string) {
	php.mount(
		path.join(WP_NOW_PATH, 'mu-plugins'),
		path.join(vfsDocumentRoot, 'wp-content', 'mu-plugins')
	);
}

function mountSqlitePlugin(php: NodePHP, vfsDocumentRoot: string) {
	const sqlitePluginPath = `${vfsDocumentRoot}/wp-content/plugins/${SQLITE_FILENAME}`;
	if (php.listFiles(sqlitePluginPath).length === 0) {
		php.mount(SQLITE_PATH, sqlitePluginPath);
		php.mount(
			path.join(SQLITE_PATH, 'db.copy'),
			`${vfsDocumentRoot}/wp-content/db.php`
		);
	}
}

/**
 * Create SQLite database directory in hidden utility directory and mount it to the document root
 *
 * @param php
 * @param vfsDocumentRoot
 * @param wpContentPath
 */
function mountSqliteDatabaseDirectory(
	php: NodePHP,
	vfsDocumentRoot: string,
	wpContentPath: string
) {
	fs.ensureDirSync(path.join(wpContentPath, 'database'));
	php.mount(
		path.join(wpContentPath, 'database'),
		path.join(vfsDocumentRoot, 'wp-content', 'database')
	);
}

export function inferMode(
	projectPath: string
): Exclude<WPNowMode, WPNowMode.AUTO> {
	if (isWordPressDevelopDirectory(projectPath)) {
		return WPNowMode.WORDPRESS_DEVELOP;
	} else if (isWordPressDirectory(projectPath)) {
		return WPNowMode.WORDPRESS;
	} else if (isWpContentDirectory(projectPath)) {
		return WPNowMode.WP_CONTENT;
	} else if (isPluginDirectory(projectPath)) {
		return WPNowMode.PLUGIN;
	} else if (isThemeDirectory(projectPath)) {
		return WPNowMode.THEME;
	}
	return WPNowMode.INDEX;
}

async function installationStep2(php: NodePHP) {
	return php.request({
		url: '/wp-admin/install.php?step=2',
		method: 'POST',
		formData: {
			language: 'en',
			prefix: 'wp_',
			weblog_title: 'My WordPress Website',
			user_name: 'admin',
			admin_password: 'password',
			admin_password2: 'password',
			Submit: 'Install WordPress',
			pw_weak: '1',
			admin_email: 'admin@localhost.com',
		},
	});
}
