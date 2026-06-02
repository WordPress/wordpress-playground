/**
 * Browser counterpart of `packages/playground/cli/src/posix-kernel/
 * prepare-wordpress.ts`.
 *
 * The CLI version downloads WordPress + the SQLite drop-in to disk and
 * lays out a document root for nginx to serve. The browser version
 * returns the raw zip bytes so {@link buildVfsImage} can stream them
 * directly into the in-memory VFS — no disk intermediary, no Node FS.
 *
 * Two zips come back:
 *
 *   1. WordPress core — for the bundled minified versions, resolved at
 *      build time via `getWordPressModuleDetails` (same Vite-bundled
 *      same-origin asset the classic worker fetches). For `trunk` /
 *      arbitrary version queries, falls back to `resolveWordPressRelease`
 *      from `@wp-playground/wordpress` plus a CORS proxy for any host
 *      that doesn't serve CORS.
 *   2. sqlite-database-integration — pre-bundled inside
 *      `@wp-playground/wordpress-builds`'s assets and resolved at
 *      build time via `getSqliteDriverModuleDetails`. Same source the
 *      classic worker uses.
 */
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import {
	getSqliteDriverModuleDetails,
	getWordPressModuleDetails,
	MinifiedWordPressVersionsList,
	wpVersionToStaticAssetsDirectory,
} from '@wp-playground/wordpress-builds';

/**
 * The SQLite driver bundle versions shipped by `@wp-playground/wordpress-
 * builds`. `v2.1.16` is the version the CLI's `prepare-wordpress.ts`
 * pins to for the posix-kernel path, so we default to the same here for
 * parity. Callers needing PHP 5.2 should pass `v3.0.0-rc.3-php52`.
 */
export type SqliteDriverVersion = 'trunk' | 'v2.1.16' | 'v3.0.0-rc.3-php52';

export interface PrepareWordPressZipsOptions {
	/** Forwarded to `resolveWordPressRelease`. Default `'latest'`. */
	wpVersionQuery?: string;
	/** Default `'v2.1.16'` — matches the CLI posix-kernel default. */
	sqliteVersion?: SqliteDriverVersion;
	/**
	 * Same CORS proxy URL the classic worker uses (the `virtual:cors-
	 * proxy-url` module is the usual source). Applied only to URLs
	 * that need it; passed through as-is for wordpress.org.
	 */
	corsProxyUrl?: string;
	/** Optional progress monitor — wires download bytes to `onDownloadProgress`. */
	monitor?: EmscriptenDownloadMonitor;
	/** Status callback (resolved version, "Downloading WP X.Y", etc.). */
	onStatus?: (message: string) => void;
}

export interface PrepareWordPressZipsResult {
	wpZipBytes: Uint8Array;
	sqliteZipBytes: Uint8Array;
	/**
	 * The bundled minified key (e.g. `'6.8'`) when fetched from the local
	 * Vite asset, otherwise the concrete release version (e.g. `'6.8.5'`)
	 * resolved by `resolveWordPressRelease`.
	 */
	wpVersion: string;
	/**
	 * Top-level directory inside `wpZipBytes` to strip when extracting,
	 * or `undefined` when files sit at the archive root. The bundled
	 * `wp-X.Y.zip` ships flat; `downloads.w.org/release/wordpress-X.Y.Z
	 * .zip` wraps everything in `wordpress/`.
	 */
	wpZipStripLeadingDir?: string;
	/**
	 * Companion archive shipping every static asset the bundled
	 * `wp-X.Y.zip` strips at build time (admin CSS/JS, theme screenshots,
	 * editor styles, etc.). Present only when `wpZipBytes` came from the
	 * bundled path; classic mode backfills these at runtime via
	 * `backfillStaticFilesRemovedFromMinifiedBuild`, but kernel mode
	 * extracts them into the VFS image at build time.
	 */
	wpStaticZipBytes?: Uint8Array;
}

export async function prepareWordPressZips(
	options: PrepareWordPressZipsOptions = {}
): Promise<PrepareWordPressZipsResult> {
	const wpVersionQuery = options.wpVersionQuery ?? 'latest';
	const sqliteVersion = options.sqliteVersion ?? 'v2.1.16';
	const onStatus = options.onStatus ?? (() => undefined);
	const monitor = options.monitor;

	let wpZipBytes: Uint8Array;
	let wpVersion: string;
	let wpZipStripLeadingDir: string | undefined;
	let wpStaticZipBytes: Uint8Array | undefined;

	// Mirror classic mode (`playground-worker-endpoint-blueprints-v1.ts`):
	// for bundled minified versions, fetch the Vite-bundled same-origin
	// asset rather than `downloads.w.org` through the CORS proxy. The
	// `php -S` proxy is fragile under parallel workers — one >30s
	// curl_exec takes the whole sidecar down, cascading every later
	// test. `trunk`/`nightly` still return an upstream GitHub URL from
	// `getWordPressModuleDetails`, so fall through to the proxy path
	// when the bundled entry isn't a local asset.
	const bundled = MinifiedWordPressVersionsList.includes(wpVersionQuery)
		? getWordPressModuleDetails(wpVersionQuery)
		: null;
	if (bundled && !/^https?:\/\//.test(bundled.url)) {
		onStatus(`Downloading WordPress ${wpVersionQuery}`);
		wpZipBytes = await fetchZipBytes(bundled.url, monitor, bundled.size);
		wpVersion = wpVersionQuery;
		// Bundled `wp-X.Y.zip` files are flat — no `wordpress/` wrapper.
		wpZipStripLeadingDir = undefined;
		// Pair the minified core with its companion static-asset archive
		// (admin CSS/JS, theme screenshots, …) — classic mode fetches this
		// at runtime via `backfillStaticFilesRemovedFromMinifiedBuild`;
		// kernel mode bakes it into the VFS image at build time. Served
		// same-origin by `@wp-playground/wordpress-builds` under the
		// version-keyed directory.
		const staticDir = wpVersionToStaticAssetsDirectory(wpVersionQuery);
		if (staticDir) {
			const staticUrl = `/${staticDir}/wordpress-static.zip`;
			onStatus(`Downloading WordPress static assets ${wpVersionQuery}`);
			wpStaticZipBytes = await fetchZipBytes(staticUrl, monitor);
		}
	} else {
		onStatus(`Resolving WordPress ${wpVersionQuery}`);
		const release = await resolveWordPressRelease(wpVersionQuery);
		onStatus(`Downloading WordPress ${release.version}`);
		wpZipBytes = await fetchZipBytes(
			maybeProxyUrl(release.releaseUrl, options.corsProxyUrl),
			monitor
		);
		wpVersion = release.version;
		wpZipStripLeadingDir = 'wordpress';
	}

	onStatus(`Downloading sqlite-database-integration ${sqliteVersion}`);
	const sqliteDetails = getSqliteDriverModuleDetails(sqliteVersion);
	const sqliteZipBytes = await fetchZipBytes(
		sqliteDetails.url,
		monitor,
		sqliteDetails.size
	);

	return {
		wpZipBytes,
		sqliteZipBytes,
		wpVersion,
		wpZipStripLeadingDir,
		wpStaticZipBytes,
	};
}

async function fetchZipBytes(
	url: string,
	monitor?: EmscriptenDownloadMonitor,
	expectedSize?: number
): Promise<Uint8Array> {
	if (monitor && expectedSize !== undefined) {
		monitor.expectAssets({ [url]: expectedSize });
	}
	const response = monitor
		? await monitor.monitorFetch(fetch(url))
		: await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to download ${url}: HTTP ${response.status} ` +
				`${response.statusText}`
		);
	}
	return new Uint8Array(await response.arrayBuffer());
}

/**
 * Route WP-archive URLs through a CORS proxy when they target a host
 * that doesn't serve `Access-Control-Allow-Origin`. The classic v1
 * worker proxies its own `https://wordpress.org/wordpress-X.Y.Z.zip`
 * URLs unconditionally (see
 * `playground-worker-endpoint-blueprints-v1.ts:137-140`) — we mirror
 * that for the canonical-release host (`downloads.w.org`) plus the
 * other wordpress.org family hostnames `resolveWordPressRelease` might
 * return, and for GitHub archives.
 */
function maybeProxyUrl(url: string, corsProxyUrl?: string): string {
	if (!corsProxyUrl) return url;
	if (
		url.startsWith('https://github.com/') ||
		url.startsWith('https://downloads.w.org/') ||
		url.startsWith('https://downloads.wordpress.org/') ||
		url.startsWith('https://wordpress.org/')
	) {
		return `${corsProxyUrl}${url}`;
	}
	return url;
}
