import { getSqliteDatabasePath } from '@wp-playground/tools';
import { login } from '@wp-playground/blueprints';
import loginCheckScript from './check-login.php?raw';
import { joinPaths, phpVar } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import bridge from './bridge.php?raw';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import type { PlaygroundClient } from '@wp-playground/client';
import release from './release.json';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

/** Bundled client release; this is not an exact server-version check. */
export const REPRINT_VERSION = release.version;
// These files live inside each Playground's PHP filesystem, not on the host.
const PHAR_PATH = '/tmp/playground-reprint.phar';
const BRIDGE_PATH = '/tmp/playground-reprint-bridge.php';
// The update command writes the version and checksum together. Check both
// bundled downloads and files cached by an earlier transfer against this digest.
const PHAR_SHA256 = release.sha256;
export type ReprintAvailability =
	| 'configured'
	| 'needs-key'
	| 'not-detected'
	| 'unreachable';

export type TransferProgress = {
	message: string;
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

/**
 * Checks whether the site's preflight endpoint replies like Reprint Server.
 *
 * No token or browser cookies are sent. `configured` means Reprint asked for
 * authentication; this check has not authenticated the browser. `needs-key`
 * means the server reported a missing connection token. Other HTTP replies,
 * including login pages and generic 403s, return `not-detected`.
 *
 * Cancellation, failed requests, and a 15-second deadline return `unreachable`.
 * The deadline also covers response bodies that stall or ignore cancellation.
 * Invalid site URLs throw before the request starts; see normalizeReprintUrl().
 */
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
		/** Handle both caller cancellation and the deadline, even if fetch stays pending. */
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

/**
 * Sends one unauthenticated preflight request and classifies its JSON reply.
 *
 * Both the HTTP status and Reprint's specific error must match. An arbitrary
 * host error is not enough to identify the plugin. JSON is read regardless of
 * Content-Type because older servers send it as application/octet-stream.
 * Unreadable JSON returns `not-detected`; failed fetches reach the caller.
 * detectReprint() supplies cancellation and the response-body deadline.
 */
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

/**
 * Builds the site, plugin-upload, and Reprint settings URLs from an install URL.
 *
 * Accepts the site URL or its ?reprint-api endpoint, removes the API query, and
 * adds a trailing slash before resolving the admin paths. This keeps a site
 * installed at /blog/ from being sent to the domain's root wp-admin directory.
 * URL validation is shared with requests through normalizeReprintUrl().
 */
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

/**
 * Returns the API URL used to identify the remote site across transfer stages.
 *
 * For example, https://example.com/?reprint-api=1 becomes
 * https://example.com/?reprint-api. Trims surrounding whitespace and replaces
 * the query flag, while retaining the site's path and trailing-slash spelling.
 *
 * Requires HTTPS, except for HTTP on localhost, 127.0.0.1, or [::1]. Rejects
 * embedded credentials, fragments, and query parameters other than reprint-api
 * rather than silently discarding them from the remote site's identity.
 *
 * @throws If the input is not a URL or includes unsupported URL parts.
 */
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

/** Import files and SQL into a temporary Playground, then verify administrator login. */
export async function pullSite(
	playground: PlaygroundClient,
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
	/** Keep all measured stages on one monotonic overall bar. */
	const report = (update: TransferProgressUpdate) => {
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
	// The SQLite driver can choose a private subdirectory. Resolve its active
	// path before pulling instead of installing SQL into an unused default file.
	const databasePath = await getSqliteDatabasePath(playground);
	await installReprint(playground, report);
	await playground.writeFile(BRIDGE_PATH, bridge);
	const connectionPath = joinPaths(
		documentRoot,
		'.playground-reprint',
		'connection.json'
	);
	await playground.mkdir(joinPaths(documentRoot, '.playground-reprint'));
	await playground.writeFile(connectionPath, JSON.stringify({ url }));
	let command: 'pull' | 'finish-pull' = 'pull';
	let stage: string | undefined;
	let warning: string | undefined;
	let transferError: Error | undefined;
	logger.info(`[Reprint ${REPRINT_VERSION}] Starting pull.`);
	try {
		while (true) {
			const result = await runBridge(
				playground,
				{ command, url, secret, documentRoot, siteUrl, databasePath },
				report
			);
			if (result.stage && stage !== result.stage) {
				stage = result.stage;
				report({
					phase: stage,
					message: phases[stage]?.[2] ?? lastProgress.message,
				});
			}
			if (result.status === 'complete') break;
			if (signal?.aborted) {
				throw new DOMException('Pull stopped.', 'AbortError');
			}
			if (result.status === 'install') {
				report({ phase: 'login', message: phases.login[2] });
				// Files and SQL are installed. Prepare WordPress, then use Blueprint
				// login. The temporary endpoint ignores old cookies once and checks
				// the new session on a separate request. Remove it on success or failure.
				const setup = await playground.run({
					code: `<?php
						require ${phpVar(joinPaths(documentRoot, 'wp-load.php'))};
						require_once ABSPATH . 'wp-admin/includes/upgrade.php';
						wp_upgrade();
						// Theme roots and cached theme errors describe the source filesystem.
						// Rebuild them from the downloaded files without changing the active theme.
						delete_option('stylesheet_root');
						delete_option('template_root');
						delete_site_transient('theme_roots');
						wp_clean_themes_cache();
						$admins = get_users(['role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'order' => 'ASC']);
						if (!$admins) {
							throw new RuntimeException('The imported site has no administrator account.');
						}
						echo json_encode(['username' => $admins[0]->user_login]);
					`,
				});
				if (setup.errors) logger.error(setup.errors);
				const { username } = JSON.parse(setup.text);
				// The imported administrator may not be named admin. The Blueprint step
				// also keeps auto-login pointed at this username when the site reopens.
				await login(playground, { username });
				const path = `/.playground-reprint-login-${crypto.randomUUID()}.php`;
				await playground.writeFile(
					joinPaths(documentRoot, path),
					loginCheckScript
				);
				try {
					const loginResponse = await playground.request({
						url: path,
						method: 'POST',
					});
					if (loginResponse.errors)
						logger.error(loginResponse.errors);
					if (loginResponse.httpStatusCode >= 400) {
						throw new Error(
							'The site was imported, but administrator login failed. Check Logs.'
						);
					}
					// A separate GET checks the cookie round trip, not just the user that
					// the auto-login plugin set in memory during the POST.
					const response = await playground.request({
						url: path,
						method: 'GET',
					});
					if (response.errors) logger.error(response.errors);
					let session;
					try {
						session = JSON.parse(response.text);
					} catch {
						/* Report invalid WordPress output below. */
					}
					if (
						response.httpStatusCode !== 200 ||
						session?.loggedIn !== true ||
						session?.username !== username
					) {
						throw new Error(
							'The site was imported, but administrator login failed. Check Logs.'
						);
					}
					if (typeof session.warning === 'string')
						warning = session.warning;
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
		logger.error(`[Reprint] Pull failed: ${transferError.message}`);
	}
	if (transferError) throw transferError;
	onProgress({
		message: 'Transfer complete',
		overallPercent: 100,
	});
	return { warning };
}

/**
 * Makes the selected client PHAR available in Playground's temporary filesystem.
 *
 * A cached file is reused only when its SHA-256 matches PHAR_SHA256. Otherwise,
 * downloads this build's bundled client from the website and checks its bytes
 * before writing PHAR_PATH. A failed download or checksum check leaves the
 * previous file untouched. Installs the client, not the bridge script.
 *
 * onProgress reports a download only when the cached client cannot be reused.
 * Resolves after the verified bytes have been written; download, verification,
 * and filesystem errors reject the promise.
 */
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
		const response = await fetch(
			`${import.meta.env.BASE_URL}assets/optional/reprint/reprint-${PHAR_SHA256}.phar`
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

/**
 * Checks whether archive bytes match the client release selected by this build.
 *
 * Uses the same SHA-256 check for cached files and new downloads. A filename or
 * an embedded version string cannot make different bytes pass this check.
 */
async function hasPinnedReprintChecksum(bytes: Uint8Array): Promise<boolean> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	return hash === PHAR_SHA256;
}

/**
 * Runs one bridge stage and returns its final playgroundReprint result.
 *
 * The caller must first install the client PHAR and the script at BRIDGE_PATH.
 * Passes the request, including its token, through PLAYGROUND_REPRINT in PHP's
 * environment instead of embedding it in a generated script. Uses the primary
 * PHP instance so successive stages see the same temporary files.
 *
 * Reads stdout as JSON lines and reports progress before PHP exits. Uses
 * Reprint's file and byte counters, including the unfinished file and resumed
 * writes. Structured progress takes priority over per-file commentary. Drains
 * stdout, stderr, and the exit status together, including output after a result.
 *
 * A nonzero exit or missing result throws using the last JSON error, stderr,
 * or an exit-code message, in that order. Literal token occurrences are redacted
 * from PHP error and message text before reporting it. Site content is not
 * sanitized by this function.
 */
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
	let hasStructuredProgress = false;
	/**
	 * Removes literal token occurrences from messages reported by this PHP call.
	 * The same replacement is applied to JSON errors, stderr, and progress text.
	 */
	const redact = (message: string) =>
		message.replaceAll(request.secret, '[redacted]');
	/**
	 * Reads UTF-8 stdout without assuming that a chunk contains a complete line.
	 *
	 * Retains partial lines between reads and accepts the last line without a
	 * newline. Plain text and unreadable records are ignored. Captures the last
	 * result and JSON error for runBridge(), and sends recognized progress to
	 * onProgress while the PHP process is still running.
	 */
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
						hasStructuredProgress = true;
					} else if (
						record.command === 'files-pull' &&
						record.progress?.items?.unit === 'files'
					) {
						// Reprint counts bytes accepted by its writer, including
						// the open file and the saved position on a retry.
						onProgress({
							...readProgress(
								{
									phase: 'files-pull',
									bytesDone: record.progress.bytes?.done,
									bytesTotal: record.progress.bytes?.total,
									filesDone: record.progress.items.done,
									filesTotal: record.progress.items.total,
								},
								'Downloading site files'
							),
							// Clear the index-stage commentary when download starts.
							detail: undefined,
						});
						hasStructuredProgress = true;
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
						hasStructuredProgress = true;
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
						hasStructuredProgress = true;
					} else if (
						!hasStructuredProgress &&
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
						!hasStructuredProgress
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

/**
 * Formats database progress as table/row context or an applied-statement count.
 *
 * Table progress takes precedence when both a table name and row count exist.
 * Row totals are labelled as estimates from the source's table statistics;
 * they must not be presented as exact download sizes. Returns undefined when
 * neither form of context has valid counters, so the caller can clear old text.
 */
function describeProgress(record: Record<string, unknown>): string | undefined {
	/**
	 * Accepts finite, nonnegative numbers, including zero. Numeric strings and
	 * invalid values return undefined rather than entering a progress label.
	 */
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

/**
 * Copies the phase and known numeric counters into a progress update.
 *
 * The caller supplies the message, already redacted where needed. Counters
 * must be finite and nonnegative; absent or invalid values remain absent.
 * Does not infer totals or clamp percentages. Other record fields, including
 * raw file paths, are left out instead of being forwarded to the UI.
 */
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
