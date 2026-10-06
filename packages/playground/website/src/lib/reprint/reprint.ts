import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import type { PlaygroundClient } from '@wp-playground/client';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export const REPRINT_VERSION = 'v0.10.13';
const PHAR_PATH = '/tmp/playground-reprint.phar';
const BRIDGE_PATH = '/tmp/playground-reprint-bridge.php';
const PHAR_SHA256 =
	'72bc95ac0623232054d1fb454f497fe8bc9e7db5c0f38e4b097a91639c735fda';
export type ReprintAvailability =
	| 'configured'
	| 'needs-key'
	| 'not-detected'
	| 'unreachable';

export type TransferProgress = {
	message: string;
	error?: string;
	phase?: string;
	percent?: number;
	overallPercent?: number;
	bytesDone?: number;
	bytesTotal?: number;
	filesDone?: number;
	filesTotal?: number;
	/** One line of finer-grained context, e.g. the table being downloaded. */
	detail?: string;
};

/** A progress record that may leave the heading as it is. */
export type TransferProgressUpdate = Omit<TransferProgress, 'message'> & {
	message?: string;
};

type TransferResult = {
	status: 'continue' | 'install' | 'complete';
	stage?: string;
};

/** Probe without a key. A generic 403 or a login page does not identify Reprint. */
export async function detectReprint(
	url: string,
	signal: AbortSignal
): Promise<ReprintAvailability> {
	if (signal.aborted) return 'unreachable';
	const endpoint = new URL(normalizeReprintUrl(url));
	endpoint.searchParams.set('endpoint', 'preflight');
	// An install or key change must be visible even if the host caches API URLs.
	endpoint.searchParams.set('_cache_bust', crypto.randomUUID());
	const controller = new AbortController();
	let abort!: () => void;
	// Aborting the network request alone does not bound a stalled response body
	// or transport that ignores cancellation. End the check independently too.
	const cancelled = new Promise<ReprintAvailability>((resolve) => {
		abort = () => {
			resolve('unreachable');
			controller.abort();
		};
	});
	signal.addEventListener('abort', abort, { once: true });
	const timeout = setTimeout(abort, 15000);
	try {
		return await Promise.race([
			probeReprint(endpoint.href, controller.signal),
			cancelled,
		]);
	} catch {
		return 'unreachable';
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener('abort', abort);
	}
}

/** Recognize the unauthenticated replies sent by Reprint Server. */
async function probeReprint(
	endpoint: string,
	signal: AbortSignal
): Promise<ReprintAvailability> {
	const response = await fetchWithCorsProxy(
		endpoint,
		{ credentials: 'omit', cache: 'no-store', signal },
		corsProxyUrl
	);
	// v0.10.8 sends JSON as application/octet-stream, including auth errors.
	const body = await response.json().catch(() => null);
	if (
		response.status === 403 &&
		body?.code === 403 &&
		body.error === 'Missing X-Auth-Signature header'
	)
		return 'configured';
	if (
		response.status === 503 &&
		body?.code === 503 &&
		body.error ===
			'Export not configured. Please configure the connection token in WordPress admin under Tools > Reprint Server.'
	)
		return 'needs-key';
	return 'not-detected';
}

/** Link to installation and token settings in this WordPress admin. */
export function getReprintAdminUrls(input: string) {
	const site = new URL(normalizeReprintUrl(input));
	site.search = '';
	if (!site.pathname.endsWith('/')) site.pathname += '/';
	return {
		site: site.href,
		install: new URL('wp-admin/plugin-install.php?tab=upload', site).href,
		settings: new URL('wp-admin/tools.php?page=reprint-server', site).href,
	};
}

/** A site URL and its Reprint API URL must select the same saved remote state. */
export function normalizeReprintUrl(input: string): string {
	const url = new URL(input.trim());
	const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (
		(url.protocol !== 'https:' &&
			!(loopback && url.protocol === 'http:')) ||
		url.username ||
		url.password ||
		url.hash
	) {
		throw new Error(
			'Use an HTTPS site URL without credentials or a fragment.'
		);
	}
	for (const key of url.searchParams.keys()) {
		if (key !== 'reprint-api') {
			throw new Error(
				'Use the site URL or its ?reprint-api endpoint, without other query parameters.'
			);
		}
	}
	url.search = '?reprint-api';
	return url.href;
}

/** Install the pinned client only after verifying its bytes. */
export async function installReprint(
	playground: PlaygroundClient,
	onProgress: (progress: TransferProgress) => void
) {
	let bytes = (await playground.fileExists(PHAR_PATH))
		? await playground.readFileAsBuffer(PHAR_PATH)
		: undefined;
	// Existing Playgrounds may still cache the previous pinned release. Replace
	// it only after the newly downloaded client passes the current checksum.
	if (!bytes || !(await hasPinnedReprintChecksum(bytes))) {
		onProgress({ message: 'Downloading Reprint…' });
		const response = await fetchWithCorsProxy(
			`https://github.com/WordPress/reprint/releases/download/${REPRINT_VERSION}/reprint.phar`,
			undefined,
			corsProxyUrl,
			await playground.absoluteUrl
		);
		if (!response.ok) throw new Error('Could not download Reprint.');
		bytes = new Uint8Array(await response.arrayBuffer());
		if (!(await hasPinnedReprintChecksum(bytes))) {
			throw new Error(
				'The Reprint download did not match the pinned release.'
			);
		}
	}
	await playground.writeFile(PHAR_PATH, bytes);
}

/** Verify cached and downloaded clients against the same release digest. */
async function hasPinnedReprintChecksum(bytes: Uint8Array): Promise<boolean> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	return hash === PHAR_SHA256;
}

/** Run an installed bridge and read its JSON lines while PHP is still running. */
export async function runBridge(
	playground: PlaygroundClient,
	request: {
		command: 'pull' | 'finish-pull';
		url: string;
		secret: string;
		documentRoot: string;
		siteUrl: string;
		databasePath?: string;
	},
	onProgress: (progress: TransferProgressUpdate) => void
): Promise<TransferResult> {
	// Every stage rewrites files under /tmp. A pooled PHP instance reads that
	// directory through a proxy whose cached nodes outlive deletions made by
	// the primary, so a stage landing there can fail to recreate a file the
	// previous stage removed. Keep all stages on one filesystem view.
	const response = await playground.runStream({
		scriptPath: BRIDGE_PATH,
		env: { PLAYGROUND_REPRINT: JSON.stringify(request) },
		usePrimaryPhp: true,
	});
	let result: TransferResult | undefined;
	let lastError = '';
	let hasByteProgress = false;
	/** Keep the connection token out of returned progress and errors. */
	const redact = (message: string) =>
		message.replaceAll(request.secret, '[redacted]');
	/** Decode chunked JSON lines, including a final line without a newline. */
	const readStdout = async () => {
		const reader = response.stdout
			.pipeThrough(new TextDecoderStream())
			.getReader();
		let pending = '';
		while (true) {
			const { value, done } = await reader.read();
			pending += value ?? '';
			const lines = pending.split('\n');
			pending = lines.pop()!;
			if (done && pending) lines.push(pending);
			for (const line of lines) {
				try {
					const record = JSON.parse(line);
					if (record.playgroundReprint)
						result = record.playgroundReprint;
					if (typeof record.error === 'string')
						lastError = redact(record.error);
					if (record.playgroundProgress) {
						const update = record.playgroundProgress;
						const detail = describeProgress(update);
						onProgress({
							...readProgress(update, redact(update.message)),
							// Clear commentary left by an earlier chunk when this
							// update has counters but no finer-grained context.
							detail,
						});
						hasByteProgress = true;
					} else if (
						record.phase === 'database-records' &&
						typeof record.records_processed === 'number'
					) {
						// URL rewriting runs inside the SQL import stage.
						const table =
							typeof record.current_table === 'string'
								? `${record.current_table} · `
								: '';
						onProgress({
							phase: 'db-apply',
							message: 'Rewriting URLs in the database',
							detail: `${table}${record.records_processed.toLocaleString()} records checked`,
						});
						hasByteProgress = true;
					} else if (
						record.phase === 'db-apply' &&
						record.bytes_read !== undefined
					) {
						onProgress(
							readProgress(
								{
									phase: 'db-apply',
									bytesDone: record.bytes_read,
									bytesTotal: record.bytes_total,
								},
								'Importing SQL'
							)
						);
						hasByteProgress = true;
					} else if (
						!hasByteProgress &&
						record.files_done !== undefined
					) {
						onProgress(
							readProgress(
								{
									filesDone: record.files_done,
									filesTotal: record.files_total,
								},
								'Downloading site files'
							)
						);
					} else if (
						typeof record.message === 'string' &&
						record.status === 'error'
					) {
						onProgress({ message: redact(record.message) });
					} else if (
						typeof record.message === 'string' &&
						!hasByteProgress
					) {
						// Reprint's running commentary ("Following symlink
						// target: …") belongs under the bar; the heading keeps
						// the phase name. Per-file lines during a byte-counted
						// download are noise and stay out.
						onProgress({ detail: redact(record.message) });
					}
				} catch {
					// Reprint may also print plain-text progress. It is not a result.
				}
			}
			if (done) break;
		}
	};
	const [exitCode, stderr] = await Promise.all([
		response.exitCode,
		response.stderrText,
		readStdout(),
	]);
	if (exitCode !== 0 || !result) {
		throw new Error(
			redact(
				lastError ||
					stderr ||
					`Reprint stopped with exit code ${exitCode}.`
			)
		);
	}
	return result;
}

/** The table or statement counters Reprint reports, as one line. */
function describeProgress(record: Record<string, unknown>): string | undefined {
	/** Ignore malformed counters rather than feeding them to the progress UI. */
	const count = (value: unknown) =>
		typeof value === 'number' && Number.isFinite(value) && value >= 0
			? value
			: undefined;
	const rowsDone = count(record.rowsDone);
	if (typeof record.tableName === 'string' && rowsDone !== undefined) {
		const tablesDone = count(record.tablesDone);
		const tablesTotal = count(record.tablesTotal);
		const rowsTotal = count(record.rowsTotal);
		const position =
			tablesDone !== undefined && tablesTotal
				? `Table ${Math.min(tablesDone + 1, tablesTotal)} of ${tablesTotal} · `
				: '';
		// Row totals come from the source's table statistics: an estimate.
		const rows = rowsTotal
			? `${rowsDone.toLocaleString()} of ~${rowsTotal.toLocaleString()} rows`
			: `${rowsDone.toLocaleString()} rows`;
		return `${position}${record.tableName} · ${rows}`;
	}
	const statements = count(record.statementsDone);
	if (statements !== undefined) {
		return `${statements.toLocaleString()} statements applied`;
	}
	return undefined;
}

/** Keep invalid counters out of the progress bar and private paths out of the UI. */
function readProgress(
	record: Record<string, unknown>,
	message: string
): TransferProgress {
	const progress: TransferProgress = { message };
	if (typeof record.phase === 'string') progress.phase = record.phase;
	for (const key of [
		'percent',
		'bytesDone',
		'bytesTotal',
		'filesDone',
		'filesTotal',
	] as const) {
		const value = record[key];
		if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
			progress[key] = value;
		}
	}
	return progress;
}
