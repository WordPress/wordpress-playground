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
import { downloadSqliteIntegrationPlugin, downloadWordPress } from './download';
import { portFinder } from './port-finder';
import {
	cp,
	defineSiteUrl,
	defineWpConfigConsts,
	login,
} from '@wp-playground/blueprints';
import {
	isPluginDirectory,
	isThemeDirectory,
	isWpContentDirectory,
	isWordPressDirectory,
	isWordPressDevelopDirectory,
} from './wp-playground-wordpress';

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
) {
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
					console.error(e);
					return false;
				}
			},
		},
	});
	php.mkdirTree(documentRoot);
	php.chdir(documentRoot);
	php.writeFile(`${documentRoot}/index.php`, `<?php echo 'Hello wp-now!';`);

	console.log(`Project directory: ${options.projectPath}`);
	console.log(`mode: ${options.mode}`);
	console.log(`php: ${options.phpVersion}`);
	console.log(`wp: ${options.wordPressVersion}`);
	if (options.mode === WPNowMode.INDEX) {
		await runIndexMode(php, options);
		return {php, options};
	}
	await downloadWordPress(options.wordPressVersion);
	await downloadSqliteIntegrationPlugin();
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

	mountSqlite(php, documentRoot);
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
	{ documentRoot, projectPath, absoluteUrl }: WPNowOptions
) {
	php.mount(projectPath, documentRoot);
	if (!php.fileExists(`${documentRoot}/wp-config.php`)) {
		await initWordPress(php, 'user-provided', documentRoot, absoluteUrl);
	}
	copySqlite(projectPath);
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
	mountSqlite(php, documentRoot);
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
	await defineSiteUrl(php, { siteUrl });
	if (wordPressVersion !== 'user-defined') {
		await defineWpConfigConsts(php, {
			consts: {
				WP_AUTO_UPDATE_CORE: wordPressVersion === 'latest',
			},
		});
	}
	php.mkdirTree(`${vfsDocumentRoot}/wp-content/mu-plugins`);
	php.writeFile(
		`${vfsDocumentRoot}/wp-content/mu-plugins/0-allow-wp-org.php`,
		`<?php
	// Needed because gethostbyname( 'wordpress.org' ) returns
	// a private network IP address for some reason.
	add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
		return array(
			'wordpress.org',
			'api.wordpress.org',
			'downloads.wordpress.org',
		);
	} );`
	);
}

function mountSqlite(php: NodePHP, vfsDocumentRoot: string) {
	const sqlitePluginPath = `${vfsDocumentRoot}/wp-content/plugins/${SQLITE_FILENAME}`;
	if (!php.fileExists(sqlitePluginPath)) {
		php.mkdirTree(sqlitePluginPath);
	}
	if (php.listFiles(sqlitePluginPath).length === 0) {
		php.mount(SQLITE_PATH, sqlitePluginPath);
	}
	cp(php, {
		fromPath: `${sqlitePluginPath}/db.copy`,
		toPath: `${vfsDocumentRoot}/wp-content/db.php`,
	});
}

function copySqlite(localWordPressPath: string) {
	const targetPath = `${localWordPressPath}/wp-content/plugins/${SQLITE_FILENAME}`;
	if (!fs.existsSync(targetPath)) {
		fs.copySync(SQLITE_PATH, targetPath);
	}
	fs.copySync(
		`${SQLITE_PATH}/db.copy`,
		`${localWordPressPath}/wp-content/db.php`
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
