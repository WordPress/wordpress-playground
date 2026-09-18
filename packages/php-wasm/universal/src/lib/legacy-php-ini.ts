/**
 * Pre-boot php.ini content for legacy PHP builds (currently 5.2).
 *
 * Why pre-create a php.ini before the SAPI starts:
 *
 * - ini_get_all() crashes on legacy PHP WASM (null function pointer in
 *   the Asyncify instrumentation) so we disable it via
 *   `disable_functions`, which PHP only reads during module startup.
 * - OPcache's shared-memory allocator fails in our WASM environment,
 *   so opcache must be disabled before php_module_startup runs.
 *
 * Both settings are processed by php_module_startup before PHP reads
 * any user code, so setting them at runtime via `ini_set()` is too
 * late. The Emscripten preRun hook below writes the ini file before
 * PHP.initializeRuntime invokes __wasm_call_ctors, which in turn
 * invokes wasm_sapi_module_startup → php_module_startup.
 *
 * PHP.initializeRuntime will skip writing its own default php.ini
 * when the file already exists.
 */

export const LEGACY_PHP_INI_PATH = '/internal/shared/php.ini';

export const LEGACY_PHP_INI_CONTENT = [
	'auto_prepend_file=/internal/shared/auto_prepend_file.php',
	'memory_limit=256M',
	'ignore_repeated_errors = 1',
	'error_reporting = E_ALL',
	'display_errors = 1',
	'html_errors = 1',
	'display_startup_errors = On',
	'log_errors = 1',
	'always_populate_raw_post_data = -1',
	'upload_max_filesize = 2000M',
	'post_max_size = 2000M',
	'allow_url_fopen = On',
	'allow_url_include = Off',
	'session.save_path = /home/web_user',
	'implicit_flush = 1',
	'output_buffering = 0',
	'max_execution_time = 0',
	'max_input_time = -1',
	'disable_functions = ini_get_all',
	'opcache.enable = 0',
	'opcache.enable_cli = 0',
].join('\n');

/**
 * Returns an Emscripten preRun callback that writes
 * {@link LEGACY_PHP_INI_CONTENT} to {@link LEGACY_PHP_INI_PATH}.
 */
export function createLegacyPhpIniPreRunStep(): (module: {
	FS: {
		mkdirTree: (path: string) => void;
		writeFile: (path: string, content: string) => void;
	};
}) => void {
	return (module) => {
		module.FS.mkdirTree('/internal/shared');
		module.FS.writeFile(LEGACY_PHP_INI_PATH, LEGACY_PHP_INI_CONTENT);
	};
}
