/**
 * Offline patcher: applies PHP 5.6 compatibility transformations to the
 * SQLite integration plugin. Produces a pre-patched zip that can be used
 * without runtime patching.
 *
 * Usage: node scripts/patch-sqlite-for-php56.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import {
	stripPhp7TypeDeclarations,
	replaceNullCoalescing,
	replacePhp7ErrorClasses,
} from '../packages/playground/wordpress/src/legacy-php-compat.ts';

const SRC_ZIP = path.resolve(
	'packages/playground/wordpress-builds/src/sqlite-database-integration/sqlite-database-integration-v2.2.22.zip'
);
const OUT_ZIP = path.resolve(
	'packages/playground/wordpress-builds/src/sqlite-database-integration/sqlite-database-integration-v2.2.22-php56.zip'
);
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-php56-patch-'));
try {
	execSync(`unzip -q "${SRC_ZIP}" -d "${TMP_DIR}"`);

	// Find all PHP files
	function findPhpFiles(dir) {
		const results = [];
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...findPhpFiles(full));
			} else if (entry.name.endsWith('.php')) {
				results.push(full);
			}
		}
		return results;
	}

	const phpFiles = findPhpFiles(TMP_DIR);
	let patchedCount = 0;

	for (const filePath of phpFiles) {
		let content = fs.readFileSync(filePath, 'utf-8');
		const original = content;

		content = stripPhp7TypeDeclarations(content);

		// Handle multi-line chains BEFORE general ?? replacement, because
		// the general regex can't see across lines and produces invalid PHP.
		//
		// Pattern A: $var = $obj\n ->m1()\n ->m2() ?? $fallback;
		// Match a method chain that starts with $obj and has newline-separated
		// ->method() calls, ending with ?? $fallback.
		content = content.replace(
			/(\$\w+)\s*=\s*(\$\w+(?:\s*\n\s*->\w+\([^)]*\))+)\s*\?\?\s*(\$\w+(?:->\w+\([^)]*\))?)\s*;/g,
			(_, varName, chain, fallback) => {
				return `$_nc_chain = ${chain};\n\t\t\t${varName} = $_nc_chain !== null ? $_nc_chain : ${fallback};`;
			}
		);
		// Pattern B: ($expr\n ?? $expr) — paren-wrapped multi-line ??
		content = content.replace(
			/\(\s*(\$\w+(?:->\w+\([^)]*\))*)\s*\n\s*\?\?\s*(\$\w+(?:->\w+\([^)]*\))*)\s*\)/g,
			(_, lhs, rhs) => {
				return `(($_nc_tmp = ${lhs}) !== null ? $_nc_tmp : ${rhs})`;
			}
		);

		content = replaceNullCoalescing(content);
		content = replacePhp7ErrorClasses(content);

		// Replace dirname(__DIR__, N) with nested dirname() calls
		content = content.replace(
			/dirname\(\s*__DIR__\s*,\s*(\d+)\s*\)/g,
			(_, levels) => {
				let r = '__DIR__';
				for (let i = 0; i < parseInt(levels, 10); i++) {
					r = `dirname(${r})`;
				}
				return r;
			}
		);

		// Rename 'throw' method (reserved word in PHP 5.6)
		content = content
			.replace(/function throw\(/g, 'function throwError(')
			.replace(/\$this->throw\(/g, '$this->throwError(')
			.replace(/self::throw\(/g, 'self::throwError(')
			// Update string references in method mapping arrays
			.replace(/'throw'(\s*=>\s*)'throw'/g, "'throw'$1'throwError'");

		// Make allow_unsafe_unquoted_parameters public so old WordPress
		// versions can access it without triggering Undefined property notices.
		content = content.replace(
			'private $allow_unsafe_unquoted_parameters = true;',
			'public $allow_unsafe_unquoted_parameters = true;'
		);

		// Guard calls to WP functions that may not exist in old WordPress.
		if (filePath.endsWith('class-wp-sqlite-db.php')) {
			// Guard apply_filters in query() (WP < 2.1)
			content = content.replace(
				"$query = apply_filters( 'query', $query );",
				"if ( function_exists( 'apply_filters' ) ) { $query = apply_filters( 'query', $query ); }"
			);
			// Guard apply_filters in set_sql_mode()
			content = content.replace(
				"$incompatible_modes = (array) apply_filters( 'incompatible_sql_modes', $this->incompatible_modes );",
				"$_modes = isset( $this->incompatible_modes ) ? $this->incompatible_modes : array();\n\t\t$incompatible_modes = function_exists( 'apply_filters' ) ? (array) apply_filters( 'incompatible_sql_modes', $_modes ) : (array) $_modes;"
			);
			// Guard wp_load_translations_early() in print_error() (WP < 3.4)
			content = content.replace(
				'wp_load_translations_early();',
				"if ( function_exists( 'wp_load_translations_early' ) ) { wp_load_translations_early(); }"
			);
		}

		// Guard is_multisite() and is_admin() calls (WP < 2.0 may lack them).
		content = content.replace(
			/if \( is_multisite\(\) \)/g,
			"if ( function_exists('is_multisite') && is_multisite() )"
		);
		content = content.replace(
			/if \( is_admin\(\) \)/g,
			"if ( function_exists('is_admin') && is_admin() )"
		);

		// Guard set_prefix call in information schema reconstructor (WP < 2.0).
		if (
			filePath.includes(
				'class-wp-sqlite-information-schema-reconstructor.php'
			)
		) {
			content = content.replace(
				'$wpdb->set_prefix( $table_prefix );',
				"if ( method_exists( $wpdb, 'set_prefix' ) ) { $wpdb->set_prefix( $table_prefix ); }"
			);
			// Work around the PHP 5.6 WASM parser bug for schema.php.
			// Try require_once first (works for WP 4.9 etc.). If it
			// fails (WASM bug for WP 2.5-2.8), fall back to eval.
			content = content.replace(
				"require_once ABSPATH . 'wp-admin/includes/schema.php';",
				"@require_once ABSPATH . 'wp-admin/includes/schema.php'; " +
					"if (!function_exists('wp_get_db_schema') && !isset($GLOBALS['wp_queries'])) " +
					"{ eval('?>' . file_get_contents(ABSPATH . 'wp-admin/includes/schema.php')); }"
			);
		}

		// Make information schema parse failures non-fatal for old WP schemas.
		if (
			filePath.includes(
				'class-wp-sqlite-information-schema-reconstructor.php'
			)
		) {
			content = content.replace(
				/throw new WP_SQLite_Driver_Exception\( \$this->driver, 'Failed to parse the MySQL query\.' \);/g,
				'return; // Non-fatal: old WP schema may not parse cleanly'
			);
		}

		// Replace wp_get_db_schema() calls with inline fallback for WP < 3.3.
		// Can't add a polyfill function because schema.php defines the real
		// one later, causing "Cannot redeclare".
		if (filePath.includes('install-functions.php')) {
			content = content.replace(
				'$table_schemas = wp_get_db_schema();',
				'$table_schemas = function_exists("wp_get_db_schema") ? wp_get_db_schema() : (isset($GLOBALS["wp_queries"]) ? $GLOBALS["wp_queries"] : "");'
			);
			// Skip the SQLite wp_install() override for old WordPress.
			// The SQLite version uses functions like update_user_meta()
			// that don't exist in WP < 3.0. Old WP's own wp_install()
			// works fine with the SQLite driver (CREATE TABLE queries
			// are translated by the AST driver).
			content = content.replace(
				"if ( ! function_exists( 'wp_install' ) ) {",
				"if ( ! function_exists( 'wp_install' ) && function_exists( 'update_user_meta' ) ) {"
			);
		}
		if (
			filePath.includes(
				'class-wp-sqlite-information-schema-reconstructor.php'
			)
		) {
			// Replace all wp_get_db_schema() calls (with or without args)
			// with an inline fallback that uses $wp_queries on old WP.
			// Replace specific known call patterns
			const fallback =
				'(isset($GLOBALS["wp_queries"]) ? $GLOBALS["wp_queries"] : "")';
			content = content
				.replace(
					"wp_get_db_schema( 'global' )",
					`(function_exists("wp_get_db_schema") ? wp_get_db_schema( 'global' ) : ${fallback})`
				)
				.replace(
					/wp_get_db_schema\( 'blog', \(int\) \$blog_id \)/g,
					`(function_exists("wp_get_db_schema") ? wp_get_db_schema( 'blog', (int) $blog_id ) : ${fallback})`
				)
				.replace(
					"wp_get_db_schema( 'blog' )",
					`(function_exists("wp_get_db_schema") ? wp_get_db_schema( 'blog' ) : ${fallback})`
				);
			// Remove the "function was not defined" exception
			content = content.replace(
				/if \( ! function_exists\( 'wp_get_db_schema' \) \) \{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s,
				'// wp_get_db_schema polyfill handled inline'
			);
		}

		// Add placeholder_escape polyfills to WP_SQLite_DB for WordPress < 4.8.3.
		// The parent wpdb class only gained these methods in WP 4.8.3, but
		// WP_SQLite_DB::_real_escape() calls add_placeholder_escape().
		if (
			filePath.endsWith('class-wp-sqlite-db.php') &&
			!content.includes('function add_placeholder_escape')
		) {
			const polyfill = `

	/**
	 * Polyfill for wpdb::placeholder_escape() (added in WP 4.8.3).
	 */
	public function placeholder_escape() {
		static $placeholder;
		if ( ! $placeholder ) {
			$algo = function_exists( 'hash' ) ? 'sha256' : 'sha1';
			$salt = defined( 'AUTH_SALT' ) && AUTH_SALT ? AUTH_SALT : (string) rand();
			$placeholder = '{' . hash_hmac( $algo, uniqid( $salt, true ), $salt ) . '}';
		}
		return $placeholder;
	}

	/**
	 * Polyfill for wpdb::add_placeholder_escape() (added in WP 4.8.3).
	 */
	public function add_placeholder_escape( $query ) {
		return str_replace( '%', $this->placeholder_escape(), $query );
	}

	/**
	 * Polyfill for wpdb::remove_placeholder_escape() (added in WP 4.8.3).
	 */
	public function remove_placeholder_escape( $query ) {
		return str_replace( $this->placeholder_escape(), '%', $query );
	}


	// Polyfills for wpdb methods missing in WordPress < 2.0.
	// These are no-op stubs that prevent fatal errors.
	public function get_caller() {
		if ( method_exists( get_parent_class( $this ), 'get_caller' ) ) {
			return parent::get_caller();
		}
		return '';
	}
	public function log_query( $query, $elapsed, $caller, $start = 0.0, $data = array() ) {
		if ( method_exists( get_parent_class( $this ), 'log_query' ) ) {
			return parent::log_query( $query, $elapsed, $caller, $start, $data );
		}
		if ( !isset( $this->queries ) ) { $this->queries = array(); }
		$this->queries[] = array( $query, $elapsed, $caller );
	}

	// Properties that old wpdb (< 3.0) doesn't declare as class members.
	// Declaring them here prevents "Undefined property" notices.
	public $insert_id = 0;
	public $num_rows = 0;
	public $last_result = array();
	public $last_error = '';
	public $last_query = null;
	public $rows_affected = 0;
	public $col_info = null;
	public $result = null;
	public $incompatible_modes = array();
	public $dbname = null;

	/**
	 * Re-initialize the SQLite driver for old WordPress (< 3.0).
	 *
	 * Old wpdb::__construct() calls mysql_connect() inline instead
	 * of db_connect(), leaving $this->dbh as a boolean stub.
	 * This method resets $this->dbh and initializes the driver.
	 */
	public function reinitialize_sqlite() {
		if ( $this->dbh instanceof WP_SQLite_Driver || $this->dbh instanceof WP_SQLite_Translator ) {
			return;
		}
		if ( empty( $this->dbname ) && defined( 'DB_NAME' ) ) {
			$this->dbname = DB_NAME;
		}
		if ( !isset( $this->last_result ) ) {
			$this->last_result = array();
		}
		// Ensure table prefix is set before db_connect(), because
		// the information schema reconstructor uses $wpdb->tables
		// properties that are only set after set_prefix().
		global $table_prefix;
		if ( isset( $table_prefix ) && empty( $this->prefix ) && method_exists( $this, 'set_prefix' ) ) {
			$this->set_prefix( $table_prefix );
		}
		// Set an empty wp_queries so the information schema
		// reconstructor doesn't crash on old WP during db_connect().
		// NOTE: db_connect() triggers require_once schema.php which
		// sets $wp_queries to the real schema. Don't unset it after.
		if ( !isset( $GLOBALS['wp_queries'] ) ) {
			$GLOBALS['wp_queries'] = '';
		}
		$this->dbh = null;
		$this->db_connect();
	}

	/**
	 * Polyfill for wpdb::init_charset() (added in WP 4.2).
	 */
	public function init_charset() {
		if ( method_exists( get_parent_class( $this ), 'init_charset' ) ) {
			parent::init_charset();
		} elseif ( defined( 'DB_CHARSET' ) ) {
			$this->charset = DB_CHARSET;
		}
	}
`;
			// Insert before the closing brace of the class
			const lastBrace = content.lastIndexOf('}');
			content =
				content.slice(0, lastBrace) +
				polyfill +
				content.slice(lastBrace);
		}

		// Fix WP_SQLite_DB::prepare() — it uses __get() and ReflectionProperty
		// on wpdb::$allow_unsafe_unquoted_parameters which doesn't exist in
		// old WordPress (added in WP 6.2). Also, __get() doesn't exist in
		// WP < 4.8.3, and calling an undefined method is a fatal error in
		// PHP 5.6 (can't be caught with try-catch).
		content = content.replace(
			/\$wpdb_allow_unsafe_unquoted_parameters = \$this->__get\( 'allow_unsafe_unquoted_parameters' \);\s*\n\s*if \( \$wpdb_allow_unsafe_unquoted_parameters !== \$this->allow_unsafe_unquoted_parameters \) \{\s*\n\s*\$property = new ReflectionProperty\([^}]+\}/s,
			"if ( method_exists( $this, '__get' ) ) {\n\t\t\ttry {\n\t\t\t\t$wpdb_allow_unsafe_unquoted_parameters = $this->__get( 'allow_unsafe_unquoted_parameters' );\n\t\t\t\tif ( $wpdb_allow_unsafe_unquoted_parameters !== $this->allow_unsafe_unquoted_parameters ) {\n\t\t\t\t\t$property = new ReflectionProperty( 'wpdb', 'allow_unsafe_unquoted_parameters' );\n\t\t\t\t\t$property->setAccessible( true );\n\t\t\t\t\t$property->setValue( $this, $this->allow_unsafe_unquoted_parameters );\n\t\t\t\t\t$property->setAccessible( false );\n\t\t\t\t}\n\t\t\t} catch (Exception $e) { /* Old WP lacks this property */ }\n\t\t\t}"
		);

		// Fix specific complex expressions that regex can't handle.
		// (ternary)['key'] ?? '' — array access on ternary result + null coalescing
		content = content.replace(
			/\(isset\(\$meta\['sqlite:decl_type'\]\) \? \$meta\['sqlite:decl_type'\] : \$meta\)\['native_type'\] \?\? ''/g,
			"(isset($meta['sqlite:decl_type']) ? (isset($meta['sqlite:decl_type']['native_type']) ? $meta['sqlite:decl_type']['native_type'] : '') : (isset($meta['native_type']) ? $meta['native_type'] : ''))"
		);

		if (content !== original) {
			fs.writeFileSync(filePath, content);
			patchedCount++;
			console.log(`  Patched: ${path.relative(TMP_DIR, filePath)}`);
		}
	}

	console.log(`\nPatched ${patchedCount}/${phpFiles.length} files`);

	// Re-zip
	if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);
	execSync(`cd "${TMP_DIR}" && zip -r -q "${OUT_ZIP}" .`);
	console.log(`\nCreated: ${OUT_ZIP}`);

	// Verify: check for remaining ??
	const remaining = execSync(
		`grep -rn '??' "${TMP_DIR}" --include='*.php' || true`
	).toString();
	if (remaining.trim()) {
		console.log('\nWARNING: Remaining ?? operators:');
		console.log(remaining);
	} else {
		console.log('\nNo remaining ?? operators — all patched.');
	}
} finally {
	fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
