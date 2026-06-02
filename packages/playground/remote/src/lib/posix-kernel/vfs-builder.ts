/**
 * Build a fully-bootable VFS image for the browser `--experimental-posix-
 * kernel` mode.
 *
 * Browser port of `wasm-posix-kernel/examples/browser/scripts/build-wp-
 * vfs-image.ts`. The Node script reads binaries from disk with
 * `readFileSync` and walks a pre-extracted WordPress checkout with
 * `walkAndWrite`. In the browser we:
 *
 *   - Pull every wasm binary over `fetch()` using Vite's `?url` imports
 *     wired up by `resolveKernelBinariesPlugin` in
 *     `vite.posix-kernel.config.ts`.
 *   - Stream-decode the WordPress + SQLite-integration zips with
 *     `@php-wasm/stream-compression`'s `decodeZip()` (same helper the
 *     CLI's `prepare-wordpress.ts` uses) and write each entry into the
 *     in-memory VFS directly — no Node FS intermediary.
 *
 * dinit (PID 1) starts `php-fpm` → `nginx`. nginx binds to
 * `127.0.0.1:8080`; `HttpBridgeHost` is wired against the same port in
 * `boot.ts`. wp-config.php is materialized at VFS build time (every
 * request carries `x-playground-absolute-url`, so the wp-config
 * template needs no runtime substitution).
 *
 * Output: bytes from `MemoryFileSystem.saveImage()` — pass straight to
 * `BrowserKernel.boot({ vfsImage })`.
 */

import { decodeZip } from '@php-wasm/stream-compression';
import { dirname, joinPaths } from '@php-wasm/util';
import { MemoryFileSystem } from './host-bridge';

import {
	writeVfsFile,
	writeVfsBinary,
	ensureDir,
	ensureDirRecursive,
	symlink,
} from '@wasm-posix-kernel/host/src/vfs/image-helpers';

// `?url` imports resolved by `resolveKernelBinariesPlugin` in
// `vite.posix-kernel.config.ts`. The plugin walks
// `<wasm-posix-kernel>/local-binaries/<rel>` first, then `binaries/<rel>`.
// Binaries must be present at one of those paths for `npm run
// dev:experimental-posix-kernel` to start.
import nginxUrl from '@kernel-binary/programs/wasm32/nginx.wasm?url';
import phpFpmUrl from '@kernel-binary/programs/wasm32/php/php-fpm.wasm?url';
import phpUrl from '@kernel-binary/programs/wasm32/php/php.wasm?url';
import dashUrl from '@kernel-binary/programs/wasm32/dash.wasm?url';
import coreutilsUrl from '@kernel-binary/programs/wasm32/coreutils.wasm?url';
import lessUrl from '@kernel-binary/programs/wasm32/less.wasm?url';
import dinitUrl from '@kernel-binary/programs/wasm32/dinit/dinit.wasm?url';
import dinitctlUrl from '@kernel-binary/programs/wasm32/dinit/dinitctl.wasm?url';

import AUTO_LOGIN_MU_PLUGIN from './wp-templates/auto-login.php?raw';

/**
 * Initial / max sizes for the SharedArrayBuffer that backs the VFS.
 * WordPress core + SQLite drop-in totals ~80 MiB on disk; 128 MiB
 * initial / 256 MiB ceiling matches the demo's working sizes. The
 * worker-side kernel can grow the SAB up to 1 GiB at runtime for
 * larger workloads.
 */
const VFS_INITIAL_BYTES = 128 * 1024 * 1024;
const VFS_MAX_BYTES = 256 * 1024 * 1024;

export interface BuildVfsImageOptions {
	/**
	 * WordPress core zip + SQLite drop-in zip. Both omitted for PHP-only
	 * mode; both required otherwise.
	 */
	wpZipBytes?: Uint8Array;
	sqliteZipBytes?: Uint8Array;
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
	 * `playground-worker-endpoint.ts:200` when networking is off.
	 * Default `true`.
	 */
	withNetworking?: boolean;
	/** Status callback (download progress, populate steps). */
	onStatus?: (message: string) => void;
}

export async function buildVfsImage(
	options: BuildVfsImageOptions
): Promise<Uint8Array> {
	const onStatus = options.onStatus ?? (() => undefined);

	const sab = new SharedArrayBuffer(VFS_INITIAL_BYTES, {
		maxByteLength: VFS_MAX_BYTES,
	});
	const fs = MemoryFileSystem.create(sab, VFS_MAX_BYTES);

	onStatus('Populating system directories and configs');
	populateSystem(fs);
	await populateServerBinaries(fs);
	await populateUserBinaries(fs);
	populatePreloadFiles(fs);
	populateShellSymlinks(fs);
	populateNginxConfig(fs);
	populatePhpFpmConfig(fs, options.withNetworking !== false);

	// php-api.ts chdirs here and the FPM router includes `${DOCROOT}/index.php`,
	// so the doc root must exist even in PHP-only mode.
	ensureDirRecursive(fs, '/var/www/html');
	if (options.wpZipBytes) {
		onStatus('Writing wp-config.php');
		writeVfsFile(fs, '/var/www/html/wp-config.php', WP_CONFIG_PHP);

		ensureDirRecursive(fs, '/var/www/html/wp-content/database');
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

		onStatus('Extracting WordPress core into VFS');
		await extractZipIntoVfs(fs, '/var/www/html', options.wpZipBytes, {
			stripLeadingDir: options.wpZipStripLeadingDir,
			// Drop the archive's own `wp-config.php` (the bundled
			// `wp-X.Y.zip` ships a sample with `DB_HOST=localhost` that
			// would clobber the kernel-tailored config written above).
			exclude: (rel) => rel.endsWith('.db') || rel === 'wp-config.php',
		});

		if (options.wpStaticZipBytes) {
			onStatus('Extracting WordPress static assets into VFS');
			await extractZipIntoVfs(
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
		await extractZipIntoVfs(
			fs,
			sqliteMountPrefix,
			options.sqliteZipBytes!,
			{
				stripLeadingDir: 'sqlite-database-integration',
				exclude: (rel) => rel.endsWith('.db'),
				onEntry: (relPath, bytes) => {
					if (relPath === 'db.copy') {
						dbCopyBytes = bytes;
					}
				},
			}
		);
		if (dbCopyBytes) {
			writeVfsBinary(
				fs,
				'/var/www/html/wp-content/db.php',
				dbCopyBytes,
				0o644
			);
		}
	}

	onStatus('Installing dinit + service tree');
	await addDinitInit(fs, buildServices());

	onStatus('Serializing VFS image');
	return await fs.saveImage();
}

// --- System setup -----------------------------------------------------

/**
 * Top-level directories + /etc baseline files. POSIX programs expect
 * these layouts even if the values are never read by our daemons.
 */
function populateSystem(fs: MemoryFileSystem): void {
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
	]) {
		ensureDir(fs, dir);
	}
	fs.chmod('/tmp', 0o777);

	writeVfsFile(fs, '/etc/services', ETC_SERVICES);
}

/**
 * Fetch every wasm binary in parallel and write into the VFS at the
 * paths the dinit service tree expects. Symlinks for shell utilities
 * are added in {@link populateShellSymlinks}; here we only place the
 * underlying multicall binary at each canonical path.
 */
async function populateServerBinaries(fs: MemoryFileSystem): Promise<void> {
	const [dashBytes, nginxBytes, phpFpmBytes, coreutilsBytes] =
		await Promise.all([
			fetchBinary(dashUrl),
			fetchBinary(nginxUrl),
			fetchBinary(phpFpmUrl),
			fetchBinary(coreutilsUrl),
		]);

	writeVfsBinary(fs, '/bin/dash', dashBytes);
	symlink(fs, '/bin/dash', '/bin/sh');
	symlink(fs, '/bin/dash', '/usr/bin/dash');
	symlink(fs, '/bin/dash', '/usr/bin/sh');

	writeVfsBinary(fs, '/usr/sbin/nginx', nginxBytes);
	writeVfsBinary(fs, '/usr/sbin/php-fpm', phpFpmBytes);
	writeVfsBinary(fs, '/bin/coreutils', coreutilsBytes);
}

/**
 * Binaries that aren't part of the dinit service tree but must be on
 * `$PATH` so PHP code running inside php-fpm can shell out to them via
 * `proc_open()`. The boot env sets
 * `PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin`
 * (`boot.ts:bootKernelWordPress`); placing each binary at one of those
 * locations lets `/bin/sh -c '<cmd>'` resolve it without the caller
 * having to spell out an absolute path.
 *
 * `php` lands at `/usr/local/bin/php` (matches the upstream demo's
 * convention in `wasm-posix-kernel/examples/browser/pages/php/main.ts`);
 * `less` lands at `/usr/bin/less` (upstream's `shell-vfs-build.ts`
 * convention). The php.wasm bytes are also fetched a second time by
 * `playground-worker-endpoint.ts` for the host-side
 * `KernelSpawnAdapter`; the browser's HTTP cache dedupes the two
 * `fetch()` calls so this redundancy is essentially free.
 */
async function populateUserBinaries(fs: MemoryFileSystem): Promise<void> {
	const [phpBytes, lessBytes] = await Promise.all([
		fetchBinary(phpUrl),
		fetchBinary(lessUrl),
	]);
	writeVfsBinary(fs, '/usr/local/bin/php', phpBytes);
	writeVfsBinary(fs, '/usr/bin/less', lessBytes);
}

/**
 * Platform-level preload scripts. The php-fpm pool config sets
 * `auto_prepend_file` to the loader below, which globs `preload/*.php`
 * and `require_once`'s each file before WordPress boots.
 */
function populatePreloadFiles(fs: MemoryFileSystem): void {
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
function populateShellSymlinks(fs: MemoryFileSystem): void {
	for (const name of [...COREUTILS_NAMES, '[']) {
		symlink(fs, '/bin/coreutils', `/bin/${name}`);
		symlink(fs, '/bin/coreutils', `/usr/bin/${name}`);
	}

	symlink(fs, '/usr/bin/grep', '/bin/grep');
	symlink(fs, '/usr/bin/grep', '/usr/bin/egrep');
	symlink(fs, '/usr/bin/grep', '/bin/egrep');
	symlink(fs, '/usr/bin/grep', '/usr/bin/fgrep');
	symlink(fs, '/usr/bin/grep', '/bin/fgrep');
}

/**
 * nginx config — verbatim copy of the demo's `populateNginxConfig`.
 * Listens on `127.0.0.1:8080` (the port `HttpBridgeHost` connects to).
 * Static-asset directories under wp-includes/wp-admin/wp-content are
 * served by nginx directly; everything else routes through the FPM
 * front controller at `/var/www/fpm-router.php`.
 */
function populateNginxConfig(fs: MemoryFileSystem): void {
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
	fs: MemoryFileSystem,
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
}

// --- dinit init system -----------------------------------------------

interface DinitService {
	name: string;
	type?: 'process' | 'scripted' | 'internal';
	command?: string;
	dependsOn?: string[];
	restart?: boolean;
	logfile?: string;
}

/**
 * Boot order: php-fpm → nginx. wp-config.php is materialized at VFS
 * build time, so there's no runtime substitution step.
 */
function buildServices(): DinitService[] {
	return [
		{
			name: 'php-fpm',
			type: 'process',
			// -c /dev/null suppresses default php.ini lookup (which lands
			// on /usr/local/lib/php/php.ini-development by default and
			// trips unsupported-config errors on the wasm port).
			command:
				'/usr/sbin/php-fpm -y /etc/php-fpm.conf -c /dev/null --nodaemonize',
			logfile: '/var/log/php-fpm.log',
			restart: false,
		},
		{
			name: 'nginx',
			type: 'process',
			command: '/usr/sbin/nginx -c /etc/nginx/nginx.conf',
			dependsOn: ['php-fpm'],
			logfile: '/var/log/nginx.log',
			restart: false,
		},
	];
}

/**
 * Browser port of `dinit-image-helpers.ts:addDinitInit`. The Node
 * helper reads dinit/dinitctl off disk via `readFileSync`; here we
 * fetch through the same `?url` indirection used for the server
 * binaries. The rest (passwd/group/hosts baseline, /etc/dinit.d/boot
 * implicit service, per-service files) is straight from the helper.
 */
async function addDinitInit(
	fs: MemoryFileSystem,
	services: DinitService[]
): Promise<void> {
	ensureDirRecursive(fs, '/sbin');
	const [dinitBytes, dinitctlBytes] = await Promise.all([
		fetchBinary(dinitUrl),
		fetchBinary(dinitctlUrl),
	]);
	writeVfsBinary(fs, '/sbin/dinit', dinitBytes);
	writeVfsBinary(fs, '/sbin/dinitctl', dinitctlBytes);

	ensureDirRecursive(fs, '/etc');
	writeVfsFile(fs, '/etc/passwd', ETC_PASSWD);
	writeVfsFile(fs, '/etc/group', ETC_GROUP);
	writeVfsFile(fs, '/etc/hosts', ETC_HOSTS);

	ensureDirRecursive(fs, '/var/log');
	fs.chmod('/var/log', 0o755);
	ensureDirRecursive(fs, '/run');
	fs.chmod('/run', 0o755);

	ensureDirRecursive(fs, '/etc/dinit.d');

	// Implicit `boot` service that depends on every supplied service.
	// Matches the demo's default — `argv=['/sbin/dinit', '--container',
	// ...]` in `boot.ts` boots the whole tree.
	const boot: DinitService = {
		name: 'boot',
		type: 'internal',
		dependsOn: services.map((s) => s.name),
	};
	writeVfsFile(fs, '/etc/dinit.d/boot', renderDinitService(boot));
	for (const svc of services) {
		writeVfsFile(fs, `/etc/dinit.d/${svc.name}`, renderDinitService(svc));
	}
}

function renderDinitService(svc: DinitService): string {
	const lines: string[] = [];
	lines.push(`type = ${svc.type ?? 'process'}`);
	if (svc.command) lines.push(`command = ${svc.command}`);
	for (const dep of svc.dependsOn ?? []) lines.push(`depends-on = ${dep}`);
	// dinit defaults `restart` to ON_FAILURE — always emit explicitly so
	// a missing field doesn't silently flip into a restart loop.
	lines.push(svc.restart ? 'restart = true' : 'restart = false');
	if (svc.logfile !== undefined) lines.push(`logfile = ${svc.logfile}`);
	lines.push('');
	return lines.join('\n');
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

interface ExtractZipOptions {
	/**
	 * If set, only entries whose path starts with `<stripLeadingDir>/`
	 * (or `<stripLeadingDir>-<suffix>/` for versioned plugin zips) are
	 * kept; the prefix is removed from every output path before
	 * mounting under `mountPrefix`.
	 */
	stripLeadingDir?: string;
	/** Skip entries by relative path (post-strip). */
	exclude?: (relPath: string) => boolean;
	/**
	 * Skip entries whose target path already exists. Mirrors classic
	 * mode's `unzipFile(..., noOverwrite=true)` semantics — used for the
	 * static-asset backfill so the bundled WP archive's contents win on
	 * any overlap.
	 */
	noOverwrite?: boolean;
	/** Observe each materialized file (post-strip) — used to fish out
	 *  db.copy from the SQLite zip without a second pass. */
	onEntry?: (relPath: string, bytes: Uint8Array) => void;
}

/**
 * Stream-decode a zip and write entries under `mountPrefix` in the
 * VFS. Same shape as the CLI's `extractZipToDir` but writes through
 * `MemoryFileSystem` helpers instead of `node:fs`.
 */
async function extractZipIntoVfs(
	fs: MemoryFileSystem,
	mountPrefix: string,
	zipBytes: Uint8Array,
	options: ExtractZipOptions = {}
): Promise<void> {
	// Use `Blob([bytes]).stream()` instead of a hand-rolled byte stream
	// with a single pre-enqueued chunk. Chrome's `ReadableStream({type:
	// 'bytes'})` with one large queued chunk does not drain reliably
	// through `limitBytes`' BYOB reader — the body stream closes short
	// and `DecompressionStream('gzip')` throws "Compressed input was
	// truncated." `Blob.stream()` returns a natively-chunked byte stream
	// that handles BYOB reads correctly. (CLI uses the manual byte-stream
	// pattern successfully on Node because Node's implementation drains
	// the queue differently.)
	const stream = new Blob([zipBytes as BlobPart]).stream();
	const reader = decodeZip(stream).getReader();
	ensureDirRecursive(fs, mountPrefix);

	let entriesProcessed = 0;
	let lastEntryName: string | null = null;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (!value) continue;
			lastEntryName = value.name;

			let relPath = value.name;
			if (options.stripLeadingDir !== undefined) {
				const stripped = stripLeadingDirPrefix(
					relPath,
					options.stripLeadingDir
				);
				if (stripped === null) continue;
				relPath = stripped;
			}
			if (relPath === '' || relPath === '/') continue;
			if (options.exclude?.(relPath)) continue;

			const targetPath = joinPaths(mountPrefix, relPath);
			if (value.type === 'directory') {
				ensureDirRecursive(fs, targetPath);
				continue;
			}
			if (options.noOverwrite && pathExists(fs, targetPath)) {
				continue;
			}
			ensureDirRecursive(fs, dirname(targetPath));
			const bytes = new Uint8Array(await value.arrayBuffer());
			writeVfsBinary(fs, targetPath, bytes, 0o644);
			options.onEntry?.(relPath, bytes);
			entriesProcessed += 1;
		}
	} catch (err) {
		throw new Error(
			`extractZipIntoVfs: failed after ${entriesProcessed} entries, ` +
				`last entry name="${lastEntryName ?? '<none>'}" — ` +
				`${(err as Error).message}`,
			{ cause: err as Error }
		);
	}
}

function pathExists(fs: MemoryFileSystem, path: string): boolean {
	try {
		fs.stat(path);
		return true;
	} catch {
		return false;
	}
}

function stripLeadingDirPrefix(path: string, dirName: string): string | null {
	const exactPrefix = `${dirName}/`;
	if (path === exactPrefix) return '';
	if (path.startsWith(exactPrefix)) return path.slice(exactPrefix.length);
	const versionedPrefix = `${dirName}-`;
	if (path.startsWith(versionedPrefix)) {
		const slash = path.indexOf('/');
		if (slash > -1) return path.slice(slash + 1);
	}
	return null;
}

// --- Inlined constants (mirror build-wp-vfs-image.ts) -----------------

/**
 * GNU coreutils multicall command names (91 entries). Each becomes a
 * symlink under /bin and /usr/bin pointing at `/bin/coreutils`. Kept
 * inline rather than importing from
 * `wasm-posix-kernel/examples/browser/lib/init/shell-binaries` so the
 * dependency graph stays narrow (that module also pulls in BrowserKernel
 * type-level — fine here, but inlining keeps the worker entry hermetic).
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
error_log stderr info;
pid /tmp/nginx.pid;

events {
    worker_connections 64;
    use poll;
}

http {
    access_log /dev/stderr;
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
error_log = /dev/stderr
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
`;

/**
 * Appended to {@link PHP_FPM_CONF} when the kernel is booted with
 * `withNetworking: false`. Mirrors the php.ini surface classic mode
 * flips off in `playground-worker-endpoint.ts` (lines 200-208):
 * `allow_url_fopen = 0` is what surfaces the
 * "https:// wrapper is disabled in the server configuration" notice
 * that `blueprints.spec.ts:746` asserts on, and the disabled
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

chdir($docRoot);
include $docRoot . '/index.php';
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

define('AUTH_KEY',         'wasm-posix-kernel-dev');
define('SECURE_AUTH_KEY',  'wasm-posix-kernel-dev');
define('LOGGED_IN_KEY',    'wasm-posix-kernel-dev');
define('NONCE_KEY',        'wasm-posix-kernel-dev');
define('AUTH_SALT',        'wasm-posix-kernel-dev');
define('SECURE_AUTH_SALT', 'wasm-posix-kernel-dev');
define('LOGGED_IN_SALT',   'wasm-posix-kernel-dev');
define('NONCE_SALT',       'wasm-posix-kernel-dev');

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

// Paths track what's extracted in `extractZipIntoVfs` below: the
// SQLite plugin lives at `/var/www/html/wp-content/plugins/sqlite-…`
// and its mysql-on-sqlite loader is `wp-pdo-mysql-on-sqlite.php`.
// `path` matches FQDB in `WP_CONFIG_PHP`.
const WP_ENV_PHP = `<?php return array(
    'db' => array(
        'type' => 'sqlite',
        'path' => '/var/www/html/wp-content/database/wordpress.db',
        'driver_path' => '/var/www/html/wp-content/plugins/sqlite-database-integration/wp-pdo-mysql-on-sqlite.php',
    ),
);
`;
