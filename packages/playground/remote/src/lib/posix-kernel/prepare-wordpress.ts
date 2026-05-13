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
 *   1. WordPress core — resolved via `resolveWordPressRelease` from
 *      `@wp-playground/wordpress`. Falls through a CORS proxy for
 *      GitHub-hosted archives (wordpress.org sets CORS so it doesn't
 *      need one).
 *   2. sqlite-database-integration — pre-bundled inside
 *      `@wp-playground/wordpress-builds`'s assets and resolved at
 *      build time via `getSqliteDriverModuleDetails`. Same source the
 *      classic worker uses.
 */
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { getSqliteDriverModuleDetails } from '@wp-playground/wordpress-builds';

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
	/** Concrete version returned by `resolveWordPressRelease` (e.g. `6.8.0`). */
	wpVersion: string;
}

export async function prepareWordPressZips(
	options: PrepareWordPressZipsOptions = {}
): Promise<PrepareWordPressZipsResult> {
	const wpVersionQuery = options.wpVersionQuery ?? 'latest';
	const sqliteVersion = options.sqliteVersion ?? 'v2.1.16';
	const onStatus = options.onStatus ?? (() => undefined);
	const monitor = options.monitor;

	onStatus(`Resolving WordPress ${wpVersionQuery}`);
	const release = await resolveWordPressRelease(wpVersionQuery);

	onStatus(`Downloading WordPress ${release.version}`);
	const wpZipBytes = await fetchZipBytes(
		maybeProxyUrl(release.releaseUrl, options.corsProxyUrl),
		monitor
	);

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
		wpVersion: release.version,
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
