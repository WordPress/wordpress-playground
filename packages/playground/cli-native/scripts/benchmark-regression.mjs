#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
	mkdir,
	mkdtemp,
	open,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export const METRIC_DEFINITIONS = Object.freeze([
	metric('throughput.public_rps', 'Public throughput', 'req/s', 'higher'),
	metric('throughput.mixed_rps', 'Mixed throughput', 'req/s', 'higher'),
	metric('throughput.admin_rps', 'Admin throughput', 'req/s', 'higher'),
	metric('cpu.public_ms_per_request', 'Public CPU/request', 'ms', 'lower'),
	metric('cpu.mixed_ms_per_request', 'Mixed CPU/request', 'ms', 'lower'),
	metric('cpu.admin_ms_per_request', 'Admin CPU/request', 'ms', 'lower'),
	metric('memory.warm_idle_pss_mib', 'Warm-idle PSS', 'MiB', 'lower'),
	metric('memory.peak_active_pss_mib', 'Peak-active PSS', 'MiB', 'lower'),
	metric('memory.peak_cgroup_mib', 'Peak cgroup memory', 'MiB', 'lower'),
	metric('site_editor.ttfb_ms', 'Site Editor TTFB', 'ms', 'lower'),
	metric(
		'site_editor.first_meaningful_paint_ms',
		'Site Editor meaningful paint',
		'ms',
		'lower'
	),
	metric(
		'site_editor.fully_loaded_ms',
		'Site Editor fully loaded',
		'ms',
		'lower'
	),
]);

const PROTOCOL_FIELDS = Object.freeze({
	harnessVersion: 1,
	wordpressVersion: 'string',
	phpVersion: '8.2',
	sqliteJournalMode: 'WAL',
	sqliteSynchronous: 'FULL',
	workers: 6,
	concurrency: 6,
	warmupRequestsPerWorker: 12,
	requestsPerWorker: 36,
	requestsPerRound: 216,
	throughputRounds: 4,
	throughputAggregation: 'arithmetic-mean',
	cpuRounds: 6,
	cpuAggregation: 'median',
	cpuProvenance: 'raw-load-cross-checked',
	memorySampleIntervalMs: 200,
	memoryMinimumIdleSamples: 20,
	memoryMinimumActiveSamples: 5,
	siteEditorWarmups: 2,
	siteEditorSamples: 7,
	siteEditorQuietWindowMs: 750,
	serverCpuSet: 'cpu-set',
	clientCpuSet: 'cpu-set',
	hostArchitecture: 'non-empty-string',
	hostCpuModel: 'non-empty-string',
	hostKernelRelease: 'non-empty-string',
	hostLogicalCpuCount: 'positive-integer',
});

const HELP = `Compare complete cli-native benchmark snapshots.

Automatic Linux collection:
  node benchmark-regression.mjs \\
    --baseline-ref=aab6ca9e --candidate-ref=HEAD --max-regression-pct=5

Portable results-file comparison:
  node benchmark-regression.mjs \\
    --baseline-results=baseline.json --candidate-results=candidate.json \\
    --max-regression-pct=5

Automatic collection requirements:
  Linux with systemd/systemd-run, unified cgroup v2, and passwordless sudo.
  CPUs 0-11 online/available by default (six server and six disjoint client CPUs).
  Chromium via PLAYWRIGHT_EXECUTABLE_PATH or chromium/chromium-browser/google-chrome.
  Usable 127.0.0.1 ports and outbound HTTPS for missing submodules/dependencies/assets.

Results-file mode requires only Node.js. It works outside a Git checkout unless
--baseline-ref or --candidate-ref is also supplied for revision verification.
Snapshots separate revisionLabel from resolvedCommit; ref verification requires
resolvedCommit to be the exact full hexadecimal commit returned by Git.

Options:
  --baseline-ref REF          Git revision to benchmark or validate.
  --candidate-ref REF         Git revision to benchmark or validate.
  --baseline-results PATH     Existing normalized schema-v1 snapshot.
  --candidate-results PATH    Existing normalized schema-v1 snapshot.
  --max-regression-pct N      Direction-aware limit (default: 5).
  --output-dir PATH           Default: dist/benchmarks/playground-cli-native/regression.
  --collector PATH            Override the built-in Linux collector.
  --keep-worktrees            Retain detached worktrees after collection.
  --help                      Show this help.
`;

function metric(id, label, unit, direction) {
	return Object.freeze({ id, label, unit, direction });
}

export function parseArgs(argv, cwd = process.cwd()) {
	const options = {
		baselineRef: undefined,
		candidateRef: undefined,
		baselineResults: undefined,
		candidateResults: undefined,
		maxRegressionPct: 5,
		outputDir: resolve(
			cwd,
			'dist/benchmarks/playground-cli-native/regression'
		),
		collector: join(scriptDirectory, 'benchmark-regression-collect.sh'),
		keepWorktrees: false,
		help: false,
	};

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		const [flag, inlineValue] = splitArgument(argument);
		const value = () => {
			if (inlineValue !== undefined) return inlineValue;
			const next = argv[++index];
			if (next === undefined || next.startsWith('--')) {
				throw new Error(`${flag} requires a value`);
			}
			return next;
		};
		switch (flag) {
			case '--baseline-ref':
				options.baselineRef = nonEmpty(value(), flag);
				break;
			case '--candidate-ref':
				options.candidateRef = nonEmpty(value(), flag);
				break;
			case '--baseline-results':
				options.baselineResults = resolve(cwd, nonEmpty(value(), flag));
				break;
			case '--candidate-results':
				options.candidateResults = resolve(
					cwd,
					nonEmpty(value(), flag)
				);
				break;
			case '--max-regression-pct':
				options.maxRegressionPct = percentage(value(), flag);
				break;
			case '--output-dir':
				options.outputDir = resolve(cwd, nonEmpty(value(), flag));
				break;
			case '--collector':
				options.collector = resolve(cwd, nonEmpty(value(), flag));
				break;
			case '--keep-worktrees':
				options.keepWorktrees = true;
				break;
			case '--help':
				options.help = true;
				break;
			default:
				throw new Error(`unknown argument: ${argument}`);
		}
	}

	if (options.help) return options;
	const hasBaselineFile = options.baselineResults !== undefined;
	const hasCandidateFile = options.candidateResults !== undefined;
	if (hasBaselineFile !== hasCandidateFile) {
		throw new Error(
			'--baseline-results and --candidate-results must be provided together'
		);
	}
	if (!hasBaselineFile && (!options.baselineRef || !options.candidateRef)) {
		throw new Error(
			'automatic collection requires --baseline-ref and --candidate-ref'
		);
	}
	return options;
}

function splitArgument(argument) {
	const equals = argument.indexOf('=');
	return equals === -1
		? [argument, undefined]
		: [argument.slice(0, equals), argument.slice(equals + 1)];
}

function nonEmpty(value, flag) {
	if (!value.trim()) throw new Error(`${flag} must not be empty`);
	return value;
}

function percentage(value, flag) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) {
		throw new Error(
			`${flag} must be a finite number from 0 through 99.999`
		);
	}
	return parsed;
}

export function validateSnapshot(value, source = 'benchmark snapshot') {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${source} must be a JSON object`);
	}
	if (value.schemaVersion !== 1) {
		throw new Error(`${source} has unsupported schemaVersion`);
	}
	if (
		typeof value.revisionLabel !== 'string' ||
		!value.revisionLabel.trim()
	) {
		throw new Error(`${source} revisionLabel must not be empty`);
	}
	if (!Object.hasOwn(value, 'resolvedCommit')) {
		throw new Error(`${source} resolvedCommit must be explicit`);
	}
	if (
		value.resolvedCommit !== null &&
		(typeof value.resolvedCommit !== 'string' ||
			!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value.resolvedCommit))
	) {
		throw new Error(
			`${source} resolvedCommit must be null or a full hexadecimal Git commit`
		);
	}
	const protocol = validateProtocol(value.protocol, source);
	if (
		!value.metrics ||
		typeof value.metrics !== 'object' ||
		Array.isArray(value.metrics)
	) {
		throw new Error(`${source} metrics must be an object`);
	}
	const expected = new Set(METRIC_DEFINITIONS.map(({ id }) => id));
	for (const key of Object.keys(value.metrics)) {
		if (!expected.has(key))
			throw new Error(`${source} has unknown metric ${key}`);
	}
	for (const { id } of METRIC_DEFINITIONS) {
		const number = value.metrics[id];
		if (
			typeof number !== 'number' ||
			!Number.isFinite(number) ||
			number <= 0
		) {
			throw new Error(
				`${source} metric ${id} must be finite and greater than zero`
			);
		}
	}
	return {
		schemaVersion: 1,
		revisionLabel: value.revisionLabel,
		resolvedCommit: value.resolvedCommit,
		protocol,
		metrics: Object.fromEntries(
			METRIC_DEFINITIONS.map(({ id }) => [id, value.metrics[id]])
		),
		metadata:
			value.metadata && typeof value.metadata === 'object'
				? value.metadata
				: {},
	};
}

function validateProtocol(value, source) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${source} protocol must be an object`);
	}
	const actualKeys = Object.keys(value).sort();
	const expectedKeys = Object.keys(PROTOCOL_FIELDS).sort();
	if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
		throw new Error(`${source} protocol fields do not match schema v1`);
	}
	const normalized = {};
	const cpuSets = {};
	for (const [key, expected] of Object.entries(PROTOCOL_FIELDS)) {
		const actual = value[key];
		if (expected === 'string') {
			if (typeof actual !== 'string' || !/^\d+\.\d+\.\d+$/.test(actual)) {
				throw new Error(
					`${source} protocol ${key} must be an exact version`
				);
			}
		} else if (expected === 'cpu-set') {
			const cpuSet = parseCpuSet(actual, source, key);
			if (cpuSet.count !== 6) {
				throw new Error(
					`${source} protocol ${key} must contain exactly six CPUs`
				);
			}
			cpuSets[key] = cpuSet.ranges;
		} else if (expected === 'non-empty-string') {
			if (typeof actual !== 'string' || !actual.trim()) {
				throw new Error(`${source} protocol ${key} must not be empty`);
			}
		} else if (expected === 'positive-integer') {
			if (!Number.isInteger(actual) || actual <= 0) {
				throw new Error(
					`${source} protocol ${key} must be a positive integer`
				);
			}
		} else if (actual !== expected) {
			throw new Error(
				`${source} protocol ${key} must equal ${JSON.stringify(expected)}`
			);
		}
		normalized[key] = actual;
	}
	if (
		cpuSets.serverCpuSet.some(([serverStart, serverEnd]) =>
			cpuSets.clientCpuSet.some(
				([clientStart, clientEnd]) =>
					serverStart <= clientEnd && clientStart <= serverEnd
			)
		)
	) {
		throw new Error(`${source} protocol CPU sets must not overlap`);
	}
	return normalized;
}

function parseCpuSet(value, source, key) {
	if (
		typeof value !== 'string' ||
		!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value)
	) {
		throw new Error(`${source} protocol ${key} is not a CPU set`);
	}
	let previousEnd = -1;
	let count = 0;
	const ranges = value.split(',').map((part) => {
		const [startText, endText = startText] = part.split('-');
		const start = Number(startText);
		const end = Number(endText);
		if (
			!Number.isSafeInteger(start) ||
			!Number.isSafeInteger(end) ||
			start > end ||
			start <= previousEnd
		) {
			throw new Error(
				`${source} protocol ${key} must be ordered, unique CPU ranges`
			);
		}
		previousEnd = end;
		count += end - start + 1;
		return [start, end];
	});
	return { count, ranges };
}

export function compareSnapshots(
	baselineValue,
	candidateValue,
	maxRegressionPct
) {
	const baseline = validateSnapshot(baselineValue, 'baseline snapshot');
	const candidate = validateSnapshot(candidateValue, 'candidate snapshot');
	if (
		JSON.stringify(baseline.protocol) !== JSON.stringify(candidate.protocol)
	) {
		const differences = Object.keys(PROTOCOL_FIELDS).filter(
			(key) => baseline.protocol[key] !== candidate.protocol[key]
		);
		throw new Error(
			`benchmark protocol mismatch: ${differences.join(', ')}`
		);
	}
	const fraction =
		percentage(String(maxRegressionPct), 'maxRegressionPct') / 100;
	const rows = METRIC_DEFINITIONS.map((definition) => {
		const baselineValue = baseline.metrics[definition.id];
		const candidateValue = candidate.metrics[definition.id];
		const deltaPct =
			((candidateValue - baselineValue) / baselineValue) * 100;
		const regressionPct =
			definition.direction === 'higher' ? -deltaPct : deltaPct;
		const limit =
			definition.direction === 'higher'
				? baselineValue * (1 - fraction)
				: baselineValue * (1 + fraction);
		const tolerance = Math.max(Math.abs(limit) * 1e-12, 1e-12);
		const passed =
			definition.direction === 'higher'
				? candidateValue + tolerance >= limit
				: candidateValue <= limit + tolerance;
		return {
			...definition,
			baseline: baselineValue,
			candidate: candidateValue,
			deltaPct,
			regressionPct,
			limit,
			passed,
		};
	});
	return {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		maxRegressionPct,
		baseline: {
			revisionLabel: baseline.revisionLabel,
			resolvedCommit: baseline.resolvedCommit,
		},
		candidate: {
			revisionLabel: candidate.revisionLabel,
			resolvedCommit: candidate.resolvedCommit,
		},
		protocol: baseline.protocol,
		passed: rows.every(({ passed }) => passed),
		metrics: rows,
	};
}

export function formatComparisonTsv(comparison) {
	const columns = [
		'metric',
		'label',
		'unit',
		'direction',
		'baseline',
		'candidate',
		'delta_pct',
		'regression_pct',
		'limit',
		'status',
	];
	const rows = comparison.metrics.map((row) => [
		row.id,
		row.label,
		row.unit,
		row.direction,
		decimal(row.baseline),
		decimal(row.candidate),
		row.deltaPct.toFixed(3),
		row.regressionPct.toFixed(3),
		decimal(row.limit),
		row.passed ? 'PASS' : 'FAIL',
	]);
	return `${[columns, ...rows].map((row) => row.join('\t')).join('\n')}\n`;
}

export function formatComparisonTable(comparison) {
	const lines = [
		'| Metric | Baseline | Candidate | Change | Allowed | Status |',
		'| --- | ---: | ---: | ---: | ---: | :---: |',
	];
	for (const row of comparison.metrics) {
		const relation = row.direction === 'higher' ? '>=' : '<=';
		lines.push(
			`| ${row.label} | ${decimal(row.baseline)} ${row.unit} | ` +
				`${decimal(row.candidate)} ${row.unit} | ${signed(row.deltaPct)}% | ` +
				`${relation} ${decimal(row.limit)} | ${row.passed ? 'PASS' : 'FAIL'} |`
		);
	}
	lines.push(`\nRegression gate: ${comparison.passed ? 'PASS' : 'FAIL'}`);
	return `${lines.join('\n')}\n`;
}

function decimal(value) {
	return Number(value.toFixed(3)).toString();
}

function signed(value) {
	return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

async function readSnapshot(path, label) {
	let parsed;
	try {
		parsed = JSON.parse(await readFile(path, 'utf8'));
	} catch (error) {
		throw new Error(
			`could not read ${label} snapshot ${path}: ${error.message}`
		);
	}
	return validateSnapshot(parsed, `${label} snapshot ${path}`);
}

async function resolveRepositoryRoot(cwd, processOptions = {}) {
	const result = await runProcess('git', ['rev-parse', '--show-toplevel'], {
		cwd,
		capture: true,
		...processOptions,
	});
	return result.stdout.trim();
}

async function resolveRevision(repositoryRoot, reference, processOptions = {}) {
	const result = await runProcess(
		'git',
		['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`],
		{ cwd: repositoryRoot, capture: true, ...processOptions }
	);
	return result.stdout.trim();
}

async function verifyRequestedRevision(
	snapshot,
	reference,
	repositoryRoot,
	role
) {
	if (!reference) return;
	const revision = await resolveRevision(repositoryRoot, reference);
	if (snapshot.resolvedCommit === null) {
		throw new Error(
			`${role} snapshot ${snapshot.revisionLabel} has no resolvedCommit for exact ref verification`
		);
	}
	if (snapshot.resolvedCommit !== revision) {
		throw new Error(
			`${role} snapshot commit ${snapshot.resolvedCommit} does not match ${reference} (${revision})`
		);
	}
}

async function collectSnapshots(options, repositoryRoot, signalLatch) {
	if (process.platform !== 'linux') {
		throw new Error(
			'automatic benchmark collection is Linux-only; use --baseline-results and --candidate-results on this platform'
		);
	}
	signalLatch.throwIfAborted();
	const revisions = {
		baseline: await resolveRevision(repositoryRoot, options.baselineRef, {
			signalLatch,
		}),
		candidate: await resolveRevision(repositoryRoot, options.candidateRef, {
			signalLatch,
		}),
	};
	signalLatch.throwIfAborted();
	const worktreeRoot = await mkdtemp(
		join(tmpdir(), 'wp-playground-native-benchmark-regression-')
	);
	const addedWorktrees = [];
	try {
		const snapshots = {};
		for (const role of ['baseline', 'candidate']) {
			signalLatch.throwIfAborted();
			const worktree = join(worktreeRoot, role);
			const output = join(options.outputDir, `${role}-snapshot.json`);
			addedWorktrees.push(worktree);
			await runProcess(
				'git',
				['worktree', 'add', '--detach', worktree, revisions[role]],
				{ cwd: repositoryRoot, capture: true, signalLatch }
			);
			signalLatch.throwIfAborted();
			process.stdout.write(
				`Collecting ${role} benchmark at ${revisions[role].slice(0, 12)}\n`
			);
			await runProcess(
				'bash',
				[
					options.collector,
					'--repository',
					worktree,
					'--revision',
					revisions[role],
					'--output',
					output,
				],
				{
					cwd: repositoryRoot,
					logPath: join(options.outputDir, `${role}-collector.log`),
					signalLatch,
				}
			);
			signalLatch.throwIfAborted();
			snapshots[role] = await readSnapshot(output, role);
			signalLatch.throwIfAborted();
			if (snapshots[role].resolvedCommit !== revisions[role]) {
				throw new Error(
					`${role} collector returned commit ${snapshots[role].resolvedCommit}; expected ${revisions[role]}`
				);
			}
		}
		return snapshots;
	} finally {
		if (!options.keepWorktrees) {
			for (const worktree of addedWorktrees.reverse()) {
				await removeWorktreeAfterCollection(
					repositoryRoot,
					worktree,
					signalLatch
				);
			}
			await rm(worktreeRoot, { recursive: true, force: true });
		} else {
			process.stdout.write(`Retained worktrees at ${worktreeRoot}\n`);
		}
		signalLatch.throwIfAborted();
	}
}

async function removeWorktreeAfterCollection(
	repositoryRoot,
	worktree,
	signalLatch
) {
	const args = ['worktree', 'remove', '--force', worktree];
	if (!signalLatch.signal) {
		try {
			await runProcess('git', args, {
				cwd: repositoryRoot,
				capture: true,
				allowFailure: true,
				signalLatch,
			});
			return;
		} catch (error) {
			if (!error.interruptedSignal) throw error;
		}
	}
	await runProcess('git', args, {
		cwd: repositoryRoot,
		capture: true,
		allowFailure: true,
	});
}

async function runProcess(command, args, options = {}) {
	let logHandle;
	let child;
	let result;
	let processFailure;
	let stdout = '';
	let stderr = '';
	let stdio = ['ignore', 'pipe', 'pipe'];
	if (options.logPath) {
		await mkdir(dirname(options.logPath), { recursive: true });
		logHandle = await open(options.logPath, 'w');
		stdio = ['ignore', logHandle.fd, logHandle.fd];
	}
	try {
		try {
			result = await new Promise((resolvePromise, reject) => {
				child = spawn(command, args, {
					cwd: options.cwd,
					env: { ...process.env, ...options.env },
					stdio,
					windowsHide: true,
					detached:
						Boolean(options.signalLatch) &&
						process.platform !== 'win32',
				});
				options.signalLatch?.track(child);
				child.stdout?.on('data', (chunk) => {
					stdout = boundedAppend(stdout, chunk);
				});
				child.stderr?.on('data', (chunk) => {
					stderr = boundedAppend(stderr, chunk);
				});
				child.once('error', reject);
				child.once('close', (code, signal) =>
					resolvePromise({ code, signal })
				);
			});
		} catch (error) {
			processFailure = error;
		}
	} finally {
		if (options.signalLatch?.signal && child) {
			await options.signalLatch.waitForChild(child);
		}
		options.signalLatch?.untrack(child);
		await logHandle?.close();
	}
	options.signalLatch?.throwIfAborted();
	if (processFailure) throw processFailure;
	if (result.code !== 0 || result.signal !== null) {
		if (options.allowFailure) return { stdout, stderr, ...result };
		const diagnostic = options.logPath
			? `; see ${options.logPath}`
			: `: ${stderr.trim().slice(-2_000)}`;
		throw new Error(
			`${basename(command)} failed with ${result.signal ?? `exit ${result.code}`}${diagnostic}`
		);
	}
	return { stdout, stderr, ...result };
}

class CollectionSignalLatch {
	constructor() {
		this.signal = null;
		this.interruptedAt = null;
		this.children = new Map();
		this.handlers = new Map();
	}

	install() {
		for (const signal of ['SIGINT', 'SIGTERM']) {
			const handler = () => this.abort(signal);
			this.handlers.set(signal, handler);
			process.on(signal, handler);
		}
	}

	abort(signal) {
		if (this.signal) return;
		this.signal = signal;
		this.interruptedAt = Date.now();
		for (const child of this.children.keys()) this.forward(child);
	}

	track(child) {
		if (!child) return;
		this.children.set(child, { forwarded: false, forceKillTimer: null });
		if (this.signal) this.forward(child);
	}

	forward(child) {
		const record = this.children.get(child);
		if (!record || record.forwarded) return;
		record.forwarded = true;
		signalProcess(child, this.signal, true);
		const remaining = Math.max(0, this.interruptedAt + 5_000 - Date.now());
		record.forceKillTimer = setTimeout(
			() => signalProcess(child, 'SIGKILL', true),
			remaining
		);
		record.forceKillTimer.unref();
	}

	async waitForChild(child) {
		if (!this.signal || !child) return;
		await waitForForwardedProcessGroup(child, this.interruptedAt);
	}

	untrack(child) {
		const record = this.children.get(child);
		if (record?.forceKillTimer) clearTimeout(record.forceKillTimer);
		this.children.delete(child);
	}

	throwIfAborted() {
		if (!this.signal) return;
		const error = new Error(`interrupted by ${this.signal}`);
		error.interruptedSignal = this.signal;
		throw error;
	}

	dispose() {
		for (const [signal, handler] of this.handlers) {
			process.off(signal, handler);
		}
		for (const child of this.children.keys()) this.untrack(child);
		this.handlers.clear();
	}
}

async function waitForForwardedProcessGroup(child, interruptedAt) {
	if (process.platform === 'win32' || !child?.pid) return;
	const gracefulDeadline = interruptedAt + 5_000;
	while (processGroupExists(child.pid) && Date.now() < gracefulDeadline) {
		await delay(Math.min(50, gracefulDeadline - Date.now()));
	}
	if (!processGroupExists(child.pid)) return;
	signalProcess(child, 'SIGKILL', true);
	const killDeadline = Date.now() + 1_000;
	while (processGroupExists(child.pid) && Date.now() < killDeadline) {
		await delay(25);
	}
}

function processGroupExists(pid) {
	try {
		process.kill(-pid, 0);
		return true;
	} catch (error) {
		if (error.code === 'ESRCH') return false;
		throw error;
	}
}

function delay(milliseconds) {
	return new Promise((resolvePromise) =>
		setTimeout(resolvePromise, milliseconds)
	);
}

function signalProcess(child, signal, processGroup) {
	if (!child?.pid) return;
	try {
		if (processGroup && process.platform !== 'win32') {
			process.kill(-child.pid, signal);
		} else {
			child.kill(signal);
		}
	} catch (error) {
		if (error.code !== 'ESRCH') throw error;
	}
}

function boundedAppend(previous, chunk) {
	const combined = previous + String(chunk);
	return combined.length > 64 * 1024 ? combined.slice(-64 * 1024) : combined;
}

async function atomicWrite(path, contents) {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	await writeFile(temporary, contents);
	await rename(temporary, path);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		process.stdout.write(HELP);
		return;
	}
	await mkdir(options.outputDir, { recursive: true });
	let baseline;
	let candidate;
	if (options.baselineResults) {
		baseline = await readSnapshot(options.baselineResults, 'baseline');
		candidate = await readSnapshot(options.candidateResults, 'candidate');
		if (options.baselineRef || options.candidateRef) {
			const repositoryRoot = await resolveRepositoryRoot(process.cwd());
			await verifyRequestedRevision(
				baseline,
				options.baselineRef,
				repositoryRoot,
				'baseline'
			);
			await verifyRequestedRevision(
				candidate,
				options.candidateRef,
				repositoryRoot,
				'candidate'
			);
		}
	} else {
		const signalLatch = new CollectionSignalLatch();
		signalLatch.install();
		try {
			const repositoryRoot = await resolveRepositoryRoot(process.cwd(), {
				signalLatch,
			});
			signalLatch.throwIfAborted();
			({ baseline, candidate } = await collectSnapshots(
				options,
				repositoryRoot,
				signalLatch
			));
		} finally {
			signalLatch.dispose();
		}
	}
	const comparison = compareSnapshots(
		baseline,
		candidate,
		options.maxRegressionPct
	);
	const jsonPath = join(options.outputDir, 'benchmark-regression.json');
	const tsvPath = join(options.outputDir, 'benchmark-regression.tsv');
	await Promise.all([
		atomicWrite(jsonPath, `${JSON.stringify(comparison, null, 2)}\n`),
		atomicWrite(tsvPath, formatComparisonTsv(comparison)),
	]);
	process.stdout.write(formatComparisonTable(comparison));
	process.stdout.write(`JSON ${jsonPath}\nTSV  ${tsvPath}\n`);
	if (!comparison.passed) process.exitCode = 1;
}

const isMain =
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
	main().catch((error) => {
		process.stderr.write(`benchmark-regression: ${error.message}\n`);
		process.exitCode =
			error.interruptedSignal === 'SIGINT'
				? 130
				: error.interruptedSignal === 'SIGTERM'
					? 143
					: 2;
	});
}
