/**
 * Legacy WordPress boot flow.
 *
 * Self-contained entry point for legacy PHP (5.2 WASM) running old
 * WordPress (1.0–4.9) on SQLite. Mirrors the structure of
 * {@link bootWordPress} in boot.ts but with every legacy-specific
 * step — source patches, db.php drop-in, defensive installer
 * dispatch, PDO post-install fixups — co-located here so the modern
 * boot flow stays free of `isLegacyPhp` branches.
 *
 * Nothing in this module runs for modern PHP; boot.ts only delegates
 * here when isLegacyPHPVersion(options.phpVersion) is true.
 */
import type { PHP, PHPRequestHandler } from '@php-wasm/universal';
import {
	isLegacyPHPVersion,
	setPhpIniEntries,
	withPHPIniValues,
} from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import { preloadSqliteIntegration, unzipWordPress } from '..';
import type { BootWordPressOptions } from '../boot';
import { assertDatabasePrerequisites } from '../database-prerequisites';
import {
	generateDbPhpContent,
	LEGACY_WP_ERROR_REPORTING_PHP_EXPR,
	LEGACY_WP_ERROR_REPORTING_VALUE,
	patchWordPressSourceFiles,
	runPostInstallLegacyFixups,
} from './legacy-fixes';

/**
 * Network/transport I/O functions disabled on legacy PHP (< 7) to
 * keep fsockopen/cURL calls (cron, update checks, dashboard RSS) and
 * mail() (no sendmail/SMTP transport in the WASM sandbox; same "null
 * function or function signature mismatch" WASM trap) from crashing
 * the runtime — let them fail safely instead.
 */
const LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS = [
	'fsockopen',
	'pfsockopen',
	'curl_init',
	'curl_exec',
	'curl_multi_exec',
	'mail',
] as const;

/**
 * Merges the legacy network disable list into php.ini for legacy PHP
 * (no-op on modern). Merge instead of overwrite so a caller-supplied
 * disable_functions list is preserved.
 */
export function applyLegacyPhpIniOverrides(
	php: PHP,
	options: {
		phpVersion?: string;
		phpIniEntries?: Record<string, string>;
	}
): void {
	if (!isLegacyPHPVersion(options.phpVersion)) return;
	const callerDisabled = (options.phpIniEntries?.['disable_functions'] ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s);
	const mergedDisabled = Array.from(
		new Set([...callerDisabled, ...LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS])
	).join(',');
	const iniOverrides: Record<string, string> = {
		disable_functions: mergedDisabled,
		allow_url_fopen: '0',
	};
	// PHP 5.2 warns on every date_*() call when date.timezone is
	// unset; WP hits those during boot. Default to UTC unless the
	// caller set it explicitly.
	if (!options.phpIniEntries?.['date.timezone']) {
		iniOverrides['date.timezone'] = 'UTC';
	}
	setPhpIniEntries(php, iniOverrides);
}

/**
 * Boots a legacy WordPress instance (PHP 5.2 + WP 1.0–4.9 on SQLite).
 *
 * Mirrors {@link bootWordPress}'s step ordering but runs the legacy
 * variant of each step:
 *
 *   * wp-config-sample fallback instead of ensureWpConfig()
 *   * patchWordPressSourceFiles() for WP source-level fixes
 *   * full-content db.php drop-in (not a placeholder)
 *   * defensive install.php dispatch with per-WP-version fallbacks
 *   * PDO-based post-install schema completion
 *   * no assertValidDatabaseConnection — loading wp-load.php for
 *     the check can trigger WASM traps that corrupt the runtime
 */
export async function bootLegacyWordPress(
	requestHandler: PHPRequestHandler,
	options: BootWordPressOptions
): Promise<PHPRequestHandler> {
	const php = await requestHandler.getPrimaryPhp();
	if (options.hooks?.beforeWordPressFiles) {
		await options.hooks.beforeWordPressFiles(php);
	}

	if (options.wordPressZip) {
		await unzipWordPress(php, await options.wordPressZip);
	}

	if (options.constants) {
		for (const key in options.constants) {
			php.defineConstant(key, options.constants[key]);
		}
	}

	php.defineConstant('WP_HOME', options.siteUrl);
	php.defineConstant('WP_SITEURL', options.siteUrl);

	await copyWpConfigFromSample(php, requestHandler.documentRoot);
	await patchWordPressSourceFiles(php, requestHandler.documentRoot);

	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php);
	}

	let usesSqlite = false;
	if (options.sqliteIntegrationPluginZip) {
		usesSqlite = true;
		await preloadSqliteIntegration(
			php,
			await options.sqliteIntegrationPluginZip,
			{ phpVersion: options.phpVersion }
		);
		await writeLegacyDbPhp(php, requestHandler.documentRoot);
	}

	const installationMode =
		options['wordpressInstallMode'] ?? 'download-and-install';
	const hasCustomDatabasePath = !!options.dataSqlPath;

	if (
		installationMode === 'download-and-install' ||
		installationMode === 'install-from-existing-files' ||
		// Legacy PHP: isWordPressInstalled() can trigger a WASM trap
		// (not a PHP exception) on old WordPress (< 3.0) and corrupt
		// the runtime beyond recovery. Always run the installer; it
		// is idempotent and its post-install fixups short-circuit
		// cheaply when the schema already exists.
		installationMode === 'install-from-existing-files-if-needed'
	) {
		await assertDatabasePrerequisites(requestHandler, {
			usesSqlite,
			hasCustomDatabasePath,
		});
		await installLegacyWordPress(php, requestHandler);
	}

	return requestHandler;
}

/**
 * Skips ensureWpConfig() because php.run() with the large transformer
 * code hangs on the PHP 5.2 WASM binary. The pre-built legacy
 * WordPress already ships a valid wp-config-sample.php, so a plain
 * file copy is sufficient.
 */
async function copyWpConfigFromSample(php: PHP, documentRoot: string) {
	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');
	const samplePath = joinPaths(documentRoot, 'wp-config-sample.php');
	if (!php.fileExists(wpConfigPath) && php.fileExists(samplePath)) {
		await php.writeFile(
			wpConfigPath,
			await php.readFileAsBuffer(samplePath)
		);
	}
}

/**
 * Writes the full-content wp-content/db.php drop-in for legacy
 * WordPress. WP < 3.0 loads only db.php and skips wp-db.php, so the
 * mysql_* stubs from generateDbPhpContent() must be present for the
 * SQLite driver to function.
 */
async function writeLegacyDbPhp(php: PHP, documentRoot: string): Promise<void> {
	const wpContentDir = joinPaths(documentRoot, 'wp-content');
	const dbPhpPath = joinPaths(wpContentDir, 'db.php');
	if (php.isDir(wpContentDir) && !php.fileExists(dbPhpPath)) {
		await php.writeFile(dbPhpPath, generateDbPhpContent());
	}
}

/**
 * Runs the legacy WordPress install flow.
 *
 * Wraps the installer with defensive error handling: old WP
 * installers (WP 1.x especially) routinely fail halfway through, and
 * we rely on {@link runPostInstallLegacyFixups} to finish building
 * the schema via direct PDO writes. This helper therefore *always*
 * proceeds to the fixups regardless of whether the installer threw,
 * and only logs a warning on error.
 */
async function installLegacyWordPress(
	php: PHP,
	requestHandler: PHPRequestHandler
): Promise<void> {
	try {
		await runLegacyInstaller(php);
	} catch (error) {
		logger.warn('Legacy PHP WordPress installation error:', error);
	}
	await runPostInstallLegacyFixups(php, requestHandler.absoluteUrl);
}

/**
 * Runs the legacy install.php?step=2 POST (with dispatch to a DB-
 * only fallback for WP versions where the installer crashes). Throws
 * on unambiguous install failure; {@link installLegacyWordPress}
 * catches the throw and proceeds to post-install fixups regardless.
 */
async function runLegacyInstaller(php: PHP): Promise<void> {
	// WP 1.0–3.0 installers trigger WASM traps (mail(),
	// mysql_get_server_info(), etc.) on the PHP 5.2 binary, so skip
	// the install.php HTTP request entirely.
	//   WP 1.0–1.2: post-install PDO fallback builds the full schema.
	//   WP 1.5–3.0: needs dbDelta() for the schema; the rest is left
	//     to the PDO fallback.
	const wpVersion = readOnDiskWpVersion(php, php.documentRoot);
	if (wpVersion !== null) {
		const parsed = parseFloat(wpVersion);
		if (parsed < 2.1) {
			return;
		}
		if (parsed <= 3.0) {
			await runDbDeltaOnly(php);
			return;
		}
	}

	// withPHPIniValues replaces values wholesale, so re-list every
	// function from LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS (mail() is
	// already in there — the installer otherwise calls it and crashes).
	// error_reporting is suppressed at the ini level because old WP
	// class declarations trigger E_STRICT at compile time, which PHP
	// reports against the ini value rather than the runtime
	// error_reporting() call.
	const iniOverrides: Record<string, string> = {
		disable_functions: LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS.join(','),
		allow_url_fopen: '0',
		error_reporting: String(LEGACY_WP_ERROR_REPORTING_VALUE),
	};

	const response = await withPHPIniValues(
		php,
		iniOverrides,
		async () =>
			await php.request({
				url: '/wp-admin/install.php?step=2',
				method: 'POST',
				body: {
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
			})
	);

	// isWordPressInstalled() can WASM-trap on old WP (< 3.0) and
	// corrupt the runtime, so detect success from the installer
	// response text instead.
	const installSucceeded =
		response.text?.includes('Success') ||
		response.text?.includes('successful') ||
		response.text?.includes('Finished') ||
		response.text?.includes('Already Installed') ||
		response.text?.includes('already have WordPress installed') ||
		false;
	if (!installSucceeded) {
		throw new Error(
			`Failed to install WordPress – installer responded with "${response.text?.substring(
				0,
				100
			)}"`
		);
	}

	await setLegacyPermalinkStructureViaPdo(php);
}

/**
 * Sets permalink_structure via PDO on legacy WP. update_option()
 * can't be used because on WP < 4.8.3, wpdb::prepare() passes the
 * value through vsprintf() without escaping '%' characters first
 * (the placeholder_escape mechanism was added in 4.8.3). The '%y',
 * '%m', '%d', '%p' sequences in the permalink pattern are
 * interpreted as sprintf format specifiers, mangling the stored
 * value. PDO bypasses wpdb entirely.
 */
async function setLegacyPermalinkStructureViaPdo(php: PHP): Promise<void> {
	try {
		const result = await php.run({
			code: `<?php
				$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
				$db_path = $db_dir . '.ht.sqlite';
				if (!file_exists($db_path)) { echo '0'; exit; }
				$pdo = new PDO('sqlite:' . $db_path);
				$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
				$nice_permalinks = '/%year%/%monthnum%/%day%/%postname%/';
				$stmt = $pdo->prepare(
					"UPDATE wp_options SET option_value = :val WHERE option_name = 'permalink_structure'"
				);
				$stmt->execute(array(':val' => $nice_permalinks));
				if ($stmt->rowCount() === 0) {
					$stmt = $pdo->prepare(
						"INSERT INTO wp_options (option_name, option_value, autoload) VALUES ('permalink_structure', :val, 'yes')"
					);
					$stmt->execute(array(':val' => $nice_permalinks));
				}
				$check = $pdo->query(
					"SELECT option_value FROM wp_options WHERE option_name = 'permalink_structure'"
				)->fetchColumn();
				echo $check === $nice_permalinks ? '1' : '0';
			`,
			env: { DOCUMENT_ROOT: php.documentRoot },
		});
		if (result.text !== '1') {
			logger.warn(
				'Failed to default to pretty permalinks after WP install.'
			);
		}
	} catch {
		logger.warn(
			'Failed to set pretty permalinks after WP install (non-fatal).'
		);
	}
}

/**
 * Runs dbDelta() and populate_options/populate_roles without the
 * full wp_install(). Used for WP 2.1–3.0 where install.php crashes
 * but we still need the table schemas.
 */
async function runDbDeltaOnly(php: PHP): Promise<void> {
	try {
		await php.run({
			code: `<?php
				define('WP_INSTALLING', true);
				error_reporting(${LEGACY_WP_ERROR_REPORTING_PHP_EXPR});
				ini_set('display_errors', '0');
				ob_start();
				require getenv('DOCUMENT_ROOT') . '/wp-load.php';
				ob_clean();
				if (file_exists(ABSPATH . 'wp-admin/includes/upgrade.php')) {
					require_once ABSPATH . 'wp-admin/includes/upgrade.php';
				} elseif (file_exists(ABSPATH . 'wp-admin/upgrade-functions.php')) {
					require_once ABSPATH . 'wp-admin/upgrade-functions.php';
				}
				if (function_exists('make_db_current_silent')) {
					make_db_current_silent();
				}
				// Seed essential options/roles when the loader exposes
				// them. The PDO fallback in runPostInstallLegacyFixups
				// backfills anything missing if either call dies.
				if (function_exists('populate_options')) populate_options();
				if (function_exists('populate_roles')) populate_roles();
				echo 'OK';
			`,
			env: { DOCUMENT_ROOT: php.documentRoot },
		});
	} catch (error) {
		logger.warn('runDbDeltaOnly failed (non-fatal):', error);
	}
}

function readOnDiskWpVersion(php: PHP, documentRoot: string): string | null {
	const versionPhp = joinPaths(documentRoot, 'wp-includes/version.php');
	if (!php.fileExists(versionPhp)) return null;
	const content = php.readFileAsText(versionPhp);
	const match = content.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
	return match ? match[1] : null;
}
