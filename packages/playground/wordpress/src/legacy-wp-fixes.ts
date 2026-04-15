/**
 * Legacy WordPress version fixes.
 *
 * Patches WordPress source files at boot time to make WP 1.0 through
 * 4.9 work on the SQLite integration layer with the PHP 5.2 WASM
 * binary.
 *
 * All functions here are only needed for old WP versions or old PHP.
 * Modern WordPress (5.0+) on PHP 7+ doesn't need any of these.
 */
import type { PHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import { MYSQL_SHIMS_PHP } from './mysql-shims';

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
 * This function must only be called for legacy PHP (< 7); callers
 * in boot.ts already gate on that.
 */
export async function patchWordPressSourceFiles(
	php: PHP,
	documentRoot: string
) {
	await ensureVersionPhp(php, documentRoot);
	await ensureWpLoadPhp(php, documentRoot);
	await patchWp10DoubleQuotedSqlLiterals(php, documentRoot);
	await patchWpSettingsPhp(php, documentRoot);
	await patchWpFunctionsPhp(php, documentRoot);
	await patchWpInstallPhp(php, documentRoot);
	await patchWpDbPhp(php, documentRoot);
	await patchWpSchemaPhp(php, documentRoot);
	await patchWpAdminRelativePaths(php, documentRoot);
	await patchCheckAdminReferer(php, documentRoot);
	await patchWpAdminDashboard(php, documentRoot);
	await patchWpLoginDisable1Password(php, documentRoot);
	await ensureLegacyAdminAuth(php, documentRoot);
	await patchAdminAuthRedirect(php, documentRoot);
	await patchAdminAjaxAuth(php, documentRoot);
	await patchLegacyWpCategoriesZeroPk(php, documentRoot);
	await patchWp10LoginPlaintextCompare(php, documentRoot);
	await patchWp33ScreenPhpSelfThis(php, documentRoot);
	await patchWp21PluginsPhpInArray(php, documentRoot);
	await patchWp41AutoDraftZeroDatetime(php, documentRoot);
	await patchWp15AdminPostAutoIncrement(php, documentRoot);
	await patchWp21InsertPostEmptyDates(php, documentRoot);
	await patchWp27InsertPostZeroDateGmt(php, documentRoot);
	await patchWp10AdminLogoLink(php, documentRoot);
	await patchWp10EditPhpPostTitleLinks(php, documentRoot);
	await patchWp10PostPhpInsertNullId(php, documentRoot);
	await patchWp12PostPhpInsertNullId(php, documentRoot);
	await patchErrorReportingInWpLoad(php, documentRoot);
	await patchAdminNetworkCalls(php, documentRoot);
	await patchWpInstallMailCrash(php, documentRoot);
	await patchWp47ThemeSearchForms(php, documentRoot);
}

/**
 * Patches WP 4.7+ themes for PHP 5.2 WASM compatibility.
 *
 * ## The bug
 *
 * WP 4.7+ themes (Twenty Seventeen, Twenty Sixteen, Twenty Fifteen)
 * include `searchform.php` templates that crash the PHP 5.2 WASM
 * runtime with `unreachable` WASM errors when included via
 * `get_search_form()`. The crash occurs during sidebar widget
 * rendering (search widget) and any other code path that calls
 * `get_search_form()`.
 *
 * The crash is a WASM-level fatal (`unreachable` instruction) that
 * kills the entire PHP instance, not a PHP error. The exact cause
 * is somewhere in the template inclusion path — the same functions
 * called inline (esc_url, home_url, twentyseventeen_get_svg) all
 * work fine, but requiring the template file via ob_start/require/
 * ob_get_clean triggers the crash.
 *
 * ## The fix
 *
 * Remove theme `searchform.php` files so that `get_search_form()`
 * falls back to its inline HTML form builder, which works correctly.
 * The inline form has the same functionality (search input + submit
 * button) but without the theme-specific styling/SVG icons.
 */
async function patchWp47ThemeSearchForms(php: PHP, documentRoot: string) {
	// Only apply to WP 4.7+ (WP_Hook class is the WP 4.7 marker)
	const wpHookPath = joinPaths(documentRoot, 'wp-includes/class-wp-hook.php');
	if (!php.fileExists(wpHookPath)) return;

	const themesDir = joinPaths(documentRoot, 'wp-content/themes');
	if (!php.isDir(themesDir)) return;

	const themes = php.listFiles(themesDir);
	for (const theme of themes) {
		const searchformPath = joinPaths(themesDir, theme, 'searchform.php');
		if (!php.fileExists(searchformPath)) continue;
		php.unlink(searchformPath);
	}
}

/**
 * Patches wp-admin/admin.php to prevent network calls that crash WASM.
 * WP 2.9–3.5 admin.php triggers SimplePie RSS fetches and update checks
 * that call fsockopen/cURL, causing "null function" WASM crashes.
 */
async function patchAdminNetworkCalls(php: PHP, documentRoot: string) {
	// Patch wp-admin/includes/dashboard.php to skip RSS widgets
	const dashPath = joinPaths(documentRoot, 'wp-admin/includes/dashboard.php');
	if (php.fileExists(dashPath)) {
		let dash = php.readFileAsText(dashPath);
		// Disable the WordPress Blog (Primary) RSS widget
		if (
			dash.includes('function wp_dashboard_primary()') &&
			!dash.includes('/* pg_no_rss */')
		) {
			dash = dash.replace(
				/function wp_dashboard_primary\(\)\s*\{/,
				'function wp_dashboard_primary() { /* pg_no_rss */ return;'
			);
			dash = dash.replace(
				/function wp_dashboard_secondary\(\)\s*\{/,
				'function wp_dashboard_secondary() { /* pg_no_rss */ return;'
			);
			// Also disable other RSS-fetching widgets
			dash = dash.replace(
				/function wp_dashboard_plugins\(\)\s*\{/,
				'function wp_dashboard_plugins() { /* pg_no_rss */ return;'
			);
			await php.writeFile(dashPath, dash);
		}
	}

	// WP 2.9–3.5: Remove admin_init hooks that make network calls.
	// These crash WASM via fsockopen/cURL. The hooks are registered
	// in wp-includes/update.php and wp-admin/includes/update.php.
	{
		const adminPhpPath2 = joinPaths(documentRoot, 'wp-admin/admin.php');
		if (php.fileExists(adminPhpPath2)) {
			let admin2 = php.readFileAsText(adminPhpPath2);
			if (
				admin2.includes("do_action('admin_init');") &&
				!admin2.includes('/* pg_admin_init_cleanup */')
			) {
				admin2 = admin2.replace(
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
				await php.writeFile(adminPhpPath2, admin2);
			}
		}
	}

	// Patch wp-admin/includes/update.php to disable network-calling
	// update checks that crash WASM on WP 2.9–3.5.
	const adminUpdatePath = joinPaths(
		documentRoot,
		'wp-admin/includes/update.php'
	);
	if (php.fileExists(adminUpdatePath)) {
		let adminUpdate = php.readFileAsText(adminUpdatePath);
		// wp_plugin_update_rows and wp_theme_update_rows make network
		// calls. The admin update.php file also registers various
		// admin_init hooks. Disable all update-related functions.
		if (!adminUpdate.includes('/* pg_admin_no_updates */')) {
			// Prepend a return-early to all functions that fetch updates
			const fns = [
				'wp_plugin_update_rows',
				'wp_plugin_update_row',
				'wp_theme_update_rows',
				'wp_theme_update_row',
				'wp_update_plugins',
				'wp_update_themes',
			];
			for (const fn of fns) {
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

	// Patch SimplePie to not make network calls.
	// SimplePie's file.php uses fsockopen/cURL to fetch RSS feeds.
	const simplePieFilePath = joinPaths(
		documentRoot,
		'wp-includes/SimplePie/File.php'
	);
	const simplePieOldPath = joinPaths(
		documentRoot,
		'wp-includes/class-simplepie.php'
	);
	for (const spPath of [simplePieFilePath, simplePieOldPath]) {
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
 * Prevents the WP installer from calling wp_mail() which crashes the
 * PHP 5.2 WASM runtime.
 *
 * ## The bug
 *
 * `wp_install()` calls `wp_new_blog_notification()` at the end of the
 * installation, which calls `wp_mail()`. PHP's `mail()` function
 * invokes sendmail/SMTP operations that trigger `unreachable` WASM
 * traps in the PHP 5.2 binary. The crash happens after all tables
 * and data are already created, so the installation succeeds but the
 * crash propagates as `RuntimeError: unreachable`.
 *
 * `disable_functions = 'mail'` prevents user-space calls to `mail()`,
 * but WordPress's pluggable `wp_mail()` catches the disabled function
 * and may still invoke PHPMailer's SMTP transport, which also crashes.
 *
 * ## The fix
 *
 * Replace `wp_new_blog_notification()` with a no-op in the upgrade
 * functions file. This is safe because the notification email can't
 * be delivered anyway in the WASM sandbox.
 */
async function patchWpInstallMailCrash(php: PHP, documentRoot: string) {
	// Disable functions that crash the PHP 5.2 WASM runtime during
	// WordPress installation:
	//
	// 1. wp_mail() — mail delivery is impossible in WASM and the
	//    underlying mail()/SMTP operations trigger `unreachable`
	//    WASM traps.
	//
	// 2. wp_install_maybe_enable_pretty_permalinks() (WP 3.0+) —
	//    makes an HTTP request via wp_remote_get() during install.
	//    Even with transports disabled, the HTTP infrastructure
	//    code path triggers WASM crashes.

	// Patch wp_mail() — in pluggable.php (WP 2.2+) or functions.php (WP 2.0-2.1)
	const mailFiles = [
		joinPaths(documentRoot, 'wp-includes/pluggable.php'),
		// WP 1.5-2.5 used pluggable-functions.php (renamed to
		// pluggable.php in WP 2.6).
		joinPaths(documentRoot, 'wp-includes/pluggable-functions.php'),
		joinPaths(documentRoot, 'wp-includes/functions.php'),
	];
	for (const filePath of mailFiles) {
		if (!php.fileExists(filePath)) {
			continue;
		}
		const content = php.readFileAsText(filePath);
		if (content.includes('/* pg_no_mail */')) continue;
		const idx = content.indexOf('function wp_mail(');
		if (idx === -1) continue;
		const braceIdx = content.indexOf('{', idx);
		if (braceIdx === -1) continue;
		await php.writeFile(
			filePath,
			content.substring(0, braceIdx + 1) +
				' /* pg_no_mail */ return true;' +
				content.substring(braceIdx + 1)
		);
	}

	// Patch functions in the upgrade/install files that crash the
	// PHP 5.2 WASM runtime during WordPress installation.
	const upgradeFiles = [
		joinPaths(documentRoot, 'wp-admin/includes/upgrade.php'),
		joinPaths(documentRoot, 'wp-admin/upgrade-functions.php'),
	];
	// Functions to make no-ops (return immediately) and the marker
	// comment used for idempotent patching.
	const noOpFunctions: Array<[string, string]> = [
		// Calls wp_mail() which invokes sendmail/SMTP → WASM crash.
		['function wp_new_blog_notification', 'pg_no_blog_notification'],
		// Makes HTTP request via wp_remote_get() → WASM crash.
		[
			'function wp_install_maybe_enable_pretty_permalinks',
			'pg_no_permalink_check',
		],
		// Calls mysql_get_server_info() with a fake handle → crash.
		['function wp_check_mysql_version', 'pg_no_mysql_check'],
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
 * Patches wp-load.php (WP 2.6+) to suppress E_STRICT and E_DEPRECATED.
 * wp-load.php sets error_reporting before wp-settings.php loads, so both
 * files need the same patch.
 */
async function patchErrorReportingInWpLoad(php: PHP, documentRoot: string) {
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	if (!php.fileExists(wpLoadPath)) return;
	let content = php.readFileAsText(wpLoadPath);
	if (!content.includes('error_reporting(')) return;
	if (content.includes('~8192') && content.includes('~2048')) return;
	content = content.replace(
		/error_reporting\(([^)]+)\)/g,
		(_match: string, flags: string) => {
			if (flags.includes('~8192') && flags.includes('~2048')) {
				return _match;
			}
			return `error_reporting((${flags}) & ~8192 & ~2048)`;
		}
	);
	await php.writeFile(wpLoadPath, content);
}

/**
 * Patches WP 1.0 and WP 1.2 admin templates to neutralise absolute
 * `http://wordpress.org` links that crash Playground.
 *
 * ## The bug
 *
 * Three locations contain absolute `http://wordpress.org` links:
 *
 * 1. WP 1.0's `wp-admin/menu.php` (header logo):
 *    ```html
 *    <h1 id="wphead"><a href="http://wordpress.org" ...>WordPress</a></h1>
 *    ```
 * 2. WP 1.2's `wp-admin/admin-header.php` (header logo):
 *    ```html
 *    <h1><a href="http://wordpress.org" rel="external" ...>WordPress</a></h1>
 *    ```
 * 3. Both versions' `wp-admin/admin-footer.php` (footer version badge):
 *    ```html
 *    <a href="http://wordpress.org">WordPress</a> 1.0.2 ...
 *    ```
 *
 * Clicking any of these causes the browser to navigate the scoped iframe
 * to `https://wordpress.org/`. WordPress.org sets `X-Frame-Options:
 * sameorigin`, so the browser refuses to embed it. Worse, the navigation
 * destroys the scoped iframe — leaving the Playground shell with no inner
 * frame, effectively crashing the entire Playground session.
 *
 * ## The fix
 *
 * Replace each offending `href="http://wordpress.org[/]"` with `href="#"`
 * in the three affected files. This keeps the visual elements intact while
 * preventing any navigation that would escape the Playground scope.
 *
 * Scoped to the exact literals that identify WP 1.0/1.2 templates; later
 * WP versions (1.5+) use a different template structure and are unaffected.
 */
async function patchWp10AdminLogoLink(php: PHP, documentRoot: string) {
	// WP 1.0: logo is the first line of menu.php
	const menuPhpPath = joinPaths(documentRoot, 'wp-admin/menu.php');
	if (php.fileExists(menuPhpPath)) {
		const content = php.readFileAsText(menuPhpPath);
		// Marker prevents double-patching (idempotent).
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

	// WP 1.2: logo is in admin-header.php body section.
	// The exact source line is:
	//   <h1><a href="http://wordpress.org" rel="external"
	//         title="<?php _e('Visit WordPress.org') ?>"><?php _e('WordPress') ?></a></h1>
	//
	// Note: the opening tag contains `?>` inside the title attribute,
	// so [^>]* would stop early at the `>` in `?>`. We locate the
	// anchor by finding its start/end string positions directly and
	// splice the replacement in without regex.
	const adminHeaderPath = joinPaths(
		documentRoot,
		'wp-admin/admin-header.php'
	);
	if (php.fileExists(adminHeaderPath)) {
		const content = php.readFileAsText(adminHeaderPath);
		// Marker prevents double-patching (idempotent).
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

	// WP 1.0 and WP 1.2: admin-footer.php contains version badge links.
	// WP 1.0 exact source:
	//   <strong><a href="http://wordpress.org">WordPress</a></strong>
	// WP 1.2 exact source:
	//   <a href="http://wordpress.org/">WordPress</a></strong>
	// Both are neutralised the same way.
	const adminFooterPath = joinPaths(
		documentRoot,
		'wp-admin/admin-footer.php'
	);
	if (php.fileExists(adminFooterPath)) {
		const content = php.readFileAsText(adminFooterPath);
		if (!content.includes('/* pg_wp10_footer_link */')) {
			// Match both WP 1.0 (no trailing slash) and WP 1.2 (with slash).
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
 * Patches WP 1.0, 1.2, and 1.5's `wp-admin/edit.php` so that post titles
 * in the "Edit Posts" list link to the edit form instead of the
 * front-end permalink (or to nothing, in WP 1.5's case).
 *
 * ## The bug
 *
 * WP 1.0's `edit.php` renders each post's title as:
 *
 * ```php
 * <strong><a href="<?php permalink_link(); ?>" rel="permalink"><?php the_title() ?></a></strong>
 * ```
 *
 * WP 1.2's `edit.php` renders it as:
 *
 * ```php
 * <td><a href="<?php the_permalink(); ?>" rel="permalink">
 * ```
 *
 * Both `permalink_link()` and `the_permalink()` output the front-end
 * URL (e.g. `http://127.0.0.1:5400/scope:xxx/2006/01/01/hello-world/`),
 * so clicking a title navigates away from the admin to the public-facing
 * post. Users reasonably expect clicking a post title in an admin post
 * list to open the edit form, not the front end.
 *
 * WP 1.5's `case 'title':` in `edit.php` renders the title as plain
 * text with no link at all:
 *
 * ```php
 * <td><?php the_title() ?>
 * <?php if ('private' == $post->post_status) _e(' - <strong>Private</strong>'); ?></td>
 * ```
 *
 * A separate "Edit" text link (`post.php?action=edit&post=$id`) exists
 * but is easy to miss. The title should be the primary affordance for
 * editing.
 *
 * ## The fix
 *
 * WP 1.0: Replace the `permalink_link()` call in the title `<strong>`
 * anchor with `post.php?action=edit&amp;post=<?php echo $id ?>`.
 *
 * WP 1.2: Replace the `the_permalink()` call in the table cell anchor
 * with the same edit URL. WP 1.2's loop variable for the post ID is
 * also `$id` (set by `start_wp()`).
 *
 * WP 1.5: Wrap the plain `the_title()` output in a link to
 * `post.php?action=edit&post=$id`. The `$id` variable is also set by
 * `start_wp()` in WP 1.5's loop.
 *
 * All variants remove `rel="permalink"` since the link no longer
 * points to the canonical URL.
 *
 * Scoped to `edit.php` files that contain the exact markup; later WP
 * versions (2.0+) use `wp_insert_post()` and a different template
 * structure and are unaffected.
 */
async function patchWp10EditPhpPostTitleLinks(php: PHP, documentRoot: string) {
	const editPhpPath = joinPaths(documentRoot, 'wp-admin/edit.php');
	if (!php.fileExists(editPhpPath)) return;

	const content = php.readFileAsText(editPhpPath);
	// Marker prevents double-patching (idempotent).
	if (content.includes('/* pg_wp10_post_title_edit */')) return;

	let patched = content;

	// WP 1.0: title wrapped in <strong>, href uses permalink_link().
	// Exact source string:
	//   <strong><a href="<?php permalink_link(); ?>" rel="permalink"><?php the_title() ?></a></strong>
	const needleWp10 =
		'<strong><a href="<?php permalink_link(); ?>" rel="permalink"><?php the_title() ?></a></strong>';
	if (patched.includes(needleWp10)) {
		patched = patched.replace(
			needleWp10,
			'<strong><a href="post.php?action=edit&amp;post=<?php echo $id /* pg_wp10_post_title_edit */ ?>"><?php the_title() ?></a></strong>'
		);
	}

	// WP 1.2: title in a <td>, href uses the_permalink().
	// Exact source string (with leading whitespace):
	//   <td><a href="<?php the_permalink(); ?>" rel="permalink">
	// The closing </a> is on a separate line so we only patch the
	// opening tag, which is sufficient to fix the href.
	const needleWp12 =
		'<td><a href="<?php the_permalink(); ?>" rel="permalink">';
	if (patched.includes(needleWp12)) {
		patched = patched.replace(
			needleWp12,
			'<td><a href="post.php?action=edit&amp;post=<?php echo $id /* pg_wp10_post_title_edit */ ?>">'
		);
	}

	// WP 1.5: title column has no link at all — just plain text.
	// Exact source (case 'title': block):
	//   <td><?php the_title() ?>
	//   <?php if ('private' == $post->post_status) _e(' - <strong>Private</strong>'); ?></td>
	// Wrap in an edit link using $id (set by start_wp()).
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
 * Patches WP 1.0's `wp-admin/post.php` so that newly created posts
 * receive a proper auto-incremented ID instead of ID=0.
 *
 * ## The bug
 *
 * WP 1.0's INSERT statement for new posts explicitly passes `'0'` as the
 * `ID` column value:
 *
 * ```sql
 * INSERT INTO wp_posts (ID, post_author, ...) VALUES ('0', ...)
 * ```
 *
 * In MySQL, inserting `0` into an `AUTO_INCREMENT` column is equivalent
 * to inserting `NULL` — MySQL ignores the zero and generates the next
 * sequence value. SQLite does not implement this behaviour: it stores the
 * literal value `0`, so every new post ends up with `ID = 0`. A second
 * insert then collides with the first, and even when it succeeds the
 * post-title links in `edit.php` render as `post=0`.
 *
 * ## The fix
 *
 * Replace `'0'` with `NULL` in the `VALUES` list of both INSERT variants
 * (with and without geo-position columns). SQLite treats `NULL` inserted
 * into an `INTEGER PRIMARY KEY` column as an auto-generate request,
 * which is the intended behaviour.
 *
 * Scoped to the exact literals present in WP 1.0's `post.php`; the
 * geo-positions branch and the plain branch are patched separately.
 */
async function patchWp10PostPhpInsertNullId(php: PHP, documentRoot: string) {
	const postPhpPath = joinPaths(documentRoot, 'wp-admin/post.php');
	if (!php.fileExists(postPhpPath)) return;
	const content = php.readFileAsText(postPhpPath);
	// Idempotency marker.
	if (content.includes('/* pg_wp10_insert_null_id */')) return;

	// Both INSERT variants in WP 1.0's post.php share the same VALUES prefix.
	// The geo-positions branch includes lat/lon columns; the plain branch does
	// not. Both use the same VALUES prefix `('0', '$user_ID', ...`, which is
	// the only place this literal appears.
	const needle = "('0', '$user_ID', '$now', '$content', '$post_title'";
	if (!content.includes(needle)) return;

	const patched = content.replaceAll(
		needle,
		"(NULL /* pg_wp10_insert_null_id */, '$user_ID', '$now', '$content', '$post_title'"
	);
	if (patched !== content) {
		await php.writeFile(postPhpPath, patched);
	}
}

/**
 * Patches WP 1.2's `wp-admin/post.php` so that newly created posts
 * receive a proper auto-incremented ID instead of ID=0.
 *
 * ## The bug
 *
 * Identical to the WP 1.0 issue: WP 1.2 explicitly inserts `'0'` as the
 * post `ID`, which MySQL silently turns into the next AUTO_INCREMENT value
 * but SQLite stores literally as `0`.
 *
 * ## The fix
 *
 * Replace `'0'` with `NULL` in both INSERT variants (plain and
 * geo-positions). The VALUES prefix in WP 1.2 differs from WP 1.0 because
 * it also includes `post_date_gmt`:
 *
 * ```sql
 * VALUES ('0', '$user_ID', '$now', '$now_gmt', '$content', ...)
 * ```
 *
 * Scoped to the exact string present only in WP 1.2's `post.php`.
 */
async function patchWp12PostPhpInsertNullId(php: PHP, documentRoot: string) {
	const postPhpPath = joinPaths(documentRoot, 'wp-admin/post.php');
	if (!php.fileExists(postPhpPath)) return;
	const content = php.readFileAsText(postPhpPath);
	// Idempotency marker.
	if (content.includes('/* pg_wp12_insert_null_id */')) return;

	// WP 1.2's VALUES prefix includes '$now_gmt' (missing in WP 1.0), making
	// this needle unique to WP 1.2.
	const needle =
		"('0', '$user_ID', '$now', '$now_gmt', '$content', '$post_title'";
	if (!content.includes(needle)) return;

	const patched = content.replaceAll(
		needle,
		"(NULL /* pg_wp12_insert_null_id */, '$user_ID', '$now', '$now_gmt', '$content', '$post_title'"
	);
	if (patched !== content) {
		await php.writeFile(postPhpPath, patched);
	}
}

/**
 * Patches WP 1.5's `wp-admin/post.php` to fix two SQL compatibility
 * issues that prevent saving posts under the SQLite integration.
 *
 * ## Bug 1: NULL post ID from SHOW TABLE STATUS
 *
 * WP 1.5's `wp-admin/post.php` determines the next post ID by querying:
 *
 * ```php
 * $id_result = $wpdb->get_row("SHOW TABLE STATUS LIKE '$wpdb->posts'");
 * $post_ID = $id_result->Auto_increment;
 * ```
 *
 * In MySQL, `SHOW TABLE STATUS` returns the next `AUTO_INCREMENT` value.
 * The SQLite integration implements this query but always returns
 * `Auto_increment = NULL` because SQLite has no AUTO_INCREMENT concept.
 *
 * With `$post_ID = NULL`, the INSERT becomes:
 * ```sql
 * INSERT INTO wp_posts (ID, ...) VALUES ('', ...)
 * ```
 * Inserting an empty string into an INTEGER PRIMARY KEY causes a
 * "datatype mismatch" SQLite error.
 *
 * **Fix:** After the lookup, add a fallback that computes the next ID
 * as `MAX(ID) + 1` when `Auto_increment` is NULL or zero.
 *
 * ## Bug 2: Missing NOT NULL columns in the INSERT
 *
 * The WP 1.5 `$postquery` INSERT omits `pinged` and
 * `post_content_filtered`. The `wp_posts` table created by the SQLite
 * integration has those columns as `NOT NULL` with a `NULL` default
 * (matching the MySQL schema where MySQL's lenient mode would accept
 * an empty value). Under the SQLite integration's strict mode this
 * raises a NOT NULL constraint violation.
 *
 * **Fix:** Append `pinged, post_content_filtered` to the column list
 * and the corresponding `'', ''` to the values list in `$postquery`.
 *
 * Both fixes are scoped to the exact strings present in WP 1.5's
 * `wp-admin/post.php`; later versions removed this code path.
 */
async function patchWp15AdminPostAutoIncrement(php: PHP, documentRoot: string) {
	const postPhpPath = joinPaths(documentRoot, 'wp-admin/post.php');
	if (!php.fileExists(postPhpPath)) return;
	let content = php.readFileAsText(postPhpPath);
	// Idempotency marker.
	if (content.includes('/* pg_wp15_post_id_fallback */')) return;

	// Fix 1: NULL Auto_increment from SHOW TABLE STATUS.
	// The exact two-line sequence that uniquely identifies the bug site.
	const needleAutoInc =
		'$id_result = $wpdb->get_row("SHOW TABLE STATUS LIKE \'$wpdb->posts\'");\n' +
		'\t$post_ID = $id_result->Auto_increment;';
	if (!content.includes(needleAutoInc)) return;
	content = content.replace(
		needleAutoInc,
		'$id_result = $wpdb->get_row("SHOW TABLE STATUS LIKE \'$wpdb->posts\'");\n' +
			'\t$post_ID = $id_result->Auto_increment;\n' +
			'\t// Playground fallback: SHOW TABLE STATUS returns Auto_increment = NULL\n' +
			'\t// on SQLite. Compute the next ID from MAX(ID) instead. /* pg_wp15_post_id_fallback */\n' +
			'\tif ( ! $post_ID ) {\n' +
			'\t\t$post_ID = (int) $wpdb->get_var("SELECT COALESCE(MAX(ID), 0) + 1 FROM $wpdb->posts");\n' +
			'\t}'
	);

	// Fix 2: Add missing NOT NULL columns to the $postquery INSERT.
	// WP 1.5's INSERT omits 'pinged' and 'post_content_filtered'.
	// The table schema (set up by the SQLite integration from the WP 2.x
	// schema) has both columns as NOT NULL with a NULL default, so
	// omitting them causes a NOT NULL constraint violation.
	const needleInsertCols =
		'(ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,  post_status, comment_status, ping_status, post_password, post_name, to_ping, post_modified, post_modified_gmt, post_parent, menu_order)';
	const needleInsertVals =
		"('$post_ID', '$post_author', '$now', '$now_gmt', '$content', '$post_title', '$excerpt', '$post_status', '$comment_status', '$ping_status', '$post_password', '$post_name', '$trackback', '$now', '$now_gmt', '$post_parent', '$menu_order')";
	if (
		content.includes(needleInsertCols) &&
		content.includes(needleInsertVals)
	) {
		content = content
			.replace(
				needleInsertCols,
				'(ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,  post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged, post_content_filtered, post_modified, post_modified_gmt, post_parent, menu_order)'
			)
			.replace(
				needleInsertVals,
				"('$post_ID', '$post_author', '$now', '$now_gmt', '$content', '$post_title', '$excerpt', '$post_status', '$comment_status', '$ping_status', '$post_password', '$post_name', '$trackback', '', '', '$now', '$now_gmt', '$post_parent', '$menu_order')"
			);
	}

	await php.writeFile(postPhpPath, content);
}

/**
 * Patches WP 2.1–2.6's `wp-includes/post.php` to always initialise
 * empty post dates to the current time, even for draft posts.
 *
 * ## The bug
 *
 * WP 2.1–2.2's `wp_insert_post()` contains:
 *
 * ```php
 * // If the post date is empty (due to having been new or a draft)
 * // and status is not 'draft', set date to now
 * if (empty($post_date)) {
 *     if ( 'draft' != $post_status )
 *         $post_date = current_time('mysql');
 * }
 * if (empty($post_date_gmt)) {
 *     if ( 'draft' != $post_status )
 *         $post_date_gmt = get_gmt_from_date($post_date);
 * }
 * ```
 *
 * WP 2.3 uses the same comment but an `in_array` guard without an else
 * branch:
 *
 * ```php
 * if (empty($post_date)) {
 *     if ( !in_array($post_status, array('draft', 'pending')) )
 *         $post_date = current_time('mysql');
 * }
 * if (empty($post_date_gmt)) {
 *     if ( !in_array($post_status, array('draft', 'pending')) )
 *         $post_date_gmt = get_gmt_from_date($post_date);
 * }
 * ```
 *
 * WP 2.5–2.6 uses the same `in_array` check but adds an explicit `else`
 * branch that stores `'0000-00-00 00:00:00'` for drafts:
 *
 * ```php
 * if (empty($post_date)) {
 *     if ( !in_array($post_status, array('draft', 'pending')) )
 *         $post_date = current_time('mysql');
 *     else
 *         $post_date = '0000-00-00 00:00:00';  // ← problem
 * }
 * if (empty($post_date_gmt)) {
 *     if ( !in_array($post_status, array('draft', 'pending')) )
 *         $post_date_gmt = get_gmt_from_date($post_date);
 *     else
 *         $post_date_gmt = '0000-00-00 00:00:00';  // ← problem
 * }
 * ```
 *
 * In all three cases, saving a post with `post_status = 'draft'` causes
 * `$post_date` and/or `$post_date_gmt` to end up as an empty string or
 * `'0000-00-00 00:00:00'`. The SQLite integration's datetime coercion
 * rejects these, throwing:
 *
 *   *Incorrect datetime value: '0000-00-00 00:00:00'* (or *''*)
 *
 * That causes `wp_insert_post()` to return `0`/`false`, producing a
 * blank "Write Post" page with no saved post and no error message.
 *
 * ## The fix
 *
 * Remove the inner draft-status guard (and any explicit zero-date `else`
 * branch) so that `$post_date` and `$post_date_gmt` are always set to
 * the current time when empty, regardless of `$post_status`.
 *
 * This is semantically harmless: the guard was intended to leave the
 * date unset for drafts (so MySQL would store a zero date), but the
 * SQLite integration rejects zero/empty dates. Using the current time
 * for draft posts matches the behaviour all subsequent WP versions
 * adopted.
 *
 * Three needle variants cover WP 2.1–2.2, WP 2.3, and WP 2.5–2.6 respectively.
 * WP 2.7+ adopted a different structure where `$post_date` is always
 * initialised but `$post_date_gmt` can still be zero for drafts;
 * `patchWp27InsertPostZeroDateGmt` handles that case.
 */
async function patchWp21InsertPostEmptyDates(php: PHP, documentRoot: string) {
	// WP 2.0 keeps wp_insert_post() in wp-includes/functions-post.php,
	// while WP 2.1+ moved it to wp-includes/post.php. Try both paths.
	const candidates = [
		joinPaths(documentRoot, 'wp-includes/post.php'),
		joinPaths(documentRoot, 'wp-includes/functions-post.php'),
	];
	const postPhpPath = candidates.find((p) => php.fileExists(p));
	if (!postPhpPath) return;
	let content = php.readFileAsText(postPhpPath);
	// Idempotency marker.
	if (content.includes('/* pg_wp21_insert_post_date */')) return;

	const replacement =
		'// Playground patch: always initialise empty dates, even for drafts.\n' +
		'\t// The original guard left $post_date empty for drafts, which the\n' +
		'\t// SQLite integration rejects as an invalid datetime value.\n' +
		'\t// /* pg_wp21_insert_post_date */\n' +
		'\tif (empty($post_date)) {\n' +
		"\t\t$post_date = current_time('mysql');\n" +
		'\t}\n' +
		'\n' +
		'\tif (empty($post_date_gmt)) {\n' +
		'\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
		'\t}';

	// WP 2.1–2.2 variant: `if ( 'draft' != $post_status )` guard, no else branch.
	const needleWp21 =
		"// If the post date is empty (due to having been new or a draft) and status is not 'draft', set date to now\n" +
		'\tif (empty($post_date)) {\n' +
		"\t\tif ( 'draft' != $post_status )\n" +
		"\t\t\t$post_date = current_time('mysql');\n" +
		'\t}\n' +
		'\n' +
		'\tif (empty($post_date_gmt)) {\n' +
		"\t\tif ( 'draft' != $post_status )\n" +
		'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
		'\t}';

	// WP 2.3 variant: `!in_array` guard, no else branch.
	const needleWp23 =
		"// If the post date is empty (due to having been new or a draft) and status is not 'draft', set date to now\n" +
		'\tif (empty($post_date)) {\n' +
		"\t\tif ( !in_array($post_status, array('draft', 'pending')) )\n" +
		"\t\t\t$post_date = current_time('mysql');\n" +
		'\t}\n' +
		'\n' +
		'\tif (empty($post_date_gmt)) {\n' +
		"\t\tif ( !in_array($post_status, array('draft', 'pending')) )\n" +
		'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
		'\t}';

	// WP 2.5–2.6 variant: same `!in_array` guard as WP 2.3 but WITH an
	// explicit `else $x = '0000-00-00 00:00:00'` branch for both fields.
	// The zero date in the else branch is the direct cause of the SQLite error.
	const needleWp25 =
		"// If the post date is empty (due to having been new or a draft) and status is not 'draft', set date to now\n" +
		'\tif (empty($post_date)) {\n' +
		"\t\tif ( !in_array($post_status, array('draft', 'pending')) )\n" +
		"\t\t\t$post_date = current_time('mysql');\n" +
		'\t\telse\n' +
		"\t\t\t$post_date = '0000-00-00 00:00:00';\n" +
		'\t}\n' +
		'\n' +
		'\tif (empty($post_date_gmt)) {\n' +
		"\t\tif ( !in_array($post_status, array('draft', 'pending')) )\n" +
		'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
		'\t\telse\n' +
		"\t\t\t$post_date_gmt = '0000-00-00 00:00:00';\n" +
		'\t}';

	if (content.includes(needleWp21)) {
		content = content.replace(needleWp21, replacement);
	} else if (content.includes(needleWp23)) {
		content = content.replace(needleWp23, replacement);
	} else if (content.includes(needleWp25)) {
		content = content.replace(needleWp25, replacement);
	} else {
		return;
	}

	await php.writeFile(postPhpPath, content);
}

/**
 * Patches `wp-includes/post.php` in WP 2.7–2.9 to avoid inserting a zero
 * `post_date_gmt` that the SQLite integration rejects in strict mode.
 *
 * ## The bug
 *
 * WP 2.7 restructured the date initialisation in `wp_insert_post()`.
 * `$post_date` is now always set to `current_time('mysql')` when empty:
 *
 * ```php
 * if ( empty($post_date) || '0000-00-00 00:00:00' == $post_date )
 *     $post_date = current_time('mysql');
 * ```
 *
 * However, `$post_date_gmt` still stores a zero value for draft/pending posts:
 *
 * ```php
 * if ( empty($post_date_gmt) || '0000-00-00 00:00:00' == $post_date_gmt ) {
 *     if ( !in_array( $post_status, array( 'draft', 'pending' ) ) )
 *         $post_date_gmt = get_gmt_from_date($post_date);
 *     else
 *         $post_date_gmt = '0000-00-00 00:00:00';  // ← problem
 * }
 * ```
 *
 * The SQLite integration is configured with `NO_ZERO_DATE` +
 * `STRICT_TRANS_TABLES` SQL modes active. Inserting `'0000-00-00 00:00:00'`
 * into a `DATETIME` column raises:
 *
 *   *Incorrect datetime value: '0000-00-00 00:00:00'*
 *
 * That error causes `wp_insert_post()` to return `false`. The form
 * submission to `post.php` then receives post ID 0, `redirect_post(0)`
 * sends the user back to `post-new.php` without a `?posted=` parameter,
 * and the page renders as a blank empty "Write Post" form — the user sees
 * no error and no confirmation that anything was saved.
 *
 * WP 2.7–2.9 use this two-space-indented, single-array variant.
 * WP 3.0 added `'auto-draft'` to the array — that pattern is already
 * covered by `patchWp41AutoDraftZeroDatetime`.
 *
 * ## The fix
 *
 * Replace the `'0000-00-00 00:00:00'` literal in the `else` branch with
 * `get_gmt_from_date($post_date)`, which always produces a valid datetime.
 * `$post_date` is guaranteed non-empty by this point, so this is safe.
 */
async function patchWp27InsertPostZeroDateGmt(php: PHP, documentRoot: string) {
	const postPhpPath = joinPaths(documentRoot, 'wp-includes/post.php');
	if (!php.fileExists(postPhpPath)) return;
	const content = php.readFileAsText(postPhpPath);
	// Idempotency marker.
	if (content.includes('/* pg_wp27_post_date_gmt */')) return;

	// WP 2.7–2.9: single-line post_date init (always set), then a braced
	// post_date_gmt block with draft/pending-only array (no 'auto-draft').
	// Indentation from WP 2.7 source: one tab throughout.
	const needle =
		"\tif ( empty($post_date_gmt) || '0000-00-00 00:00:00' == $post_date_gmt ) {\n" +
		"\t\tif ( !in_array( $post_status, array( 'draft', 'pending' ) ) )\n" +
		'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
		'\t\telse\n' +
		"\t\t\t$post_date_gmt = '0000-00-00 00:00:00';\n" +
		'\t}';
	if (!content.includes(needle)) return;

	const patched = content.replace(
		needle,
		"\tif ( empty($post_date_gmt) || '0000-00-00 00:00:00' == $post_date_gmt ) {\n" +
			"\t\tif ( !in_array( $post_status, array( 'draft', 'pending' ) ) )\n" +
			'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
			'\t\telse\n' +
			'\t\t\t$post_date_gmt = get_gmt_from_date($post_date); /* pg_wp27_post_date_gmt */\n' +
			'\t}'
	);
	if (patched !== content) {
		await php.writeFile(postPhpPath, patched);
	}
}

/**
 * Patches `wp-includes/post.php` in WP 3.1–4.1 to avoid inserting zero
 * datetime values that the SQLite integration rejects in strict mode.
 *
 * ## The bug
 *
 * `post-new.php` calls:
 *
 * ```php
 * $post = get_default_post_to_edit( $post_type, true );
 * ```
 *
 * The `$create_in_db = true` argument causes `get_default_post_to_edit()`
 * to persist the draft immediately via `wp_insert_post()`. Inside
 * `wp_insert_post()`, when the post status is `'auto-draft'` (or
 * `'draft'`/`'pending'`), WordPress deliberately stores a zero GMT
 * timestamp:
 *
 * WP 3.1–3.9 variant (tab-indented, braceless if/else):
 * ```php
 * if ( empty($post_date_gmt) || '0000-00-00 00:00:00' == $post_date_gmt ) {
 *     if ( !in_array( $post_status, array( 'draft', 'pending', 'auto-draft' ) ) )
 *         $post_date_gmt = get_gmt_from_date($post_date);
 *     else
 *         $post_date_gmt = '0000-00-00 00:00:00';  // ← problem
 * }
 * ```
 *
 * WP 4.0–4.1 variant (space-indented, braced if/else):
 * ```php
 * if ( ! in_array( $post_status, array( 'draft', 'pending', 'auto-draft' ) ) ) {
 *     $post_date_gmt = get_gmt_from_date( $post_date );
 * } else {
 *     $post_date_gmt = '0000-00-00 00:00:00';  // ← problem
 * }
 * ```
 *
 * The SQLite integration is configured with `NO_ZERO_DATE` +
 * `STRICT_TRANS_TABLES` SQL modes active. Inserting `'0000-00-00 00:00:00'`
 * into a `DATETIME` column raises:
 *
 *   *Incorrect datetime value: '0000-00-00 00:00:00'*
 *
 * That error causes `wp_insert_post()` to return `0`. `get_default_post_to_edit()`
 * then calls `get_post(0)`, which returns null. In `post-new.php`, `$post->ID`
 * is 0, so the post form renders with `post_ID=0`. When that form is
 * submitted, `post.php` processes it as an edit of post 0, and the
 * capability check `current_user_can('edit_post', 0)` fails even for admins
 * (post 0 doesn't exist), producing "You are not allowed to edit this post."
 * In WP 3.3–3.4, the nonce check for `update-post_0` also fails because the
 * nonce was generated for a real post ID.
 *
 * For WP 3.7–3.9, the same error also fires from the Quick Draft widget on
 * the dashboard, which calls `get_default_post_to_edit('post', true)` to
 * create an auto-draft for the quick-press form, producing a DB error and
 * silently discarding the published post.
 *
 * ## The fix
 *
 * Replace the `'0000-00-00 00:00:00'` literal in the `else` branch with
 * `get_gmt_from_date($post_date)`, which always produces a valid datetime.
 * This is safe: `$post_date` is guaranteed non-empty by this point, so
 * converting it to GMT never yields a zero date.
 *
 * Two needles handle the two code styles across WP versions:
 *   - WP 3.1–3.9: tab-indented braceless pattern
 *   - WP 4.0–4.1: space-indented braced pattern
 *
 * WP 4.2+ uses a completely rewritten `wp_insert_post()` that avoids the
 * zero-date, so no patch is needed there.
 */
async function patchWp41AutoDraftZeroDatetime(php: PHP, documentRoot: string) {
	const postPhpPath = joinPaths(documentRoot, 'wp-includes/post.php');
	if (!php.fileExists(postPhpPath)) return;
	const content = php.readFileAsText(postPhpPath);
	// Markers prevent double-patching (idempotent).
	if (
		content.includes('/* pg_wp41_auto_draft_gmt */') ||
		content.includes('/* pg_wp31_auto_draft_gmt */')
	) {
		return;
	}

	// WP 3.1–3.9: tab-indented, braceless if/else inside an outer
	// `if ( empty($post_date_gmt) || ... )` guard.
	// Indentation (confirmed from WP 3.1 source):
	//   ↓ one tab   if ( empty($post_date_gmt) || ... ) {
	//   ↓ two tabs      if ( !in_array( ... ) )
	//   ↓ three tabs        $post_date_gmt = get_gmt_from_date($post_date);
	//   ↓ two tabs      else
	//   ↓ three tabs        $post_date_gmt = '0000-00-00 00:00:00';
	//   ↓ one tab   }
	const needleWp31 =
		"\tif ( empty($post_date_gmt) || '0000-00-00 00:00:00' == $post_date_gmt ) {\n" +
		"\t\tif ( !in_array( $post_status, array( 'draft', 'pending', 'auto-draft' ) ) )\n" +
		'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
		'\t\telse\n' +
		"\t\t\t$post_date_gmt = '0000-00-00 00:00:00';\n" +
		'\t}';
	if (content.includes(needleWp31)) {
		const patched = content.replace(
			needleWp31,
			"\tif ( empty($post_date_gmt) || '0000-00-00 00:00:00' == $post_date_gmt ) {\n" +
				"\t\tif ( !in_array( $post_status, array( 'draft', 'pending', 'auto-draft' ) ) )\n" +
				'\t\t\t$post_date_gmt = get_gmt_from_date($post_date);\n' +
				'\t\telse\n' +
				'\t\t\t$post_date_gmt = get_gmt_from_date($post_date); /* pg_wp31_auto_draft_gmt */\n' +
				'\t}'
		);
		if (patched !== content) {
			await php.writeFile(postPhpPath, patched);
		}
		return;
	}

	// WP 4.0–4.1: space-indented, braced if/else.
	// Indentation uses real tab characters (as confirmed from WP 4.1 source):
	//   ↓ two tabs  if ( ! in_array(...) ) {
	//   ↓ three tabs    $post_date_gmt = get_gmt_from_date( $post_date );
	//   ↓ two tabs  } else {
	//   ↓ three tabs    $post_date_gmt = '0000-00-00 00:00:00';
	//   ↓ two tabs  }
	const needleWp41 =
		"if ( ! in_array( $post_status, array( 'draft', 'pending', 'auto-draft' ) ) ) {\n" +
		'\t\t\t$post_date_gmt = get_gmt_from_date( $post_date );\n' +
		'\t\t} else {\n' +
		"\t\t\t$post_date_gmt = '0000-00-00 00:00:00';\n" +
		'\t\t}';
	if (!content.includes(needleWp41)) return;
	const patched = content.replace(
		needleWp41,
		"if ( ! in_array( $post_status, array( 'draft', 'pending', 'auto-draft' ) ) ) {\n" +
			'\t\t\t$post_date_gmt = get_gmt_from_date( $post_date );\n' +
			'\t\t} else {\n' +
			'\t\t\t$post_date_gmt = get_gmt_from_date( $post_date ); /* pg_wp41_auto_draft_gmt */\n' +
			'\t\t}'
	);
	if (patched !== content) {
		await php.writeFile(postPhpPath, patched);
	}
}

/**
 * Patches WP 3.3's `wp-admin/includes/screen.php` to fix an invalid
 * `self::$this` reference in `WP_Screen::render_screen_meta()`.
 *
 * ## The bug
 *
 * WP 3.3.3's screen.php line 706 reads:
 *
 * ```php
 * <?php echo self::$this->_help_sidebar; ?>
 * ```
 *
 * This is a typo: `self::` resolves static members, and `$this` is
 * never a static property. Modern PHP (5.3+) raises a fatal error:
 * *"Access to undeclared static property: WP_Screen::$this"*. The
 * line sits inside `render_screen_meta()` — an instance method — so
 * the fix is to drop the `self::` qualifier.
 *
 * The fatal only fires when `$this->_help_sidebar` is non-empty.
 * `/wp-admin/post-new.php` triggers it because `edit-form-advanced.php`
 * calls `get_current_screen()->set_help_sidebar(...)` before the
 * admin header renders. Other admin pages that don't populate the
 * sidebar never enter the `if ($has_sidebar)` branch.
 *
 * WP 3.4 rewrote the method to use a local `$help_sidebar` variable
 * and never regressed, so this patch is scoped to WP 3.3 only via a
 * content check for the exact buggy expression.
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
 * Patches WP 2.1's `wp-admin/plugins.php` to guard the `in_array()`
 * call against a non-array `active_plugins` option value.
 *
 * ## The bug
 *
 * WP 2.1's plugins.php line 7 reads the active plugins list:
 *
 * ```php
 * $current = get_option('active_plugins');
 * ```
 *
 * And line 13 immediately passes it to `in_array()`:
 *
 * ```php
 * if (!in_array($plugin, $current)) {
 * ```
 *
 * When the `active_plugins` option has never been written (fresh
 * Playground install), `get_option()` returns an empty string `""`
 * instead of an array. PHP then emits:
 *
 *   *Warning: in_array() expects parameter 2 to be array, string given*
 *
 * WP 2.0 had an explicit sanity-check block immediately after the
 * page header that reset a non-array result to `[]` and persisted it.
 * That block was removed in WP 2.1 without a replacement guard at the
 * point of use, leaving both the `activate` and `deactivate` branches
 * vulnerable.
 *
 * WP 2.2 has the same code at line 13 and is patched here as well.
 * WP 2.3+ introduced `maybe_unserialize()` in `get_option()` which
 * ensures the stored value is always unserialized; the default for
 * `active_plugins` was also set to `array()` from then on.
 *
 * ## The fix
 *
 * After the `$current = get_option(...)` assignment, insert:
 *
 * ```php
 * if (!is_array($current)) $current = array();
 * ```
 *
 * This mirrors the sanity check WP 2.0 already had and is idempotent
 * (a real array value passes `is_array()` unchanged).
 */
async function patchWp21PluginsPhpInArray(php: PHP, documentRoot: string) {
	const pluginsPath = joinPaths(documentRoot, 'wp-admin/plugins.php');
	if (!php.fileExists(pluginsPath)) return;
	const content = php.readFileAsText(pluginsPath);
	// Marker prevents double-patching (idempotent).
	if (content.includes('/* pg_wp21_active_plugins_array */')) return;
	// Only patch the WP 2.1/2.2 variant: get_option() + in_array() with
	// no intervening array guard. WP 2.0 uses get_settings() and already
	// has its own sanity check; WP 2.3+ initialises the option correctly.
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
 * Patches WP 1.0's `wp-login.php` so manual logins work against the
 * MD5-stored admin password that the Playground seeds.
 *
 * ## The bug
 *
 * WP 1.0's `wp-login.php` checks the submitted password by running:
 *
 * ```php
 * $query = "SELECT ID, user_login, user_pass FROM $tableusers
 *           WHERE user_login = '$user_login' AND user_pass = '$password'";
 * ```
 *
 * i.e. it expects `user_pass` to be stored *in plaintext* and
 * compares it to the form-submitted password directly. Later on
 * (line ~98) the same expectation is echoed in an in-PHP check
 * `$login->user_pass == $password`.
 *
 * Playground seeds every legacy admin user with `MD5('password')`
 * because WP 1.2+ and the wider cookie-auth flow (wp_login /
 * $user_pass_md5 cookie validation) assume that format. Mixing the
 * two means WP 1.0's manual /wp-login.php form is rejected for the
 * admin user even though the seeded row is internally consistent
 * for every other auth path (mu-plugin auto-login, admin.php cookie
 * shimming, and WP 1.0's own cookie validator which explicitly
 * re-hashes user_pass).
 *
 * ## The fix
 *
 * Teach WP 1.0's `login()` function to also accept an already-MD5'd
 * password by wrapping both comparison sites in "or md5" fallbacks.
 * The SQL path becomes:
 *
 * ```php
 * WHERE user_login = '$user_login'
 *   AND (user_pass = '$password' OR user_pass = MD5('$password'))
 * ```
 *
 * and the PHP post-query check gains the matching `md5($password)`
 * branch. Both forms are still rejected when the submitted password
 * is wrong — the extra branch only accepts a correct plaintext
 * submission whose stored form happens to be the md5 hash.
 *
 * Scoped to WP 1.0 only via a content check for the exact `user_pass
 * = '$password'` SQL fragment that disappeared in WP 1.2 when
 * `wp_login()` moved into `wp-includes/functions.php`.
 */
async function patchWp10LoginPlaintextCompare(php: PHP, documentRoot: string) {
	const loginPath = joinPaths(documentRoot, 'wp-login.php');
	if (!php.fileExists(loginPath)) return;
	const content = php.readFileAsText(loginPath);
	// WP 1.0 signature: the inline login() function in wp-login.php
	// that runs the direct plaintext query. WP 1.2+ delegates to
	// wp_login() and never contains this exact substring.
	const sqlMarker = "AND user_pass = '$password'";
	if (!content.includes(sqlMarker)) return;
	if (content.includes('pg_wp10_plain_or_md5')) return;
	let patched = content.replace(
		sqlMarker,
		// pg_wp10_plain_or_md5: accept either the original plaintext
		// comparison or the md5-hashed form Playground seeds.
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

/**
 * Patches WP 2.0–2.2's install.php / upgrade-functions.php / admin-db.php
 * to stop inserting `cat_ID = '0'` into the categories table.
 *
 * ## The bug
 *
 * WP 2.0 creates the default "Uncategorized" term by calling:
 *
 * ```php
 * $wpdb->query("INSERT INTO $wpdb->categories (cat_ID, cat_name, ...)
 *               VALUES ('0', 'Uncategorized', ...)");
 * ```
 *
 * The `'0'` is intentional: MySQL treats an INSERT of `0` into an
 * `AUTO_INCREMENT` column as "please use the next auto-increment
 * value" unless the `NO_AUTO_VALUE_ON_ZERO` sql_mode flag is set.
 * The new row therefore gets `cat_ID = 1`.
 *
 * SQLite has no such special-case: an `INTEGER PRIMARY KEY AUTOINCREMENT`
 * column stores whatever value it's given, so the row ends up with
 * `cat_ID = 0`. Because the same row also has `category_parent = 0`,
 * `get_nested_categories()` in `wp-admin/admin-functions.php` recurses
 * on itself forever when rendering the category picker on
 * `/wp-admin/post.php`:
 *
 * ```php
 * $cats = return_categories_list($parent); // SELECT cat_ID WHERE category_parent = 0 → ['0']
 * foreach ($cats as $cat) {
 *     $result[$cat]['children'] = get_nested_categories($default, $cat); // loops forever
 * }
 * ```
 *
 * The infinite recursion never emits output, so PHP flushes the
 * headers sent so far (Content-Type from admin-header.php) and then
 * hangs — which the service worker surfaces as `ERR_FAILED` after
 * the 25 s request timeout.
 *
 * ## The fix
 *
 * Rewrite the offending `VALUES ('0', …)` expressions to
 * `VALUES (NULL, …)`. SQLite's primary key then auto-assigns a fresh
 * row id (1 for the first row), and MySQL behaves identically because
 * inserting `NULL` into an `AUTO_INCREMENT` column also triggers the
 * "next value" behavior.
 *
 * Scoped to install.php / upgrade-functions.php / admin-db.php only —
 * that's where the `cat_ID = '0'` pattern appears in WP 2.0–2.2.
 * WP 2.3+ replaced these direct INSERTs with helpers that pass NULL.
 */
async function patchLegacyWpCategoriesZeroPk(php: PHP, documentRoot: string) {
	const files = [
		// WP 2.0 inserts Uncategorized from install.php.
		joinPaths(documentRoot, 'wp-admin/install.php'),
		// WP 2.1/2.2 moved the insert to upgrade-functions.php.
		joinPaths(documentRoot, 'wp-admin/upgrade-functions.php'),
		// Used by wp_create_category() in WP 2.0–2.2 for every new
		// category added post-install.
		joinPaths(documentRoot, 'wp-admin/admin-db.php'),
	];
	// Match INSERT INTO <table>.categories (cat_ID, ...) VALUES ('0', ...)
	// and rewrite the leading '0' to NULL. Keep the match conservative
	// so we don't accidentally touch other INSERTs.
	const insertRe =
		/(INSERT INTO\s+[^`"']*?categories\s*\([^)]*\bcat_ID\b[^)]*\)\s*VALUES\s*\()\s*'0'\s*,/g;
	for (const path of files) {
		if (!php.fileExists(path)) continue;
		const content = php.readFileAsText(path);
		if (!insertRe.test(content)) continue;
		// Reset regex state (test() advances lastIndex on /g regexes).
		insertRe.lastIndex = 0;
		const patched = content.replace(insertRe, '$1NULL, ');
		if (patched !== content) {
			await php.writeFile(path, patched);
		}
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
 * Patches WP 1.0.2 SQL-emission bugs that break the SQLite
 * integration's AST parser.
 *
 * Two problems on WP 1.0.2:
 *
 * 1. wp-blog-header.php line 303 builds the main query with:
 *        $where .= ' AND (post_status = "publish"';
 *    MySQL accepts double quotes as string delimiters unless
 *    ANSI_QUOTES mode is enabled, but the SQLite integration's
 *    AST parser treats DOUBLE_QUOTED_TEXT as an identifier, not a
 *    string literal. The WHERE clause is rejected and every
 *    front-page request fails with "Failed to parse the MySQL
 *    query". Replace with single quotes, which the parser accepts
 *    as SINGLE_QUOTED_TEXT.
 *
 * 2. wp-includes/vars.php line 272 does:
 *        add_filter('all', 'wptexturize');
 *    This registers wptexturize as a callback on the "all" filter,
 *    which means EVERY apply_filters() call in WP 1.0.2 runs its
 *    input through wptexturize — including SQL date literals. The
 *    result is that 'publish' becomes &#8216;publish&#8217; (smart
 *    quotes) and the AST parser rejects the query. WP 1.2 fixed
 *    this by hooking wptexturize to specific content filters
 *    (the_content, the_title, etc.) instead of 'all'. Remove the
 *    'all' hook entirely — we lose pretty quotes in content but
 *    gain working SQL, which is a reasonable tradeoff for a
 *    20-year-old WP version.
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

	let settings = php.readFileAsText(wpSettingsPath);
	let settingsChanged = false;

	if (settings.includes("extension_loaded('mysql')")) {
		settings = settings.replace(
			/if\s*\(\s*!extension_loaded\('mysql'\)\s*\)\s*\n\s*die/,
			'if ( false ) // Patched for SQLite\n\tdie'
		);
		settingsChanged = true;
	}

	// Replace all error_reporting() calls with a version that
	// suppresses E_DEPRECATED (8192) and E_STRICT (2048).
	// Must use `& ~` (AND NOT), not `^` (XOR), because XOR
	// toggles bits — on PHP 5.2 where E_ALL doesn't include
	// E_STRICT, XOR would ENABLE it. Use numeric values because
	// PHP 5.2 doesn't define the E_DEPRECATED constant.
	{
		settings = settings.replace(
			/error_reporting\(([^)]+)\)/g,
			(_match, flags) => {
				// Already patched with & ~8192 & ~2048
				if (flags.includes('~8192') && flags.includes('~2048')) {
					return _match;
				}
				return `error_reporting((${flags}) & ~8192 & ~2048)`;
			}
		);
		settingsChanged = true;
	}

	// set_magic_quotes_runtime() removed in PHP 7.0.
	if (settings.includes('set_magic_quotes_runtime')) {
		settings = settings.replace(
			/set_magic_quotes_runtime\(\s*0\s*\)\s*;/g,
			'// set_magic_quotes_runtime(0); // Removed'
		);
		settingsChanged = true;
	}

	// get_magic_quotes_gpc() removed in PHP 8.0.
	if (
		settings.includes('get_magic_quotes_gpc()') &&
		!settings.includes("function_exists('get_magic_quotes_gpc')")
	) {
		settings = settings.replace(
			/get_magic_quotes_gpc\(\)/g,
			"(function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc())"
		);
		settingsChanged = true;
	}

	// "=& new" triggers compile-time E_DEPRECATED in PHP 5.3+.
	if (settings.includes('=& new') || settings.includes('=&new')) {
		settings = settings.replace(/=\s*&\s*new\b/g, '= new');
		settingsChanged = true;
	}

	// $HTTP_SERVER_VARS removed in PHP 5.4.
	if (settings.includes('$HTTP_SERVER_VARS')) {
		settings = settings.replace(/\$HTTP_SERVER_VARS/g, '$_SERVER');
		settingsChanged = true;
	}

	// WP_CONTENT_DIR missing in WP < 2.0.
	if (
		!settings.includes('WP_CONTENT_DIR') &&
		settings.includes("define('WPINC'")
	) {
		settings = settings.replace(
			/define\('WPINC',\s*'wp-includes'\);/,
			`define('WPINC', 'wp-includes');\nif (!defined('WP_CONTENT_DIR')) define('WP_CONTENT_DIR', ABSPATH . 'wp-content');`
		);
		settingsChanged = true;
	}

	// WP 2.5–3.x clears $wp_filter at the top of wp-settings.php
	// to prevent interference from register_globals. This also
	// destroys hooks set by the preload (auto_prepend_file) such
	// as the playground_load_mu_plugins hook. Remove $wp_filter
	// from the unset() call so the preload hooks survive.
	if (settings.includes('$wp_filter')) {
		const before = settings;
		settings = settings.replace(/unset\(\s*\$wp_filter\s*,/, 'unset(');
		if (settings !== before) {
			settingsChanged = true;
		}
	}

	// WP 1.x–2.x "not installed" die() check.
	{
		// The die() may be wrapped in sprintf/__()/etc. Match any
		// die(...installed WP...) by finding the balanced parens.
		// Simple approach: find "die(" before "installed WP" and
		// the matching ");" after it.
		const instIdx = settings.indexOf('installed WP');
		const dieStart = settings.lastIndexOf('die(', instIdx);
		let dieEnd = -1;
		if (dieStart !== -1) {
			let depth = 0;
			for (let i = dieStart + 3; i < settings.length; i++) {
				if (settings[i] === '(') depth++;
				if (settings[i] === ')') {
					depth--;
					if (depth === 0) {
						dieEnd = i + 1;
						// Include trailing semicolon
						if (settings[dieEnd] === ';') dieEnd++;
						break;
					}
				}
			}
		}
		const dieMatched =
			dieStart !== -1 && dieEnd !== -1
				? settings.substring(0, dieStart) +
					'true; /* die removed by Playground */' +
					settings.substring(dieEnd)
				: settings;
		if (dieMatched !== settings) {
			settings = dieMatched;
			settingsChanged = true;
		}
	}

	// WP 2.5–2.7 hooks wp_cron() and wp_version_check() to the
	// 'init' action. Both make outbound HTTP requests (fsockopen /
	// wp_remote_post) that crash the PHP 5.2 WASM runtime with
	// "null function or function signature mismatch".
	// WP 2.8+ moved these to scheduled events and added
	// DISABLE_WP_CRON. Old WP doesn't check that constant.
	// Fix: remove these specific hooks right before do_action('init')
	// runs. This is more reliable than patching individual files
	// because it works regardless of WP version differences.
	// WP 2.5–2.7 hooks functions that make outbound HTTP requests
	// (fsockopen / wp_remote_post) to the 'init' and 'admin_init'
	// actions. These crash the PHP 5.2 WASM runtime with "null
	// function or function signature mismatch" because fsockopen's
	// underlying socket calls can't work in WASM.
	// Remove all known network-calling hooks before they fire.
	if (settings.includes("do_action('init');")) {
		settings = settings.replace(
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
// Disable cURL and streams HTTP transports. The underlying
// libcurl/fsockopen crash the WASM runtime. WP 3.2+ checks
// these filters before using each transport.
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
		settingsChanged = true;
	}

	if (settingsChanged) {
		await php.writeFile(wpSettingsPath, settings);
	}
}

/** Patches wp-includes/functions.php. */
async function patchWpFunctionsPhp(php: PHP, documentRoot: string) {
	const functionsPhpPath = joinPaths(
		documentRoot,
		'wp-includes/functions.php'
	);
	if (!php.fileExists(functionsPhpPath)) return;

	let functionsPhp = php.readFileAsText(functionsPhpPath);
	let functionsPhpChanged = false;

	// WP 1.5: $all_options not initialized as object.
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

/** Patches wp-admin/install.php for old WP versions. */
async function patchWpInstallPhp(php: PHP, documentRoot: string) {
	const installPhpPath = joinPaths(documentRoot, 'wp-admin/install.php');
	if (!php.fileExists(installPhpPath)) return;

	let installPhp = php.readFileAsText(installPhpPath);
	let installPhpChanged = false;

	// Fix relative paths to absolute.
	if (
		installPhp.includes("'../wp-config.php'") ||
		installPhp.includes("'../wp-load.php'")
	) {
		const absAdminDir = joinPaths(documentRoot, 'wp-admin');
		const absRoot = documentRoot;
		installPhp = installPhp
			.replace(/'\.\.\/(wp-config\.php)'/g, `'${absRoot}/$1'`)
			.replace(/'\.\.\/(wp-load\.php)'/g, `'${absRoot}/$1'`)
			.replace(/'\.\/(upgrade-functions\.php)'/g, `'${absAdminDir}/$1'`)
			.replace(/'(upgrade-functions\.php)'/g, `'${absAdminDir}/$1'`)
			.replace(/'\.\/(includes\/upgrade\.php)'/g, `'${absAdminDir}/$1'`)
			.replace(/'\.\.\/(wp-includes\/[^']+)'/g, `'${absRoot}/$1'`);
		installPhpChanged = true;
	}

	// $HTTP_GET_VARS/$HTTP_POST_VARS removed in PHP 5.4.
	if (installPhp.includes('$HTTP_GET_VARS')) {
		installPhp = installPhp.replace(/\$HTTP_GET_VARS/g, '$_GET');
		installPhpChanged = true;
	}
	if (installPhp.includes('$HTTP_POST_VARS')) {
		installPhp = installPhp.replace(/\$HTTP_POST_VARS/g, '$_POST');
		installPhpChanged = true;
	}

	// WP 1.x multi-step installer: combine steps into single request.
	if (
		installPhp.includes('mysql_list_tables') &&
		installPhp.includes('switch($step)')
	) {
		installPhp = installPhp.replace(
			/^(if\s*\(isset\(\$_GET\['step'\]\)\)\s*\n\s*\$step\s*=\s*\$_GET\['step'\];\s*\n\s*else\s*\n\s*\$step\s*=\s*0;)/m,
			`$1\n// Playground: run all install steps in one request\nif ($step >= 1) $step = 1;`
		);
		installPhp = installPhp.replace(
			/^(\$step\s*=\s*\$_GET\['step'\];\s*\n\s*if\s*\(!\$step\)\s*\$step\s*=\s*0;)/m,
			`$1\n// Playground: run all install steps in one request\nif ($step >= 1) $step = 1;`
		);
		installPhp = installPhp.replace(
			/break;\s*\n(\s*case\s+2\s*:)/,
			'// break; // Playground: fall through\n$1'
		);
		installPhp = installPhp.replace(
			/break;\s*\n(\s*case\s+3\s*:)/,
			'// break; // Playground: fall through\n$1'
		);
		installPhpChanged = true;
	}

	if (installPhpChanged) {
		await php.writeFile(installPhpPath, installPhp);
	}
}

/** Patches wp-includes/wp-db.php (wpdb class). */
async function patchWpDbPhp(php: PHP, documentRoot: string) {
	const wpDbPath = joinPaths(documentRoot, 'wp-includes/wp-db.php');
	if (!php.fileExists(wpDbPath)) return;

	let wpDb = php.readFileAsText(wpDbPath);
	let wpDbChanged = false;

	// Guard $wpdb creation so the lazy loader isn't overwritten.
	if (
		wpDb.includes(
			'$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);'
		) &&
		!wpDb.includes('isset($wpdb)')
	) {
		wpDb = wpDb.replace(
			'$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);',
			'if ( !isset($wpdb) ) { $wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST); }'
		);
		wpDbChanged = true;
	}

	// Old wpdb (< 3.0) calls mysql_connect() inline — patch to
	// call db_connect() when available (i.e., WP_SQLite_DB).
	if (!wpDb.includes('db_connect')) {
		const mysqlConnectPattern =
			/\$this->dbh\s*=\s*@mysql_connect\(\$dbhost\s*,\s*\$dbuser\s*,\s*\$dbpassword(?:\s*,\s*true)?\);/;
		if (mysqlConnectPattern.test(wpDb)) {
			wpDb = wpDb.replace(
				mysqlConnectPattern,
				'if (method_exists($this, "db_connect")) { $this->dbname = $dbname; $this->db_connect(); } else { $this->dbh = @mysql_connect($dbhost, $dbuser, $dbpassword); }'
			);
			wpDbChanged = true;
		}
	}

	// Inject method polyfills for old wpdb classes.
	{
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
		if (polyfills.length > 0) {
			const classEndMatch = wpDb.match(
				/^(\s*})\s*\n+(\$wpdb|\?>\s*$|if\s*\(\s*!\s*isset\(\s*\$wpdb\s*\))/m
			);
			if (classEndMatch && classEndMatch.index !== undefined) {
				const polyfillBlock =
					'\n\t// Polyfills added by WordPress Playground.\n' +
					polyfills.join('\n') +
					'\n\n';
				wpDb =
					wpDb.substring(0, classEndMatch.index) +
					polyfillBlock +
					wpDb.substring(classEndMatch.index);
				wpDbChanged = true;
			}
		}
	}

	if (wpDbChanged) {
		await php.writeFile(wpDbPath, wpDb);
	}
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
	// Generic fix: replace all relative require/include statements in
	// wp-admin PHP files with dirname(__FILE__)-based absolute paths.
	// This handles WP 1.2 through 3.6 where many files use
	// './file.php' or '../file.php'.
	//
	// The emitted replacement is always in canonical form:
	// `./foo` → dirname(__FILE__) . '/foo'
	// `../foo` → dirname(dirname(__FILE__)) . '/foo'
	// `foo.php` → dirname(__FILE__) . '/foo.php'
	// (No literal './' or '../' survives in the output.)
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
				// ../path — parent directory (with parentheses)
				.replace(
					/((?:require|include)(?:_once)?)\s*\(\s*(['"])(\.\.\/[^'"]+)\2\s*\)/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// ./path — current directory (with parentheses)
				.replace(
					/((?:require|include)(?:_once)?)\s*\(\s*(['"])(\.\/[^'"]+)\2\s*\)/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Bare filename without ./ prefix (with parentheses)
				// (e.g. 'admin-header.php'). Only match filenames
				// ending in .php to avoid false positives.
				.replace(
					/((?:require|include)(?:_once)?)\s*\(\s*(['"])([a-z][\w-]*\.php)\2\s*\)/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Statement form without parentheses:
				//   require_once '../wp-config.php';
				//   require './admin.php';
				//   include 'admin-header.php';
				// WP 2.0 uses this form in several wp-admin files.
				// ../path (no parens)
				.replace(
					/((?:require|include)(?:_once)?)\s+(['"])(\.\.\/[^'"]+)\2/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// ./path (no parens)
				.replace(
					/((?:require|include)(?:_once)?)\s+(['"])(\.\/[^'"]+)\2/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Bare filename (no parens)
				.replace(
					/((?:require|include)(?:_once)?)\s+(['"])([a-z][\w-]*\.php)\2/g,
					(_, keyword, _q, path) =>
						`${keyword}(${toDirnameExpr(path)})`
				)
				// Fix ABSPATH . '/path' → ABSPATH . 'path'
				// (removes double slash)
				.replace(/ABSPATH\s*\.\s*'\/wp-/g, "ABSPATH . 'wp-");
			if (patched !== content) {
				await php.writeFile(filePath, patched);
			}
		}
	}

	// Specific patches for patterns the generic fix above can't handle
	// (e.g., require without parentheses, unusual spacing). The
	// replacement paths use `toDirnameExpr` to stay canonical (no
	// stray './' or '../' literals in the emitted PHP).
	const patches: Array<{ file: string; from: RegExp; to: string }> = [
		// WP < 2.6: require_once('../wp-config.php') in admin.php
		{
			file: 'wp-admin/admin.php',
			from: /require_once\s*\(\s*'\.\.\/wp-config\.php'\s*\)/,
			to: `require_once(${toDirnameExpr('../wp-config.php')})`,
		},
		// WP 2.6-2.9: require_once('../wp-load.php') in admin.php
		{
			file: 'wp-admin/admin.php',
			from: /require_once\s*\(\s*'\.\.\/wp-load\.php'\s*\)/,
			to: `require_once(${toDirnameExpr('../wp-load.php')})`,
		},
		// WP 3.0-3.6: require_once('./admin.php') in index.php and index-extra.php
		{
			file: 'wp-admin/index.php',
			from: /require_once\s*\(\s*'\.\/admin\.php'\s*\)/,
			to: `require_once(${toDirnameExpr('./admin.php')})`,
		},
		{
			file: 'wp-admin/index-extra.php',
			from: /require_once\s*\(\s*'\.\/admin\.php'\s*\)/,
			to: `require_once(${toDirnameExpr('./admin.php')})`,
		},
		// WP 3.0: require('./includes/dashboard.php') in index-extra.php
		{
			file: 'wp-admin/index-extra.php',
			from: /require\s*\(\s*'\.\/includes\/dashboard\.php'\s*\)/,
			to: `require(${toDirnameExpr('./includes/dashboard.php')})`,
		},
		// WP < 3.7: require[_once]('./admin-header.php') in index.php
		{
			file: 'wp-admin/index.php',
			from: /require(?:_once)?\s*\(\s*'\.\/admin-header\.php'\s*\)/,
			to: `require_once(${toDirnameExpr('./admin-header.php')})`,
		},
		// WP < 3.7: require[_once]('./admin-footer.php') in index.php
		{
			file: 'wp-admin/index.php',
			from: /require(?:_once)?\s*\(\s*'\.\/admin-footer\.php'\s*\)/,
			to: `require_once(${toDirnameExpr('./admin-footer.php')})`,
		},
		// WP 1.x: require('../wp-config.php') in index.php
		{
			file: 'wp-admin/index.php',
			from: /require\s*\(\s*'\.\.\/wp-config\.php'\s*\)/,
			to: `require(${toDirnameExpr('../wp-config.php')})`,
		},
	];

	for (const { file, from, to } of patches) {
		const filePath = joinPaths(documentRoot, file);
		if (!php.fileExists(filePath)) continue;
		const content = php.readFileAsText(filePath);
		if (from.test(content)) {
			await php.writeFile(filePath, content.replace(from, to));
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
 * Bypasses referer-based check_admin_referer() in WP < 2.5.
 *
 * In WP 1.2-1.5, check_admin_referer() verifies that
 * $_SERVER['HTTP_REFERER'] contains the siteurl. In Playground's
 * service worker environment, the Referer header is often missing
 * or incorrect, causing plugin activation and other admin actions
 * to fail with "you need to enable sending referrers".
 *
 * WP 2.5+ switched to nonce-based verification and doesn't need
 * this patch.
 */
async function patchCheckAdminReferer(php: PHP, documentRoot: string) {
	const adminFunctionsPath = joinPaths(
		documentRoot,
		'wp-admin/admin-functions.php'
	);
	if (!php.fileExists(adminFunctionsPath)) return;

	const content = php.readFileAsText(adminFunctionsPath);
	// Only patch the referer-based version (WP < 2.5).
	// The function body checks $_SERVER['HTTP_REFERER'] and die()s
	// if it doesn't contain the admin URL.
	if (
		!content.includes('function check_admin_referer()') ||
		!content.includes("$_SERVER['HTTP_REFERER']")
	) {
		return;
	}

	// The regex uses (?:[^{}]|\{[^}]*\})* instead of [^}]* to
	// handle one level of brace nesting. WP 1.2 wraps the die()
	// in an if-block with braces; WP 1.5 uses a braceless if.
	const patched = content.replace(
		/function check_admin_referer\(\)\s*\{(?:[^{}]|\{[^}]*\})*\$_SERVER\['HTTP_REFERER'\](?:[^{}]|\{[^}]*\})*\}/,
		`function check_admin_referer() {
	// Patched by Playground: skip referer check.
	// The Referer header is unreliable in the service worker
	// environment. The original function die()d when the header
	// was missing or didn't match the admin URL.
	do_action('check_admin_referer', '');
}`
	);
	if (patched !== content) {
		await php.writeFile(adminFunctionsPath, patched);
	}
}

/**
 * Patches the WP 1.5 admin dashboard to fix missing posts listing.
 *
 * WP 1.5's wp-admin/index.php queries recent posts with:
 *   post_date_gmt < '$today'
 * where $today = current_time('mysql', 1). This date comparison
 * can fail in SQLite when the post_date_gmt value is a zero date
 * ('0000-00-00 00:00:00') or when the SQLite driver doesn't
 * handle the comparison correctly. Remove the date condition so
 * the recent posts list displays on the dashboard.
 */
async function patchWpAdminDashboard(php: PHP, documentRoot: string) {
	const indexPhpPath = joinPaths(documentRoot, 'wp-admin/index.php');
	if (!php.fileExists(indexPhpPath)) return;

	let content = php.readFileAsText(indexPhpPath);
	let changed = false;

	// Remove the "AND post_date_gmt < '$today'" condition from
	// the recent posts query. The condition filters out future
	// scheduled posts, but the post_status = 'publish' check is
	// sufficient for the dashboard — scheduled posts have status
	// 'future' (WP 2.1+) or aren't published (WP 1.x).
	const dateCondition = /AND post_date_gmt < '\$today'/;
	if (dateCondition.test(content)) {
		content = content.replace(dateCondition, '');
		changed = true;
	}

	if (changed) {
		await php.writeFile(indexPhpPath, content);
	}

	// WP 1.5's rss-functions.php calls a global error() function
	// from fetch_rss() when the RSS fetch fails, but that function
	// is only defined as a method on the RSSCache class — not as a
	// standalone function. In Playground, outbound HTTP always fails
	// (no network), so every fetch_rss() call hits this path and
	// causes a fatal "Call to undefined function error()" that kills
	// the dashboard rendering mid-page. Define the missing stub.
	await patchRssFunctionsErrorStub(php, documentRoot);
}

/**
 * Defines a global error() function stub in rss-functions.php.
 *
 * WP 1.5's Magpie RSS library calls error() as a standalone function
 * from fetch_rss() and _response_to_rss(), but error() is only
 * defined as a method on the RSSCache class. When the RSS fetch
 * fails (which always happens in Playground — no outbound HTTP),
 * PHP hits "Call to undefined function error()" — a fatal error
 * that @ cannot suppress, killing the script mid-page.
 */
async function patchRssFunctionsErrorStub(php: PHP, documentRoot: string) {
	const rssPath = joinPaths(documentRoot, 'wp-includes/rss-functions.php');
	if (!php.fileExists(rssPath)) return;

	let content = php.readFileAsText(rssPath);
	// Only patch if the file calls error() as a standalone function
	// and doesn't already define a global error() function.
	if (
		!/^\s*error\s*\(/m.test(content) ||
		/^function\s+error\s*\(/m.test(content)
	) {
		return;
	}

	// Insert a global error() stub right after the opening <?php tag.
	content = content.replace(
		/^(<\?php\s*)/,
		`$1\n` +
			`// Playground patch: define a global error() stub.\n` +
			`// Magpie's fetch_rss() calls error() as a standalone\n` +
			`// function, but it's only defined as a class method.\n` +
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
 * Disables 1Password's inline autofill on the legacy wp-login.php form.
 *
 * 1Password's inline tooltip enters a tight inject/remove loop on
 * Playground's sandboxed iframes, flickering the UI and generating
 * thousands of cached `chrome-extension://.../inline-tooltip.css`
 * requests per second. The `data-1p-ignore` attribute is 1Password's
 * official opt-out mechanism — it tells the extension to skip these
 * fields entirely.
 */
async function patchWpLoginDisable1Password(php: PHP, documentRoot: string) {
	const loginPath = joinPaths(documentRoot, 'wp-login.php');
	if (!php.fileExists(loginPath)) return;

	let content = php.readFileAsText(loginPath);
	let changed = false;

	// Add data-1p-ignore to username and password inputs.
	for (const fieldName of ['log', 'pwd']) {
		const re = new RegExp(
			`(\\bname=(['"])${fieldName}\\2)(?!.*data-1p-ignore)`
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
 * Writes a mu-plugin that forces admin authentication for legacy PHP.
 *
 * On old WordPress (< 3.5), the auth cookies set during auto-login
 * may not validate correctly for the admin area. This mu-plugin
 * ensures the user is logged in for admin/login requests.
 *
 * IMPORTANT: This must only create a new session when the user is
 * NOT already authenticated. Creating a new session on every request
 * (via wp_set_auth_cookie) would generate a new session token each
 * time, breaking nonce verification — nonces embed the session token
 * from the request that rendered the form, and verification fails
 * when the token changes between form render and form submit.
 *
 * Written to wp-content/mu-plugins/ (real WP mu-plugins directory)
 * rather than /internal/shared/mu-plugins/ because the internal
 * mu-plugins load via the muplugins_loaded hook, which fires after
 * wp_get_mu_plugins() but may not work reliably on all old WP.
 */

async function ensureLegacyAdminAuth(php: PHP, documentRoot: string) {
	const muDir = joinPaths(documentRoot, 'wp-content/mu-plugins');
	if (!php.isDir(muDir)) {
		php.mkdir(muDir);
	}
	await php.writeFile(
		joinPaths(muDir, '0-legacy-admin-auth.php'),
		`<?php
if (!defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) return;
function playground_legacy_admin_auth() {
	if (empty($_SERVER['REQUEST_URI'])) return;
	if (strpos($_SERVER['REQUEST_URI'], 'wp-admin') === false &&
	    strpos($_SERVER['REQUEST_URI'], 'wp-login') === false) return;

	// If the user is already logged in via valid cookies, do nothing.
	// Re-authenticating on every request creates a new session token
	// (WP 4.0+), which invalidates nonces embedded in forms during
	// the previous request.
	if (function_exists('is_user_logged_in') && is_user_logged_in()) {
		return;
	}

	$username = PLAYGROUND_AUTO_LOGIN_AS_USER;

	// WP 2.5+ auth system: HMAC-based auth cookies.
	if (function_exists('wp_generate_auth_cookie')) {
		$user = function_exists('get_user_by')
			? get_user_by('login', $username)
			: (function_exists('get_userdatabylogin')
				? get_userdatabylogin($username) : null);
		if (!$user) return;

		wp_set_current_user($user->ID, $user->user_login);

		// Create a single session and set cookies via response
		// headers. This must only happen once per session — not on
		// every request — because each call generates a new session
		// token, which would invalidate nonces.
		if (!headers_sent()) {
			wp_set_auth_cookie($user->ID);
		}

		// On WP < 4.0, wp_set_auth_cookie() does not update $_COOKIE
		// in-process. auth_redirect() reads $_COOKIE to decide whether
		// to redirect to wp-login.php, so we must populate it manually.
		// Generate cookies with wp_generate_auth_cookie() — these have
		// no session token (pre-4.0) and validate for auth_redirect().
		if (!isset($_COOKIE[LOGGED_IN_COOKIE]) || empty($_COOKIE[LOGGED_IN_COOKIE])) {
			$expiration = time() + 172800;
			if (defined('AUTH_COOKIE'))
				$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'auth');
			if (defined('SECURE_AUTH_COOKIE'))
				$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'secure_auth');
			if (defined('LOGGED_IN_COOKIE'))
				$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'logged_in');
		}
		return;
	}

	// WP < 2.5 auth system: USER_COOKIE + PASS_COOKIE with
	// double-md5 hashed password. SECURITY NOTE: the admin password
	// was hardcoded to 'password' during legacy WP installation (see
	// the SQLite user-row seeding in this same file), so we hardcode
	// md5(md5('password')) here to match. The generated site only
	// exists inside the Playground WASM sandbox; there is no real
	// account to steal credentials for.
	if (defined('USER_COOKIE') && defined('PASS_COOKIE')) {
		$_COOKIE[USER_COOKIE] = $username;
		$_COOKIE[PASS_COOKIE] = md5(md5('password'));
		if (function_exists('wp_setcookie') && !headers_sent()) {
			wp_setcookie($username, 'password');
		}
	}
}
add_action('init', 'playground_legacy_admin_auth', 0);
`
	);
}

/**
 * Patches wp-admin/admin.php to inject auth cookie population before
 * auth_redirect(). This is needed for WP < 2.8 which doesn't have
 * mu-plugin support — the mu-plugin-based auth fix can't run.
 *
 * Inserts PHP code that populates $_COOKIE with valid auth cookies
 * right before the auth_redirect() call.
 */
async function patchAdminAuthRedirect(php: PHP, documentRoot: string) {
	// Bail out entirely on WP 2.8+ where mu-plugins handle auth.
	const wpSettingsPath = joinPaths(documentRoot, 'wp-settings.php');
	if (php.fileExists(wpSettingsPath)) {
		const settings = php.readFileAsText(wpSettingsPath);
		if (settings.includes('mu_plugin') || settings.includes('mu-plugin')) {
			return;
		}
	}

	// WP 2.0-2.7 path: patch wp-admin/admin.php before the
	// auth_redirect() call. WP 1.2 doesn't have admin.php — the
	// wp-admin/auth.php patch at the bottom of this function
	// handles that case and must run even when admin.php is missing.
	const adminPhpPath = joinPaths(documentRoot, 'wp-admin/admin.php');
	const content = php.fileExists(adminPhpPath)
		? php.readFileAsText(adminPhpPath)
		: '';
	const shouldPatchAdminPhp = content.includes('auth_redirect()');

	// For WP 2.5-2.7: modern auth with wp_generate_auth_cookie
	// For WP < 2.5: legacy auth with USER_COOKIE/PASS_COOKIE
	//
	// This code only runs on WP < 2.8 (no mu-plugin support).
	// Session tokens don't exist until WP 4.0, so generating
	// cookies with wp_generate_auth_cookie() here is safe — there
	// is no session token to mismatch. Nonces in WP < 4.0 only
	// depend on user ID, action, and secret keys.
	const authCode = `
// Playground: populate auth cookies and force admin user before auth_redirect.
if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) {
	// Skip if user is already logged in from the auto-login mu-plugin.
	if (function_exists('is_user_logged_in') && is_user_logged_in()) {
		// Still need $_COOKIE populated for auth_redirect().
		// On old WP, wp_set_auth_cookie() does not update $_COOKIE.
		if (function_exists('wp_generate_auth_cookie') && defined('LOGGED_IN_COOKIE') && empty($_COOKIE[LOGGED_IN_COOKIE])) {
			$_pg_uid = wp_get_current_user()->ID;
			$_pg_exp = time() + 172800;
			$_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($_pg_uid, $_pg_exp, 'auth');
			if (defined('SECURE_AUTH_COOKIE'))
				$_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($_pg_uid, $_pg_exp, 'secure_auth');
			$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($_pg_uid, $_pg_exp, 'logged_in');
		}
	} elseif (function_exists('wp_generate_auth_cookie')) {
		$_pg_user = function_exists('get_user_by')
			? get_user_by('login', PLAYGROUND_AUTO_LOGIN_AS_USER)
			: (function_exists('get_userdatabylogin')
				? get_userdatabylogin(PLAYGROUND_AUTO_LOGIN_AS_USER) : null);
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
	} elseif (defined('USER_COOKIE') && defined('PASS_COOKIE')) {
		// WP 2.0-2.4: double-md5 PASS_COOKIE with the sandbox admin
		// password ('password'). See SECURITY NOTE at the top of the
		// auto-login mu-plugin — this is only safe because the
		// generated site lives entirely inside the WASM sandbox.
		$_COOKIE[USER_COOKIE] = PLAYGROUND_AUTO_LOGIN_AS_USER;
		$_COOKIE[PASS_COOKIE] = md5(md5('password'));
		// Reset $current_user so get_currentuserinfo() re-evaluates
		// with the cookies we just set. On WP 2.0-2.4, kses_init()
		// fires during do_action('init') inside wp-settings.php and
		// calls get_currentuserinfo() when no cookies exist yet,
		// caching $current_user as WP_User(0). Without this reset,
		// the cached anonymous user persists and all capability
		// checks fail.
		$GLOBALS['current_user'] = null;
		if (function_exists('get_currentuserinfo')) {
			get_currentuserinfo();
		}
	} elseif (defined('COOKIEHASH')) {
		// WP 1.5-1.x: hardcoded cookie names without constants. The
		// same sandbox-only admin password ('password') applies here;
		// see the SECURITY NOTE in the auto-login mu-plugin for the
		// full rationale.
		$_COOKIE['wordpressuser_' . COOKIEHASH] = PLAYGROUND_AUTO_LOGIN_AS_USER;
		$_COOKIE['wordpresspass_' . COOKIEHASH] = md5(md5('password'));
	}
	// Force admin capabilities on the current user. The WP_User
	// object loads caps from the database. If populate_roles()
	// didn't run during install (e.g. WP 2.5 where the installer
	// may crash before writing roles), the user has no caps and
	// every current_user_can() check fails with "insufficient
	// permissions". Set caps directly in-memory so admin works.
	$_pg_cu = isset($GLOBALS['current_user']) ? $GLOBALS['current_user'] : null;
	if ($_pg_cu && isset($_pg_cu->ID) && $_pg_cu->ID > 0 && empty($_pg_cu->allcaps['read'])) {
		// Respect the user_level stored in the DB if one exists, so
		// a blueprint asking to auto-login as a lower-privilege user
		// doesn't silently get level 10 admin. Fall back to 10 only
		// when the field is absent (e.g. WP 2.0 installs where
		// populate_roles() never ran).
		$_pg_db_level = isset($_pg_cu->user_level)
			? (int) $_pg_cu->user_level
			: null;
		if ($_pg_db_level === null && isset($_pg_user) && $_pg_user) {
			$_pg_db_level = isset($_pg_user->user_level)
				? (int) $_pg_user->user_level
				: null;
		}
		$_pg_cu->user_level = $_pg_db_level !== null ? $_pg_db_level : 10;
		// Grant the capability set that corresponds to the resolved
		// user_level. On WP 2.0-2.7 capability names are level_N
		// markers plus the role-specific flags; we build the cap list
		// up to the effective level instead of unconditionally adding
		// level_10/administrator.
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
	if (shouldPatchAdminPhp) {
		const patched = content.replace(
			'auth_redirect();',
			authCode + 'auth_redirect();'
		);
		if (patched !== content) {
			await php.writeFile(adminPhpPath, patched);
		}
	}

	// WP 1.2: auth.php uses $cookiehash variable (not admin.php/auth_redirect).
	// Replace it with a stub that loads wp-config.php and pre-populates
	// the user globals so get_currentuserinfo() in wp-admin/index.php
	// sees an authenticated admin. Also set the wordpressuser_ cookie
	// so any downstream code that reads it still works.
	const authPhpPath = joinPaths(documentRoot, 'wp-admin/auth.php');
	if (php.fileExists(authPhpPath)) {
		const authPhp = php.readFileAsText(authPhpPath);
		if (
			authPhp.includes('$cookiehash') &&
			!authPhp.includes('Playground: bypass auth')
		) {
			const bypassedAuth = `<?php
require_once(ABSPATH . 'wp-config.php');
// Playground: bypass auth and manually populate user globals for
// WP 1.0-1.2. The original auth.php calls wp_login()/veriflog()
// with cookie values that Playground can't reliably set (the
// password cookie is an md5 of the stored pw and
// get_settings('siteurl') may not be stable during install).
// Short-circuit the cookie roundtrip by setting the cookies AND
// directly populating the user globals that get_currentuserinfo()
// would have set.
//
// Cookie-hash gotcha: WP 1.2 defines both the $cookiehash variable
// AND the COOKIEHASH constant; WP 1.0 only defines the $cookiehash
// variable. Check both so this stub works on either version, and
// compute our own fallback from the siteurl option if neither is
// available yet.
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
 * Patches admin-ajax.php to authenticate the user before the
 * is_user_logged_in() check.
 *
 * WP 2.5-2.7 admin-ajax.php loads wp-config.php directly (not via
 * admin.php), then checks is_user_logged_in() and dies with -1 if
 * the user isn't authenticated. Since WP < 2.8 has no mu-plugin
 * support, the Playground auth mu-plugin never loads. The preload
 * auto-login (1-auto-login.php) runs at init but only on the
 * *first* visit — subsequent requests (including AJAX) rely on
 * auth cookies that may not validate because they were generated
 * by wp_set_auth_cookie() during the first redirect.
 *
 * Fix: inject the same auth code used in patchAdminAuthRedirect()
 * before the is_user_logged_in() gate in admin-ajax.php.
 */
async function patchAdminAjaxAuth(php: PHP, documentRoot: string) {
	// Only needed on WP < 2.8 (no mu-plugin support).
	const wpSettingsPath = joinPaths(documentRoot, 'wp-settings.php');
	if (php.fileExists(wpSettingsPath)) {
		const settings = php.readFileAsText(wpSettingsPath);
		if (settings.includes('mu_plugin') || settings.includes('mu-plugin')) {
			return;
		}
	}

	const ajaxPhpPath = joinPaths(documentRoot, 'wp-admin/admin-ajax.php');
	if (!php.fileExists(ajaxPhpPath)) return;

	let content = php.readFileAsText(ajaxPhpPath);
	if (!content.includes('is_user_logged_in')) return;

	// Inject auth code before the is_user_logged_in() check.
	// Uses wp_set_current_user() + $_COOKIE population so that both
	// is_user_logged_in() and subsequent nonce checks succeed.
	const authCode = `
// Playground: authenticate admin user for AJAX requests.
// WP < 2.8 has no mu-plugin support, and admin-ajax.php doesn't
// go through admin.php, so no other auth mechanism applies here.
if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER')) {
	if (function_exists('wp_set_current_user') && function_exists('wp_generate_auth_cookie')) {
		$_pg_user = function_exists('get_user_by')
			? get_user_by('login', PLAYGROUND_AUTO_LOGIN_AS_USER)
			: (function_exists('get_userdatabylogin')
				? get_userdatabylogin(PLAYGROUND_AUTO_LOGIN_AS_USER) : null);
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
}
`;

	content = content.replace(
		/if\s*\(\s*!\s*is_user_logged_in\(\)\s*\)/,
		authCode + 'if ( !is_user_logged_in() )'
	);
	await php.writeFile(ajaxPhpPath, content);
}

/** Patches wp-admin/includes/schema.php for WP < 3.3. */
async function patchWpSchemaPhp(php: PHP, documentRoot: string) {
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
	return `<?php
// @playground-managed — Playground-generated db.php.
//
// WordPress < 3.0 loads ONLY db.php and skips wp-db.php
// entirely when db.php exists. We need the wpdb class
// definition from wp-db.php for the SQLite driver.
if (defined('ABSPATH') && defined('WPINC') && !class_exists('wpdb', false)) {
	require_once(ABSPATH . WPINC . '/wp-db.php');
}
// For old WordPress (< 3.0), load the SQLite integration directly
// from db.php and call reinitialize_sqlite(). Old wpdb has no
// db_connect() method; it does mysql_connect() inline, leaving
// $this->dbh as a boolean stub.
//
// Only do this for old WP: check if wpdb lacks db_connect()
// as a method defined in the class itself (not inherited).
// Modern WP (3.0+) uses the lazy $wpdb loader successfully.
if (
	class_exists('wpdb', false) &&
	isset($GLOBALS['wpdb']) &&
	!($GLOBALS['wpdb'] instanceof wpdb) &&
	!method_exists('wpdb', 'db_connect') &&
	file_exists('/internal/shared/mu-plugins/sqlite-database-integration.php')
) {
	// This block loads SQLite integration for old WP (< 3.0).
	require_once '/internal/shared/mu-plugins/sqlite-database-integration.php';
	if (
		isset($GLOBALS['wpdb']) &&
		$GLOBALS['wpdb'] instanceof wpdb &&
		method_exists($GLOBALS['wpdb'], 'reinitialize_sqlite')
	) {
		$GLOBALS['wpdb']->reinitialize_sqlite();
	}
}
//
// Polyfills for PHP functions used by the SQLite integration
// but missing on older PHP versions.
if (!function_exists('str_contains')) {
	function str_contains($haystack, $needle) {
		return $needle === '' || strpos($haystack, $needle) !== false;
	}
}
if (!function_exists('str_starts_with')) {
	function str_starts_with($haystack, $needle) {
		return strncmp($haystack, $needle, strlen($needle)) === 0;
	}
}
if (!function_exists('str_ends_with')) {
	function str_ends_with($haystack, $needle) {
		return $needle === '' || substr($haystack, -strlen($needle)) === $needle;
	}
}
// Provides MySQL/MySQLi function stubs so WordPress 4.x
// doesn't die on the extension_loaded() check.
// The actual SQLite database is set up by the
// 0-sqlite.php preload via auto_prepend_file.
//
// mysql_connect and mysql_select_db return truthy values because
// WordPress < 3.0 calls mysql_connect() directly in wpdb::__construct
// and dies on false. The return value is never used for real queries.
if (!function_exists('mysql_connect')) {
	function mysql_connect() { return true; }
}
if (!function_exists('mysql_select_db')) {
	function mysql_select_db() { return true; }
}
if (!function_exists('mysqli_connect')) {
	function mysqli_connect() { return true; }
}
if (!function_exists('mysqli_init')) {
	function mysqli_init() { return true; }
}
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
${MYSQL_SHIMS_PHP}
`;
}

/**
 * Runs post-install fixups for old WordPress versions.
 *
 * Two-stage approach:
 * 1. Load WordPress and fix data via $wpdb (admin password, seed content)
 * 2. PDO fallback that directly creates tables and seeds data when the
 *    WordPress-based fixup fails (WP 1.x where loading WP may crash)
 *
 * Stage 2 is gated to WP < 3.5: later versions install cleanly through
 * the AST SQLite driver and the PDO fallback would just pollute their
 * schema with stale WP 1.x-shaped tables that the driver never sees in
 * its information_schema.
 */
export async function runPostInstallLegacyFixups(
	php: PHP,
	siteUrl: string
): Promise<void> {
	// Parse the on-disk wp_version to decide whether stage 2 should run.
	let wpVersion: string | null = null;
	const versionPhp = joinPaths(php.documentRoot, 'wp-includes/version.php');
	if (php.fileExists(versionPhp)) {
		const m = php
			.readFileAsText(versionPhp)
			.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
		if (m) wpVersion = m[1];
	}
	const needsStage2 = wpVersion !== null && parseFloat(wpVersion) < 3.5;
	// Stage 1: wpdb-based fixups (loads WordPress)
	try {
		await php.run({
			code: `<?php
				// WP_INSTALLING allows bypassing WP 1.x's "not installed"
				// die() check in wp-settings.php.
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

				// Fix siteurl/home to match the Playground's scoped URL.
				// WP < 2.2 doesn't natively override get_option('siteurl')
				// with the WP_SITEURL constant (the preload env.php adds
				// option_siteurl/option_home filters to handle that).
				// The DB values must also contain the full scope path for
				// parse_request() to correctly strip the home path from
				// REQUEST_URI. Without this, the front page returns 404
				// because the scope prefix remains in the request path
				// and matches no rewrite rule.
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

				// Fix admin password for WP < 2.5.
				// Use $wpdb->users if available (WP 1.5+),
				// fall back to $table_prefix . 'users' (WP 1.2).
				$users_table = !empty($wpdb->users) ? $wpdb->users : $GLOBALS['table_prefix'] . 'users';

				// WP 1.2/1.0: the installer may fail to create the
				// users table or the admin user. Create both if missing.
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

				// Ensure WordPress roles exist and the admin user has
				// admin capabilities. The installer calls populate_roles()
				// but it may fail on SQLite. Set up roles and user caps
				// directly via database queries as a fallback.
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
					// Minimal administrator role with essential capabilities.
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
				// Set admin user capabilities and level in usermeta.
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

				// Seed default content when the posts table is empty.
				// Covers both old WP 1.5 (SQLite NOT NULL fix) and
				// WP 2.5+ where the install may have failed to seed
				// data due to SQLite compatibility issues.
				$posts_table = !empty($wpdb->posts) ? $wpdb->posts : $GLOBALS['table_prefix'] . 'posts';
				$has_posts = false;
				try { $has_posts = (bool)$wpdb->get_var("SELECT COUNT(*) FROM {$posts_table}"); } catch (Exception $e) {}
				if (!$has_posts) {
					$now = date('Y-m-d H:i:s');
					$now_gmt = gmdate('Y-m-d H:i:s');

					// Default category
					if (isset($wpdb->categories)) {
						$wpdb->query("INSERT INTO {$wpdb->categories} (cat_ID, cat_name, category_nicename, category_description, category_parent) VALUES (1, 'Uncategorized', 'uncategorized', '', 0)");
					}

					// Default post — use only basic columns that exist
					// in all WP versions (1.0+).
					$wpdb->query("INSERT INTO {$posts_table} (ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered) VALUES (1, 1, '{$now}', '{$now_gmt}', 'Welcome to WordPress. This is your first post. Edit or delete it, then start blogging!', 'Hello world!', '', 'publish', 'open', 'open', '', 'hello-world', '', '', '{$now}', '{$now_gmt}', '')");

					// Default comment
					if (isset($wpdb->comments)) {
						$wpdb->query("INSERT INTO {$wpdb->comments} (comment_post_ID, comment_author, comment_author_email, comment_author_url, comment_author_IP, comment_date, comment_date_gmt, comment_content, comment_karma, comment_approved, comment_agent, comment_type, comment_parent, user_id) VALUES (1, 'Mr WordPress', '', 'http://wordpress.org', '127.0.0.1', '{$now}', '{$now_gmt}', 'Hi, this is a comment. To delete a comment, just log in and view the post comments. There you will have the option to edit or delete them.', 0, '1', '', '', 0, 0)");
					}

					// Link post to category
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
		// Non-fatal: post-install fixups may fail on some WP versions
		logger.warn('Legacy WP post-install fixups failed (non-fatal):', error);
	}

	// Stage 2: PDO fallback for WP < 3.5 where loading WordPress may crash
	// or where the AST driver can't bootstrap the schema on its own.
	if (!needsStage2) return;
	try {
		await php.run({
			code: `<?php
				$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
				if (!is_dir($db_dir)) { @mkdir($db_dir, 0777, true); }
				$db_path = $db_dir . '.ht.sqlite';
				// Create database file if it doesn't exist yet
				// (the SQLite driver may have failed to initialize)
				$pdo = new PDO('sqlite:' . $db_path);
				$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

				// Check if admin user exists
				$prefix = 'wp_';
				$table = $prefix . 'users';
				try {
					$count = $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
				} catch (Exception $e) {
					// Table might not exist — create it
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
					// SECURITY NOTE: WP 1.0-1.2 stores a single-md5
					// password hash directly in the users table. We
					// seed the admin row with md5('password') so that
					// auto-login works without a blueprint-supplied
					// password. This is safe because the generated
					// site only runs inside the Playground WASM
					// sandbox and has no network-reachable login
					// surface; it is NOT safe to lift verbatim into
					// any real WordPress install.
					$pass = md5('password');
					try {
						// Build INSERT with defaults for ALL columns
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
					// See SECURITY NOTE above: the fixed 'password'
					// here is only ever written into the ephemeral
					// sandbox DB.
					$pass = md5('password');
					try { $pdo->exec("UPDATE {$table} SET user_pass = '{$pass}' WHERE user_login = 'admin'"); } catch (Exception $e) {}
				}

				// Create essential WP tables if missing. For WP 1.0-1.2,
				// the install may fail to create tables because the
				// SQLite driver can't process the old-style CREATE TABLE
				// through the WordPress query path.
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
				// Add missing columns to existing tables (for WP 1.0-1.2
				// where the install creates tables with fewer columns).
				$alter_cols = array(
					'categories' => array(
						'category_nicename' => "TEXT NOT NULL DEFAULT ''",
						'category_description' => "TEXT NOT NULL DEFAULT ''",
						'category_parent' => "INTEGER NOT NULL DEFAULT 0",
						'category_count' => "INTEGER NOT NULL DEFAULT 0",
					),
					// WP 1.5+ reads comment_count directly off wp_posts in
					// get_comments_number(). The WP 1.x legacy schemas above
					// don't include it, so back-fill the column if missing.
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
				// Seed default data — use dynamic column detection
				// to handle varying schemas across WP versions.
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
					// Always update siteurl/home to the scoped Playground
					// URL. preCreateLegacyTables seeds 'http://localhost'
					// which breaks CSS/JS paths when the actual URL has a
					// scope prefix.
					if ($env_site) {
						$pdo->exec("UPDATE {$prefix}options SET option_value = '{$env_site}' WHERE option_name = 'siteurl'");
						$pdo->exec("UPDATE {$prefix}options SET option_value = '{$env_site}' WHERE option_name = 'home'");
					}
					// Ensure template/stylesheet options exist. The WP
					// installer sets these via populate_options(), but if
					// the install crashes before that runs, WP can't find
					// any theme and the front page fatals.
					if (!$pdo->query("SELECT COUNT(*) FROM {$prefix}options WHERE option_name='template'")->fetchColumn()) {
						// Detect the first available theme directory.
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
					// Ensure db_version matches $wp_db_version from version.php.
					// Without this, WP 2.0-2.5 admin redirects to upgrade.php
					// with "Your database is out of date" because populate_options()
					// may have crashed before setting the correct db_version.
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
		// Non-fatal: PDO fallback may fail if SQLite isn't available
		logger.warn('Legacy WP PDO fallback failed (non-fatal):', error);
	}
}
