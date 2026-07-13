#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const METRICS = [
	['navigationTtfbMs', 'ttfb'],
	['firstContentfulPaintMs', 'fcp'],
	['firstMeaningfulPaintMs', 'meaningful_paint'],
	['fullyLoadedMs', 'fully_loaded'],
];

export const DEFAULT_MEANINGFUL_SELECTORS = [
	'.edit-site-layout',
	'.edit-site',
	'.interface-interface-skeleton',
	'iframe[name="editor-canvas"]',
	'.editor-canvas',
	'[data-testid="site-editor"]',
];

export const DEFAULT_IGNORED_REQUEST_PATTERNS = [
	'/wp-admin/admin-ajax.php',
	'wp_site_preview=1',
	// Gutenberg does not always consume these fetch response bodies, so Chromium
	// can leave them in Playwright's pending set after the 200 response arrives.
	'/wp-json/wp/v2/navigation',
	'/wp-json/wp/v2/settings',
];

const HELP = `Usage:
  node benchmark-site-editor.mjs \\
    --target 'Node Playground CLI=http://127.0.0.1:9401' \\
    --target Wasmtime=http://127.0.0.1:9400 \\
    --target 'nginx/native PHP=http://127.0.0.1:8081' \\
    --storage-state ./wordpress-auth.json

Required:
  --target LABEL=BASE_URL       Repeat for every target to measure.
  Authentication via one or more of:
  --storage-state [LABEL::]PATH Playwright storage-state JSON.
  --auth-cookie [LABEL::]HEADER Cookie header, e.g. name=value; other=value.
  --bootstrap [LABEL::]PATH     JS module exporting async default/bootstrap function.
  --allow-unauthenticated       Explicitly benchmark without authentication.

Sampling and output:
  --warmups N                   Warmups per target (default: 2).
  --samples N                   Recorded samples per target (default: 7).
  --timeout-ms N                Navigation/paint timeout (default: 30000).
  --fully-loaded-timeout-ms N   Load/fonts/quiet timeout (default: 30000).
  --quiet-window-ms N           Required network quiet period (default: 750).
  --ignore-request-pattern TEXT Add a long-lived request URL substring to ignore.
  --site-editor-path PATH       Default: /wp-admin/site-editor.php.
  --meaningful-selector CSS     Repeat to replace the default selector set.
  --browser NAME                chromium, firefox, or webkit (default: chromium).
  --executable-path PATH        Browser binary; overrides PLAYWRIGHT_EXECUTABLE_PATH.
  --headful                     Show the browser.
  --json-out PATH               Default: site-editor-benchmark.json.
  --tsv-out PATH                Default: site-editor-benchmark.tsv.
  --quiet                       Suppress progress; the final summary is still printed.

Scoped auth values use LABEL::VALUE. A bootstrap module receives:
  { browser, context, page, target, siteEditorUrl }

Fully loaded requires the load event, a visible Site Editor root/canvas,
document.fonts.ready, and the configured tracked-request quiet window. Known
WordPress preview and heartbeat requests are ignored and timeouts are reported.
`;

export function parseArgs(argv, environment = process.env) {
	const options = {
		targets: [],
		warmups: 2,
		samples: 7,
		timeoutMs: 30_000,
		fullyLoadedTimeoutMs: 30_000,
		quietWindowMs: 750,
		ignoredRequestPatterns: [...DEFAULT_IGNORED_REQUEST_PATTERNS],
		siteEditorPath: '/wp-admin/site-editor.php',
		meaningfulSelectors: [],
		browser: 'chromium',
		executablePath:
			environment.PLAYWRIGHT_EXECUTABLE_PATH?.trim() || undefined,
		headless: true,
		jsonOut: 'site-editor-benchmark.json',
		tsvOut: 'site-editor-benchmark.tsv',
		quiet: false,
		allowUnauthenticated: false,
		storageStates: newScopedValues(),
		authCookies: newScopedValues(),
		bootstraps: newScopedValues(),
	};

	for (let index = 0; index < argv.length; index++) {
		const parsed = splitFlag(argv[index]);
		const flag = parsed.flag;
		const value = () => {
			if (parsed.value !== undefined) {
				return parsed.value;
			}
			index++;
			if (index >= argv.length || argv[index].startsWith('--')) {
				throw new Error(`${flag} requires a value`);
			}
			return argv[index];
		};

		switch (flag) {
			case '--help':
			case '-h':
				return { ...options, help: true };
			case '--target':
				options.targets.push(parseTarget(value()));
				break;
			case '--warmups':
				options.warmups = parseInteger(value(), flag, 0, 100);
				break;
			case '--samples':
				options.samples = parseInteger(value(), flag, 1, 1_000);
				break;
			case '--timeout-ms':
				options.timeoutMs = parseInteger(value(), flag, 1, 600_000);
				break;
			case '--fully-loaded-timeout-ms':
			case '--network-idle-timeout-ms':
				options.fullyLoadedTimeoutMs = parseInteger(
					value(),
					flag,
					1,
					600_000
				);
				break;
			case '--quiet-window-ms':
				options.quietWindowMs = parseInteger(value(), flag, 1, 60_000);
				break;
			case '--ignore-request-pattern':
				options.ignoredRequestPatterns.push(nonEmpty(value(), flag));
				break;
			case '--site-editor-path':
				options.siteEditorPath = value();
				break;
			case '--meaningful-selector':
				options.meaningfulSelectors.push(nonEmpty(value(), flag));
				break;
			case '--browser':
				options.browser = value();
				break;
			case '--executable-path':
				options.executablePath = nonEmpty(value(), flag);
				break;
			case '--headful':
				options.headless = false;
				break;
			case '--json-out':
				options.jsonOut = nonEmpty(value(), flag);
				break;
			case '--tsv-out':
				options.tsvOut = nonEmpty(value(), flag);
				break;
			case '--storage-state':
				setScopedValue(options.storageStates, value(), flag);
				break;
			case '--auth-cookie':
				setScopedValue(options.authCookies, value(), flag);
				break;
			case '--bootstrap':
				setScopedValue(options.bootstraps, value(), flag);
				break;
			case '--allow-unauthenticated':
				options.allowUnauthenticated = true;
				break;
			case '--quiet':
				options.quiet = true;
				break;
			default:
				throw new Error(`unknown argument: ${argv[index]}`);
		}
	}

	validateOptions(options);
	options.meaningfulSelectors = options.meaningfulSelectors.length
		? options.meaningfulSelectors
		: [...DEFAULT_MEANINGFUL_SELECTORS];
	return options;
}

function splitFlag(argument) {
	if (!argument.startsWith('--')) {
		return { flag: argument, value: undefined };
	}
	const equals = argument.indexOf('=');
	return equals === -1
		? { flag: argument, value: undefined }
		: {
				flag: argument.slice(0, equals),
				value: argument.slice(equals + 1),
			};
}

function parseTarget(value) {
	const equals = value.indexOf('=');
	if (equals <= 0 || equals === value.length - 1) {
		throw new Error(
			`--target must be LABEL=BASE_URL, got ${JSON.stringify(value)}`
		);
	}
	const label = value.slice(0, equals);
	if (!/^[A-Za-z0-9._-]+$/.test(label)) {
		throw new Error(
			`target label must use only letters, numbers, dot, underscore, or dash: ${label}`
		);
	}
	let url;
	try {
		url = new URL(value.slice(equals + 1));
	} catch {
		throw new Error(`invalid target URL for ${label}`);
	}
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password
	) {
		throw new Error(
			`target ${label} must use an http(s) URL without embedded credentials`
		);
	}
	if (url.search || url.hash) {
		throw new Error(
			`target ${label} base URL must not contain a query or fragment`
		);
	}
	url.pathname = url.pathname.replace(/\/+$/, '') || '/';
	return { label, baseUrl: url.href.replace(/\/$/, '') };
}

function parseInteger(value, flag, minimum, maximum) {
	if (!/^[0-9]+$/.test(value)) {
		throw new Error(`${flag} must be an integer`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
		throw new Error(`${flag} must be between ${minimum} and ${maximum}`);
	}
	return parsed;
}

function nonEmpty(value, flag) {
	if (!value.trim()) {
		throw new Error(`${flag} must not be empty`);
	}
	return value;
}

function newScopedValues() {
	return { global: undefined, labels: new Map() };
}

function setScopedValue(target, rawValue, flag) {
	const delimiter = rawValue.indexOf('::');
	if (delimiter === -1) {
		if (target.global !== undefined) {
			throw new Error(`${flag} may specify only one unscoped value`);
		}
		target.global = nonEmpty(rawValue, flag);
		return;
	}
	const label = rawValue.slice(0, delimiter);
	const value = rawValue.slice(delimiter + 2);
	if (!/^[A-Za-z0-9._-]+$/.test(label) || !value) {
		throw new Error(`${flag} scoped values must be LABEL::VALUE`);
	}
	if (target.labels.has(label)) {
		throw new Error(`${flag} was specified more than once for ${label}`);
	}
	target.labels.set(label, value);
}

export function scopedValue(target, label) {
	return target.labels.get(label) ?? target.global;
}

function validateOptions(options) {
	if (options.targets.length < 1) {
		throw new Error('at least one --target value is required');
	}
	const labels = new Set();
	for (const target of options.targets) {
		if (labels.has(target.label)) {
			throw new Error(`duplicate target label: ${target.label}`);
		}
		labels.add(target.label);
	}
	for (const [name, scoped] of [
		['--storage-state', options.storageStates],
		['--auth-cookie', options.authCookies],
		['--bootstrap', options.bootstraps],
	]) {
		for (const label of scoped.labels.keys()) {
			if (!labels.has(label)) {
				throw new Error(
					`${name} refers to unknown target label: ${label}`
				);
			}
		}
	}
	if (!options.allowUnauthenticated) {
		for (const target of options.targets) {
			const authenticated = [
				options.storageStates,
				options.authCookies,
				options.bootstraps,
			].some((scoped) => scopedValue(scoped, target.label) !== undefined);
			if (!authenticated) {
				throw new Error(
					`target ${target.label} has no authentication; provide storage state, cookie, bootstrap, or --allow-unauthenticated`
				);
			}
		}
	}
	if (!options.siteEditorPath.startsWith('/')) {
		throw new Error('--site-editor-path must start with /');
	}
	if (!['chromium', 'firefox', 'webkit'].includes(options.browser)) {
		throw new Error('--browser must be chromium, firefox, or webkit');
	}
}

export function percentile(values, quantile) {
	if (!values.length) {
		return null;
	}
	if (!(quantile >= 0 && quantile <= 1)) {
		throw new Error('quantile must be between 0 and 1');
	}
	const sorted = [...values].sort((left, right) => left - right);
	const position = (sorted.length - 1) * quantile;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) {
		return sorted[lower];
	}
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function meaningfulPaintTime(firstContentfulPaint, editorVisible) {
	return Math.max(firstContentfulPaint, editorVisible);
}

export function aggregateSamples(samples) {
	return Object.fromEntries(
		METRICS.map(([key]) => {
			const values = samples
				.map((sample) => sample[key])
				.filter((value) => Number.isFinite(value));
			return [
				key,
				{
					observations: values.length,
					median: roundMilliseconds(percentile(values, 0.5)),
					p95: roundMilliseconds(percentile(values, 0.95)),
				},
			];
		})
	);
}

function roundMilliseconds(value) {
	return value === null ? null : Math.round(value * 1_000) / 1_000;
}

export function parseCookieHeader(header) {
	return header
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const equals = part.indexOf('=');
			if (equals <= 0) {
				throw new Error(`invalid cookie pair: ${JSON.stringify(part)}`);
			}
			return {
				name: part.slice(0, equals).trim(),
				value: part.slice(equals + 1),
			};
		});
}

export function siteEditorUrl(baseUrl, siteEditorPath) {
	const url = new URL(baseUrl);
	const prefix = url.pathname.replace(/\/+$/, '');
	url.pathname = `${prefix}/${siteEditorPath.replace(/^\/+/, '')}`;
	return url.href;
}

export function formatTsv(report) {
	const rows = [
		[
			'label',
			'base_url',
			'successful_samples',
			'failed_samples',
			'fully_loaded_ok',
			'fully_loaded_quiet_timeouts',
			'fully_loaded_errors',
			'metric',
			'observations',
			'median_ms',
			'p95_ms',
		],
	];
	for (const result of report.results) {
		for (const [key, metricName] of METRICS) {
			const metric = result.metrics[key];
			rows.push([
				result.label,
				result.baseUrl,
				result.successfulSamples,
				result.failedSamples,
				result.fullyLoadedStatuses.ok,
				result.fullyLoadedStatuses.quietWindowTimeout,
				result.fullyLoadedStatuses.error,
				metricName,
				metric.observations,
				metric.median ?? '',
				metric.p95 ?? '',
			]);
		}
	}
	return `${rows.map((row) => row.map(tsvCell).join('\t')).join('\n')}\n`;
}

function tsvCell(value) {
	return String(value).replace(/[\t\r\n]+/g, ' ');
}

async function runBenchmark(options) {
	const playwright = await import('@playwright/test');
	const browserType = playwright[options.browser];
	const browser = await browserType.launch({
		headless: options.headless,
		executablePath: options.executablePath
			? resolve(options.executablePath)
			: undefined,
	});
	const sessions = [];
	try {
		for (const target of options.targets) {
			sessions.push(await createTargetSession(browser, target, options));
		}
		if (!options.quiet) {
			process.stdout.write(
				`Running ${options.warmups} warmups and ${options.samples} samples per target\n`
			);
		}
		await runPhase(sessions, options.warmups, 'warmup', options);
		await runPhase(sessions, options.samples, 'sample', options);
	} finally {
		await Promise.allSettled(
			sessions.map((session) => session.context.close())
		);
		await browser.close();
	}

	return {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		configuration: {
			warmups: options.warmups,
			samples: options.samples,
			timeoutMs: options.timeoutMs,
			fullyLoadedTimeoutMs: options.fullyLoadedTimeoutMs,
			quietWindowMs: options.quietWindowMs,
			ignoredRequestPatterns: options.ignoredRequestPatterns,
			siteEditorPath: options.siteEditorPath,
			meaningfulSelectors: options.meaningfulSelectors,
			browser: options.browser,
			executablePath: options.executablePath
				? resolve(options.executablePath)
				: null,
			headless: options.headless,
		},
		results: sessions.map(buildResult),
	};
}

function buildResult(session) {
	const fullyLoadedStatuses = { ok: 0, quietWindowTimeout: 0, error: 0 };
	for (const sample of session.samples) {
		fullyLoadedStatuses[sample.fullyLoadedStatus]++;
	}
	return {
		label: session.target.label,
		baseUrl: session.target.baseUrl,
		siteEditorUrl: session.siteEditorUrl,
		successfulSamples: session.samples.length,
		failedSamples: session.failures.filter(
			(failure) => failure.phase === 'sample'
		).length,
		fullyLoadedStatuses,
		metrics: aggregateSamples(session.samples),
		samples: session.samples,
		failures: session.failures.slice(0, 10),
	};
}

async function createTargetSession(browser, target, options) {
	const storageState = scopedValue(options.storageStates, target.label);
	const context = await browser.newContext({
		storageState: storageState ? resolve(storageState) : undefined,
	});
	const cookieHeader = scopedValue(options.authCookies, target.label);
	if (cookieHeader) {
		const cookieUrl = `${new URL(target.baseUrl).origin}/`;
		await context.addCookies(
			parseCookieHeader(cookieHeader).map((cookie) => ({
				...cookie,
				url: cookieUrl,
			}))
		);
	}
	const targetSiteEditorUrl = siteEditorUrl(
		target.baseUrl,
		options.siteEditorPath
	);
	const bootstrapPath = scopedValue(options.bootstraps, target.label);
	if (bootstrapPath) {
		const bootstrapModule = await import(
			pathToFileURL(resolve(bootstrapPath)).href
		);
		const bootstrap = bootstrapModule.default ?? bootstrapModule.bootstrap;
		if (typeof bootstrap !== 'function') {
			throw new Error(
				`bootstrap module for ${target.label} must export a function`
			);
		}
		const page = await context.newPage();
		try {
			await bootstrap({
				browser,
				context,
				page,
				target,
				siteEditorUrl: targetSiteEditorUrl,
			});
		} finally {
			await page.close();
		}
	}
	return {
		target,
		context,
		siteEditorUrl: targetSiteEditorUrl,
		samples: [],
		failures: [],
	};
}

async function runPhase(sessions, count, phase, options) {
	for (let sampleIndex = 0; sampleIndex < count; sampleIndex++) {
		const ordered =
			sampleIndex % 2 === 0 ? sessions : [...sessions].reverse();
		for (const session of ordered) {
			try {
				const sample = await measureSiteEditor(session, options);
				if (phase === 'sample') {
					session.samples.push({ index: sampleIndex + 1, ...sample });
				}
			} catch (error) {
				session.failures.push({
					phase,
					index: sampleIndex + 1,
					message: boundedError(error),
				});
			}
		}
	}
}

async function measureSiteEditor(session, options) {
	const page = await session.context.newPage();
	page.setDefaultTimeout(options.timeoutMs);
	const networkTracker = createNetworkActivityTracker(
		page,
		options.ignoredRequestPatterns
	);
	try {
		const response = await page.goto(session.siteEditorUrl, {
			waitUntil: 'commit',
			timeout: options.timeoutMs,
		});
		if (!response || response.status() >= 400) {
			throw new Error(
				`navigation failed with HTTP ${response?.status() ?? 'unknown'}`
			);
		}
		if (new URL(page.url()).pathname.includes('/wp-login.php')) {
			throw new Error(
				'Site Editor redirected to wp-login.php; authentication is not valid'
			);
		}

		const navigationTtfb = waitForNumericMetric(
			page,
			() => {
				const navigation =
					performance.getEntriesByType('navigation')[0];
				return navigation?.responseStart > 0
					? navigation.responseStart - navigation.startTime
					: false;
			},
			undefined,
			options.timeoutMs
		);
		const firstContentfulPaint = waitForNumericMetric(
			page,
			() =>
				performance.getEntriesByName('first-contentful-paint')[0]
					?.startTime || false,
			undefined,
			options.timeoutMs
		);
		const editorVisible = waitForNumericMetric(
			page,
			(selectors) => {
				const visible = selectors.some((selector) =>
					[...document.querySelectorAll(selector)].some((element) => {
						const style = getComputedStyle(element);
						const rectangle = element.getBoundingClientRect();
						return (
							style.display !== 'none' &&
							style.visibility !== 'hidden' &&
							Number(style.opacity || 1) !== 0 &&
							rectangle.width > 0 &&
							rectangle.height > 0
						);
					})
				);
				return visible ? performance.now() : false;
			},
			options.meaningfulSelectors,
			options.timeoutMs
		);
		const fullyLoaded = measureFullyLoaded(
			page,
			networkTracker,
			editorVisible,
			options
		);

		const [
			navigationTtfbMs,
			firstContentfulPaintMs,
			editorVisibleMs,
			fullyLoadedResult,
		] = await Promise.all([
			navigationTtfb,
			firstContentfulPaint,
			editorVisible,
			fullyLoaded,
		]);
		const firstMeaningfulPaintMs = meaningfulPaintTime(
			firstContentfulPaintMs,
			editorVisibleMs
		);
		return {
			navigationTtfbMs: roundMilliseconds(navigationTtfbMs),
			firstContentfulPaintMs: roundMilliseconds(firstContentfulPaintMs),
			firstMeaningfulPaintMs: roundMilliseconds(firstMeaningfulPaintMs),
			fullyLoadedMs: roundMilliseconds(fullyLoadedResult.ms),
			fullyLoadedStatus: fullyLoadedResult.status,
			fullyLoadedError: fullyLoadedResult.error,
			fullyLoadedPendingRequests: fullyLoadedResult.pendingRequests,
			fullyLoadedPendingRequestUrls: fullyLoadedResult.pendingRequestUrls,
		};
	} finally {
		await page.close();
	}
}

function createNetworkActivityTracker(page, ignoredRequestPatterns) {
	const tracker = {
		pending: new Set(),
		lastActivityAt: Date.now(),
	};
	const isIgnored = (request) => {
		if (['eventsource', 'websocket'].includes(request.resourceType())) {
			return true;
		}
		return ignoredRequestPatterns.some((pattern) =>
			request.url().includes(pattern)
		);
	};
	page.on('request', (request) => {
		if (!isIgnored(request)) {
			tracker.pending.add(request);
			tracker.lastActivityAt = Date.now();
		}
	});
	const settle = (request) => {
		if (tracker.pending.delete(request)) {
			tracker.lastActivityAt = Date.now();
		}
	};
	page.on('requestfinished', settle);
	page.on('requestfailed', settle);
	return tracker;
}

async function measureFullyLoaded(
	page,
	networkTracker,
	editorVisible,
	options
) {
	const deadline = Date.now() + options.fullyLoadedTimeoutMs;
	try {
		await Promise.all([
			page.waitForLoadState('load', {
				timeout: remainingMilliseconds(deadline),
			}),
			withTimeout(
				editorVisible,
				remainingMilliseconds(deadline),
				'visible Site Editor timed out while waiting for fully loaded'
			),
		]);

		const fontsHandle = await page.waitForFunction(
			() => !document.fonts || document.fonts.status === 'loaded',
			undefined,
			{
				timeout: remainingMilliseconds(deadline),
				polling: 50,
			}
		);
		await fontsHandle.dispose();
		await page.evaluate(async () => {
			if (document.fonts) {
				await document.fonts.ready;
			}
		});

		const quiet = await waitForNetworkQuiet(
			networkTracker,
			options.quietWindowMs,
			deadline
		);
		if (!quiet.ok) {
			return {
				ms: null,
				status: 'quietWindowTimeout',
				error: null,
				pendingRequests: networkTracker.pending.size,
				pendingRequestUrls: pendingRequestUrls(networkTracker),
			};
		}
		return {
			ms: await page.evaluate(() => performance.now()),
			status: 'ok',
			error: null,
			pendingRequests: 0,
			pendingRequestUrls: [],
		};
	} catch (error) {
		return {
			ms: null,
			status: 'error',
			error: boundedError(error),
			pendingRequests: networkTracker.pending.size,
			pendingRequestUrls: pendingRequestUrls(networkTracker),
		};
	}
}

function pendingRequestUrls(tracker) {
	return [...tracker.pending]
		.map((request) => request.url())
		.sort()
		.slice(0, 10);
}

async function waitForNetworkQuiet(tracker, quietWindowMs, deadline) {
	while (true) {
		const now = Date.now();
		const quietFor = now - tracker.lastActivityAt;
		if (tracker.pending.size === 0 && quietFor >= quietWindowMs) {
			return { ok: true };
		}
		if (now >= deadline) {
			return { ok: false };
		}
		const untilQuiet =
			tracker.pending.size === 0 ? quietWindowMs - quietFor : 50;
		await delay(Math.max(1, Math.min(50, untilQuiet, deadline - now)));
	}
}

function remainingMilliseconds(deadline) {
	return Math.max(1, deadline - Date.now());
}

function withTimeout(promise, timeoutMs, message) {
	return new Promise((resolvePromise, rejectPromise) => {
		const timeout = setTimeout(
			() => rejectPromise(new Error(message)),
			timeoutMs
		);
		promise.then(
			(value) => {
				clearTimeout(timeout);
				resolvePromise(value);
			},
			(error) => {
				clearTimeout(timeout);
				rejectPromise(error);
			}
		);
	});
}

function delay(milliseconds) {
	return new Promise((resolvePromise) =>
		setTimeout(resolvePromise, milliseconds)
	);
}

async function waitForNumericMetric(page, pageFunction, argument, timeout) {
	const handle = await page.waitForFunction(pageFunction, argument, {
		timeout,
		polling: 50,
	});
	try {
		const value = await handle.jsonValue();
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			throw new Error(
				'browser metric did not resolve to a finite number'
			);
		}
		return value;
	} finally {
		await handle.dispose();
	}
}

function boundedError(error) {
	return String(error instanceof Error ? error.message : error)
		.replace(/[\r\n]+/g, ' ')
		.slice(0, 300);
}

function consoleSummary(report) {
	const lines = ['Site Editor benchmark — median / p95 (ms)'];
	for (const result of report.results) {
		const metrics = Object.fromEntries(
			METRICS.map(([key, name]) => {
				const value = result.metrics[key];
				return [name, `${value.median ?? '-'} / ${value.p95 ?? '-'}`];
			})
		);
		lines.push(
			`${result.label} n=${result.successfulSamples} failed=${result.failedSamples} | ` +
				`TTFB ${metrics.ttfb} | FCP ${metrics.fcp} | meaningful ${metrics.meaningful_paint} | ` +
				`fully-loaded ${metrics.fully_loaded} ` +
				`[ok=${result.fullyLoadedStatuses.ok} quiet-timeout=${result.fullyLoadedStatuses.quietWindowTimeout} ` +
				`error=${result.fullyLoadedStatuses.error}]`
		);
		for (const failure of result.failures.slice(0, 2)) {
			lines.push(
				`  ${failure.phase} ${failure.index}: ${failure.message}`
			);
		}
	}
	return `${lines.join('\n')}\n`;
}

async function writeOutput(path, contents) {
	const absolute = resolve(path);
	await mkdir(dirname(absolute), { recursive: true });
	await writeFile(absolute, contents);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		process.stdout.write(HELP);
		return;
	}
	const report = await runBenchmark(options);
	await Promise.all([
		writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`),
		writeOutput(options.tsvOut, formatTsv(report)),
	]);
	process.stdout.write(consoleSummary(report));
	process.stdout.write(
		`JSON ${resolve(options.jsonOut)}\nTSV  ${resolve(options.tsvOut)}\n`
	);
	if (report.results.some((result) => result.successfulSamples === 0)) {
		process.exitCode = 1;
	}
}

const isMain =
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
	main().catch((error) => {
		process.stderr.write(`benchmark-site-editor: ${boundedError(error)}\n`);
		process.exitCode = 1;
	});
}
