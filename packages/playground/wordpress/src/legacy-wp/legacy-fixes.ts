/**
 * WordPress source-file patches for legacy / mid-modern WordPress.
 *
 * Two kinds of patches live here:
 *
 *   * Full source-level rewrites that let WordPress 1.0–2.8 boot on
 *     the PHP 5.2 WASM + SQLite stack. Entry point:
 *     {@link patchWordPressSourceFiles}. Used from legacy-wp/legacy-boot.ts.
 *   * A mysqli-check backport that lets WP 5.0–6.1 boot on SQLite.
 *     Entry point: {@link backportWpPreV62MysqlCheck}. Used from the
 *     main boot.ts flow.
 *
 * In addition this file exposes a PDO-based post-install fixup
 * ({@link runPostInstallLegacyFixups}) and a legacy-db.php generator
 * ({@link generateDbPhpContent}) that legacy-wp/legacy-boot.ts composes
 * into its install flow.
 *
 * Patches are plain, idempotent string replacements — no PHP parser.
 * Each one plants a `pg_*` marker so re-runs are no-ops, and its
 * match string is narrow enough that non-matching WP versions are
 * silently skipped. {@link patchWordPressSourceFiles} also gates
 * range-specific patches on the on-disk `$wp_version`; the rest
 * rely on match specificity alone. Legacy WP releases are frozen,
 * so a needle that matches today will keep matching tomorrow.
 *
 * The balance is delicate: a patch may have been quietly covering
 * more WP versions than it advertises, so tightening a needle or
 * changing the replacement can break one you didn't know about.
 * The boot-smoke suite in `tests/test-legacy-wp-version-boot.mjs`
 * exercises every supported legacy WP version end-to-end; run it
 * before landing changes here.
 */
import type { PHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';

/**
 * Backports WP 6.2's mysqli check to WP 5.0–6.1 on SQLite: the
 * `extension_loaded('mysqli')` guard in `wp_check_php_mysql_versions()`
 * runs before `$wpdb` and before `WP_CONTENT_DIR` is defined, so
 * neither a userland stub nor a `wp-content/db.php` drop-in can
 * satisfy it — the source itself has to change.
 */
export async function backportWpPreV62MysqlCheck(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const wpVersionString = readOnDiskWpVersion(php, documentRoot);
	if (wpVersionString === null) return;
	const wpVersion = parseFloat(wpVersionString);
	if (!Number.isFinite(wpVersion) || wpVersion < 5.0 || wpVersion >= 6.2) {
		return;
	}

	const loadPhp = joinPaths(documentRoot, 'wp-includes/load.php');
	if (!php.fileExists(loadPhp)) return;
	const content = php.readFileAsText(loadPhp);
	const patched = content.replace(
		"extension_loaded( 'mysqli' )",
		"function_exists( 'mysqli_connect' )"
	);
	if (patched !== content) {
		await php.writeFile(loadPhp, patched);
	}
}

function readOnDiskWpVersion(php: PHP, documentRoot: string): string | null {
	const versionPhp = joinPaths(documentRoot, 'wp-includes/version.php');
	if (!php.fileExists(versionPhp)) return null;
	const content = php.readFileAsText(versionPhp);
	const match = content.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
	return match ? match[1] : null;
}

/**
 * PHP error_reporting mask for legacy WordPress: all errors EXCEPT
 * E_DEPRECATED (8192) and E_STRICT (2048). Old WordPress class
 * declarations (e.g. Walker_Page) trigger E_STRICT during compile;
 * masking it keeps install and bootstrap output clean.
 *
 * Keep the two representations below in sync: on PHP 5.2, E_ALL is
 * 0x7fff (before E_STRICT was folded into E_ALL in PHP 5.4), so
 * `0x7fff & ~8192 & ~2048` is the numeric equivalent of the PHP
 * expression `E_ALL & ~8192 & ~2048`.
 */
export const LEGACY_WP_ERROR_REPORTING_VALUE = 0x7fff & ~8192 & ~2048;
export const LEGACY_WP_ERROR_REPORTING_PHP_EXPR = 'E_ALL & ~8192 & ~2048';

/**
 * Patches WordPress source files for legacy version compatibility.
 *
 * Applies all necessary patches to make old WordPress versions
 * (1.0 through 2.8) work with modern PHP and the SQLite integration.
 *
 * Called from legacy-wp/legacy-boot.ts; legacy boot path only.
 */
export async function patchWordPressSourceFiles(
	php: PHP,
	documentRoot: string
) {
	await ensureVersionPhp(php, documentRoot);
	await ensureWpLoadPhp(php, documentRoot);

	// Version-agnostic patches. Each one's match pattern is narrow
	// enough to be a no-op on WP versions that don't need it.
	await patchWpSettingsPhp(php, documentRoot);
	await patchWpInstallPhp(php, documentRoot);
	await patchWpDbPhp(php, documentRoot);
	await patchWpSchemaPhp(php, documentRoot);
	await patchWpAdminRelativePaths(php, documentRoot);
	await patchWpLoginDisable1Password(php, documentRoot);
	await patchErrorReportingInWpLoad(php, documentRoot);
	await patchWpInstallMailCrash(php, documentRoot);

	// Version-gated patches. If version.php is missing or unparseable,
	// skip them all rather than guessing.
	const wpVersionString = readOnDiskWpVersion(php, documentRoot);
	if (wpVersionString === null) return;
	const wpVersion = parseFloat(wpVersionString);
	if (!Number.isFinite(wpVersion)) return;

	if (wpVersion < 1.2) {
		await patchWp10DoubleQuotedSqlLiterals(php, documentRoot);
		await patchWp10LoginPlaintextCompare(php, documentRoot);
	}
	if (wpVersion < 1.5) {
		await patchWp10AdminLogoLink(php, documentRoot);
	}
	if (1.5 <= wpVersion && wpVersion < 2.0) {
		await patchWpAdminDashboard(php, documentRoot);
	}
	if (wpVersion < 2.0) {
		await patchWp10EditPhpPostTitleLinks(php, documentRoot);
		await patchWpFunctionsPhp(php, documentRoot);
	}
	if (2.1 <= wpVersion && wpVersion < 2.3) {
		await patchWp21PluginsPhpInArray(php, documentRoot);
	}
	if (wpVersion < 2.5) {
		await patchCheckAdminReferer(php, documentRoot);
	}
	if (wpVersion < 2.8) {
		await patchAdminAuthRedirect(php, documentRoot);
		await patchAdminAjaxAuth(php, documentRoot);
	}
	if (2.9 <= wpVersion && wpVersion < 3.6) {
		await patchAdminNetworkCalls(php, documentRoot);
	}
	if (3.3 <= wpVersion && wpVersion < 3.4) {
		await patchWp33ScreenPhpSelfThis(php, documentRoot);
	}
	if (wpVersion >= 4.7) {
		await patchWp47ThemeSearchForms(php, documentRoot);
	}
}

/**
 * Removes theme `searchform.php` templates on WP 4.7+ so
 * `get_search_form()` falls back to its inline HTML builder. Including
 * a theme template via ob_start/require triggers an `unreachable` WASM
 * trap on the PHP 5.2 binary that the runtime cannot recover from.
 */
async function patchWp47ThemeSearchForms(php: PHP, documentRoot: string) {
	const themesDir = joinPaths(documentRoot, 'wp-content/themes');
	if (!php.isDir(themesDir)) return;

	for (const theme of php.listFiles(themesDir)) {
		const searchformPath = joinPaths(themesDir, theme, 'searchform.php');
		if (php.fileExists(searchformPath)) {
			php.unlink(searchformPath);
		}
	}
}

/**
 * Short-circuits dashboard RSS widgets, admin_init update hooks, and
 * SimplePie's HTTP fetcher on WP 2.9–3.5. fsockopen/cURL are already
 * disabled, but the surrounding HTTP machinery still touches stream
 * APIs that the PHP 5.2 WASM binary cannot tolerate.
 */
async function patchAdminNetworkCalls(php: PHP, documentRoot: string) {
	const dashPath = joinPaths(documentRoot, 'wp-admin/includes/dashboard.php');
	if (php.fileExists(dashPath)) {
		let dash = php.readFileAsText(dashPath);
		if (
			dash.includes('function wp_dashboard_primary()') &&
			!dash.includes('/* pg_no_rss */')
		) {
			for (const fn of [
				'wp_dashboard_primary',
				'wp_dashboard_secondary',
				'wp_dashboard_plugins',
			]) {
				dash = dash.replace(
					new RegExp(`function ${fn}\\(\\)\\s*\\{`),
					`function ${fn}() { /* pg_no_rss */ return;`
				);
			}
			await php.writeFile(dashPath, dash);
		}
	}

	const adminPhpPath = joinPaths(documentRoot, 'wp-admin/admin.php');
	if (php.fileExists(adminPhpPath)) {
		let admin = php.readFileAsText(adminPhpPath);
		if (
			admin.includes("do_action('admin_init');") &&
			!admin.includes('/* pg_admin_init_cleanup */')
		) {
			admin = admin.replace(
				"do_action('admin_init');",
				`/* pg_admin_init_cleanup */
if (function_exists('remove_action')) {
	@remove_action('admin_init', '_maybe_update_plugins');
	@remove_action('admin_init', '_maybe_update_themes');
	@remove_action('admin_init', '_maybe_update_core');
	@remove_action('admin_init', 'wp_version_check');
	@remove_action('admin_init', 'wp_update_plugins');
	@remove_action('admin_init', 'wp_update_themes');
}
do_action('admin_init');`
			);
			await php.writeFile(adminPhpPath, admin);
		}
	}

	const adminUpdatePath = joinPaths(
		documentRoot,
		'wp-admin/includes/update.php'
	);
	if (php.fileExists(adminUpdatePath)) {
		let adminUpdate = php.readFileAsText(adminUpdatePath);
		if (!adminUpdate.includes('/* pg_admin_no_updates */')) {
			for (const fn of [
				'wp_plugin_update_rows',
				'wp_plugin_update_row',
				'wp_theme_update_rows',
				'wp_theme_update_row',
				'wp_update_plugins',
				'wp_update_themes',
			]) {
				const pattern = new RegExp(
					`function ${fn}\\s*\\([^)]*\\)\\s*\\{`
				);
				if (pattern.test(adminUpdate)) {
					adminUpdate = adminUpdate.replace(
						pattern,
						(m) => m + ` /* pg_admin_no_updates */ return;`
					);
				}
			}
			await php.writeFile(adminUpdatePath, adminUpdate);
		}
	}

	for (const spPath of [
		joinPaths(documentRoot, 'wp-includes/SimplePie/File.php'),
		joinPaths(documentRoot, 'wp-includes/class-simplepie.php'),
	]) {
		if (!php.fileExists(spPath)) continue;
		let sp = php.readFileAsText(spPath);
		if (
			sp.includes('function SimplePie_File(') &&
			!sp.includes('/* pg_no_fetch */')
		) {
			sp = sp.replace(
				/function SimplePie_File\([^)]*\)\s*\{/,
				(m) =>
					m +
					`\n\t\t/* pg_no_fetch */\n\t\t$this->error = 'Network requests disabled in Playground';\n\t\t$this->success = false;\n\t\treturn;`
			);
			await php.writeFile(spPath, sp);
		}
	}
}

/**
 * No-ops the install-time pretty-permalink HTTP probe so the PHP 5.2
 * WASM binary doesn't trap inside wp_remote_get(); the probe just
 * times out anyway. wp_mail() is no longer patched: mail() is in
 * LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS and PHPMailer's SMTP fallback
 * also needs fsockopen (also disabled), so wp_mail() now fails
 * safely with a WP_Error rather than trapping.
 */
async function patchWpInstallMailCrash(php: PHP, documentRoot: string) {
	// wp_check_mysql_version is left untouched: mysql_get_server_info is
	// shimmed in mysql-shims.ts, so the version check now passes safely.
	const noOpFunctions: Array<[string, string]> = [
		['function wp_new_blog_notification', 'pg_no_blog_notification'],
		[
			'function wp_install_maybe_enable_pretty_permalinks',
			'pg_no_permalink_check',
		],
	];
	const upgradeFiles = [
		joinPaths(documentRoot, 'wp-admin/includes/upgrade.php'),
		joinPaths(documentRoot, 'wp-admin/upgrade-functions.php'),
	];
	for (const filePath of upgradeFiles) {
		if (!php.fileExists(filePath)) continue;
		let content = php.readFileAsText(filePath);
		let changed = false;
		for (const [funcSig, marker] of noOpFunctions) {
			if (content.includes(`/* ${marker} */`)) continue;
			const idx = content.indexOf(funcSig);
			if (idx === -1) continue;
			const braceIdx = content.indexOf('{', idx);
			if (braceIdx === -1) continue;
			content =
				content.substring(0, braceIdx + 1) +
				` /* ${marker} */ return;` +
				content.substring(braceIdx + 1);
			changed = true;
		}
		if (changed) {
			await php.writeFile(filePath, content);
		}
	}
}

/**
 * Mask E_STRICT/E_DEPRECATED in wp-load.php — it sets error_reporting
 * before wp-settings.php's matching patch runs, so both need patching.
 */
async function patchErrorReportingInWpLoad(php: PHP, documentRoot: string) {
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	if (!php.fileExists(wpLoadPath)) return;
	const content = php.readFileAsText(wpLoadPath);
	if (!content.includes('error_reporting(')) return;
	if (content.includes('~8192') && content.includes('~2048')) return;
	const patched = content.replace(
		/error_reporting\(([^)]+)\)/g,
		(_match: string, flags: string) =>
			`error_reporting((${flags}) & ~8192 & ~2048)`
	);
	await php.writeFile(wpLoadPath, patched);
}

/**
 * Neutralises absolute `http://wordpress.org` links in WP 1.0/1.2 admin
 * templates. Clicking them navigates the scoped iframe to wordpress.org,
 * which `X-Frame-Options: sameorigin` then refuses to render — destroying
 * the Playground frame.
 */
async function patchWp10AdminLogoLink(php: PHP, documentRoot: string) {
	// WP 1.0: header logo lives in wp-admin/menu.php.
	const menuPhpPath = joinPaths(documentRoot, 'wp-admin/menu.php');
	if (php.fileExists(menuPhpPath)) {
		const content = php.readFileAsText(menuPhpPath);
		if (!content.includes('/* pg_wp10_logo_link */')) {
			const needle =
				'<h1 id="wphead"><a href="http://wordpress.org" rel="external">WordPress</a></h1>';
			if (content.includes(needle)) {
				const patched = content.replace(
					needle,
					'<h1 id="wphead"><a href="#" rel="external">WordPress</a></h1> <!-- pg_wp10_logo_link -->'
				);
				if (patched !== content) {
					await php.writeFile(menuPhpPath, patched);
				}
			}
		}
	}

	// WP 1.2: header logo lives in admin-header.php. The opening anchor
	// tag contains a `?>` inside the title attribute, so [^>]* would stop
	// short — splice by start/end indices instead of using a regex.
	const adminHeaderPath = joinPaths(
		documentRoot,
		'wp-admin/admin-header.php'
	);
	if (php.fileExists(adminHeaderPath)) {
		const content = php.readFileAsText(adminHeaderPath);
		if (!content.includes('/* pg_wp12_logo_link */')) {
			const logoStart = '<a href="http://wordpress.org" rel="external"';
			const logoEnd = '</a>';
			const startIdx = content.indexOf(logoStart);
			if (startIdx !== -1) {
				const endIdx = content.indexOf(logoEnd, startIdx);
				if (endIdx !== -1) {
					const patched =
						content.substring(0, startIdx) +
						'<a href="#">WordPress</a><!-- pg_wp12_logo_link -->' +
						content.substring(endIdx + logoEnd.length);
					if (patched !== content) {
						await php.writeFile(adminHeaderPath, patched);
					}
				}
			}
		}
	}

	// WP 1.0 (no trailing slash) and WP 1.2 (with slash): footer badge.
	const adminFooterPath = joinPaths(
		documentRoot,
		'wp-admin/admin-footer.php'
	);
	if (php.fileExists(adminFooterPath)) {
		const content = php.readFileAsText(adminFooterPath);
		if (!content.includes('/* pg_wp10_footer_link */')) {
			const patched = content
				.replace(
					'<a href="http://wordpress.org">WordPress</a>',
					'WordPress<!-- pg_wp10_footer_link -->'
				)
				.replace(
					'<a href="http://wordpress.org/">WordPress</a>',
					'WordPress<!-- pg_wp10_footer_link -->'
				);
			if (patched !== content) {
				await php.writeFile(adminFooterPath, patched);
			}
		}
	}
}

/**
 * Rewrites post-title links in WP 1.0/1.2/1.5 `wp-admin/edit.php` so they
 * open the edit form. WP 1.0/1.2 link to the front-end permalink (which
 * navigates away from the admin), and WP 1.5 renders no link at all — a
 * separate inline "Edit" link exists but is easy to miss. `$id` is set by
 * `start_wp()` in all three versions' loops.
 */
async function patchWp10EditPhpPostTitleLinks(php: PHP, documentRoot: string) {
	const editPhpPath = joinPaths(documentRoot, 'wp-admin/edit.php');
	if (!php.fileExists(editPhpPath)) return;

	const content = php.readFileAsText(editPhpPath);
	if (content.includes('/* pg_wp10_post_title_edit */')) return;

	let patched = content;

	// WP 1.0: title wrapped in <strong>, href uses permalink_link().
	const needleWp10 =
		'<strong><a href="<?php permalink_link(); ?>" rel="permalink"><?php the_title() ?></a></strong>';
	if (patched.includes(needleWp10)) {
		patched = patched.replace(
			needleWp10,
			'<strong><a href="post.php?action=edit&amp;post=<?php echo $id /* pg_wp10_post_title_edit */ ?>"><?php the_title() ?></a></strong>'
		);
	}

	// WP 1.2: title in a <td>, href uses the_permalink(). Closing </a> is
	// on a separate line; patching the opening tag is sufficient.
	const needleWp12 =
		'<td><a href="<?php the_permalink(); ?>" rel="permalink">';
	if (patched.includes(needleWp12)) {
		patched = patched.replace(
			needleWp12,
			'<td><a href="post.php?action=edit&amp;post=<?php echo $id /* pg_wp10_post_title_edit */ ?>">'
		);
	}

	// WP 1.5: title is plain text — wrap it in an edit link.
	const needleWp15 =
		'<td><?php the_title() ?>\n' +
		"\t\t<?php if ('private' == $post->post_status) _e(' - <strong>Private</strong>'); ?></td>";
	if (patched.includes(needleWp15)) {
		patched = patched.replace(
			needleWp15,
			'<td><a href="post.php?action=edit&amp;post=<?php echo $id /* pg_wp10_post_title_edit */ ?>"><?php the_title() ?></a>' +
				"\n\t\t<?php if ('private' == $post->post_status) _e(' - <strong>Private</strong>'); ?></td>"
		);
	}

	if (patched !== content) {
		await php.writeFile(editPhpPath, patched);
	}
}

/**
 * Fix WP 3.3's `self::$this->_help_sidebar` typo in screen.php — PHP
 * 5.3+ fatals on it whenever the sidebar is populated (e.g. post-new.php).
 * WP 3.4 rewrote the method; gated by the buggy expression itself.
 */
async function patchWp33ScreenPhpSelfThis(php: PHP, documentRoot: string) {
	const screenPath = joinPaths(documentRoot, 'wp-admin/includes/screen.php');
	if (!php.fileExists(screenPath)) return;
	const content = php.readFileAsText(screenPath);
	if (!content.includes('self::$this->_help_sidebar')) return;
	const patched = content.replace(
		/self::\$this->_help_sidebar/g,
		'$this->_help_sidebar'
	);
	if (patched !== content) {
		await php.writeFile(screenPath, patched);
	}
}

/**
 * Guard WP 2.1/2.2 plugins.php `in_array($plugin, $current)`: fresh
 * installs return `""` from `get_option('active_plugins')` and PHP
 * then warns. WP 2.0 had its own sanity block; WP 2.3+ unserializes
 * and defaults to array().
 */
async function patchWp21PluginsPhpInArray(php: PHP, documentRoot: string) {
	const pluginsPath = joinPaths(documentRoot, 'wp-admin/plugins.php');
	if (!php.fileExists(pluginsPath)) return;
	const content = php.readFileAsText(pluginsPath);
	if (content.includes('/* pg_wp21_active_plugins_array */')) return;
	const needle = "$current = get_option('active_plugins');";
	if (!content.includes(needle)) return;
	const patched = content.replace(
		needle,
		needle +
			'\n\tif (!is_array($current)) $current = array(); /* pg_wp21_active_plugins_array */'
	);
	if (patched !== content) {
		await php.writeFile(pluginsPath, patched);
	}
}

/**
 * Teaches WP 1.0's `wp-login.php` to accept an md5-hashed `user_pass`.
 * WP 1.0 compares submitted passwords to `user_pass` in plaintext, but
 * Playground seeds every legacy admin row with `MD5('password')` to match
 * the cookie-auth format WP 1.2+ and the auto-login mu-plugin expect.
 * Without this patch the manual login form rejects the seeded admin.
 *
 * Scoped via the exact plaintext SQL fragment, which WP 1.2 removed when
 * `wp_login()` moved into `wp-includes/functions.php`.
 */
async function patchWp10LoginPlaintextCompare(php: PHP, documentRoot: string) {
	const loginPath = joinPaths(documentRoot, 'wp-login.php');
	if (!php.fileExists(loginPath)) return;
	const content = php.readFileAsText(loginPath);
	const sqlMarker = "AND user_pass = '$password'";
	if (!content.includes(sqlMarker)) return;
	if (content.includes('pg_wp10_plain_or_md5')) return;
	let patched = content.replace(
		sqlMarker,
		"AND (user_pass = '$password' OR user_pass = MD5('$password')) /* pg_wp10_plain_or_md5 */"
	);
	patched = patched.replace(
		'$login->user_pass == $password',
		'($login->user_pass == $password || $login->user_pass == md5($password))'
	);
	if (patched !== content) {
		await php.writeFile(loginPath, patched);
	}
}

// ── Private helpers ──────────────────────────────────────────────

/** WP < 1.5 lacks wp-includes/version.php. Create a stub. */
async function ensureVersionPhp(php: PHP, documentRoot: string) {
	const wpIncludesDir = joinPaths(documentRoot, 'wp-includes');
	if (!php.isDir(wpIncludesDir)) return;
	const versionPhpPath = joinPaths(wpIncludesDir, 'version.php');
	if (!php.fileExists(versionPhpPath)) {
		await php.writeFile(versionPhpPath, `<?php $wp_version = '1.0';`);
	}
}

/**
 * Two WP 1.0.2 SQL-emission bugs that the SQLite AST parser can't
 * tolerate:
 *   1. wp-blog-header.php emits `post_status = "publish"`. The parser
 *      reads double-quoted strings as identifiers, so the WHERE clause
 *      is rejected. Switch to single quotes.
 *   2. wp-includes/vars.php registers `add_filter('all', 'wptexturize')`,
 *      which pipes EVERY apply_filters() value (including SQL literals)
 *      through wptexturize and produces smart-quoted SQL. Remove that
 *      hook; WP 1.2+ already wires wptexturize to specific filters.
 */
async function patchWp10DoubleQuotedSqlLiterals(
	php: PHP,
	documentRoot: string
) {
	const blogHeaderPath = joinPaths(documentRoot, 'wp-blog-header.php');
	if (php.fileExists(blogHeaderPath)) {
		const content = php.readFileAsText(blogHeaderPath);
		const needle = `$where .= ' AND (post_status = "publish"';`;
		if (content.includes(needle)) {
			await php.writeFile(
				blogHeaderPath,
				content.replace(
					needle,
					`$where .= " AND (post_status = 'publish'";`
				)
			);
		}
	}

	const varsPhpPath = joinPaths(documentRoot, 'wp-includes/vars.php');
	if (php.fileExists(varsPhpPath)) {
		const varsContent = php.readFileAsText(varsPhpPath);
		const allFilterHook = `add_filter('all', 'wptexturize');`;
		if (varsContent.includes(allFilterHook)) {
			await php.writeFile(
				varsPhpPath,
				varsContent.replace(
					allFilterHook,
					`// ${allFilterHook} // Disabled by Playground: mangles SQL literals.`
				)
			);
		}
	}
}

/** WP < 2.0 lacks wp-load.php. Create a shim that loads wp-config.php. */
async function ensureWpLoadPhp(php: PHP, documentRoot: string) {
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	if (!php.fileExists(wpLoadPath)) {
		await php.writeFile(
			wpLoadPath,
			`<?php
if ( !defined('ABSPATH') ) {
	define('ABSPATH', dirname(__FILE__) . '/');
}
require_once(ABSPATH . 'wp-config.php');
`
		);
	}
}

/** Patches wp-settings.php for deprecated functions, syntax, etc. */
async function patchWpSettingsPhp(php: PHP, documentRoot: string) {
	const wpSettingsPath = joinPaths(documentRoot, 'wp-settings.php');
	if (!php.fileExists(wpSettingsPath)) return;

	const original = php.readFileAsText(wpSettingsPath);
	let settings = original;

	// WP 1.5/2.0 abort with die() when the mysql extension is missing,
	// before db.php gets a chance to load.
	settings = settings.replace(
		/if\s*\(\s*!extension_loaded\('mysql'\)\s*\)\s*\n\s*die/,
		'if ( false ) // Patched for SQLite\n\tdie'
	);

	// Mask E_DEPRECATED (8192) and E_STRICT (2048) — old class
	// declarations (e.g. Walker_Page) emit E_STRICT at compile time on
	// PHP 5.2, which doesn't define these constants. Use `& ~`, not
	// `^`: XOR would *enable* E_STRICT where E_ALL doesn't include it.
	settings = settings.replace(
		/error_reporting\(([^)]+)\)/g,
		(match, flags) =>
			flags.includes('~8192') && flags.includes('~2048')
				? match
				: `error_reporting((${flags}) & ~8192 & ~2048)`
	);

	// set_magic_quotes_runtime removed in PHP 7.0.
	settings = settings.replace(
		/set_magic_quotes_runtime\(\s*0\s*\)\s*;/g,
		'// set_magic_quotes_runtime(0); // Removed'
	);

	// get_magic_quotes_gpc removed in PHP 8.0.
	if (!settings.includes("function_exists('get_magic_quotes_gpc')")) {
		settings = settings.replace(
			/get_magic_quotes_gpc\(\)/g,
			"(function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc())"
		);
	}

	// "=& new" triggers compile-time E_DEPRECATED in PHP 5.3+.
	settings = settings.replace(/=\s*&\s*new\b/g, '= new');

	// $HTTP_SERVER_VARS removed in PHP 5.4.
	settings = settings.replace(/\$HTTP_SERVER_VARS/g, '$_SERVER');

	// WP < 2.0 has no WP_CONTENT_DIR; the SQLite db.php drop-in needs it.
	if (
		!settings.includes('WP_CONTENT_DIR') &&
		settings.includes("define('WPINC'")
	) {
		settings = settings.replace(
			/define\('WPINC',\s*'wp-includes'\);/,
			`define('WPINC', 'wp-includes');\nif (!defined('WP_CONTENT_DIR')) define('WP_CONTENT_DIR', ABSPATH . 'wp-content');`
		);
	}

	// WP 2.5–3.x unsets $wp_filter to defeat register_globals — that
	// also wipes hooks our auto_prepend_file preload registered (e.g.
	// playground_load_mu_plugins). Drop $wp_filter from the unset list.
	settings = settings.replace(/unset\(\s*\$wp_filter\s*,/, 'unset(');

	settings = removeNotInstalledDie(settings);
	settings = injectInitHookCleanup(settings);

	if (settings !== original) {
		await php.writeFile(wpSettingsPath, settings);
	}
}

/**
 * Removes the WP 1.x–2.x "you haven't installed WP yet" die(). The
 * call may be wrapped in sprintf/__/etc., so we match by locating
 * "installed WP" and walking back to the enclosing die(...);
 */
function removeNotInstalledDie(settings: string): string {
	const instIdx = settings.indexOf('installed WP');
	if (instIdx === -1) return settings;
	const dieStart = settings.lastIndexOf('die(', instIdx);
	if (dieStart === -1) return settings;

	let depth = 0;
	for (let i = dieStart + 3; i < settings.length; i++) {
		if (settings[i] === '(') depth++;
		else if (settings[i] === ')') {
			depth--;
			if (depth === 0) {
				let dieEnd = i + 1;
				if (settings[dieEnd] === ';') dieEnd++;
				return (
					settings.substring(0, dieStart) +
					'true; /* die removed by Playground */' +
					settings.substring(dieEnd)
				);
			}
		}
	}
	return settings;
}

/**
 * Strips network-calling hooks and disables HTTP transports right
 * before do_action('init') in wp-settings.php. WP 2.5–2.7 wires
 * wp_cron/wp_version_check/etc. into 'init' and 'admin_init'; their
 * fsockopen/cURL paths trigger "null function or function signature
 * mismatch" WASM traps on the PHP 5.2 binary. WP 3.2+ honors the
 * use_*_transport filters as a second line of defense.
 */
function injectInitHookCleanup(settings: string): string {
	return settings.replace(
		"do_action('init');",
		`// Remove hooks that make outbound HTTP requests (crash WASM).
if (function_exists('remove_action')) {
	@remove_action('init', 'wp_cron');
	@remove_action('init', 'wp_version_check');
	@remove_action('init', 'wp_update_plugins');
	@remove_action('init', 'wp_update_themes');
	@remove_action('admin_init', '_maybe_update_plugins');
	@remove_action('admin_init', '_maybe_update_themes');
	@remove_action('admin_init', 'wp_version_check');
	@remove_action('admin_init', 'wp_update_plugins');
	@remove_action('admin_init', 'wp_update_themes');
	@remove_action('load-plugins.php', 'wp_update_plugins');
	@remove_action('load-update.php', 'wp_update_plugins');
	@remove_action('load-update.php', 'wp_update_themes');
	@remove_action('load-themes.php', 'wp_update_themes');
	@remove_action('wp_update_plugins', 'wp_update_plugins');
	@remove_action('wp_version_check', 'wp_version_check');
}
if (function_exists('add_filter')) {
	function _pg_disable_curl() { return false; }
	function _pg_disable_streams() { return false; }
	@add_filter('use_curl_transport', '_pg_disable_curl');
	@add_filter('use_streams_transport', '_pg_disable_streams');
	@add_filter('use_ftp_transport', '_pg_disable_curl');
	@add_filter('use_fsockopen_transport', '_pg_disable_streams');
}
do_action('init');`
	);
}

async function patchWpFunctionsPhp(php: PHP, documentRoot: string) {
	const functionsPhpPath = joinPaths(
		documentRoot,
		'wp-includes/functions.php'
	);
	if (!php.fileExists(functionsPhpPath)) return;

	let functionsPhp = php.readFileAsText(functionsPhpPath);
	let functionsPhpChanged = false;

	// WP 1.5 writes `$all_options->{$option->option_name}` without first
	// initialising `$all_options`; PHP 5.3+ warns and the cache stays empty.
	if (
		functionsPhp.includes('$all_options->{$option->option_name}') &&
		!functionsPhp.includes('$all_options = new stdClass')
	) {
		functionsPhp = functionsPhp.replace(
			'foreach ($options as $option) {',
			'$all_options = new stdClass;\n\tforeach ($options as $option) {'
		);
		functionsPhpChanged = true;
	}

	if (functionsPhpChanged) {
		await php.writeFile(functionsPhpPath, functionsPhp);
	}
}

/**
 * Patches wp-admin/install.php for old WP versions. The legacy boot
 * flow itself bypasses install.php (see runLegacyInstaller in
 * legacy-boot.ts), but a user can still navigate to /wp-admin/install.php
 * manually — these patches keep the page loadable rather than fataling
 * at parse/include time on PHP 5.2+.
 */
async function patchWpInstallPhp(php: PHP, documentRoot: string) {
	const installPhpPath = joinPaths(documentRoot, 'wp-admin/install.php');
	if (!php.fileExists(installPhpPath)) return;

	const original = php.readFileAsText(installPhpPath);
	let installPhp = original;

	// WP 1.x–2.5 use relative require paths that break when CWD isn't
	// wp-admin/ (Playground's CWD is the document root).
	const absAdminDir = joinPaths(documentRoot, 'wp-admin');
	installPhp = installPhp
		.replace(/'\.\.\/(wp-config\.php)'/g, `'${documentRoot}/$1'`)
		.replace(/'\.\.\/(wp-load\.php)'/g, `'${documentRoot}/$1'`)
		.replace(/'\.\/(upgrade-functions\.php)'/g, `'${absAdminDir}/$1'`)
		.replace(/'(upgrade-functions\.php)'/g, `'${absAdminDir}/$1'`)
		.replace(/'\.\/(includes\/upgrade\.php)'/g, `'${absAdminDir}/$1'`)
		.replace(/'\.\.\/(wp-includes\/[^']+)'/g, `'${documentRoot}/$1'`);

	// $HTTP_GET_VARS/$HTTP_POST_VARS removed in PHP 5.4.
	installPhp = installPhp
		.replace(/\$HTTP_GET_VARS/g, '$_GET')
		.replace(/\$HTTP_POST_VARS/g, '$_POST');

	if (installPhp !== original) {
		await php.writeFile(installPhpPath, installPhp);
	}
}

/**
 * Patches wp-includes/wp-db.php so old wpdb classes (WP 1.5–2.5) can
 * delegate to WP_SQLite_DB and expose the methods that newer WP
 * callers (and the SQLite drop-in) expect.
 */
async function patchWpDbPhp(php: PHP, documentRoot: string) {
	const wpDbPath = joinPaths(documentRoot, 'wp-includes/wp-db.php');
	if (!php.fileExists(wpDbPath)) return;

	const original = php.readFileAsText(wpDbPath);
	let wpDb = original;

	// The SQLite db.php drop-in instantiates $wpdb itself; guard the
	// global write so wp-db.php doesn't overwrite the lazy loader.
	if (!wpDb.includes('isset($wpdb)')) {
		wpDb = wpDb.replace(
			'$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);',
			'if ( !isset($wpdb) ) { $wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST); }'
		);
	}

	// WP < 3.0 calls mysql_connect() inline in the constructor; the
	// SQLite-backed wpdb subclass exposes db_connect() instead.
	if (!wpDb.includes('db_connect')) {
		wpDb = wpDb.replace(
			/\$this->dbh\s*=\s*@mysql_connect\(\$dbhost\s*,\s*\$dbuser\s*,\s*\$dbpassword(?:\s*,\s*true)?\);/,
			'if (method_exists($this, "db_connect")) { $this->dbname = $dbname; $this->db_connect(); } else { $this->dbh = @mysql_connect($dbhost, $dbuser, $dbpassword); }'
		);
	}

	wpDb = injectWpdbPolyfills(wpDb);

	if (wpDb !== original) {
		await php.writeFile(wpDbPath, wpDb);
	}
}

/**
 * Injects polyfill methods into the wpdb class. WP 1.5–2.4 ship a
 * minimal wpdb (no set_prefix, init_charset, check_connection, etc.),
 * but the SQLite drop-in and WP_SQLite_DB call these methods
 * unconditionally.
 */
function injectWpdbPolyfills(wpDb: string): string {
	const polyfills: string[] = [];
	if (!wpDb.includes('function set_prefix')) {
		polyfills.push(`
	function set_prefix($prefix) {
		$this->prefix = $prefix;
		$tables = array('posts', 'users', 'categories', 'post2cat', 'comments', 'link2cat', 'links', 'options', 'postmeta', 'usermeta', 'terms', 'term_taxonomy', 'term_relationships');
		foreach ($tables as $t) {
			$this->$t = $prefix . $t;
		}
		return $prefix;
	}`);
	}
	if (!wpDb.includes('function timer_start')) {
		polyfills.push(`
	function timer_start() {
		$this->time_start = microtime(true);
		return true;
	}`);
	}
	if (!wpDb.includes('function timer_stop')) {
		polyfills.push(`
	function timer_stop() {
		return microtime(true) - $this->time_start;
	}`);
	}
	if (!wpDb.includes('function init_charset')) {
		polyfills.push(`
	function init_charset() {
		if (defined('DB_CHARSET')) $this->charset = DB_CHARSET;
		if (defined('DB_COLLATE')) $this->collate = DB_COLLATE;
	}`);
	}
	if (!wpDb.includes('function bail')) {
		polyfills.push(`
	function bail($message, $error_code = '500') {
		die($message);
	}`);
	}
	if (!wpDb.includes('function check_connection')) {
		polyfills.push(`
	function check_connection($allow_bail = true) {
		return true;
	}`);
	}
	if (polyfills.length === 0) return wpDb;

	const classEndMatch = wpDb.match(
		/^(\s*})\s*\n+(\$wpdb|\?>\s*$|if\s*\(\s*!\s*isset\(\s*\$wpdb\s*\))/m
	);
	if (!classEndMatch || classEndMatch.index === undefined) return wpDb;

	const polyfillBlock =
		'\n\t// Polyfills added by WordPress Playground.\n' +
		polyfills.join('\n') +
		'\n\n';
	return (
		wpDb.substring(0, classEndMatch.index) +
		polyfillBlock +
		wpDb.substring(classEndMatch.index)
	);
}

/**
 * Fixes relative paths in wp-admin files so they work regardless of CWD.
 *
 * Old WordPress (< 3.7) uses relative paths like `require('../wp-load.php')`,
 * `require('./admin.php')`, and `include('./admin-footer.php')` in wp-admin
 * scripts. These fail in the Playground because PHP's CWD is set to the
 * document root, not the script's directory. Modern WordPress uses
 * `dirname(__FILE__)` instead.
 */
async function patchWpAdminRelativePaths(php: PHP, documentRoot: string) {
	// CWD during a Playground request is the document root, so
	// require/include statements with './' or '../' resolve relative to
	// /wordpress instead of the file's own directory. Rewrite every
	// relative require/include in wp-admin to a dirname(__FILE__)-based
	// absolute path. Covers WP 1.2 through 3.6.
	const toDirnameExpr = (relPath: string): string => {
		let remaining = relPath;
		let upLevels = 0;
		while (remaining.startsWith('../')) {
			upLevels++;
			remaining = remaining.slice(3);
		}
		while (remaining.startsWith('./')) {
			remaining = remaining.slice(2);
		}
		let dirExpr = 'dirname(__FILE__)';
		for (let i = 0; i < upLevels; i++) {
			dirExpr = `dirname(${dirExpr})`;
		}
		return `${dirExpr} . '/${remaining}'`;
	};
	const wpAdminDir = joinPaths(documentRoot, 'wp-admin');
	if (php.isDir(wpAdminDir)) {
		for (const file of php.listFiles(wpAdminDir)) {
			if (!file.endsWith('.php')) continue;
			const filePath = joinPaths(wpAdminDir, file);
			const content = php.readFileAsText(filePath);
			const patched = content
				.replace(
					/((?:require|include)(?:_once)?)\s*\(\s*(['"])(\.\.\/[^'"]+)\2\s*\)/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				.replace(
					/((?:require|include)(?:_once)?)\s*\(\s*(['"])(\.\/[^'"]+)\2\s*\)/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Bare filename (e.g. 'admin-header.php'). Restrict to
				// .php to avoid false positives.
				.replace(
					/((?:require|include)(?:_once)?)\s*\(\s*(['"])([a-z][\w-]*\.php)\2\s*\)/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Statement form without parentheses (WP 2.0 uses this).
				.replace(
					/((?:require|include)(?:_once)?)\s+(['"])(\.\.\/[^'"]+)\2/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				.replace(
					/((?:require|include)(?:_once)?)\s+(['"])(\.\/[^'"]+)\2/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				.replace(
					/((?:require|include)(?:_once)?)\s+(['"])([a-z][\w-]*\.php)\2/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Drop the leading slash from `ABSPATH . '/wp-...'`.
				.replace(/ABSPATH\s*\.\s*'\/wp-/g, "ABSPATH . 'wp-");
			if (patched !== content) {
				await php.writeFile(filePath, patched);
			}
		}
	}

	// WP 1.2: index.php redirects using get_settings('siteurl') which
	// may be 'http://localhost' (wrong host for the Playground). Replace
	// with relative redirects that work regardless of siteurl.
	const indexPhpPath = joinPaths(documentRoot, 'wp-admin/index.php');
	if (php.fileExists(indexPhpPath)) {
		let indexPhp = php.readFileAsText(indexPhpPath);
		if (indexPhp.includes("get_settings('siteurl')")) {
			indexPhp = indexPhp.replace(
				/get_settings\('siteurl'\)\s*\.\s*'\/wp-admin\//g,
				"'"
			);
			await php.writeFile(indexPhpPath, indexPhp);
		}
	}

	// WP 1.0.2 wp-admin/menu.php reads the admin menu definition from
	// a relative path: `$menu = file('./menu.txt');`. The CWD during
	// a Playground request is the document root (/wordpress), not
	// wp-admin, so ./menu.txt resolves to /wordpress/menu.txt and
	// fails. Rewrite to an absolute path relative to the menu.php
	// file location.
	const menuPhpPath = joinPaths(documentRoot, 'wp-admin/menu.php');
	if (php.fileExists(menuPhpPath)) {
		const menuPhp = php.readFileAsText(menuPhpPath);
		const needle = `file('./menu.txt')`;
		if (menuPhp.includes(needle)) {
			await php.writeFile(
				menuPhpPath,
				menuPhp.replace(needle, `file(dirname(__FILE__) . '/menu.txt')`)
			);
		}
	}
}

/**
 * Bypasses referer-based check_admin_referer() in WP < 2.5. The
 * Referer header is unreliable inside Playground's service worker, so
 * the original die() short-circuits plugin activation and other admin
 * actions. WP 2.5+ uses nonces and doesn't need this patch.
 */
async function patchCheckAdminReferer(php: PHP, documentRoot: string) {
	const adminFunctionsPath = joinPaths(
		documentRoot,
		'wp-admin/admin-functions.php'
	);
	if (!php.fileExists(adminFunctionsPath)) return;

	const content = php.readFileAsText(adminFunctionsPath);
	if (
		!content.includes('function check_admin_referer()') ||
		!content.includes("$_SERVER['HTTP_REFERER']")
	) {
		return;
	}

	const patched = replacePhpFunctionBody(
		content,
		'check_admin_referer',
		`\n\tdo_action('check_admin_referer', '');\n`
	);
	if (patched !== content) {
		await php.writeFile(adminFunctionsPath, patched);
	}
}

/**
 * Replaces the body of a top-level PHP function `fnName` (zero-arg)
 * with `newBody` using a balanced-brace walker. Returns the original
 * string if the function isn't found.
 */
function replacePhpFunctionBody(
	source: string,
	fnName: string,
	newBody: string
): string {
	const sig = `function ${fnName}()`;
	const sigIdx = source.indexOf(sig);
	if (sigIdx === -1) return source;
	const openIdx = source.indexOf('{', sigIdx + sig.length);
	if (openIdx === -1) return source;

	let depth = 1;
	for (let i = openIdx + 1; i < source.length; i++) {
		const ch = source[i];
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) {
				return (
					source.substring(0, openIdx + 1) +
					newBody +
					source.substring(i)
				);
			}
		}
	}
	return source;
}

/**
 * Removes WP 1.5's `AND post_date_gmt < '$today'` from the dashboard
 * recent-posts query: SQLite mishandles the comparison against the
 * '0000-00-00 00:00:00' values seeded by the legacy installer, leaving
 * the dashboard empty. The post_status='publish' filter alone is
 * enough — scheduled posts use status 'future' (WP 2.1+) or aren't
 * published yet (WP 1.x).
 */
async function patchWpAdminDashboard(php: PHP, documentRoot: string) {
	const indexPhpPath = joinPaths(documentRoot, 'wp-admin/index.php');
	if (php.fileExists(indexPhpPath)) {
		const content = php.readFileAsText(indexPhpPath);
		const patched = content.replace(/AND post_date_gmt < '\$today'/, '');
		if (patched !== content) {
			await php.writeFile(indexPhpPath, patched);
		}
	}

	await patchRssFunctionsErrorStub(php, documentRoot);
}

/**
 * WP 1.5's Magpie RSS library calls a bare `error()` function from
 * fetch_rss() / _response_to_rss(), but `error()` only exists as a
 * method on the RSSCache class. RSS fetches always fail in Playground
 * (no outbound HTTP), so without a global stub the dashboard dies on
 * "Call to undefined function error()".
 */
async function patchRssFunctionsErrorStub(php: PHP, documentRoot: string) {
	const rssPath = joinPaths(documentRoot, 'wp-includes/rss-functions.php');
	if (!php.fileExists(rssPath)) return;

	let content = php.readFileAsText(rssPath);
	if (
		!/^\s*error\s*\(/m.test(content) ||
		/^function\s+error\s*\(/m.test(content)
	) {
		return;
	}

	content = content.replace(
		/^(<\?php\s*)/,
		`$1\n` +
			`if (!function_exists('error')) {\n` +
			`\tfunction error($msg = '', $lvl = E_USER_WARNING) {\n` +
			`\t\tif (defined('MAGPIE_DEBUG') && MAGPIE_DEBUG) {\n` +
			`\t\t\ttrigger_error($msg, $lvl);\n` +
			`\t\t}\n` +
			`\t}\n` +
			`}\n`
	);
	await php.writeFile(rssPath, content);
}

/**
 * Disables 1Password's inline autofill on legacy wp-login.php. The inline
 * tooltip enters a tight inject/remove loop inside Playground's sandboxed
 * iframes, flickering the UI and emitting thousands of extension-CSS
 * fetches per second. `data-1p-ignore` is 1Password's official opt-out.
 */
async function patchWpLoginDisable1Password(php: PHP, documentRoot: string) {
	const loginPath = joinPaths(documentRoot, 'wp-login.php');
	if (!php.fileExists(loginPath)) return;

	let content = php.readFileAsText(loginPath);
	let changed = false;

	for (const fieldName of ['log', 'pwd']) {
		// Match the field's name attribute only when the surrounding tag
		// (everything up to the next `>`) does not already carry the opt-out.
		const re = new RegExp(
			`(\\bname=(['"])${fieldName}\\2)(?![^>]*data-1p-ignore)`
		);
		if (re.test(content)) {
			content = content.replace(re, '$1 data-1p-ignore');
			changed = true;
		}
	}

	if (changed) {
		await php.writeFile(loginPath, content);
	}
}

/**
 * Injects auth-cookie population before `auth_redirect()` in
 * `wp-admin/admin.php` (WP 2.0-2.7) and replaces `wp-admin/auth.php`
 * with a stub that pre-populates user globals (WP 1.2). WP < 2.8 has
 * no mu-plugin support, so the auto-login mu-plugin can't run.
 */
async function patchAdminAuthRedirect(php: PHP, documentRoot: string) {
	// Session tokens don't exist until WP 4.0, so cookies generated
	// here can't mismatch a token. Nonces in WP < 4.0 only depend on
	// user ID, action, and secret keys.
	const adminPhpPath = joinPaths(documentRoot, 'wp-admin/admin.php');
	if (php.fileExists(adminPhpPath)) {
		const content = php.readFileAsText(adminPhpPath);
		if (content.includes('auth_redirect()')) {
			const authCode = `
// Playground: populate auth cookies and force admin user before auth_redirect.
if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) {
	if (function_exists('is_user_logged_in') && is_user_logged_in()) {
		// On WP < 4.0, wp_set_auth_cookie() does not update $_COOKIE
		// in-process — auth_redirect() reads $_COOKIE, so re-emit.
		if (function_exists('wp_generate_auth_cookie') && defined('LOGGED_IN_COOKIE') && empty($_COOKIE[LOGGED_IN_COOKIE])) {
			$_pg_uid = wp_get_current_user()->ID;
			$_pg_exp = time() + 172800;
			$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($_pg_uid, $_pg_exp, 'auth');
			if (defined('SECURE_AUTH_COOKIE'))
				$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($_pg_uid, $_pg_exp, 'secure_auth');
			$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($_pg_uid, $_pg_exp, 'logged_in');
		}
	} else {
		${legacyAuthCookieBlock('PLAYGROUND_AUTO_LOGIN_AS_USER')}
		// WP 2.0-2.4: kses_init() runs during do_action('init') inside
		// wp-settings.php and caches $current_user as WP_User(0) when
		// no cookies were set yet. Reset and re-evaluate so capability
		// checks see the user we just authenticated.
		if (!function_exists('wp_generate_auth_cookie')) {
			$GLOBALS['current_user'] = null;
			if (function_exists('get_currentuserinfo')) {
				get_currentuserinfo();
			}
		}
	}
	// Force admin caps in-memory: if populate_roles() never ran
	// (e.g. WP 2.0, or WP 2.5 installs that crashed before writing
	// roles), the user has no caps and every current_user_can() fails.
	$_pg_cu = isset($GLOBALS['current_user']) ? $GLOBALS['current_user'] : null;
	if ($_pg_cu && isset($_pg_cu->ID) && $_pg_cu->ID > 0 && empty($_pg_cu->allcaps['read'])) {
		// Respect a DB-stored user_level so a blueprint that auto-logs
		// in as a lower-privilege user doesn't silently get level 10.
		$_pg_db_level = isset($_pg_cu->user_level)
			? (int) $_pg_cu->user_level
			: null;
		if ($_pg_db_level === null && isset($_pg_user) && $_pg_user) {
			$_pg_db_level = isset($_pg_user->user_level)
				? (int) $_pg_user->user_level
				: null;
		}
		$_pg_cu->user_level = $_pg_db_level !== null ? $_pg_db_level : 10;
		$_pg_effective_level = $_pg_cu->user_level;
		$_pg_caps = array('read');
		for ($_pg_i = 0; $_pg_i <= $_pg_effective_level; $_pg_i++) {
			$_pg_caps[] = 'level_' . $_pg_i;
		}
		if ($_pg_effective_level >= 10) {
			$_pg_caps = array_merge($_pg_caps, array(
				'switch_themes','edit_themes','activate_plugins',
				'edit_plugins','edit_users','edit_files','manage_options',
				'moderate_comments','manage_categories','manage_links',
				'upload_files','import','unfiltered_html','edit_posts',
				'edit_others_posts','edit_published_posts','publish_posts',
				'edit_pages'));
		}
		foreach ($_pg_caps as $_pg_c) {
			$_pg_cu->allcaps[$_pg_c] = true;
		}
		if ($_pg_effective_level >= 10) {
			$_pg_cu->caps = array('administrator' => true);
		}
	}
}
`;
			const patched = content.replace(
				'auth_redirect();',
				authCode + 'auth_redirect();'
			);
			if (patched !== content) {
				await php.writeFile(adminPhpPath, patched);
			}
		}
	}

	// WP 1.2 routes admin auth through wp-admin/auth.php (no admin.php
	// / auth_redirect). The original auth.php calls wp_login()/veriflog()
	// with cookie values Playground can't reliably reproduce: the pass
	// cookie is md5 of the stored pw and get_settings('siteurl') is not
	// stable during install. Short-circuit by setting cookies AND
	// populating the user globals get_currentuserinfo() would have set.
	const authPhpPath = joinPaths(documentRoot, 'wp-admin/auth.php');
	if (php.fileExists(authPhpPath)) {
		const authPhp = php.readFileAsText(authPhpPath);
		if (
			authPhp.includes('$cookiehash') &&
			!authPhp.includes('Playground: bypass auth')
		) {
			// WP 1.2 defines both `$cookiehash` and the COOKIEHASH
			// constant; WP 1.0 only the variable. Check both, with a
			// siteurl-derived fallback.
			const bypassedAuth = `<?php
require_once(ABSPATH . 'wp-config.php');
// Playground: bypass auth and manually populate user globals.
global $user_login, $userdata, $user_level, $user_ID,
	$user_nickname, $user_email, $user_url, $user_pass_md5, $cookiehash;
$__pg_user_login = defined('PLAYGROUND_AUTO_LOGIN_AS_USER')
	? PLAYGROUND_AUTO_LOGIN_AS_USER
	: 'admin';
$__pg_cookiehash = defined('COOKIEHASH')
	? COOKIEHASH
	: (isset($cookiehash) && $cookiehash
		? $cookiehash
		: md5(function_exists('get_settings') ? get_settings('siteurl') : ''));
if ($__pg_cookiehash) {
	$_COOKIE['wordpressuser_' . $__pg_cookiehash] = $__pg_user_login;
}
if (function_exists('get_userdatabylogin')) {
	$__pg_userdata = get_userdatabylogin($__pg_user_login);
	if ($__pg_userdata) {
		$user_login = $__pg_user_login;
		$userdata = $__pg_userdata;
		$user_level = isset($__pg_userdata->user_level)
			? (int) $__pg_userdata->user_level
			: 10;
		$user_ID = $__pg_userdata->ID;
		$user_nickname = isset($__pg_userdata->user_nickname)
			? $__pg_userdata->user_nickname
			: $__pg_user_login;
		$user_email = isset($__pg_userdata->user_email)
			? $__pg_userdata->user_email
			: '';
		$user_url = isset($__pg_userdata->user_url)
			? $__pg_userdata->user_url
			: '';
		$user_pass_md5 = md5(
			isset($__pg_userdata->user_pass) ? $__pg_userdata->user_pass : ''
		);
	}
}
?>`;
			if (bypassedAuth !== authPhp) {
				await php.writeFile(authPhpPath, bypassedAuth);
			}
		}
	}
}

/**
 * Injects auth-cookie population before the `is_user_logged_in()`
 * gate in `wp-admin/admin-ajax.php` for WP 2.5-2.7. admin-ajax.php
 * loads wp-config.php directly (not via admin.php), and WP < 2.8 has
 * no mu-plugin support, so no other auth mechanism applies here.
 */
async function patchAdminAjaxAuth(php: PHP, documentRoot: string) {
	const ajaxPhpPath = joinPaths(documentRoot, 'wp-admin/admin-ajax.php');
	if (!php.fileExists(ajaxPhpPath)) return;

	let content = php.readFileAsText(ajaxPhpPath);
	if (!content.includes('is_user_logged_in')) return;

	const authCode = `
// Playground: authenticate admin user for AJAX requests on WP < 2.8.
if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) {
	${legacyAuthCookieBlock('PLAYGROUND_AUTO_LOGIN_AS_USER')}
}
`;

	content = content.replace(
		/if\s*\(\s*!\s*is_user_logged_in\(\)\s*\)/,
		authCode + 'if ( !is_user_logged_in() )'
	);
	await php.writeFile(ajaxPhpPath, content);
}

/**
 * PHP snippet that, on WP 2.5+, resolves a username to a WP_User and
 * populates `$_COOKIE` with the three HMAC auth cookies.
 *
 * On WP < 2.5 the block is a no-op: env.php's
 * {@link playground_legacy_set_auth_cookies_early} runs via
 * auto_prepend_file before every script and already populated the
 * `wordpressuser_$cookiehash` / `wordpresspass_$cookiehash` pair
 * (which also backs the USER_COOKIE/PASS_COOKIE constants WP 1.5–2.4
 * reads). `$_pg_user` is left `null` there; callers that care about
 * DB-level capability info fall back to `$GLOBALS['current_user']`.
 */
function legacyAuthCookieBlock(usernamePhpExpr: string): string {
	return `
$_pg_user = null;
if (function_exists('wp_generate_auth_cookie')) {
	$_pg_user = function_exists('get_user_by')
		? get_user_by('login', ${usernamePhpExpr})
		: (function_exists('get_userdatabylogin')
			? get_userdatabylogin(${usernamePhpExpr}) : null);
	if ($_pg_user) {
		wp_set_current_user($_pg_user->ID, $_pg_user->user_login);
		$_pg_exp = time() + 172800;
		if (defined('AUTH_COOKIE'))
			$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($_pg_user->ID, $_pg_exp, 'auth');
		if (defined('SECURE_AUTH_COOKIE'))
			$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($_pg_user->ID, $_pg_exp, 'secure_auth');
		if (defined('LOGGED_IN_COOKIE'))
			$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($_pg_user->ID, $_pg_exp, 'logged_in');
	}
}
`;
}

/**
 * Wraps WP 2.1–3.2's top-level `$wp_queries = "CREATE TABLE …"` in a
 * wp_get_db_schema() polyfill. Consumed by runDbDeltaOnly() in
 * legacy-boot.ts; WP 3.3+ ships the function natively.
 */
async function patchWpSchemaPhp(php: PHP, documentRoot: string) {
	const wpVersion = readOnDiskWpVersion(php, documentRoot);
	if (wpVersion === null) return;
	const parsed = parseFloat(wpVersion);
	if (!Number.isFinite(parsed) || parsed >= 3.3) return;

	const schemaPhpPath = joinPaths(
		documentRoot,
		'wp-admin/includes/schema.php'
	);
	if (!php.fileExists(schemaPhpPath)) return;

	const schemaPhp = php.readFileAsText(schemaPhpPath);
	if (
		/\$wp_queries\s*=\s*"CREATE TABLE/.test(schemaPhp) &&
		!schemaPhp.includes('function wp_get_db_schema')
	) {
		await patchInlineSchemaPhp(php, documentRoot, schemaPhpPath, schemaPhp);
	}
}

/**
 * Adds wp_get_db_schema() polyfill to WP < 3.3 schema.php.
 *
 * Also patches upgrade.php so make_db_current_silent() regenerates
 * $wp_queries via wp_get_db_schema() before passing it to dbDelta().
 */
async function patchInlineSchemaPhp(
	php: PHP,
	documentRoot: string,
	schemaPhpPath: string,
	schemaPhp: string
) {
	const startMatch = schemaPhp.match(/\$wp_queries\s*=\s*"CREATE TABLE/);
	if (!startMatch || startMatch.index === undefined) {
		return;
	}
	const startIdx = startMatch.index;

	const endMarker = '";';
	const endIdx = schemaPhp.indexOf(endMarker, startIdx);
	if (endIdx === -1) {
		return;
	}
	const endPos = endIdx + endMarker.length;

	const wpQueriesBlock = schemaPhp.substring(startIdx, endPos);

	const replacement =
		`function wp_get_db_schema( $scope = 'all', $blog_id = null ) {\n` +
		`\tglobal $wpdb, $wp_queries, $charset_collate;\n` +
		`\t$charset_collate = '';\n` +
		`\tif ( ! empty($wpdb->charset) )\n` +
		`\t\t$charset_collate = "DEFAULT CHARACTER SET $wpdb->charset";\n` +
		`\tif ( ! empty($wpdb->collate) )\n` +
		`\t\t$charset_collate .= " COLLATE $wpdb->collate";\n` +
		`\t${wpQueriesBlock}\n` +
		`\treturn $wp_queries;\n` +
		`}`;

	const patched =
		schemaPhp.substring(0, startIdx) +
		replacement +
		schemaPhp.substring(endPos);
	await php.writeFile(schemaPhpPath, patched);

	const upgradePhpPath = joinPaths(
		documentRoot,
		'wp-admin/includes/upgrade.php'
	);
	if (php.fileExists(upgradePhpPath)) {
		const upgradePhp = php.readFileAsText(upgradePhpPath);

		const dbDeltaReplacement =
			`if ( function_exists('wp_get_db_schema') ) { ` +
			`$wp_queries = wp_get_db_schema(); } ` +
			`$1`;
		const updated = upgradePhp.replace(
			/(\$alterations\s*=\s*dbDelta\(\s*\$wp_queries\s*\))/g,
			dbDeltaReplacement
		);
		if (updated !== upgradePhp) {
			await php.writeFile(upgradePhpPath, updated);
		}
	}
}
/**
 * Returns the PHP content for wp-content/db.php.
 *
 * This db.php provides MySQL/MySQLi function stubs and, for WP < 3.0,
 * loads the SQLite integration directly. Modern WP only needs this file
 * to *exist* (to bypass the extension_loaded('mysql') check), but old
 * WP actually uses the stubs defined here.
 */
export function generateDbPhpContent(): string {
	// 0-sqlite.php preload runs first via auto_prepend_file and already
	// defines mysql_*, mysqli_connect/init, and str_* polyfills. Only
	// the mysqli_* stubs that the preload doesn't cover live here.
	return `<?php
// @playground-managed — Playground-generated db.php.
// WP < 3.0 loads only db.php and skips wp-db.php, so we pull
// in the wpdb class definition explicitly.
if (defined('ABSPATH') && defined('WPINC') && !class_exists('wpdb', false)) {
	require_once(ABSPATH . WPINC . '/wp-db.php');
}
// Old wpdb (WP < 3.0) has no db_connect() and calls mysql_connect()
// inline, so the SQLite driver never gets a chance to attach. Load
// the integration here and reinitialise to swap the dbh in place.
if (
	class_exists('wpdb', false) &&
	isset($GLOBALS['wpdb']) &&
	!($GLOBALS['wpdb'] instanceof wpdb) &&
	!method_exists('wpdb', 'db_connect') &&
	file_exists('/internal/shared/mu-plugins/sqlite-database-integration.php')
) {
	require_once '/internal/shared/mu-plugins/sqlite-database-integration.php';
	if (
		isset($GLOBALS['wpdb']) &&
		$GLOBALS['wpdb'] instanceof wpdb &&
		method_exists($GLOBALS['wpdb'], 'reinitialize_sqlite')
	) {
		$GLOBALS['wpdb']->reinitialize_sqlite();
	}
}
// Remaining mysqli_* stubs not covered by the 0-sqlite.php preload.
// WP 4.x's extension_loaded('mysqli') check expects these to exist.
if (!function_exists('mysqli_real_connect')) {
	function mysqli_real_connect() { return true; }
}
if (!function_exists('mysqli_error')) {
	function mysqli_error() { return ''; }
}
if (!function_exists('mysqli_errno')) {
	function mysqli_errno() { return 0; }
}
if (!function_exists('mysqli_query')) {
	function mysqli_query() { return false; }
}
if (!function_exists('mysqli_set_charset')) {
	function mysqli_set_charset() { return true; }
}
if (!function_exists('mysqli_select_db')) {
	function mysqli_select_db() { return true; }
}
if (!function_exists('mysqli_close')) {
	function mysqli_close() { return true; }
}
`;
}

/**
 * Post-install fixups for legacy WordPress.
 *
 * Stage 1 (always): boots WordPress and patches data via $wpdb —
 * siteurl/home, admin password, roles/caps, default content.
 *
 * Stage 2 (WP < 3.5 only): direct PDO writes that create the WP 1.x-era
 * schema and seed users/posts/categories/options. Runs in addition to
 * stage 1 (idempotent guards), so it backfills whatever stage 1 missed
 * — including the case where wp-load.php crashed before stage 1 ran.
 * Skipped for WP 3.5+ to avoid polluting the AST driver's schema with
 * legacy-shaped tables it never registers in information_schema.
 */
export async function runPostInstallLegacyFixups(
	php: PHP,
	siteUrl: string
): Promise<void> {
	let wpVersion: string | null = null;
	const versionPhp = joinPaths(php.documentRoot, 'wp-includes/version.php');
	if (php.fileExists(versionPhp)) {
		const m = php
			.readFileAsText(versionPhp)
			.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
		if (m) wpVersion = m[1];
	}
	const needsStage2 = wpVersion !== null && parseFloat(wpVersion) < 3.5;
	try {
		await php.run({
			code: `<?php
				// WP_INSTALLING bypasses WP 1.x's "not installed" die() in wp-settings.php.
				define('WP_INSTALLING', true);
				error_reporting(${LEGACY_WP_ERROR_REPORTING_PHP_EXPR});
				ini_set('display_errors', '0');
				ob_start();
				$_pg_db_path = getenv('DOCUMENT_ROOT') . '/wp-content/database/.ht.sqlite';
				if (!file_exists($_pg_db_path)) { exit; }
				$_pg_pdo = new PDO('sqlite:' . $_pg_db_path);
				$_pg_check = $_pg_pdo->query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='wp_users'")->fetchColumn();
				$_pg_pdo = null;
				if (!$_pg_check) { exit; }
				$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
				if (!file_exists($wp_load)) { exit; }
				require $wp_load;
				ob_clean();
				global $wpdb;
				if (!isset($wpdb) || !method_exists($wpdb, 'query')) { exit; }

				// Persist the scoped siteurl/home to the DB so parse_request()
				// strips the scope prefix from REQUEST_URI. Filters alone
				// (env.php) aren't enough on WP < 2.2.
				$_pg_opts = !empty($wpdb->options) ? $wpdb->options : $GLOBALS['table_prefix'] . 'options';
				try {
					$_pg_url = getenv('PLAYGROUND_SITE_URL');
					if ($_pg_url) {
						$_pg_current = $wpdb->get_var("SELECT option_value FROM {$_pg_opts} WHERE option_name = 'siteurl'");
						if ($_pg_current !== $_pg_url) {
							$wpdb->query("UPDATE {$_pg_opts} SET option_value = '{$_pg_url}' WHERE option_name = 'siteurl'");
							$wpdb->query("UPDATE {$_pg_opts} SET option_value = '{$_pg_url}' WHERE option_name = 'home'");
						}
					}
				} catch (Exception $e) {}

				// $wpdb->users exists on WP 1.5+; older WP needs the prefix.
				$users_table = !empty($wpdb->users) ? $wpdb->users : $GLOBALS['table_prefix'] . 'users';

				// WP 1.0/1.2 installers often leave the users table or admin row missing.
				$wpdb->query("CREATE TABLE IF NOT EXISTS {$users_table} (
					ID int(10) unsigned NOT NULL auto_increment,
					user_login varchar(20) NOT NULL default '',
					user_pass varchar(64) NOT NULL default '',
					user_firstname varchar(50) NOT NULL default '',
					user_lastname varchar(50) NOT NULL default '',
					user_nickname varchar(50) NOT NULL default '',
					user_icq int(10) unsigned NOT NULL default '0',
					user_email varchar(100) NOT NULL default '',
					user_url varchar(100) NOT NULL default '',
					user_ip varchar(15) NOT NULL default '',
					user_domain varchar(200) NOT NULL default '',
					user_browser varchar(200) NOT NULL default '',
					dateYMDhour datetime NOT NULL default '0000-00-00 00:00:00',
					user_level int(2) unsigned NOT NULL default '0',
					user_aim varchar(50) NOT NULL default '',
					user_msn varchar(100) NOT NULL default '',
					user_yim varchar(50) NOT NULL default '',
					user_idmode varchar(20) NOT NULL default '',
					PRIMARY KEY (ID),
					UNIQUE KEY user_login (user_login)
				)");
				if (!$wpdb->get_var("SELECT COUNT(*) FROM {$users_table}")) {
					$now = date('Y-m-d H:i:s');
					$wpdb->query(
						"INSERT INTO {$users_table} (ID, user_login, user_pass, user_email, user_level, dateYMDhour, user_nickname) " .
						"VALUES (1, 'admin', MD5('password'), 'admin@localhost.com', 10, '{$now}', 'admin')"
					);
				}
				$wpdb->query(
					"UPDATE {$users_table} SET user_pass = MD5('password') WHERE user_login = 'admin'"
				);

				// populate_roles() can fail on SQLite; seed the admin role and caps directly.
				$p = $GLOBALS['table_prefix'];
				$roles_key = $p . 'user_roles';
				try {
					$has_roles = $wpdb->get_var(
						"SELECT COUNT(*) FROM {$p}options WHERE option_name = '{$roles_key}'"
					);
				} catch (Exception $e) {
					$has_roles = 0;
				}
				if (!$has_roles) {
					$roles = array('administrator' => array(
						'name' => 'Administrator',
						'capabilities' => array(
							'switch_themes'=>true, 'edit_themes'=>true,
							'activate_plugins'=>true, 'edit_plugins'=>true,
							'edit_users'=>true, 'edit_files'=>true,
							'manage_options'=>true, 'moderate_comments'=>true,
							'manage_categories'=>true, 'manage_links'=>true,
							'upload_files'=>true, 'import'=>true,
							'unfiltered_html'=>true, 'edit_posts'=>true,
							'edit_others_posts'=>true, 'edit_published_posts'=>true,
							'publish_posts'=>true, 'edit_pages'=>true,
							'read'=>true, 'level_10'=>true, 'level_9'=>true,
							'level_8'=>true, 'level_7'=>true, 'level_6'=>true,
							'level_5'=>true, 'level_4'=>true, 'level_3'=>true,
							'level_2'=>true, 'level_1'=>true, 'level_0'=>true,
							'edit_others_pages'=>true, 'edit_published_pages'=>true,
							'publish_pages'=>true, 'delete_pages'=>true,
							'delete_others_pages'=>true, 'delete_published_pages'=>true,
							'delete_posts'=>true, 'delete_others_posts'=>true,
							'delete_published_posts'=>true, 'delete_private_posts'=>true,
							'edit_private_posts'=>true, 'read_private_posts'=>true,
							'delete_private_pages'=>true, 'edit_private_pages'=>true,
							'read_private_pages'=>true,
						)
					));
					$wpdb->query("INSERT INTO {$p}options (option_name, option_value, autoload) VALUES ('{$roles_key}', '" . addslashes(serialize($roles)) . "', 'yes')");
				}
				$um = isset($wpdb->usermeta) ? $wpdb->usermeta : $p . 'usermeta';
				try {
					$has_cap = $wpdb->get_var("SELECT COUNT(*) FROM {$um} WHERE user_id=1 AND meta_key='{$p}capabilities'");
					if (!$has_cap) {
						$cap_val = addslashes(serialize(array('administrator' => true)));
						$wpdb->query("INSERT INTO {$um} (user_id, meta_key, meta_value) VALUES (1, '{$p}capabilities', '{$cap_val}')");
					}
					$has_level = $wpdb->get_var("SELECT COUNT(*) FROM {$um} WHERE user_id=1 AND meta_key='{$p}user_level'");
					if (!$has_level) {
						$wpdb->query("INSERT INTO {$um} (user_id, meta_key, meta_value) VALUES (1, '{$p}user_level', '10')");
					}
				} catch (Exception $e) {}

				// Seed default content when the install left the posts table empty.
				$posts_table = !empty($wpdb->posts) ? $wpdb->posts : $GLOBALS['table_prefix'] . 'posts';
				$has_posts = false;
				try { $has_posts = (bool)$wpdb->get_var("SELECT COUNT(*) FROM {$posts_table}"); } catch (Exception $e) {}
				if (!$has_posts) {
					$now = date('Y-m-d H:i:s');
					$now_gmt = gmdate('Y-m-d H:i:s');
					if (isset($wpdb->categories)) {
						$wpdb->query("INSERT INTO {$wpdb->categories} (cat_ID, cat_name, category_nicename, category_description, category_parent) VALUES (1, 'Uncategorized', 'uncategorized', '', 0)");
					}
					// Columns common to WP 1.0+.
					$wpdb->query("INSERT INTO {$posts_table} (ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered) VALUES (1, 1, '{$now}', '{$now_gmt}', 'Welcome to WordPress. This is your first post. Edit or delete it, then start blogging!', 'Hello world!', '', 'publish', 'open', 'open', '', 'hello-world', '', '', '{$now}', '{$now_gmt}', '')");
					if (isset($wpdb->comments)) {
						$wpdb->query("INSERT INTO {$wpdb->comments} (comment_post_ID, comment_author, comment_author_email, comment_author_url, comment_author_IP, comment_date, comment_date_gmt, comment_content, comment_karma, comment_approved, comment_agent, comment_type, comment_parent, user_id) VALUES (1, 'Mr WordPress', '', 'http://wordpress.org', '127.0.0.1', '{$now}', '{$now_gmt}', 'Hi, this is a comment. To delete a comment, just log in and view the post comments. There you will have the option to edit or delete them.', 0, '1', '', '', 0, 0)");
					}
					if (isset($wpdb->post2cat)) {
						$wpdb->query("INSERT INTO {$wpdb->post2cat} (rel_id, post_id, category_id) VALUES (1, 1, 1)");
					}
				}
			`,
			env: {
				DOCUMENT_ROOT: php.documentRoot,
				PLAYGROUND_SITE_URL: siteUrl || '',
			},
		});
	} catch (error) {
		logger.warn('Legacy WP post-install fixups failed (non-fatal):', error);
	}

	if (!needsStage2) return;
	try {
		await php.run({
			code: `<?php
				$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
				if (!is_dir($db_dir)) { @mkdir($db_dir, 0777, true); }
				$db_path = $db_dir . '.ht.sqlite';
				$pdo = new PDO('sqlite:' . $db_path);
				$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

				$prefix = 'wp_';
				$table = $prefix . 'users';
				try {
					$count = $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
				} catch (Exception $e) {
					$pdo->exec("CREATE TABLE IF NOT EXISTS {$table} (
						ID INTEGER PRIMARY KEY AUTOINCREMENT,
						user_login TEXT NOT NULL DEFAULT '',
						user_pass TEXT NOT NULL DEFAULT '',
						user_nickname TEXT NOT NULL DEFAULT '',
						user_email TEXT NOT NULL DEFAULT '',
						user_url TEXT NOT NULL DEFAULT '',
						user_ip TEXT NOT NULL DEFAULT '',
						user_domain TEXT NOT NULL DEFAULT '',
						user_browser TEXT NOT NULL DEFAULT '',
						dateYMDhour TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						user_level INTEGER NOT NULL DEFAULT 0,
						user_idmode TEXT NOT NULL DEFAULT '',
						user_firstname TEXT NOT NULL DEFAULT '',
						user_lastname TEXT NOT NULL DEFAULT '',
						user_icq INTEGER NOT NULL DEFAULT 0,
						user_aim TEXT NOT NULL DEFAULT '',
						user_msn TEXT NOT NULL DEFAULT '',
						user_yim TEXT NOT NULL DEFAULT ''
					)");
					$count = 0;
				}
				if ($count == 0) {
					$now = date('Y-m-d H:i:s');
					// SECURITY: md5('password') matches WP 1.0-1.2's single-md5
					// scheme so auto-login works without a blueprint password.
					// Safe only inside the Playground WASM sandbox.
					$pass = md5('password');
					try {
						$col_info = $pdo->query("PRAGMA table_info({$table})")->fetchAll(PDO::FETCH_ASSOC);
						$known = array(
							'ID' => '1', 'user_login' => "'admin'",
							'user_pass' => "'{$pass}'", 'user_email' => "'admin@localhost.com'",
							'user_level' => '10', 'dateYMDhour' => "'{$now}'",
							'user_nickname' => "'admin'", 'user_nicename' => "'admin'",
							'user_registered' => "'{$now}'", 'user_status' => '0',
						);
						$ins_cols = array(); $ins_vals = array();
						foreach ($col_info as $ci) {
							$cn = $ci['name'];
							$ins_cols[] = $cn;
							if (isset($known[$cn])) {
								$ins_vals[] = $known[$cn];
							} elseif ($ci['dflt_value'] !== null) {
								$ins_vals[] = $ci['dflt_value'];
							} elseif (stripos($ci['type'], 'int') !== false) {
								$ins_vals[] = '0';
							} else {
								$ins_vals[] = "''";
							}
						}
						$pdo->exec("INSERT INTO {$table} (" . implode(',', $ins_cols) . ") VALUES (" . implode(',', $ins_vals) . ")");
					} catch (Exception $e) {}
				} else {
					// See SECURITY note above.
					$pass = md5('password');
					try { $pdo->exec("UPDATE {$table} SET user_pass = '{$pass}' WHERE user_login = 'admin'"); } catch (Exception $e) {}
				}

				// WP 1.0-1.2 install often leaves these tables missing because
				// the SQLite driver can't translate the old-style CREATE TABLEs.
				$now = date('Y-m-d H:i:s');
				$now_gmt = gmdate('Y-m-d H:i:s');
				$tables_sql = array(
					'posts' => "CREATE TABLE IF NOT EXISTS {$prefix}posts (
						ID INTEGER PRIMARY KEY AUTOINCREMENT,
						post_author INTEGER NOT NULL DEFAULT 0,
						post_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_date_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_content TEXT NOT NULL DEFAULT '',
						post_title TEXT NOT NULL DEFAULT '',
						post_category INTEGER NOT NULL DEFAULT 0,
						post_excerpt TEXT NOT NULL DEFAULT '',
						post_status TEXT NOT NULL DEFAULT 'publish',
						comment_status TEXT NOT NULL DEFAULT 'open',
						ping_status TEXT NOT NULL DEFAULT 'open',
						post_password TEXT NOT NULL DEFAULT '',
						post_name TEXT NOT NULL DEFAULT '',
						to_ping TEXT NOT NULL DEFAULT '',
						pinged TEXT NOT NULL DEFAULT '',
						post_modified TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_modified_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						post_content_filtered TEXT NOT NULL DEFAULT '',
						post_parent INTEGER NOT NULL DEFAULT 0,
						menu_order INTEGER NOT NULL DEFAULT 0,
						post_mime_type TEXT NOT NULL DEFAULT ''
					)",
					'categories' => "CREATE TABLE IF NOT EXISTS {$prefix}categories (
						cat_ID INTEGER PRIMARY KEY AUTOINCREMENT,
						cat_name TEXT NOT NULL DEFAULT '',
						category_nicename TEXT NOT NULL DEFAULT '',
						category_description TEXT NOT NULL DEFAULT '',
						category_parent INTEGER NOT NULL DEFAULT 0
					)",
					'post2cat' => "CREATE TABLE IF NOT EXISTS {$prefix}post2cat (
						rel_id INTEGER PRIMARY KEY AUTOINCREMENT,
						post_id INTEGER NOT NULL DEFAULT 0,
						category_id INTEGER NOT NULL DEFAULT 0
					)",
					'comments' => "CREATE TABLE IF NOT EXISTS {$prefix}comments (
						comment_ID INTEGER PRIMARY KEY AUTOINCREMENT,
						comment_post_ID INTEGER NOT NULL DEFAULT 0,
						comment_author TEXT NOT NULL DEFAULT '',
						comment_author_email TEXT NOT NULL DEFAULT '',
						comment_author_url TEXT NOT NULL DEFAULT '',
						comment_author_IP TEXT NOT NULL DEFAULT '',
						comment_date TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						comment_date_gmt TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						comment_content TEXT NOT NULL DEFAULT '',
						comment_karma INTEGER NOT NULL DEFAULT 0,
						comment_approved TEXT NOT NULL DEFAULT '1',
						comment_agent TEXT NOT NULL DEFAULT '',
						comment_type TEXT NOT NULL DEFAULT '',
						comment_parent INTEGER NOT NULL DEFAULT 0,
						user_id INTEGER NOT NULL DEFAULT 0
					)",
					'options' => "CREATE TABLE IF NOT EXISTS {$prefix}options (
						option_id INTEGER PRIMARY KEY AUTOINCREMENT,
						blog_id INTEGER NOT NULL DEFAULT 0,
						option_name TEXT NOT NULL DEFAULT '',
						option_can_override TEXT NOT NULL DEFAULT 'Y',
						option_type INTEGER NOT NULL DEFAULT 1,
						option_value TEXT NOT NULL DEFAULT '',
						option_width INTEGER NOT NULL DEFAULT 20,
						option_height INTEGER NOT NULL DEFAULT 8,
						option_description TEXT NOT NULL DEFAULT '',
						option_admin_level INTEGER NOT NULL DEFAULT 1,
						autoload TEXT NOT NULL DEFAULT 'yes'
					)",
					'postmeta' => "CREATE TABLE IF NOT EXISTS {$prefix}postmeta (
						meta_id INTEGER PRIMARY KEY AUTOINCREMENT,
						post_id INTEGER NOT NULL DEFAULT 0,
						meta_key TEXT NOT NULL DEFAULT '',
						meta_value TEXT NOT NULL DEFAULT ''
					)",
					'links' => "CREATE TABLE IF NOT EXISTS {$prefix}links (
						link_id INTEGER PRIMARY KEY AUTOINCREMENT,
						link_url TEXT NOT NULL DEFAULT '',
						link_name TEXT NOT NULL DEFAULT '',
						link_image TEXT NOT NULL DEFAULT '',
						link_target TEXT NOT NULL DEFAULT '',
						link_category INTEGER NOT NULL DEFAULT 0,
						link_description TEXT NOT NULL DEFAULT '',
						link_visible TEXT NOT NULL DEFAULT 'Y',
						link_owner INTEGER NOT NULL DEFAULT 1,
						link_rating INTEGER NOT NULL DEFAULT 0,
						link_updated TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
						link_rel TEXT NOT NULL DEFAULT '',
						link_notes TEXT NOT NULL DEFAULT '',
						link_rss TEXT NOT NULL DEFAULT ''
					)",
					'linkcategories' => "CREATE TABLE IF NOT EXISTS {$prefix}linkcategories (
						cat_id INTEGER PRIMARY KEY AUTOINCREMENT,
						cat_name TEXT NOT NULL DEFAULT '',
						auto_toggle TEXT NOT NULL DEFAULT 'N',
						show_images TEXT NOT NULL DEFAULT 'Y',
						show_description TEXT NOT NULL DEFAULT 'N',
						show_rating TEXT NOT NULL DEFAULT 'Y',
						show_updated TEXT NOT NULL DEFAULT 'Y',
						sort_order TEXT NOT NULL DEFAULT 'name',
						sort_desc TEXT NOT NULL DEFAULT 'ASC',
						text_before_link TEXT NOT NULL DEFAULT '<li>',
						text_after_link TEXT NOT NULL DEFAULT '<br />',
						text_after_all TEXT NOT NULL DEFAULT '</li>',
						list_limit INTEGER NOT NULL DEFAULT -1
					)",
					'optiongroups' => "CREATE TABLE IF NOT EXISTS {$prefix}optiongroups (
						group_id INTEGER PRIMARY KEY AUTOINCREMENT,
						group_name TEXT NOT NULL DEFAULT '',
						group_desc TEXT DEFAULT '',
						group_longdesc TEXT DEFAULT ''
					)",
					'optiongroup_options' => "CREATE TABLE IF NOT EXISTS {$prefix}optiongroup_options (
						group_id INTEGER NOT NULL DEFAULT 0,
						option_id INTEGER NOT NULL DEFAULT 0,
						seq INTEGER NOT NULL DEFAULT 0,
						PRIMARY KEY (group_id, option_id)
					)"
				);
				foreach ($tables_sql as $t => $sql) {
					try { $pdo->exec($sql); } catch (Exception $e) {}
				}
				// Backfill columns that WP 1.0-1.2 installs leave off but later code paths read.
				$alter_cols = array(
					'categories' => array(
						'category_nicename' => "TEXT NOT NULL DEFAULT ''",
						'category_description' => "TEXT NOT NULL DEFAULT ''",
						'category_parent' => "INTEGER NOT NULL DEFAULT 0",
						'category_count' => "INTEGER NOT NULL DEFAULT 0",
					),
					// WP 1.5+ get_comments_number() reads comment_count off wp_posts.
					'posts' => array(
						'comment_count' => "INTEGER NOT NULL DEFAULT 0",
					),
				);
				foreach ($alter_cols as $t => $cols_to_add) {
					try {
						$existing = $pdo->query("PRAGMA table_info({$prefix}{$t})")->fetchAll(PDO::FETCH_COLUMN, 1);
						foreach ($cols_to_add as $col => $type) {
							if (!in_array($col, $existing)) {
								$pdo->exec("ALTER TABLE {$prefix}{$t} ADD COLUMN {$col} {$type}");
							}
						}
					} catch (Exception $e) {}
				}
				// Dynamic column detection because the schema differs across WP 1.x.
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}posts")->fetchColumn()) {
						$post_cols = $pdo->query("PRAGMA table_info({$prefix}posts)")->fetchAll(PDO::FETCH_COLUMN, 1);
						$post_vals = array(
							'ID' => '1', 'post_author' => '1',
							'post_date' => "'{$now}'", 'post_date_gmt' => "'{$now_gmt}'",
							'post_content' => "'Welcome to WordPress. This is your first post. Edit or delete it, then start blogging!'",
							'post_title' => "'Hello world!'", 'post_excerpt' => "''",
							'post_status' => "'publish'", 'comment_status' => "'open'",
							'ping_status' => "'open'", 'post_password' => "''",
							'post_name' => "'hello-world'", 'to_ping' => "''", 'pinged' => "''",
							'post_modified' => "'{$now}'", 'post_modified_gmt' => "'{$now_gmt}'",
							'post_content_filtered' => "''",
						);
						$ins_c = array(); $ins_v = array();
						foreach ($post_vals as $c => $v) {
							if (in_array($c, $post_cols)) { $ins_c[] = $c; $ins_v[] = $v; }
						}
						if ($ins_c) $pdo->exec("INSERT INTO {$prefix}posts (" . implode(',', $ins_c) . ") VALUES (" . implode(',', $ins_v) . ")");
					}
				} catch (Exception $e) {}
				try {
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}categories")->fetchColumn()) {
						$pdo->exec("INSERT INTO {$prefix}categories (cat_ID, cat_name, category_nicename, category_description, category_parent) VALUES (1, 'Uncategorized', 'uncategorized', '', 0)");
					}
				} catch (Exception $e) {}
				try {
					$env_site = getenv('PLAYGROUND_SITE_URL');
					$site = $env_site ? $env_site : 'http://localhost';
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}options WHERE option_name='siteurl'")->fetchColumn()) {
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('siteurl', '{$site}')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('blogname', 'My WordPress Website')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('blogdescription', 'Just another WordPress weblog')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value) VALUES ('home', '{$site}')");
					}
					// Overwrite the placeholder 'http://localhost' with the scoped URL.
					if ($env_site) {
						$pdo->exec("UPDATE {$prefix}options SET option_value = '{$env_site}' WHERE option_name = 'siteurl'");
						$pdo->exec("UPDATE {$prefix}options SET option_value = '{$env_site}' WHERE option_name = 'home'");
					}
					// populate_options() sets template/stylesheet; backfill if it crashed.
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}options WHERE option_name='template'")->fetchColumn()) {
						$themes_dir = getenv('DOCUMENT_ROOT') . '/wp-content/themes/';
						$tpl = 'default';
						if (is_dir($themes_dir)) {
							$entries = glob($themes_dir . '*', GLOB_ONLYDIR);
							if ($entries) {
								foreach ($entries as $e) {
									$name = basename($e);
									if ($name === '.' || $name === '..') continue;
									if (file_exists($e . '/style.css')) {
										$tpl = $name;
										break;
									}
								}
							}
						}
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value, autoload) VALUES ('template', '{$tpl}', 'yes')");
						$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value, autoload) VALUES ('stylesheet', '{$tpl}', 'yes')");
					}
					// Without a correct db_version, WP 2.0-2.5 admin redirects to upgrade.php.
					$version_path = getenv('DOCUMENT_ROOT') . '/wp-includes/version.php';
					if (file_exists($version_path)) {
						$wp_db_version = 0;
						include $version_path;
						if ($wp_db_version > 0) {
							$has_dbv = $pdo->query("SELECT COUNT(*) FROM {$prefix}options WHERE option_name='db_version'")->fetchColumn();
							if (!$has_dbv) {
								$pdo->exec("INSERT INTO {$prefix}options (option_name, option_value, autoload) VALUES ('db_version', '{$wp_db_version}', 'yes')");
							} else {
								$pdo->exec("UPDATE {$prefix}options SET option_value = '{$wp_db_version}' WHERE option_name = 'db_version'");
							}
						}
					}
				} catch (Exception $e) {}
			`,
			env: {
				DOCUMENT_ROOT: php.documentRoot,
				PLAYGROUND_SITE_URL: siteUrl || '',
			},
		});
	} catch (error) {
		logger.warn('Legacy WP PDO fallback failed (non-fatal):', error);
	}
}
