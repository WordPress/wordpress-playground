/**
 * Build a fully-bootable VFS image for the browser `--experimental-posix-
 * kernel` mode.
 *
 * Browser port of `kandelo/images/vfs/scripts/build-wp-vfs-image.ts`.
 * The Node script reads binaries and a pre-extracted WordPress checkout
 * from disk. In the browser we:
 *
 *   - Pull every wasm binary over `fetch()` using Vite's `?url` imports
 *     wired up by `resolveKernelBinariesPlugin` in
 *     `vite.posix-kernel.config.ts`.
 *   - Stream-decode the WordPress core bundle (`tar.zst`) and the
 *     SQLite-integration zip via `extractArchiveIntoVfs` (see
 *     `archive-extract.ts`) and write each entry into the VFS image
 *     directly — no Node FS intermediary.
 *
 * `boot.ts` spawns the {@link serverDaemons} `php-fpm` and `nginx`.
 * nginx binds to `127.0.0.1:8080`; `HttpBridgeHost` is wired against
 * the same port in `boot.ts`. wp-config.php is materialized at VFS build time (every
 * request carries `x-playground-absolute-url`, so the wp-config
 * template needs no runtime substitution).
 *
 * Output: bytes from `KandeloImageFs.saveImage()` — pass straight to
 * `BrowserKernel.initFromImage({ vfsImage })`.
 */

import { KandeloImageFs } from './host-bridge';
import { extractArchiveIntoVfs } from './archive-extract';

import {
	writeVfsFile,
	writeVfsBinary,
	ensureDir,
	ensureDirRecursive,
	symlink,
} from '@kandelo/host/src/vfs/image-helpers';

// `?url` imports resolved by `resolveKernelBinariesPlugin` in
// `vite.posix-kernel.config.ts` against `@wp-playground/posix-kernel-builds`.
import imageModuleUrl from '@kernel-binary/kandelo_image_module32.wasm?url';
import nginxUrl from '@kernel-binary/programs/wasm32/nginx.wasm?url';
import phpFpmUrl from '@kernel-binary/programs/wasm32/php/php-fpm.wasm?url';
import phpUrl from '@kernel-binary/programs/wasm32/php/php.wasm?url';
// Side module loaded by php-fpm via `-d extension=zip.so`. Provides
// ZipArchive (DEFLATE-only libzip 1.11.4).
import zipSoUrl from '@kernel-binary/programs/wasm32/php/zip.so?url';
// Side module loaded by php-fpm via `-d extension=curl.so`. Provides
// curl_* / CURLFile (libcurl 8.11.1, statically linked).
import curlSoUrl from '@kernel-binary/programs/wasm32/php/curl.so?url';
// Side module loaded by php-fpm via `-d extension=phar.so`. Provides the
// `Phar` class (kandelo builds PHP with `--enable-phar=shared`) so the
// `wp-cli` blueprint step can run `wp-cli.phar`. Mirrors the CLI path.
import pharSoUrl from '@kernel-binary/programs/wasm32/php/phar.so?url';
// Zend extension loaded by php-fpm via `-d zend_extension=opcache.so`.
// Caches compiled WordPress scripts, so a request does not compile every
// file it includes again.
import opcacheSoUrl from '@kernel-binary/programs/wasm32/php/opcache.so?url';
// Side module loaded by php-fpm via `-d extension=intl.so` ONLY when a
// blueprint opts in with `features: { intl: true }`. Provides the intl
// functions/classes (NumberFormatter, Collator, …). Off by default: it is
// heavy and WordPress core does not require it, so the shared prebuilt VFS
// snapshot ships without it and the few intl tests cold-build with it on
// (see `populateServerBinaries` / `serverDaemons` `withIntl`).
import intlSoUrl from '@kernel-binary/programs/wasm32/php/intl.so?url';
// ICU locale/data bundle (icudt74) that `intl.so` loads at runtime. The
// extension has the guest path `/usr/lib/php/icu.dat` baked in (kandelo's
// runtime-file mapping `artifact: icu.dat → guest_path /usr/lib/php/icu.dat`),
// so without this 30 MB file staged there every `NumberFormatter`/`Collator`
// constructor fails ("Constructor failed" / numfmt_create returns null).
// Staged only alongside `intl.so` on the intl opt-in path.
import icuDatUrl from '@kernel-binary/programs/wasm32/php/icu.dat?url';
import bashUrl from '@kernel-binary/programs/wasm32/bash.wasm?url';
import coreutilsUrl from '@kernel-binary/programs/wasm32/coreutils.wasm?url';

import AUTO_LOGIN_MU_PLUGIN from './wp-templates/auto-login.php?raw';
import DISABLE_WP_MAIL_MU_PLUGIN from './wp-templates/disable-wp-mail.php?raw';
import REPORT_URL_TO_PARENT_MU_PLUGIN from './wp-templates/report-url-to-parent.php?raw';

/**
 * The capacity the rootfs image declares. WordPress core + SQLite drop-in
 * totals ~80 MiB on disk, and installing a very large plugin (Gutenberg
 * unzips to several thousand files) needs room well past that.
 */
const VFS_MAX_BYTES = 1024 * 1024 * 1024;

const SHIPPED_DATABASE_PATH =
	/^wp-content\/database\/\.ht\.[^/]+\/\.ht\.sqlite$/;

const OPCACHE_FILE_CACHE = '/var/cache/opcache';

export interface BuildVfsImageOptions {
	/**
	 * WordPress core zip + SQLite drop-in zip. Both omitted for PHP-only
	 * mode; both required otherwise.
	 */
	wpZipBytes?: Uint8Array;
	sqliteZipBytes?: Uint8Array;
	/** Top-level directory inside `sqliteZipBytes` to strip when extracting. */
	sqliteZipStripLeadingDir?: string;
	/**
	 * Top-level directory inside `wpZipBytes` to strip when extracting,
	 * or omitted when files sit at the archive root. The bundled
	 * `wp-X.Y.zip` is flat; `downloads.w.org/release/wordpress-X.Y.Z.zip`
	 * wraps everything in `wordpress/`.
	 */
	wpZipStripLeadingDir?: string;
	/**
	 * Companion static-asset archive (admin CSS/JS, theme screenshots,
	 * etc.) for the minified `wp-X.Y.zip`. When present, extracted into
	 * `/var/www/html` after the core zip with no-overwrite semantics —
	 * matching classic mode's runtime backfill (`backfillStaticFiles
	 * RemovedFromMinifiedBuild`). Omit for upstream full releases.
	 */
	wpStaticZipBytes?: Uint8Array;
	/**
	 * When `false`, php-fpm's pool config disables `allow_url_fopen`
	 * and the `curl_exec` / `curl_multi_exec` functions — mirroring
	 * the php.ini gate classic mode flips in
	 * `playground-worker-endpoint.ts` when networking is off.
	 * Default `true`.
	 */
	withNetworking?: boolean;
	/**
	 * When `true`, php-fpm loads `intl.so` (`-d extension=intl.so`) so the
	 * intl functions/classes (NumberFormatter, Collator, …) are available.
	 * Off by default: intl is heavy and WordPress core does not require it,
	 * so the shared prebuilt VFS snapshot ships without it and only the
	 * intl opt-in tests (`features: { intl: true }`) cold-build with it on.
	 */
	withIntl?: boolean;
	/**
	 * The wp-cli.phar bytes to stage at `/usr/local/bin/wp-cli.phar`,
	 * together with a `wp` wrapper script, so the terminal pane's shell
	 * can drive the live site with WP-CLI. Staged in every image,
	 * PHP-only mode included. See {@link populateWpCli}.
	 */
	wpCliPharBytes: Uint8Array;
	/**
	 * A previously-captured SQLite database (the bytes of
	 * `wp-content/database/wordpress.db` from an already-installed site).
	 * When present, it is written into the image so the booted site is
	 * already installed and the installer is skipped. Used by the e2e suite
	 * to boot every test from one snapshot. Ignored in PHP-only mode (no
	 * `wpZipBytes`).
	 */
	preinstalledDatabase?: Uint8Array;
	/** Status callback (download progress, populate steps). */
	onStatus?: (message: string) => void;
}

export async function buildVfsImage(
	options: BuildVfsImageOptions
): Promise<Uint8Array> {
	const onStatus = options.onStatus ?? (() => undefined);

	KandeloImageFs.installModuleBytes(await fetchBinary(imageModuleUrl));
	const fs = KandeloImageFs.create();
	fs.setImageCapacity(VFS_MAX_BYTES);

	onStatus('Populating system directories and configs');
	populateSystem(fs);
	await populateServerBinaries(fs, options.withIntl === true);
	await populateUserBinaries(fs);
	populateWpCli(fs, options.wpCliPharBytes);
	populateBashRc(fs);
	populatePreloadFiles(fs);
	populateShellSymlinks(fs);
	populateNginxConfig(fs);
	populatePhpFpmConfig(fs, options.withNetworking !== false);

	// php-api.ts chdirs here and the FPM router includes `${DOCROOT}/index.php`,
	// so the doc root must exist even in PHP-only mode.
	ensureDirRecursive(fs, '/var/www/html');
	if (options.wpZipBytes) {
		// Classic Playground's docroot is `/wordpress`; php-api.ts rewrites
		// the absolute form in blueprint code, and this symlink covers the
		// relative `wordpress/...` form resolved from the docroot cwd.
		symlink(fs, '/var/www/html', '/var/www/html/wordpress');

		onStatus('Writing wp-config.php');
		writeVfsFile(fs, '/var/www/html/wp-config.php', WP_CONFIG_PHP);

		ensureDirRecursive(fs, '/var/www/html/wp-content/database');
		// SQLite drop-in's prepare_directory() wp_die()s with
		// "Unable to create a file in the directory!" if the DB dir is
		// not writable by the FPM worker (uid 99). Mirrors the CLI's
		// `ensureDatabaseDir` (prepare-wordpress.ts).
		fs.chmod('/var/www/html/wp-content/database', 0o777);
		ensureDirRecursive(fs, '/var/www/html/wp-content/mu-plugins');
		writeVfsFile(
			fs,
			'/var/www/html/wp-content/mu-plugins/wasm-optimizations.php',
			WASM_OPTIMIZATIONS_MU_PLUGIN
		);
		// Out-of-band tools (Adminer, phpMyAdmin) require()
		// /internal/shared/wp-env.php to discover the SQLite driver path.
		// Classic mode writes this from a wp_loaded mu-plugin (see
		// `platform-mu-plugins.ts`); kernel-mode paths are stable, so just
		// drop a static file here.
		ensureDirRecursive(fs, '/internal/shared');
		writeVfsFile(fs, '/internal/shared/wp-env.php', WP_ENV_PHP);
		// Mirrors the CLI's `ensureDisableWpMailMuPlugin`. wp_install()'s
		// wp_new_blog_notification() calls wp_mail() → PHPMailer →
		// popen("sendmail …"); kandelo's fork+exec cannot resolve the
		// missing sendmail and crashes the FPM worker mid-install (in
		// the browser worker, the crash surfaces as a wasm-function[42]
		// recursive stack overflow on `POST /wp-admin/install.php`).
		// Declaring wp_mail() before pluggable.php makes its
		// function_exists guard skip the real definition, so the
		// popen path is never reached.
		writeVfsFile(
			fs,
			'/var/www/html/wp-content/mu-plugins/0-disable-wp-mail.php',
			DISABLE_WP_MAIL_MU_PLUGIN
		);
		// Mirrors the CLI's `ensureAutoLoginMuPlugin`
		// (packages/playground/cli/src/posix-kernel/prepare-wordpress.ts).
		// The `login` blueprint step only calls `defineConstant
		// ('PLAYGROUND_AUTO_LOGIN_AS_USER', …)`; this mu-plugin is what
		// turns that constant into an actual WordPress session on the first
		// HTTP request.
		writeVfsFile(
			fs,
			'/var/www/html/wp-content/mu-plugins/1-playground-auto-login.php',
			AUTO_LOGIN_MU_PLUGIN
		);
		// Mirrors playground_report_url_to_parent() in the classic
		// 0-playground.php mu-plugin. `onNavigation` in
		// boot-playground-remote.ts listens for its message.
		writeVfsFile(
			fs,
			'/var/www/html/wp-content/mu-plugins/0-playground-report-url.php',
			REPORT_URL_TO_PARENT_MU_PLUGIN
		);

		onStatus('Extracting WordPress core into VFS');
		let shippedDatabase: Uint8Array | undefined;
		await extractArchiveIntoVfs(fs, '/var/www/html', options.wpZipBytes, {
			stripLeadingDir: options.wpZipStripLeadingDir,
			// Drop the archive's own `wp-config.php` (the bundled
			// `wp-X.Y.zip` ships a sample with `DB_HOST=localhost` that
			// would clobber the kernel-tailored config written above).
			exclude: (rel) => rel.endsWith('.db') || rel === 'wp-config.php',
			// `wordpress-builds` ships an installed database next to its
			// `db-path.php`. Classic mode boots from it; seeding it here
			// skips the installer the same way.
			onEntry: (rel, bytes) => {
				if (SHIPPED_DATABASE_PATH.test(rel)) {
					shippedDatabase = bytes;
				}
			},
		});

		if (options.wpStaticZipBytes) {
			onStatus('Extracting WordPress static assets into VFS');
			await extractArchiveIntoVfs(
				fs,
				'/var/www/html',
				options.wpStaticZipBytes,
				{
					exclude: (rel) => rel.endsWith('.db'),
					noOverwrite: true,
				}
			);
		}

		onStatus('Extracting SQLite plugin into VFS');
		const sqliteMountPrefix =
			'/var/www/html/wp-content/plugins/sqlite-database-integration';
		let dbCopyBytes: Uint8Array | null = null;
		await extractArchiveIntoVfs(
			fs,
			sqliteMountPrefix,
			options.sqliteZipBytes!,
			{
				stripLeadingDir: options.sqliteZipStripLeadingDir,
				exclude: (rel) => rel.endsWith('.db'),
				onEntry: (relPath, bytes) => {
					if (relPath === 'db.copy') {
						dbCopyBytes = bytes;
					}
				},
			}
		);
		if (dbCopyBytes) {
			// The SQLite plugin ships `db.copy` as the WordPress database
			// drop-in template; WordPress loads `wp-content/db.php`. Install
			// it verbatim, mirroring the CLI's `ensureDbDropIn`.
			writeVfsBinary(
				fs,
				'/var/www/html/wp-content/db.php',
				dbCopyBytes,
				0o644
			);
		}

		// Seed a pre-installed database. Written last so it lands after the
		// SQLite drop-in extraction (which excludes `.db` files), at the
		// `DB_DIR`/`DB_FILE` path WordPress opens — so `is_blog_installed()`
		// is true and the root probe returns 200 instead of install.php.
		//
		// Mode 0o666, NOT 0o644: the image builder writes this as uid 0, but
		// the FPM worker runs as `nobody` and must WRITE the DB at runtime
		// (session tokens on login, option updates). A read-only DB renders
		// pages but silently fails writes — `wp_set_auth_cookie` can't persist
		// its token, so auto-login bounces to `wp-login.php?...reauth=1`. The
		// DB dir is already 0o777 for the same reason; the file must match.
		const database = options.preinstalledDatabase ?? shippedDatabase;
		if (database) {
			writeVfsBinary(
				fs,
				'/var/www/html/wp-content/database/wordpress.db',
				database,
				0o666
			);
		}
	}

	onStatus('Serializing VFS image');
	return await fs.saveImage();
}

// --- System setup -----------------------------------------------------

/**
 * Top-level directories + /etc baseline files. POSIX programs expect
 * these layouts even if the values are never read by our daemons.
 */
function populateSystem(fs: KandeloImageFs): void {
	for (const dir of [
		'/tmp',
		'/home',
		'/dev',
		'/etc',
		'/bin',
		'/usr',
		'/usr/bin',
		'/usr/local',
		'/usr/local/bin',
		'/usr/share',
		'/usr/share/misc',
		'/usr/share/file',
		'/root',
		'/usr/sbin',
		'/var',
		'/var/log',
		'/var/www',
		'/run',
	]) {
		ensureDir(fs, dir);
	}
	fs.chmod('/tmp', 0o777);

	writeVfsFile(fs, '/etc/services', ETC_SERVICES);
	writeVfsFile(fs, '/etc/passwd', ETC_PASSWD);
	writeVfsFile(fs, '/etc/group', ETC_GROUP);
	writeVfsFile(fs, '/etc/hosts', ETC_HOSTS);
}

/**
 * Fetch every wasm binary in parallel and write into the VFS at the
 * paths {@link serverDaemons} and `proc_open()` expect. Symlinks for
 * shell utilities are added in {@link populateShellSymlinks}; here we
 * only place the underlying multicall binary at each canonical path.
 */
async function populateServerBinaries(
	fs: KandeloImageFs,
	withIntl: boolean
): Promise<void> {
	const [
		bashBytes,
		nginxBytes,
		phpFpmBytes,
		coreutilsBytes,
		zipSoBytes,
		curlSoBytes,
		pharSoBytes,
		opcacheSoBytes,
	] = await Promise.all([
		fetchBinary(bashUrl),
		fetchBinary(nginxUrl),
		fetchBinary(phpFpmUrl),
		fetchBinary(coreutilsUrl),
		fetchBinary(zipSoUrl),
		fetchBinary(curlSoUrl),
		fetchBinary(pharSoUrl),
		fetchBinary(opcacheSoUrl),
	]);

	writeVfsBinary(fs, '/bin/bash', bashBytes);
	symlink(fs, '/bin/bash', '/bin/sh');
	symlink(fs, '/bin/bash', '/usr/bin/bash');
	symlink(fs, '/bin/bash', '/usr/bin/sh');

	writeVfsBinary(fs, '/usr/sbin/nginx', nginxBytes);
	writeVfsBinary(fs, '/usr/sbin/php-fpm', phpFpmBytes);
	writeVfsBinary(fs, '/bin/coreutils', coreutilsBytes);

	// PHP side modules. The `serverDaemons()` php-fpm command passes
	// `-d extension_dir=/usr/lib/php/extensions -d extension=zip.so
	//  -d extension=curl.so -d extension=phar.so` so the loader resolves
	// these paths at instantiation.
	ensureDirRecursive(fs, '/usr/lib/php/extensions');
	writeVfsBinary(fs, '/usr/lib/php/extensions/zip.so', zipSoBytes);
	writeVfsBinary(fs, '/usr/lib/php/extensions/curl.so', curlSoBytes);
	writeVfsBinary(fs, '/usr/lib/php/extensions/phar.so', pharSoBytes);
	writeVfsBinary(fs, '/usr/lib/php/extensions/opcache.so', opcacheSoBytes);
	// php-fpm workers run as `nobody` and write the opcache file cache.
	ensureDirRecursive(fs, OPCACHE_FILE_CACHE);
	fs.chmod(OPCACHE_FILE_CACHE, 0o777);
	// opcache calls `mkdir('/var/cache/opcache')` and accepts only EEXIST.
	// The Kandelo kernel checks parent write access before existence, so
	// `nobody` gets EACCES under a root-owned `/var/cache` and opcache
	// writes nothing. Drop this once the kernel returns EEXIST first.
	fs.chmod('/var/cache', 0o777);

	// intl.so + its 30 MB ICU data bundle are only staged when a blueprint
	// opts in (`features: { intl: true }`). The shared prebuilt snapshot
	// never carries them, so fetch here rather than widen the Promise.all
	// tuple. icu.dat MUST land at `/usr/lib/php/icu.dat` — the guest path
	// baked into intl.so — or every formatter/collator constructor fails.
	if (withIntl) {
		const [intlSoBytes, icuDatBytes] = await Promise.all([
			fetchBinary(intlSoUrl),
			fetchBinary(icuDatUrl),
		]);
		writeVfsBinary(fs, '/usr/lib/php/extensions/intl.so', intlSoBytes);
		writeVfsBinary(fs, '/usr/lib/php/icu.dat', icuDatBytes);
	}
}

/**
 * Binaries that aren't server daemons but must be on `$PATH` so PHP
 * code running inside php-fpm can shell out to them via `proc_open()`.
 * The boot env sets `PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin`
 * (`boot.ts:bootKernelWordPress`); placing each binary at one of those
 * locations lets `/bin/sh -c '<cmd>'` resolve it without the caller
 * having to spell out an absolute path.
 *
 * `php` lands at `/usr/local/bin/php`. The php.wasm bytes are also
 * fetched a second time by `playground-worker-endpoint.ts` for the
 * host-side `KernelSpawnAdapter`; the browser's HTTP cache dedupes the
 * two `fetch()` calls so this redundancy is essentially free.
 */
async function populateUserBinaries(fs: KandeloImageFs): Promise<void> {
	writeVfsBinary(fs, '/usr/local/bin/php', await fetchBinary(phpUrl));
}

/**
 * WP-CLI for the terminal pane: the phar plus a `wp` wrapper script,
 * both at `/usr/local/bin` (already on the boot env's PATH). NOT
 * `/tmp/wp-cli.phar` — the `wp-cli` blueprint step's location — because
 * kandelo mounts an empty scratch memfs over `/tmp` on every boot,
 * shadowing anything the image stages there (same trap as `/root`, which
 * is why the shell rc lives at `/etc/bashrc`).
 *
 * The wrapper's `-d` flags mirror `PHP_EXTENSION_ARGS` in `php-api.ts`
 * (minus the opt-in `intl.so`) so `wp` behaves like every other direct
 * `php` spawn: `phar.so` is what makes the phar runnable at all, and
 * `zend.max_allowed_stack_size` raises a graceful PHP fatal on deep
 * recursion before V8's ~50-frame budget kills the worker.
 * `WP_CLI_ALLOW_ROOT` because the shell runs as uid 0 and WP-CLI
 * refuses to run as root without the opt-in.
 */
function populateWpCli(fs: KandeloImageFs, pharBytes: Uint8Array): void {
	writeVfsBinary(fs, '/usr/local/bin/wp-cli.phar', pharBytes, 0o644);
	writeVfsFile(
		fs,
		'/usr/local/bin/wp',
		`#!/bin/sh
export WP_CLI_ALLOW_ROOT=1
exec php \\
  -d extension_dir=/usr/lib/php/extensions \\
  -d extension=zip.so \\
  -d extension=curl.so \\
  -d extension=phar.so \\
  -d curl.cainfo=/etc/ssl/certs/ca-certificates.crt \\
  -d zend.max_allowed_stack_size=131072 \\
  /usr/local/bin/wp-cli.phar "$@"
`,
		0o755
	);
}

function populateBashRc(fs: KandeloImageFs): void {
	writeVfsFile(
		fs,
		'/etc/bashrc',
		`alias ls='ls --color=auto'
alias clear='printf "\\e[H\\e[2J\\e[3J"'
PS1='\\[\\e[1;32m\\]\\w\\[\\e[0m\\] $ '
PROMPT_COMMAND='(( COLUMNS > 0 )) && printf "%\${COLUMNS}s\\r" ""'
playground() {
  printf '\\n'
  printf '\\e[38;2;56;88;233mThis shell runs inside the WordPress Playground Kandelo kernel.\\e[0m\\n\\n'
  printf 'Available binaries: wp, php, bash, and GNU coreutils.\\n\\n'
  printf 'Clear the screen with "clear" or Ctrl+L.\\n\\n'
}
`
	);
}

/**
 * Platform-level preload scripts. The php-fpm pool config sets
 * `auto_prepend_file` to the loader below, which globs `preload/*.php`
 * and `require_once`'s each file before WordPress boots.
 */
function populatePreloadFiles(fs: KandeloImageFs): void {
	ensureDirRecursive(fs, '/internal/shared/preload');

	writeVfsFile(
		fs,
		'/internal/shared/auto_prepend_file.php',
		`<?php
foreach (glob('/internal/shared/preload/*.php') as $file) {
    require_once $file;
}
`
	);

	writeVfsFile(
		fs,
		'/internal/shared/preload/phpinfo.php',
		`<?php
if (isset($_SERVER['REQUEST_URI']) && '/phpinfo.php' === $_SERVER['REQUEST_URI']) {
    phpinfo();
    exit;
}
`
	);

	// WP 6.7+ only redirects /sitemap.xml -> /wp-sitemap.xml when installed
	// at the domain root; Playground sites live under /scope:<id>/ so the
	// auto-generated rule never matches. REQUEST_URI here is already
	// scope-stripped; the service worker re-scopes the Location.
	writeVfsFile(
		fs,
		'/internal/shared/preload/sitemap-redirect.php',
		`<?php
if (isset($_SERVER['REQUEST_URI'])) {
    $request_uri = $_SERVER['REQUEST_URI'];
    if (
        $request_uri === '/sitemap.xml' ||
        strpos($request_uri, '/sitemap.xml?') === 0 ||
        strpos($request_uri, '/sitemap.xml/') === 0
    ) {
        $query_string = '';
        $qpos = strpos($request_uri, '?');
        if ($qpos !== false) {
            $query_string = substr($request_uri, $qpos);
        }
        header('Location: /wp-sitemap.xml' . $query_string, true, 301);
        exit;
    }
}
`
	);

	// Lifted from the `0-playground-defines.php` mu-plugin so constants
	// also apply to non-WordPress PHP entry points (the mu-plugin only
	// fires from wp-settings.php).
	writeVfsFile(
		fs,
		'/internal/shared/preload/playground-defines.php',
		`<?php
$store = '/var/www/html/wp-content/mu-plugins/0-playground-defines.json';
if (!file_exists($store)) {
    return;
}
$entries = json_decode((string) file_get_contents($store), true);
if (!is_array($entries)) {
    return;
}
foreach ($entries as $name => $value) {
    if (defined($name)) {
        continue;
    }
    define($name, $value);
}
`
	);
}

/**
 * Per-utility symlinks pointing at the coreutils multicall binary,
 * plus grep aliases. Matches the demo's `populateShellSymlinks`.
 */
function populateShellSymlinks(fs: KandeloImageFs): void {
	for (const name of [...COREUTILS_NAMES, '[']) {
		symlink(fs, '/bin/coreutils', `/bin/${name}`);
		symlink(fs, '/bin/coreutils', `/usr/bin/${name}`);
	}
}

/**
 * nginx config — verbatim copy of the demo's `populateNginxConfig`.
 * Listens on `127.0.0.1:8080` (the port `HttpBridgeHost` connects to).
 * Static-asset directories under wp-includes/wp-admin/wp-content are
 * served by nginx directly; everything else routes through the FPM
 * front controller at `/var/www/fpm-router.php`.
 */
function populateNginxConfig(fs: KandeloImageFs): void {
	for (const dir of [
		'/etc/nginx',
		'/var/www/html',
		'/var/log/nginx',
		'/tmp/nginx_client_temp',
	]) {
		ensureDirRecursive(fs, dir);
	}

	writeVfsFile(fs, '/etc/nginx/nginx.conf', NGINX_CONF);
}

/**
 * php-fpm pool config + FPM front controller. The controller mirrors
 * the demo's: serve static files directly, resolve directory URLs to
 * `index.php`, otherwise fall back to `index.php` (front-controller).
 */
function populatePhpFpmConfig(
	fs: KandeloImageFs,
	withNetworking: boolean
): void {
	ensureDirRecursive(fs, '/etc/php-fpm.d');
	ensureDirRecursive(fs, '/var/log');
	ensureDirRecursive(fs, '/tmp/nginx_fastcgi_temp');
	ensureDirRecursive(fs, '/var/www');

	const conf = withNetworking
		? PHP_FPM_CONF
		: PHP_FPM_CONF + PHP_FPM_NETWORKING_DISABLED_OVERRIDES;
	writeVfsFile(fs, '/etc/php-fpm.conf', conf);
	writeVfsFile(fs, '/var/www/fpm-router.php', FPM_ROUTER_PHP);
	// Constrain PHP's recursive-compile budget. PHP's auto-detect
	// pthread stack returns the WASM linear-memory stack (4 MB), which
	// far overshoots V8's actual host stack. The cap makes deep
	// recursion raise a PHP fatal before V8 overflows the wasm stack
	// and kills the kernel worker with an untrappable RangeError.
	//
	// Active budget = max_allowed_stack_size - reserved_stack_size.
	// Zend/zend.c::OnUpdateReservedStackSize enforces a 49152-byte floor
	// on `reserved_stack_size`, so max_allowed_stack_size must be larger
	// than 49152 — a smaller value wraps the subtraction at uint64 and
	// PHP fatals on every check.
	writeVfsFile(fs, '/etc/php.ini', 'zend.max_allowed_stack_size=131072\n');
}

// --- Server daemons ----------------------------------------------------

/**
 * The argv of each long-running server `boot.ts` spawns: php-fpm, then
 * nginx. wp-config.php is materialized at VFS build time, so there's no
 * runtime substitution step.
 */
export function serverDaemons(withIntl: boolean): string[][] {
	return [
		[
			'/usr/sbin/php-fpm',
			'-y',
			'/etc/php-fpm.conf',
			'-c',
			'/dev/null',
			// Caps PHP's stack so deep recursion raises a PHP fatal
			// before V8 overflows the wasm stack. Zend enforces a
			// 49 152-byte floor on reserved_stack_size, so max must be
			// > 49 152 to produce a positive budget.
			'-d',
			'zend.max_allowed_stack_size=131072',
			'-d',
			'extension_dir=/usr/lib/php/extensions',
			'-d',
			'extension=zip.so',
			'-d',
			'extension=curl.so',
			'-d',
			'extension=phar.so',
			// Kandelo has no cross-process MAP_SHARED yet, so opcache's
			// shared memory would not stay coherent across FPM workers.
			// The file cache works per process, like Kandelo's own images.
			'-d',
			'zend_extension=opcache.so',
			'-d',
			'opcache.enable=1',
			'-d',
			`opcache.file_cache=${OPCACHE_FILE_CACHE}`,
			'-d',
			'opcache.file_cache_only=1',
			// Only the intl opt-in tests load intl.so; the shared snapshot
			// omits it (see `populateServerBinaries`).
			...(withIntl ? ['-d', 'extension=intl.so'] : []),
			// The WASM curl.so was cross-built without a compiled-in CA
			// bundle and without --with-ca-fallback, so unlike PHP's
			// OpenSSL streams (which honor the SSL_CERT_FILE env the host
			// sets) it has an empty trust store and rejects every HTTPS
			// handshake. curl.cainfo points it at the CA bundle the kernel
			// worker installs at /etc/ssl/certs/ca-certificates.crt.
			'-d',
			'curl.cainfo=/etc/ssl/certs/ca-certificates.crt',
			'--nodaemonize',
		],
		['/usr/sbin/nginx', '-c', '/etc/nginx/nginx.conf'],
	];
}

// --- Helpers ---------------------------------------------------------

async function fetchBinary(url: string): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch kernel binary ${url}: HTTP ` +
				`${response.status} ${response.statusText}`
		);
	}
	return new Uint8Array(await response.arrayBuffer());
}

// --- Inlined constants (mirror build-wp-vfs-image.ts) -----------------

/**
 * GNU coreutils multicall command names (91 entries). Each becomes a
 * symlink under /bin and /usr/bin pointing at `/bin/coreutils`. Mirrors
 * `COREUTILS_NAMES` in `kandelo/images/vfs/lib/init/shell-binaries.ts`.
 */
const COREUTILS_NAMES = [
	'arch',
	'b2sum',
	'base32',
	'base64',
	'basename',
	'basenc',
	'cat',
	'chcon',
	'chgrp',
	'chmod',
	'chown',
	'chroot',
	'cksum',
	'comm',
	'cp',
	'csplit',
	'cut',
	'date',
	'dd',
	'df',
	'dir',
	'dircolors',
	'dirname',
	'du',
	'echo',
	'env',
	'expand',
	'expr',
	'factor',
	'false',
	'fmt',
	'fold',
	'groups',
	'head',
	'hostid',
	'id',
	'install',
	'join',
	'link',
	'ln',
	'logname',
	'ls',
	'md5sum',
	'mkdir',
	'mkfifo',
	'mknod',
	'mktemp',
	'mv',
	'nice',
	'nl',
	'nohup',
	'nproc',
	'numfmt',
	'od',
	'paste',
	'pathchk',
	'pr',
	'printenv',
	'printf',
	'ptx',
	'pwd',
	'readlink',
	'realpath',
	'rm',
	'rmdir',
	'runcon',
	'seq',
	'sha1sum',
	'sha224sum',
	'sha256sum',
	'sha384sum',
	'sha512sum',
	'shred',
	'shuf',
	'sleep',
	'sort',
	'split',
	'stat',
	'stty',
	'sum',
	'sync',
	'tac',
	'tail',
	'tee',
	'test',
	'timeout',
	'touch',
	'tr',
	'true',
	'truncate',
	'tsort',
	'tty',
	'uname',
	'unexpand',
	'uniq',
	'unlink',
	'vdir',
	'wc',
	'whoami',
	'yes',
] as const;

const ETC_SERVICES =
	[
		'tcpmux\t\t1/tcp',
		'echo\t\t7/tcp',
		'echo\t\t7/udp',
		'discard\t\t9/tcp\t\tsink null',
		'discard\t\t9/udp\t\tsink null',
		'ftp-data\t20/tcp',
		'ftp\t\t21/tcp',
		'ssh\t\t22/tcp',
		'telnet\t\t23/tcp',
		'smtp\t\t25/tcp\t\tmail',
		'domain\t\t53/tcp',
		'domain\t\t53/udp',
		'http\t\t80/tcp\t\twww',
		'pop3\t\t110/tcp\t\tpop-3',
		'nntp\t\t119/tcp\t\treadnews untp',
		'ntp\t\t123/udp',
		'imap\t\t143/tcp\t\timap2',
		'snmp\t\t161/udp',
		'https\t\t443/tcp',
		'imaps\t\t993/tcp',
		'pop3s\t\t995/tcp',
	].join('\n') + '\n';

const ETC_PASSWD = [
	'root:x:0:0:root:/root:/bin/sh',
	'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
	'nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin',
	'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
	'redis:x:100:100:redis:/var/lib/redis:/usr/sbin/nologin',
	'mysql:x:101:101:mysql:/var/lib/mysql:/usr/sbin/nologin',
	'user:x:1000:1000:user:/home/user:/bin/sh',
	'',
].join('\n');

const ETC_GROUP = [
	'root:x:0:',
	'daemon:x:1:',
	'nogroup:x:65534:',
	'nobody:x:65534:',
	'www-data:x:33:',
	'redis:x:100:',
	'mysql:x:101:',
	'user:x:1000:',
	'',
].join('\n');

const ETC_HOSTS = ['127.0.0.1\tlocalhost', '::1\tlocalhost', ''].join('\n');

const NGINX_CONF = `user root;
daemon off;
master_process on;
worker_processes 2;
error_log /var/log/nginx.log info;
pid /tmp/nginx.pid;

events {
    worker_connections 64;
    use poll;
}

http {
    access_log /var/log/nginx.log;
    client_body_temp_path /tmp/nginx_client_temp;

    types {
        text/html  html htm;
        text/css   css;
        text/javascript js;
        application/json json;
        image/png png;
        image/svg+xml svg;
    }
    default_type application/octet-stream;

    server {
        listen 8080;
        server_name localhost;
        root /var/www/html;
        index index.html;

        # Static asset directories — served directly by nginx
        location /wp-includes/css/ { }
        location /wp-includes/js/ { }
        location /wp-includes/fonts/ { }
        location /wp-includes/images/ { }
        location /wp-admin/css/ { }
        location /wp-admin/js/ { }
        location /wp-admin/images/ { }
        location /wp-content/ {
            try_files $uri @fpm;
        }

        # Everything else through PHP-FPM (PHP pages, front controller)
        location @fpm {
            fastcgi_pass 127.0.0.1:9000;
            fastcgi_read_timeout 600s;
            fastcgi_param SCRIPT_FILENAME /var/www/fpm-router.php;
            fastcgi_param DOCUMENT_ROOT $document_root;
            fastcgi_param DOCUMENT_URI $document_uri;
            fastcgi_param QUERY_STRING $query_string;
            fastcgi_param REQUEST_METHOD $request_method;
            fastcgi_param CONTENT_TYPE $content_type;
            fastcgi_param CONTENT_LENGTH $content_length;
            fastcgi_param REQUEST_URI $request_uri;
            fastcgi_param SERVER_PROTOCOL $server_protocol;
            fastcgi_param SERVER_PORT $server_port;
            fastcgi_param SERVER_NAME $server_name;
            fastcgi_param HTTP_HOST $http_host;
            # nginx doesn't auto-forward arbitrary headers to fastcgi —
            # only the params enumerated here reach PHP. The wp-config
            # template reads HTTP_X_PLAYGROUND_ABSOLUTE_URL to derive
            # WP_HOME / WP_SITEURL for the scoped iframe origin; without
            # this line WP falls back to http://localhost/app and the
            # iframe loads HTML pointing at a port nothing listens on.
            fastcgi_param HTTP_X_PLAYGROUND_ABSOLUTE_URL $http_x_playground_absolute_url;
            fastcgi_param REDIRECT_STATUS 200;
        }

        location / {
            fastcgi_pass 127.0.0.1:9000;
            fastcgi_read_timeout 600s;
            fastcgi_param SCRIPT_FILENAME /var/www/fpm-router.php;
            fastcgi_param DOCUMENT_ROOT $document_root;
            fastcgi_param DOCUMENT_URI $document_uri;
            fastcgi_param QUERY_STRING $query_string;
            fastcgi_param REQUEST_METHOD $request_method;
            fastcgi_param CONTENT_TYPE $content_type;
            fastcgi_param CONTENT_LENGTH $content_length;
            fastcgi_param REQUEST_URI $request_uri;
            fastcgi_param SERVER_PROTOCOL $server_protocol;
            fastcgi_param SERVER_PORT $server_port;
            fastcgi_param SERVER_NAME $server_name;
            fastcgi_param HTTP_HOST $http_host;
            fastcgi_param HTTP_X_PLAYGROUND_ABSOLUTE_URL $http_x_playground_absolute_url;
            fastcgi_param REDIRECT_STATUS 200;
        }
    }
}
`;

const PHP_FPM_CONF = `[global]
daemonize = no
error_log = /var/log/php-fpm.log
log_level = notice

[www]
user = nobody
group = nobody
listen = 127.0.0.1:9000
pm = static
pm.max_children = 2
clear_env = no
slowlog = /dev/null
request_slowlog_trace_depth = 0
; php-fpm runs with \`-c /dev/null\`; no php.ini auto_prepend_file fires,
; so wire the platform preload loader via the pool config instead.
php_admin_value[auto_prepend_file] = /internal/shared/auto_prepend_file.php
; FPM's compiled-in 30s default aborts long requests (the WordPress
; install, large blueprint imports) midway on a slow machine. 0 matches
; the other Playground runtimes.
php_admin_value[max_execution_time] = 0
`;

/**
 * Appended to {@link PHP_FPM_CONF} when the kernel is booted with
 * `withNetworking: false`. Mirrors the php.ini surface classic mode
 * flips off in `playground-worker-endpoint.ts`:
 * `allow_url_fopen = 0` is what surfaces the
 * "https:// wrapper is disabled in the server configuration" notice
 * that the posix-kernel `blueprints.spec.ts` asserts on, and the disabled
 * `curl_exec` / `curl_multi_exec` mirror `networkingDisabledFunctions`
 * from `packages/playground/remote/src/lib/disabled-functions.ts`.
 */
const PHP_FPM_NETWORKING_DISABLED_OVERRIDES = `
php_admin_value[allow_url_fopen] = 0
php_admin_value[disable_functions] = curl_exec,curl_multi_exec
`;

const FPM_ROUTER_PHP = `<?php
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$docRoot = $_SERVER['DOCUMENT_ROOT'];
$file = $docRoot . $uri;

// Path aliases: serve bundled tools that live outside the WordPress
// docroot. Mirrors classic mode's \`PHPRequestHandler\` pathAliases,
// which \`boot-site-client.ts\` wires as \`/phpmyadmin\` ->
// \`/tools/phpmyadmin\` (\`PHPMYADMIN_INSTALL_PATH\`). Applied before the
// docroot/multisite resolution below so the subdir-multisite rewrite
// can't reclaim \`/phpmyadmin/<file>.php\` back to WordPress' index.php
// (which is what made the Database panel's "Open phpMyAdmin" 404).
$pathAliases = ['/phpmyadmin' => '/tools/phpmyadmin'];
foreach ($pathAliases as $prefix => $target) {
    if ($uri === $prefix || strpos($uri, $prefix . '/') === 0) {
        $file = $target . substr($uri, strlen($prefix));
        break;
    }
}

$staticTypes = [
    'css'   => 'text/css',
    'js'    => 'text/javascript',
    'json'  => 'application/json',
    'png'   => 'image/png',
    'jpg'   => 'image/jpeg',
    'jpeg'  => 'image/jpeg',
    'gif'   => 'image/gif',
    'svg'   => 'image/svg+xml',
    'ico'   => 'image/x-icon',
    'woff'  => 'font/woff',
    'woff2' => 'font/woff2',
    'ttf'   => 'font/ttf',
    'eot'   => 'application/vnd.ms-fontobject',
    'map'   => 'application/json',
    'xml'   => 'application/xml',
    'txt'   => 'text/plain',
];

// Scope path is reused by the trailing-slash 301 (Location must be
// scope-aware) and the REQUEST_URI re-attachment further down.
$scopePath = '';
if (isset($_SERVER['HTTP_X_PLAYGROUND_ABSOLUTE_URL'])) {
    $maybeScope = parse_url(
        $_SERVER['HTTP_X_PLAYGROUND_ABSOLUTE_URL'],
        PHP_URL_PATH
    );
    if (is_string($maybeScope) && $maybeScope !== '' && $maybeScope !== '/') {
        $scopePath = rtrim($maybeScope, '/');
    }
}

// Add trailing slash to directory URLs (mirror classic-mode 301).
// Otherwise /wp-admin renders, but the iframe URL bar stays at the
// un-canonical /wp-admin and relative admin links break.
if ($uri !== '/' && substr($uri, -1) !== '/' && is_dir($file)) {
    $location = $scopePath . $uri . '/';
    if (!empty($_SERVER['QUERY_STRING'])) {
        $location .= '?' . $_SERVER['QUERY_STRING'];
    }
    header('Location: ' . $location, true, 301);
    exit;
}

// Resolve directory URLs to index.php (e.g. /wp-admin/ -> /wp-admin/index.php)
if (is_dir($file)) {
    $idx = rtrim($file, '/') . '/index.php';
    if (is_file($idx)) {
        $file = $idx;
        $uri = rtrim($uri, '/') . '/index.php';
    }
}

// Re-attach the scope to REQUEST_URI so WP-internal URL builders
// (auth_redirect, redirect_canonical, ...) agree with home_url().
if ($scopePath !== '') {
    $reqUri = $_SERVER['REQUEST_URI'];
    if (
        $reqUri !== $scopePath &&
        strpos($reqUri, $scopePath . '/') !== 0
    ) {
        $_SERVER['REQUEST_URI'] = $scopePath . $reqUri;
    }
}

// WP subdir multisite: \`/<slug>/wp-(admin|content|includes)/…\` and
// \`/<slug>/<file>.php\` rewrite the FILE lookup to the unslugged path
// while REQUEST_URI keeps its /<slug>/ prefix so WP's ms-load.php can
// dispatch to the right subsite. Mirrors the .htaccess rules WP
// generates for subdirectory multisite installs.
if (!is_file($file) && !is_dir($file)) {
    if (preg_match(
        '#^/[_0-9a-zA-Z-]+/(wp-(?:admin|content|includes)(?:/.*)?|[^/]+\\.php)$#',
        $uri,
        $m
    )) {
        $alt = $docRoot . '/' . $m[1];
        if (is_file($alt)) {
            $file = $alt;
        }
    }
}

if ($uri !== '/' && is_file($file)) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (isset($staticTypes[$ext])) {
        header('Content-Type: ' . $staticTypes[$ext]);
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    if ($ext === 'php') {
        chdir(dirname($file));
        include $file;
        exit;
    }
}

$indexPath = $docRoot . '/index.php';
if (is_file($indexPath)) {
    chdir($docRoot);
    include $indexPath;
    exit;
}
// PHP-only mode (no WordPress installed) or an unrecognized path with
// no docroot index.php. Surface a clean 404 instead of the misleading
// "include(/var/www/html/index.php): Failed to open stream" warning.
header('Content-Type: text/plain; charset=utf-8', true, 404);
echo "Not Found\\n";
exit;
`;

const WP_CONFIG_PHP = `<?php
define('DB_NAME', 'wordpress');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_HOST', '');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');

define('DB_DIR', __DIR__ . '/wp-content/database/');
define('DB_FILE', 'wordpress.db');

define('AUTH_KEY',         'kandelo-dev');
define('SECURE_AUTH_KEY',  'kandelo-dev');
define('LOGGED_IN_KEY',    'kandelo-dev');
define('NONCE_KEY',        'kandelo-dev');
define('AUTH_SALT',        'kandelo-dev');
define('SECURE_AUTH_SALT', 'kandelo-dev');
define('LOGGED_IN_SALT',   'kandelo-dev');
define('NONCE_SALT',       'kandelo-dev');

$table_prefix = 'wp_';

// Guards so the playground-defines auto-prepend wins when a blueprint
// overrides these; otherwise the redefine warning is printed and breaks
// header()-based redirects.
if (!defined('WP_DEBUG')) {
    define('WP_DEBUG', true);
}
if (!defined('WP_DEBUG_LOG')) {
    define('WP_DEBUG_LOG', true);
}
if (!defined('WP_DEBUG_DISPLAY')) {
    define('WP_DEBUG_DISPLAY', false);
}
@ini_set('display_errors', '0');

// Every browser-side request (and the install probe) carries an
// X-Playground-Absolute-Url header with the scoped site URL — see
// playground-worker-endpoint.ts:requestStreamed and
// ensureWordPressInstalled. Use it as WP_HOME / WP_SITEURL so
// WordPress renders absolute URLs that route back through the
// service-worker scope. PHP-CLI invocations (KernelLimitedPHPApi.run)
// don't set this header and fall through to whatever's in wp_options.
if (isset($_SERVER['HTTP_X_PLAYGROUND_ABSOLUTE_URL'])) {
    $playground_site_url = $_SERVER['HTTP_X_PLAYGROUND_ABSOLUTE_URL'];
    if (substr($playground_site_url, 0, 8) === 'https://') {
        $_SERVER['HTTPS'] = 'on';
    }
    define('WP_HOME', $playground_site_url);
    define('WP_SITEURL', $playground_site_url);
}

define('WP_HTTP_BLOCK_EXTERNAL', true);
define('DISABLE_WP_CRON', true);

/* That's all, stop editing! Happy publishing. */
// ^ Marker line: wp-cli's \`core multisite-convert\` inserts MULTISITE,
//   SUBDOMAIN_INSTALL, DOMAIN_CURRENT_SITE, etc. immediately above it.
//   Without the marker, wp-cli falls back to appending after
//   wp-settings.php is required, so the constants never run.

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
`;

const WASM_OPTIMIZATIONS_MU_PLUGIN = `<?php
add_filter('pre_wp_mail', '__return_false');
add_filter('pre_http_request', function($pre, $args, $url) {
    return new WP_Error('http_disabled', 'HTTP requests disabled in Wasm');
}, 10, 3);
add_filter('plugins_api_result', function ($res) {
    if ($res instanceof WP_Error) {
        $res = new WP_Error(
            'plugins_api_failed',
            'Network access is an experimental, opt-in feature'
        );
    }
    return $res;
});
`;

// Paths track what's extracted in `extractArchiveIntoVfs` above: the
// SQLite plugin lives at `/var/www/html/wp-content/plugins/sqlite-…`
// and its mysql-on-sqlite loader is `wp-includes/database/load.php`.
// `path` matches `DB_DIR` + `DB_FILE` in `WP_CONFIG_PHP`.
const WP_ENV_PHP = `<?php return array(
    'db' => array(
        'type' => 'sqlite',
        'path' => '/var/www/html/wp-content/database/wordpress.db',
        'driver_path' => '/var/www/html/wp-content/plugins/sqlite-database-integration/wp-includes/database/load.php',
    ),
);
`;
