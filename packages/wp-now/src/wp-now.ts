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
import { defineSiteUrl } from '@wp-playground/blueprints';

type WPNowMode = 'plugin' | 'theme' | 'core' | 'index' | 'auto';
export interface WPNowOptions {
	phpVersion?: SupportedPHPVersion;
	documentRoot?: string;
	absoluteUrl?: string;
	mode?: WPNowMode;
	projectPath?: string;
	wpContentPath?: string;
	wordPressVersion?: string;
}

const DEFAULT_OPTIONS: WPNowOptions = {
	phpVersion: DEFAULT_PHP_VERSION,
	wordPressVersion: DEFAULT_WORDPRESS_VERSION,
	documentRoot: '/var/www/html',
	mode: 'auto',
};

async function getAbsoluteURL() {
	const port = await portFinder.getOpenPort();
	return `http://127.0.0.1:${port}`;
}

function seemsLikeAPHPFile(path) {
	return path.endsWith('.php') || path.includes('.php/');
}

export default class WPNow {
	php: NodePHP;
	options: WPNowOptions = DEFAULT_OPTIONS;

	static async create(options: WPNowOptions = {}): Promise<WPNow> {
		this.#validateOptions(options);
		const instance = new WPNow();
		const absoluteUrl = await getAbsoluteURL();
		const projectPath = options.projectPath || process.cwd();
		const wpContentPath = this.#getWpContentHomePath(projectPath);
		const mode = this.#inferMode(projectPath);
		await instance.#setup({
			absoluteUrl,
			projectPath,
			wpContentPath,
			mode,
			...options,
		});
		return instance;
	}

	updateFile = (path, callback) => {
		this.php.writeFile(path, callback(this.php.readFileAsText(path)));
	};

	async #setup(options: WPNowOptions = {}) {
		this.options = {
			...this.options,
			...options,
		};
		const { phpVersion, documentRoot, absoluteUrl } = this.options;
		this.php = await NodePHP.load(phpVersion, {
			requestHandler: {
				documentRoot,
				absoluteUrl,
				isStaticFilePath: (path) => {
					try {
						const fullPath = this.options.documentRoot + path;
						return (
							this.php.fileExists(fullPath) &&
							!this.php.isDir(fullPath) &&
							!seemsLikeAPHPFile(fullPath)
						);
					} catch (e) {
						console.error(e);
						return false;
					}
				},
			},
		});
		this.php.mkdirTree(documentRoot);
		this.php.chdir(documentRoot);
		this.php.writeFile(
			`${documentRoot}/index.php`,
			`<?php echo 'Hello wp-now!';`
		);
	}

	mountWordpress() {
		const { wordPressVersion } = this.options;
		const { documentRoot } = this.options;
		const root = path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion);
		this.php.mount(
			{
				root,
			},
			documentRoot
		);
		this.php.writeFile(
			`${documentRoot}/wp-config.php`,
			this.php.readFileAsText(`${documentRoot}/wp-config-sample.php`)
		);
		defineSiteUrl(this.php, { siteUrl: this.options.absoluteUrl });
		if (this.options.wordPressVersion !== 'latest') {
			this.updateFile(
				`${documentRoot}/wp-config.php`,
				(contents) => `<?php
          if ( ! defined( 'WP_AUTO_UPDATE_CORE' ) ) {
            define( 'WP_AUTO_UPDATE_CORE', false );
          }
        ?>${contents}`
			);
		}
		this.php.mkdirTree(`${documentRoot}/wp-content/mu-plugins`);
		this.php.writeFile(
			`${documentRoot}/wp-content/mu-plugins/0-allow-wp-org.php`,
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

	async runCode(code) {
		const result = await this.php.run({
			code,
		});
		console.log(result.text);
		return result;
	}

	mountSqlite() {
		const { documentRoot } = this.options;
		const sqlitePluginPath = `${documentRoot}/wp-content/plugins/${SQLITE_FILENAME}`;
		this.php.mkdirTree(sqlitePluginPath);
		this.php.mount(SQLITE_PATH, sqlitePluginPath);
		this.php.writeFile(
			`${documentRoot}/wp-content/db.php`,
			this.php
				.readFileAsText(`${sqlitePluginPath}/db.copy`)
				.replace(
					/\{SQLITE_IMPLEMENTATION_FOLDER_PATH\}/g,
					`${documentRoot}/wp-content/plugins/${SQLITE_FILENAME}`
				)
				.replace(/\{SQLITE_PLUGIN\}/g, SQLITE_FILENAME)
		);
	}

	static #getWpContentHomePath(projectPath: string) {
		const basename = path.basename(projectPath);
		const directoryHash = crypto
			.createHash('sha1')
			.update(projectPath)
			.digest('hex');
		return path.join(
			WP_NOW_PATH,
			'wp-content',
			`${basename}-${directoryHash}`
		);
	}

	static #isPluginDirectory(projectPath: string): Boolean {
		const files = fs.readdirSync(projectPath);
		for (const file of files) {
			if (file.endsWith('.php')) {
				const fileContent = fs.readFileSync(
					path.join(projectPath, file),
					'utf8'
				);
				if (fileContent.includes('Plugin Name:')) {
					return true;
				}
			}
		}
		return false;
	}

	static #isThemeDirectory(projectPath: string): Boolean {
		const styleCSSExists = fs.existsSync(
			path.join(projectPath, 'style.css')
		);
		if (!styleCSSExists) {
			return false;
		}
		const styleCSS = fs.readFileSync(
			path.join(projectPath, 'style.css'),
			'utf-8'
		);
		return styleCSS.includes('Theme Name:');
	}

	static #inferMode(projectPath: string): Exclude<WPNowMode, 'auto'> {
		const hasIndexPhp = fs.existsSync(path.join(projectPath, 'index.php'));
		const hasWpContentFolder = fs.existsSync(
			path.join(projectPath, 'wp-content')
		);

		if (WPNow.#isPluginDirectory(projectPath)) {
			return 'plugin';
		} else if (WPNow.#isThemeDirectory(projectPath)) {
			return 'theme';
		} else if (!hasIndexPhp && hasWpContentFolder) {
			return 'core';
		}
		return 'index';
	}

	static #validateOptions(options: WPNowOptions) {
		// Check the php version
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
	}

	mount() {
		const { mode, wordPressVersion } = this.options;
		if (mode === 'index') {
			this.php.mount(this.options.projectPath, this.options.documentRoot);
			return;
		}
		// Mode: core, plugin or theme
		this.mountWordpress();
		const { wpContentPath } = this.options;
		fs.ensureDirSync(wpContentPath);
		fs.copySync(
			path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion, 'wp-content'),
			wpContentPath
		);
		this.php.mount(
			wpContentPath,
			`${this.options.documentRoot}/wp-content`
		);

		if (mode === 'plugin' || mode === 'theme') {
			const folderName = path.basename(this.options.projectPath);
			const partialPath = mode === 'plugin' ? 'plugins' : 'themes';
			fs.ensureDirSync(path.join(wpContentPath, partialPath, folderName));
			this.php.mount(
				this.options.projectPath,
				`${this.options.documentRoot}/wp-content/${partialPath}/${folderName}`
			);
		}

		this.mountSqlite();
	}

	async registerUser() {
		return this.php.request({
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

	async autoLogin() {
		await this.php.request({
			url: '/wp-login.php',
		});

		await this.php.request({
			url: '/wp-login.php',
			method: 'POST',
			formData: {
				log: 'admin',
				pwd: 'password',
				rememberme: 'forever',
			},
		});
	}

	async start() {
		console.log(`Project directory: ${this.options.projectPath}`);
		console.log(`mode: ${this.options.mode}`);
		console.log(`php: ${this.options.phpVersion}`);
		console.log(`wp: ${this.options.wordPressVersion}`);
		if (this.options.mode === 'index') {
			this.mount();
			return;
		}
		await downloadWordPress(this.options.wordPressVersion);
		await downloadSqliteIntegrationPlugin();
		this.mount();
		await this.registerUser();
		await this.autoLogin();
	}
}
