/**
 * Offline patcher: transforms the upstream SQLite database integration
 * plugin into a PHP 5.2-compatible variant.
 *
 * Pipeline:
 *
 *   1. Unzip `sqlite-database-integration-v3.0.0-rc.3.zip` to a temp dir.
 *   2. Run `scripts/php52-downgrader/bin/downgrade.php` over the dir.
 *      The downgrader is an AST-based pipeline built on nikic/php-parser
 *      v5 that handles every mechanical PHP 7+ -> 5.2 rewrite — type
 *      declarations, null-coalescing, short arrays, closures, etc.
 *   3. Apply a small set of per-file surgical fixes for shapes that
 *      don't survive a pure AST round-trip (PHP_VERSION_ID-gated
 *      traits, ReflectionProperty access, WP compatibility polyfills,
 *      etc.).
 *   4. Re-zip to `sqlite-database-integration-v3.0.0-rc.3-php52.zip`.
 *
 * Usage: node scripts/patch-sqlite-for-php52.mjs
 *
 * Requires a host PHP 7.4+ binary (`php` on PATH) to run the AST
 * downgrader, plus `composer` to install the downgrader's own
 * dependencies the first time. The `vendor/` directory is not
 * committed — running this script will `composer install` from
 * `scripts/php52-downgrader/composer.lock` if `vendor/autoload.php`
 * is missing.
 *
 * The compiled SQLite plugin and its PHP 5.2 WASM runtime have no
 * dependency on this script at runtime — the generated zip is
 * committed and served as-is by the build.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import {
	getSqliteIntegrationZipPath,
	registerSqliteIntegrationVersion,
} from '../packages/playground/wordpress-builds/build/sqlite-integration-registry.js';

const REPO_ROOT = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	'..'
);
const SQLITE_PLUGIN_VERSION = 'v3.0.0-rc.3';
const SQLITE_PHP52_PLUGIN_VERSION = `${SQLITE_PLUGIN_VERSION}-php52`;
const SQLITE_DIR = path.join(
	REPO_ROOT,
	'packages/playground/wordpress-builds/src/sqlite-database-integration'
);
const SRC_ZIP = getSqliteIntegrationZipPath(SQLITE_DIR, SQLITE_PLUGIN_VERSION);
const OUT_ZIP = getSqliteIntegrationZipPath(
	SQLITE_DIR,
	SQLITE_PHP52_PLUGIN_VERSION
);
const DOWNGRADER_DIR = path.join(REPO_ROOT, 'scripts/php52-downgrader');
const DOWNGRADER = path.join(DOWNGRADER_DIR, 'bin/downgrade.php');
const DOWNGRADER_AUTOLOAD = path.join(DOWNGRADER_DIR, 'vendor/autoload.php');

function ensureDowngraderVendor() {
	if (fs.existsSync(DOWNGRADER_AUTOLOAD)) {
		return;
	}
	console.log('Installing downgrader dependencies (composer install)...');
	const result = spawnSync(
		'composer',
		['install', '--no-dev', '--no-interaction', '--no-progress'],
		{ cwd: DOWNGRADER_DIR, stdio: 'inherit' }
	);
	if (result.status !== 0) {
		throw new Error(
			`composer install failed in ${DOWNGRADER_DIR}. ` +
				`The PHP 5.2 downgrader needs its composer deps installed. ` +
				`Ensure 'composer' is on PATH and re-run this script.`
		);
	}
}

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-php52-patch-'));
try {
	ensureDowngraderVendor();
	execSync(`unzip -q "${SRC_ZIP}" -d "${TMP_DIR}"`);

	// Run the AST downgrader. It walks every .php/.copy file and
	// rewrites in place.
	const pluginRoot = fs
		.readdirSync(TMP_DIR, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => path.join(TMP_DIR, e.name))[0];
	if (!pluginRoot) {
		throw new Error('zip did not contain a plugin subdirectory');
	}
	console.log('Running AST downgrader...');
	const result = spawnSync('php', [DOWNGRADER, pluginRoot], {
		stdio: ['ignore', 'inherit', 'inherit'],
	});
	if (result.status !== 0) {
		throw new Error(
			`downgrader failed (exit ${result.status}). ` +
				`Requires a host PHP 7.4+ binary named 'php' on PATH.`
		);
	}

	// Apply per-file surgical fixes that can't be expressed as AST
	// transforms. These run AFTER the downgrader, so they operate on
	// the pretty-printed PHP 5.2-compatible output.
	console.log('Applying surgical fixes...');
	let surgicalCount = 0;
	const files = findFiles(pluginRoot);
	for (const filePath of files) {
		const rel = path.relative(pluginRoot, filePath);
		let content = fs.readFileSync(filePath, 'utf-8');
		const original = content;

		// Rename the reserved `throw` method. AST visitor already
		// handles the class definition + call sites, but inline
		// references in array literals (`'throw' => 'throw'`) and
		// string comparisons slip past — patch those here too.
		content = content.replace(
			/'throw'(\s*=>\s*)'throw'/g,
			"'throw'$1'throwError'"
		);

		// Widen `$allow_unsafe_unquoted_parameters` visibility from
		// `private` to `public`. Legacy WordPress (<4.8.3) reads this
		// property on wpdb-shaped objects through plain `->property`
		// access — not `$this->` — so `protected` would still error on
		// PHP 5.2 with "Cannot access protected property". Public is
		// therefore the minimum viable relaxation. In-process code
		// inside the WASM sandbox can flip this flag, but the
		// Playground iframe is a single-trust boundary and the only
		// consumer of this build.
		content = content.replace(
			'private $allow_unsafe_unquoted_parameters = true;',
			'public $allow_unsafe_unquoted_parameters = true;'
		);

		// Guard WP function calls that may not exist in old WordPress.
		// These are WordPress-version dependent, not PHP-version
		// dependent, so they can't live in the AST downgrader.
		if (filePath.endsWith('class-wp-sqlite-db.php')) {
			content = content.replace(
				"$query = apply_filters('query', $query);",
				"if ( function_exists( 'apply_filters' ) ) { $query = apply_filters( 'query', $query ); }"
			);
			content = content.replace(
				"$incompatible_modes = (array) apply_filters('incompatible_sql_modes', $this->incompatible_modes);",
				"$_modes = isset( $this->incompatible_modes ) ? $this->incompatible_modes : array();\n\t\t$incompatible_modes = function_exists( 'apply_filters' ) ? (array) apply_filters( 'incompatible_sql_modes', $_modes ) : (array) $_modes;"
			);
			content = content.replace(
				'wp_load_translations_early();',
				"if ( function_exists( 'wp_load_translations_early' ) ) { wp_load_translations_early(); }"
			);
		}

		content = content.replace(
			/if \( is_multisite\(\) \)/g,
			"if ( function_exists('is_multisite') && is_multisite() )"
		);
		content = content.replace(
			/if \(is_multisite\(\)\)/g,
			"if ( function_exists('is_multisite') && is_multisite() )"
		);
		content = content.replace(
			/if \( is_admin\(\) \)/g,
			"if ( function_exists('is_admin') && is_admin() )"
		);
		content = content.replace(
			/if \(is_admin\(\)\)/g,
			"if ( function_exists('is_admin') && is_admin() )"
		);

		if (
			filePath.includes(
				'class-wp-sqlite-information-schema-reconstructor.php'
			)
		) {
			content = content.replace(
				'$wpdb->set_prefix( $table_prefix );',
				"if ( method_exists( $wpdb, 'set_prefix' ) ) { $wpdb->set_prefix( $table_prefix ); }"
			);
			// Load wp-admin/includes/schema.php so `wp_get_db_schema()`
			// becomes available on the legacy WP install path.
			//
			// The @require_once + eval fallback looks odd but is load-
			// bearing:
			//
			//   1. `@require_once` suppresses E_STRICT / E_DEPRECATED
			//      warnings that pre-3.5 WordPress emits when its
			//      legacy schema.php runs under PHP 5.2 (strict-mode
			//      method signatures, reassigning $this in globals,
			//      etc.). Without the @, the include trips a strict
			//      warning that aborts the legacy install chain.
			//
			//   2. Some legacy WP branches (pre-3.1) `require` or
			//      `include` schema.php elsewhere in their bootstrap.
			//      When that happens before reconstruction runs,
			//      `require_once` here is a no-op and
			//      `wp_get_db_schema()` can STILL be undefined —
			//      because the earlier include landed inside a
			//      function scope that doesn't expose top-level
			//      functions, or because the earlier file path
			//      differs by normalization and PHP's resolved-file
			//      cache doesn't treat the two includes as the same.
			//      The `eval('?>' . file_get_contents(...))` branch
			//      forces the file's global definitions to run a
			//      second time in the current scope and is the only
			//      thing that reliably defines `wp_get_db_schema()`
			//      on WP 2.x–3.0.
			//
			// DO NOT simplify to a plain `require_once` — doing so
			// causes the pre-3.1 install to silently no-op writes,
			// leaving a 0-byte SQLite file and every subsequent
			// request landing on wp-admin/install.php. (The plain-
			// require_once variant also collides with the
			// `wp_get_db_schema` `function_exists` guard regex below.)
			//
			// In-sandbox only: the PHP file system is the ephemeral
			// WASM VFS, so a `file_get_contents()` + eval on ABSPATH
			// is a local-only bootstrap, not a supply-chain surface.
			content = content.replace(
				"require_once ABSPATH . 'wp-admin/includes/schema.php';",
				"@require_once ABSPATH . 'wp-admin/includes/schema.php'; " +
					"if (!function_exists('wp_get_db_schema') && !isset($GLOBALS['wp_queries'])) " +
					"{ eval('?>' . file_get_contents(ABSPATH . 'wp-admin/includes/schema.php')); }"
			);
			content = content.replace(
				/throw new WP_SQLite_Driver_Exception\(\s*\$this->driver,\s*'Failed to parse the MySQL query\.'\s*\);/g,
				'return; // Non-fatal: old WP schema may not parse cleanly'
			);
			const fallback =
				'(isset($GLOBALS["wp_queries"]) ? $GLOBALS["wp_queries"] : "")';
			content = content
				.replace(
					"wp_get_db_schema('global')",
					`(function_exists("wp_get_db_schema") ? wp_get_db_schema( 'global' ) : ${fallback})`
				)
				.replace(
					/wp_get_db_schema\('blog', \(int\) \$blog_id\)/g,
					`(function_exists("wp_get_db_schema") ? wp_get_db_schema( 'blog', (int) $blog_id ) : ${fallback})`
				)
				.replace(
					"wp_get_db_schema('blog')",
					`(function_exists("wp_get_db_schema") ? wp_get_db_schema( 'blog' ) : ${fallback})`
				);
			content = content.replace(
				/if \(\s*!\s*function_exists\(\s*'wp_get_db_schema'\s*\)\s*\) \{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s,
				'// wp_get_db_schema polyfill handled inline'
			);
		}

		if (filePath.includes('install-functions.php')) {
			content = content.replace(
				'$table_schemas = wp_get_db_schema();',
				'$table_schemas = function_exists("wp_get_db_schema") ? wp_get_db_schema() : (isset($GLOBALS["wp_queries"]) ? $GLOBALS["wp_queries"] : "");'
			);
			content = content.replace(
				"if (!function_exists('wp_install')) {",
				"if ( ! function_exists( 'wp_install' ) && function_exists( 'update_user_meta' ) ) {"
			);
		}

		// Add placeholder_escape + wpdb polyfills (for WP < 4.8.3).
		if (
			filePath.endsWith('class-wp-sqlite-db.php') &&
			!content.includes('function add_placeholder_escape')
		) {
			const polyfill = `

	public function placeholder_escape() {
		static $placeholder;
		if ( ! $placeholder ) {
			$algo = function_exists( 'hash' ) ? 'sha256' : 'sha1';
			$salt = defined( 'AUTH_SALT' ) && AUTH_SALT ? AUTH_SALT : (string) rand();
			$placeholder = '{' . hash_hmac( $algo, uniqid( $salt, true ), $salt ) . '}';
		}
		if ( function_exists( 'add_filter' )
			&& function_exists( 'has_filter' )
			&& false === has_filter( 'query', array( $this, 'remove_placeholder_escape' ) )
		) {
			add_filter( 'query', array( $this, 'remove_placeholder_escape' ), 0 );
		}
		return $placeholder;
	}
	public function add_placeholder_escape( $query ) {
		return str_replace( '%', $this->placeholder_escape(), $query );
	}
	public function remove_placeholder_escape( $query ) {
		return str_replace( $this->placeholder_escape(), '%', $query );
	}
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
		global $table_prefix;
		if ( isset( $table_prefix ) && empty( $this->prefix ) && method_exists( $this, 'set_prefix' ) ) {
			$this->set_prefix( $table_prefix );
		}
		if ( !isset( $GLOBALS['wp_queries'] ) ) {
			$GLOBALS['wp_queries'] = '';
		}
		$this->dbh = null;
		$this->db_connect();
	}
	public function init_charset() {
		if ( method_exists( get_parent_class( $this ), 'init_charset' ) ) {
			parent::init_charset();
		} elseif ( defined( 'DB_CHARSET' ) ) {
			$this->charset = DB_CHARSET;
		}
	}
`;
			// Find the WP_SQLite_DB class body's closing brace. The
			// AST downgrader appends helper functions after the class,
			// so lastIndexOf('}') would land inside a helper — walk
			// the braces from the class declaration instead.
			const classIdx = content.indexOf('class WP_SQLite_DB');
			if (classIdx === -1) {
				throw new Error(
					'class WP_SQLite_DB not found in class-wp-sqlite-db.php'
				);
			}
			const classOpen = content.indexOf('{', classIdx);
			const classClose = findMatchingBrace(content, classOpen);
			content =
				content.slice(0, classClose) +
				polyfill +
				content.slice(classClose);
		}

		// Fix WP_SQLite_DB::prepare() ReflectionProperty access. The
		// wpdb `allow_unsafe_unquoted_parameters` property only
		// appeared in WP 6.2. Reflecting on an absent property throws
		// ReflectionException — wrap in a try/catch.
		content = content.replace(
			/\$wpdb_allow_unsafe_unquoted_parameters = \$this->__get\(\s*'allow_unsafe_unquoted_parameters'\s*\);\s*\n\s*if \(\s*\$wpdb_allow_unsafe_unquoted_parameters !== \$this->allow_unsafe_unquoted_parameters\s*\) \{\s*\n\s*\$property = new ReflectionProperty\([^}]+\}/s,
			"if ( method_exists( $this, '__get' ) ) {\n\t\t\ttry {\n\t\t\t\t$wpdb_allow_unsafe_unquoted_parameters = $this->__get( 'allow_unsafe_unquoted_parameters' );\n\t\t\t\tif ( $wpdb_allow_unsafe_unquoted_parameters !== $this->allow_unsafe_unquoted_parameters ) {\n\t\t\t\t\t$property = new ReflectionProperty( 'wpdb', 'allow_unsafe_unquoted_parameters' );\n\t\t\t\t\t$property->setAccessible( true );\n\t\t\t\t\t$property->setValue( $this, $this->allow_unsafe_unquoted_parameters );\n\t\t\t\t\t$property->setAccessible( false );\n\t\t\t\t}\n\t\t\t} catch (Exception $e) { /* Old WP lacks this property */ }\n\t\t\t}"
		);

		// PDO\SQLite / PDO\MySQL — namespace-qualified class references
		// inside `instanceof` that PHP 5.2 can't even parse. Replace
		// the whole instanceof with `false` (PHP 5.2 can never be PDO\X).
		content = content.replace(
			/\$\w+\s+instanceof\s+PDO\\(?:SQLite|MySQL)/g,
			'false'
		);

		// `WP_SQLite_Driver::__set('main_db_name', $value)` and
		// `quote_mysql_utf8_string_literal()` use `Closure::call()` to
		// access private members of the inner mysql_on_sqlite_driver.
		// PHP 5.2 has no closures; the AST hoist produces a string
		// helper name, so the original `$closure->call(...)` syntax
		// becomes a "method call on non-object" fatal at runtime.
		//
		// Both proxies exist for tests only. The driver constructor
		// fires `$this->main_db_name = $database` which triggers the
		// magic `__set` because `main_db_name` is not declared on the
		// driver class — that's the call path that crashes legacy WP
		// boot. Declare a real public `$main_db_name` property on
		// WP_SQLite_Driver so the assignment lands on a regular slot
		// instead of going through `__set`, then neutralise both
		// proxy bodies so they can never invoke the broken closures.
		if (filePath.endsWith('class-wp-sqlite-driver.php')) {
			// Add a real `public $main_db_name` property right after
			// the class declaration. Anchored on the
			// `mysql_on_sqlite_driver` proxy property which the
			// downgrader leaves as the first declared field.
			content = content.replace(
				/(class WP_SQLite_Driver\b[^{]*\{)/,
				'$1\n    public $main_db_name = null;'
			);
			// Replace the broken `__set` body for `main_db_name`
			// with a direct field assignment. The remaining magic
			// for other property names is fine (it still throws via
			// the closure path, but no caller hits it during boot).
			// Use [\s\S]*? (non-greedy any-including-newline) for the
			// _pg52_set_capture(...) argument list because it contains
			// nested parentheses (the captures `array(...)`).
			content = content.replace(
				/if \('main_db_name' === \$name\) \{\s*\$closure = _pg52_set_capture\([\s\S]*?\);\s*\$closure->call\(\$this->mysql_on_sqlite_driver, \$value\);\s*\}/,
				`if ('main_db_name' === \$name) {
            \$this->main_db_name = \$value;
            // Best-effort: also set on the inner driver if it exposes
            // the slot publicly. PHP 5.2 has no Closure::bind, so we
            // can't reach private fields from here.
            if (property_exists(\$this->mysql_on_sqlite_driver, 'main_db_name')) {
                @\$this->mysql_on_sqlite_driver->main_db_name = \$value;
            }
        }`
			);
			// Replace the broken `quote_mysql_utf8_string_literal`
			// proxy body with a no-op fallback. It's only used by
			// the same closure-based path which never works on PHP
			// 5.2; the inner driver's own private copy is what
			// production code actually uses.
			content = content.replace(
				/(private function quote_mysql_utf8_string_literal\(\$utf8_literal\)\s*\{)\s*\$closure = _pg52_set_capture\([\s\S]*?\);\s*return \$closure->call\(\$this->mysql_on_sqlite_driver, \$utf8_literal\);\s*\}/,
				`$1
        // PHP 5.2: no Closure::call(); fall back to a naive escape.
        // The inner driver's own private copy is what production code
        // hits — this proxy only exists for tests.
        return "'" . str_replace("'", "''", \$utf8_literal) . "'";
    }`
			);
		}

		// Exception::__construct only takes 2 params in PHP 5.2
		// (PHP 5.3 added $previous). Strip the third arg when a
		// subclass passes it to parent::__construct.
		if (filePath.endsWith('class-wp-sqlite-driver-exception.php')) {
			content = content.replace(
				/parent::__construct\(\s*\$message,\s*0,\s*\$previous\s*\)/,
				'parent::__construct( $message, 0 )'
			);
		}

		// Inline the PHP < 8 trait definitions from
		// class-wp-pdo-proxy-statement.php. The upstream file ships a
		// `if ( PHP_VERSION_ID < 80000 ) { trait ... } else { trait ... }`
		// block with two identically-named traits. PHP 5.2 doesn't
		// know about traits at all. Delete both blocks and replace
		// `use TraitName;` with the inlined methods from the PHP < 8
		// branch.
		if (filePath.endsWith('class-wp-pdo-proxy-statement.php')) {
			content = inlineProxyStatementTraits(content);
		}

		// Add the array_column() polyfill (PHP 5.5+) to each
		// php-polyfills.php. The polyfills file runs early, so it
		// covers every subsequent file.
		if (
			filePath.endsWith('php-polyfills.php') &&
			!content.includes('function array_column')
		) {
			content += `
if ( ! function_exists( 'array_column' ) ) {
\t/**
\t * PHP 5.5+ array_column() polyfill for PHP 5.2.
\t */
\tfunction array_column( $input, $column_key, $index_key = null ) {
\t\t$result = array();
\t\tforeach ( $input as $row ) {
\t\t\t$has_value = false;
\t\t\t$value     = null;
\t\t\tif ( null === $column_key ) {
\t\t\t\t$value     = $row;
\t\t\t\t$has_value = true;
\t\t\t} elseif ( is_array( $row ) && array_key_exists( $column_key, $row ) ) {
\t\t\t\t$value     = $row[ $column_key ];
\t\t\t\t$has_value = true;
\t\t\t} elseif ( is_object( $row ) && isset( $row->{ $column_key } ) ) {
\t\t\t\t$value     = $row->{ $column_key };
\t\t\t\t$has_value = true;
\t\t\t}
\t\t\tif ( ! $has_value ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\tif ( null === $index_key ) {
\t\t\t\t$result[] = $value;
\t\t\t} else {
\t\t\t\t$key = null;
\t\t\t\tif ( is_array( $row ) && array_key_exists( $index_key, $row ) ) {
\t\t\t\t\t$key = $row[ $index_key ];
\t\t\t\t} elseif ( is_object( $row ) && isset( $row->{ $index_key } ) ) {
\t\t\t\t\t$key = $row->{ $index_key };
\t\t\t\t}
\t\t\t\tif ( null !== $key ) {
\t\t\t\t\t$result[ $key ] = $value;
\t\t\t\t} else {
\t\t\t\t\t$result[] = $value;
\t\t\t\t}
\t\t\t}
\t\t}
\t\treturn $result;
\t}
}
`;
		}

		if (content !== original) {
			fs.writeFileSync(filePath, content);
			surgicalCount++;
			console.log(`  Surgical: ${rel}`);
		}
	}
	console.log(
		`Applied surgical fixes to ${surgicalCount}/${files.length} files`
	);

	// Static post-pass: scan the pretty-printed output for `self::`,
	// `parent::`, or `static::` references that ended up OUTSIDE any
	// class body. The PHP 5.2 SAPI lint catches parse errors but not
	// these — they're a runtime fatal ("Cannot access self:: when no
	// class scope is active") and would otherwise only surface during
	// the legacy WP boot test. Failing here gives a precise file:line.
	const scanResult = spawnSync(
		'node',
		[
			path.join(
				REPO_ROOT,
				'scripts/php52-downgrader/bin/scan-out-of-class-self.mjs'
			),
			pluginRoot,
		],
		{ stdio: ['ignore', 'inherit', 'inherit'] }
	);
	if (scanResult.status !== 0) {
		throw new Error(
			'out-of-class self::/parent::/static:: scan failed; see diagnostics above'
		);
	}

	// Re-zip.
	if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);
	execSync(`cd "${TMP_DIR}" && zip -r -q "${OUT_ZIP}" .`);
	console.log(`\nCreated: ${OUT_ZIP}`);
	registerPatchedZip();
} finally {
	fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

function registerPatchedZip() {
	registerSqliteIntegrationVersion(SQLITE_DIR, SQLITE_PHP52_PLUGIN_VERSION, {
		removeVersions: [SQLITE_PLUGIN_VERSION],
	});
	console.log(`Registered: ${SQLITE_PHP52_PLUGIN_VERSION}`);
}

/** Returns the index of the `}` matching the `{` at `openIdx`, or -1. */
function findMatchingBrace(str, openIdx) {
	let depth = 0;
	let inString = null;
	for (let i = openIdx; i < str.length; i++) {
		const ch = str[i];
		if (inString) {
			if (ch === '\\') {
				i++;
				continue;
			}
			if (ch === inString) inString = null;
			continue;
		}
		if (ch === "'" || ch === '"') {
			inString = ch;
			continue;
		}
		if (ch === '/' && str[i + 1] === '/') {
			const nl = str.indexOf('\n', i);
			i = nl === -1 ? str.length : nl;
			continue;
		}
		if (ch === '/' && str[i + 1] === '*') {
			const end = str.indexOf('*/', i + 2);
			i = end === -1 ? str.length : end + 1;
			continue;
		}
		if (ch === '{') {
			depth++;
		} else if (ch === '}') {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function findFiles(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...findFiles(full));
		else if (entry.name.endsWith('.php') || entry.name.endsWith('.copy'))
			out.push(full);
	}
	return out;
}

/**
 * Inlines the PHP < 8 trait methods of class-wp-pdo-proxy-statement.php
 * directly into the class body. PHP 5.2 doesn't know about traits.
 */
function inlineProxyStatementTraits(content) {
	// Remove the entire `if ( PHP_VERSION_ID < 80000 ) { trait ... } else { trait ... }` block.
	content = content.replace(
		/if \(PHP_VERSION_ID < 80000\) \{[\s\S]*?\n\} else \{[\s\S]*?\n\}\n/,
		''
	);
	// Replace `use WP_PDO_Proxy_Statement_PHP_Compat;` with the
	// inlined PHP 5.2-compatible methods.
	const inlined = `
	public function setFetchMode( $mode, $params = null ) {
		if ( null === $params ) {
			return $this->setDefaultFetchMode( $mode );
		}
		return $this->setDefaultFetchMode( $mode, $params );
	}

	public function fetchAll( $mode = null, $class_name = null, $constructor_args = null ) {
		if ( null === $class_name && null === $constructor_args ) {
			return $this->fetchAllRows( $mode );
		}
		return $this->fetchAllRows( $mode, $class_name, $constructor_args );
	}
`;
	content = content.replace(
		/^\s*use WP_PDO_Proxy_Statement_PHP_Compat;/m,
		inlined
	);
	return content;
}
