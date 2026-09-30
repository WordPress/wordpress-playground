import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import type { PlaygroundClient } from '@wp-playground/client';
import bridge from './bridge.php?raw';
import loginScript from './login.php?raw';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export const REPRINT_VERSION = 'v0.10.10';
const PHAR_PATH = '/tmp/playground-reprint.phar';
const BRIDGE_PATH = '/tmp/playground-reprint-bridge.php';
const PHAR_SHA256 =
	'8a28aa71483668a549b22932d021f3d98d7690f0e858406ddf99e91303a8e4c8';
export type TransferDirection = 'pull' | 'push';
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

/** Runs only after the user confirms the destination and the overwrite boundary. */
export async function transferSite(
	playground: PlaygroundClient,
	direction: TransferDirection,
	url: string,
	secret: string,
	onProgress: (progress: TransferProgress) => void,
	/** Stops after the current PHP run. The checkpoint allows a later resume. */
	signal?: AbortSignal
): Promise<{ warning?: string }> {
	url = normalizeReprintUrl(url);
	if (!secret.trim()) throw new Error('Enter the Reprint connection token.');
	// Phase weights estimate work, not elapsed time. SQL and file bytes have
	// different costs. Checkpoints keep the bar; only completion reaches 100%.
	const phases: Record<string, [number, number, string]> = {
		preflight: [0, 2, 'Connecting to the live site…'],
		'files-pull': [2, 52, 'Downloading site files…'],
		'files-prepare': [52, 55, 'Setting up downloaded files…'],
		'db-pull': [55, 70, 'Downloading SQL…'],
		'db-apply': [70, 94, 'Importing SQL…'],
		configure: [94, 96, 'Configuring the imported site…'],
		login: [96, 98, 'Logging in as an administrator…'],
	};
	let phase = 'preflight';
	let overallPercent = 0;
	let lastProgress: TransferProgress = { message: 'Starting Reprint…' };
	const report = (update: TransferProgressUpdate) => {
		if (direction !== 'pull') {
			lastProgress = { ...lastProgress, ...update };
			return onProgress(lastProgress);
		}
		if (update.phase && phases[update.phase] && update.phase !== phase) {
			phase = update.phase;
			logger.info(
				`[Reprint] ${(update.message ?? '').replaceAll(secret, '[redacted]')}`
			);
			lastProgress = { message: update.message ?? lastProgress.message };
		}
		lastProgress = { ...lastProgress, ...update };
		const [start, end] = phases[phase];
		const total = lastProgress.bytesTotal || lastProgress.filesTotal;
		const done = lastProgress.bytesTotal
			? lastProgress.bytesDone
			: lastProgress.filesDone;
		const fraction =
			lastProgress.percent !== undefined
				? lastProgress.percent / 100
				: total && done !== undefined
					? done / total
					: 0;
		overallPercent = Math.max(
			overallPercent,
			start + (end - start) * Math.min(1, Math.max(0, fraction))
		);
		onProgress({ ...lastProgress, overallPercent });
	};
	report(lastProgress);
	const documentRoot = await playground.documentRoot;
	const siteUrl = await playground.absoluteUrl;
	await installReprint(playground, report);
	await playground.writeFile(BRIDGE_PATH, bridge);
	const connectionPath = joinPaths(
		documentRoot,
		'.playground-reprint',
		'connection.json'
	);
	await playground.mkdir(joinPaths(documentRoot, '.playground-reprint'));
	await playground.writeFile(connectionPath, JSON.stringify({ url }));
	let command: TransferDirection | 'finish-pull' = direction;
	let stage: string | undefined;
	let warning: string | undefined;
	let transferError: Error | undefined;
	logger.info(`[Reprint ${REPRINT_VERSION}] Starting ${direction}.`);
	try {
		while (true) {
			const result = await runBridge(
				playground,
				{ command, url, secret, documentRoot, siteUrl },
				report
			);
			if (result.stage && stage !== result.stage) {
				stage = result.stage;
				report({
					phase: stage,
					message:
						phases[stage ?? '']?.[2] ??
						(stage === 'snapshot'
							? 'Preparing files to push…'
							: 'Sending files…'),
				});
			}
			if (result.status === 'complete') break;
			if (signal?.aborted) {
				throw new DOMException('Pull stopped.', 'AbortError');
			}
			if (result.status === 'install') {
				if (direction !== 'pull')
					throw new Error('Invalid Reprint import result.');
				report({ phase: 'login', message: phases.login[2] });
				warning = await logInAfterPull(playground, documentRoot);
				// Completion only discards the SQL dump; no separate phase.
				command = 'finish-pull';
			}
		}
	} catch (error) {
		transferError =
			error instanceof DOMException && error.name === 'AbortError'
				? error
				: new Error(
						(error instanceof Error
							? error.message
							: String(error)
						).replaceAll(secret, '[redacted]')
					);
		logger.error(`[Reprint] ${direction} failed: ${transferError.message}`);
	}
	if (transferError) throw transferError;
	onProgress({
		message: 'Transfer complete',
		...(direction === 'pull' ? { overallPercent: 100 } : {}),
	});
	return { warning };
}

async function logInAfterPull(
	playground: PlaygroundClient,
	documentRoot: string
) {
	const path = `/.playground-reprint-login-${crypto.randomUUID()}.php`;
	await playground.writeFile(joinPaths(documentRoot, path), loginScript);
	let warning: string | undefined;
	try {
		for (const method of ['POST', 'GET'] as const) {
			const response = await playground.request({ url: path, method });
			if (response.errors) logger.error(response.errors);
			let result;
			try {
				result = JSON.parse(response.text);
			} catch {
				/* Report invalid WordPress output below. */
			}
			if (typeof result?.warning === 'string') warning = result.warning;
			if (
				response.httpStatusCode !== 200 ||
				result?.loggedIn !== true ||
				!result?.username
			) {
				throw new Error(
					result?.error ||
						'The site was imported, but administrator login failed. Check Logs.'
				);
			}
			if (method === 'GET') {
				// The imported administrator may not be named admin. Keep the
				// normal Playground auto-login working when this site reopens.
				await playground.defineConstant(
					'PLAYGROUND_AUTO_LOGIN_AS_USER',
					result.username
				);
			}
		}
	} finally {
		await playground.unlink(joinPaths(documentRoot, path));
	}
	const home = await playground.request({ url: '/' });
	if (home.errors) logger.error(home.errors);
	if (
		home.httpStatusCode >= 400 ||
		(home.httpStatusCode === 200 && !home.text.trim())
	) {
		warning ??= `The site was imported, but its homepage returned ${home.httpStatusCode}${!home.text.trim() ? ' with an empty response' : ''}. You are logged in as an administrator. Check Logs and the active theme.`;
	}
	if (warning) logger.error(warning);
	await playground.goTo('/wp-admin/');
	return warning;
}

async function installReprint(
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

async function hasPinnedReprintChecksum(bytes: Uint8Array): Promise<boolean> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	return hash === PHAR_SHA256;
}

async function runBridge(
	playground: PlaygroundClient,
	request: {
		command: TransferDirection | 'finish-pull';
		url: string;
		secret: string;
		documentRoot: string;
		siteUrl: string;
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
	const redact = (message: string) =>
		message.replaceAll(request.secret, '[redacted]');
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
							...(detail ? { detail } : {}),
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
					} else if (record.file_bytes_done !== undefined) {
						onProgress(
							readProgress(
								{
									bytesDone: record.file_bytes_done,
									bytesTotal: record.file_bytes_total,
									filesDone: record.files_done,
									filesTotal: record.files_total,
								},
								'Pushing files'
							)
						);
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
