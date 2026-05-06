/**
 * Materialize a self-contained WordPress document root for
 * `--experimental-posix-kernel`. TypeScript port of
 * `wasm-posix-kernel/examples/wordpress/setup.sh` that reuses the
 * helpers Playground already ships (release resolver, cached download,
 * SQLite integration fetch, zip stream decoder).
 */
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { decodeZip } from '@php-wasm/stream-compression';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import {
	mkdirSync,
	writeFileSync,
	existsSync,
	copyFileSync,
	readFileSync,
} from 'node:fs';
import { dirname, joinPaths } from '@php-wasm/util';
import {
	cachedDownload,
	fetchSqliteIntegration,
} from '../blueprints-v1/download';
import type { KernelLimitedPHPApi } from './php-api';

const dir = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;

const DISABLE_WP_MAIL_MU_PLUGIN_PHP = readFileSync(
	joinPaths(dir, 'wp-templates/disable-wp-mail.php'),
	'utf8'
);
const AUTO_LOGIN_MU_PLUGIN_PHP = readFileSync(
	joinPaths(dir, 'wp-templates/auto-login.php'),
	'utf8'
);
const WP_CONFIG_PHP = readFileSync(
	joinPaths(dir, 'wp-templates/wp-config.php'),
	'utf8'
);

export interface PrepareWordPressOptions {
	wordPressRoot: string;
	wpVersionQuery?: string;
	onStatus?: (message: string) => void;
}

export interface PrepareWordPressResult {
	wordPressRoot: string;
	wpVersion: string;
	skipped: boolean;
}

export async function prepareWordPressForPosixKernel(
	options: PrepareWordPressOptions
): Promise<PrepareWordPressResult> {
	const { wordPressRoot, wpVersionQuery = 'latest', onStatus } = options;

	mkdirSync(wordPressRoot, { recursive: true });

	let skipped = false;
	let wpVersion: string;

	if (existsSync(joinPaths(wordPressRoot, 'wp-settings.php'))) {
		// Don't ping the API again — the cached install is whatever
		// version it was. Only resolve when we actually need the URL.
		wpVersion = 'cached';
		skipped = true;
	} else {
		const release = await resolveWordPressRelease(wpVersionQuery);
		wpVersion = release.version;

		onStatus?.(`Downloading WordPress ${release.version}`);
		const monitor = new EmscriptenDownloadMonitor();
		const wpZip = await cachedDownload(
			release.releaseUrl,
			`${release.version}.zip`,
			monitor
		);
		const wpZipBytes = new Uint8Array(await wpZip.arrayBuffer());

		onStatus?.('Extracting WordPress');
		await extractZipToDir(wpZipBytes, wordPressRoot, {
			stripLeadingDir: 'wordpress',
		});
	}

	await ensureSqliteIntegrationPlugin(wordPressRoot, onStatus);
	ensureDbDropIn(wordPressRoot);
	ensureWpConfig(wordPressRoot);
	ensureDatabaseDir(wordPressRoot);
	ensureAutoLoginMuPlugin(wordPressRoot);
	ensureDisableWpMailMuPlugin(wordPressRoot);

	return { wordPressRoot, wpVersion, skipped };
}

/**
 * Drive WP's installer over HTTP the first time the kernel boots a
 * fresh install. Idempotent: if the root probe is already a 200, no-op.
 *
 * Why HTTP rather than a programmatic `wp_install()`: a standalone
 * php.wasm CLI bootstrapping WordPress hangs the moment wp-load.php
 * starts loading the SQLite drop-in (the drop-in's connection setup
 * relies on per-request state nginx + php-fpm establish). Posting to
 * `/wp-admin/install.php` reuses the working FPM pipeline.
 */
export async function ensureWordPressInstalled(
	api: KernelLimitedPHPApi
): Promise<void> {
	const probe = await api.request({
		method: 'GET',
		url: '/',
	});
	const probeLocation = probe.headers['location']?.[0] ?? '';
	const installRequired =
		probe.httpStatusCode === 302 && probeLocation.includes('install.php');
	if (!installRequired) {
		return;
	}

	const formBody = new URLSearchParams({
		weblog_title: 'My WordPress Website',
		user_name: 'admin',
		admin_password: 'password',
		admin_password2: 'password',
		// Mark `password` user-acknowledged-weak — without `pw_weak`
		// install.php rejects it and re-renders the form.
		pw_weak: '1',
		admin_email: 'admin@example.com',
		blog_public: '1',
		Submit: 'Install WordPress',
	}).toString();
	const installResponse = await api.request({
		method: 'POST',
		url: '/wp-admin/install.php?step=2',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: formBody,
	});
	if (installResponse.httpStatusCode !== 200) {
		throw new Error(
			`WordPress install request failed: HTTP ` +
				`${installResponse.httpStatusCode}`
		);
	}
	const html = new TextDecoder().decode(installResponse.bytes);
	if (
		!html.includes('Success') &&
		!html.includes('WordPress has been installed')
	) {
		throw new Error(
			`WordPress installer did not report success: ` +
				`${html.slice(0, 1000)}`
		);
	}
}

/**
 * Auto-login mu-plugin. Reads `PLAYGROUND_AUTO_LOGIN_AS_USER` (set by
 * the `login` blueprint step via `defineConstant()`) and signs the user
 * in on first request. Adapted from the `1-auto-login.php` mu-plugin
 * generated in `@wp-playground/wordpress`'s boot helpers, trimmed
 * because we don't have `/internal/shared/mu-plugins` here.
 */
function ensureAutoLoginMuPlugin(wordPressRoot: string): void {
	const path = joinPaths(
		wordPressRoot,
		'wp-content/mu-plugins/1-playground-auto-login.php'
	);
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		return;
	}
	writeFileSync(path, AUTO_LOGIN_MU_PLUGIN_PHP);
}

/**
 * No-op `wp_mail()` mu-plugin. WP's `wp_new_blog_notification()` (run
 * from `wp_install()`) calls `wp_mail()` → PHPMailer →
 * `popen("sendmail …")`, and our wasm-posix-kernel's fork+exec lands
 * on a missing target and `exit_group(127)`s, killing the FPM worker
 * mid-install. Mu-plugins load before `wp-includes/pluggable.php`, so
 * declaring `wp_mail` here makes pluggable.php's `function_exists`
 * guard skip its own definition and the popen path is never reached.
 */
function ensureDisableWpMailMuPlugin(wordPressRoot: string): void {
	const path = joinPaths(
		wordPressRoot,
		'wp-content/mu-plugins/0-disable-wp-mail.php'
	);
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		return;
	}
	writeFileSync(path, DISABLE_WP_MAIL_MU_PLUGIN_PHP);
}

async function ensureSqliteIntegrationPlugin(
	wordPressRoot: string,
	onStatus?: (message: string) => void
): Promise<void> {
	const sqlitePluginDir = joinPaths(
		wordPressRoot,
		'wp-content/plugins/sqlite-database-integration'
	);
	if (existsSync(joinPaths(sqlitePluginDir, 'load.php'))) {
		return;
	}
	onStatus?.('Installing SQLite Database Integration');
	mkdirSync(sqlitePluginDir, { recursive: true });
	const sqliteZip = await fetchSqliteIntegration('v2.1.16');
	const sqliteZipBytes = new Uint8Array(await sqliteZip.arrayBuffer());
	await extractZipToDir(sqliteZipBytes, sqlitePluginDir, {
		stripLeadingDir: 'sqlite-database-integration',
	});
}

function ensureDbDropIn(wordPressRoot: string): void {
	const wpContent = joinPaths(wordPressRoot, 'wp-content');
	const dbDropIn = joinPaths(wpContent, 'db.php');
	const source = joinPaths(
		wpContent,
		'plugins/sqlite-database-integration/db.copy'
	);
	mkdirSync(wpContent, { recursive: true });
	if (!existsSync(dbDropIn) && existsSync(source)) {
		copyFileSync(source, dbDropIn);
	}
}

function ensureWpConfig(wordPressRoot: string): void {
	const wpConfigPath = joinPaths(wordPressRoot, 'wp-config.php');
	if (existsSync(wpConfigPath)) {
		return;
	}
	writeFileSync(wpConfigPath, WP_CONFIG_PHP);
}

function ensureDatabaseDir(wordPressRoot: string): void {
	mkdirSync(joinPaths(wordPressRoot, 'wp-content/database'), {
		recursive: true,
	});
}

interface ExtractZipOptions {
	/**
	 * If set, only entries whose path starts with `<stripLeadingDir>/`
	 * (or `<stripLeadingDir>-<suffix>/` for versioned plugin zips) are
	 * kept, with that prefix removed from every output path.
	 */
	stripLeadingDir?: string;
}

async function extractZipToDir(
	zipBytes: Uint8Array,
	destDir: string,
	options: ExtractZipOptions = {}
): Promise<void> {
	// `decodeZip` reads via a BYOB reader — needs a byte stream
	// (`type: 'bytes'`), not a default stream.
	const stream = new ReadableStream({
		type: 'bytes',
		start(controller) {
			controller.enqueue(new Uint8Array(zipBytes));
			controller.close();
		},
	} as UnderlyingByteSource) as ReadableStream<Uint8Array>;

	const reader = decodeZip(stream).getReader();

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}
		let pathStr = value.name;
		if (options.stripLeadingDir !== undefined) {
			const stripped = stripLeadingDirPrefix(
				pathStr,
				options.stripLeadingDir
			);
			if (stripped === null) {
				continue;
			}
			pathStr = stripped;
		}
		if (pathStr === '' || pathStr === '/') {
			continue;
		}
		const targetPath = joinPaths(destDir, pathStr);
		if (value.type === 'directory') {
			mkdirSync(targetPath, { recursive: true });
			continue;
		}
		mkdirSync(dirname(targetPath), { recursive: true });
		const bytes = new Uint8Array(await value.arrayBuffer());
		writeFileSync(targetPath, bytes);
	}
}

function stripLeadingDirPrefix(path: string, dirName: string): string | null {
	const exactPrefix = `${dirName}/`;
	if (path === exactPrefix) {
		return '';
	}
	if (path.startsWith(exactPrefix)) {
		return path.slice(exactPrefix.length);
	}
	const versionedPrefix = `${dirName}-`;
	if (path.startsWith(versionedPrefix)) {
		const slash = path.indexOf('/');
		if (slash > -1) {
			return path.slice(slash + 1);
		}
	}
	return null;
}
