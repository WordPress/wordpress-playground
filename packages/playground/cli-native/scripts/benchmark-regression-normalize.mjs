#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKLOADS = ['public', 'mixed', 'admin'];

function parseArgs(argv) {
	const options = {};
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		const equals = argument.indexOf('=');
		const flag = equals === -1 ? argument : argument.slice(0, equals);
		const inline = equals === -1 ? undefined : argument.slice(equals + 1);
		const value = () => {
			if (inline !== undefined) return inline;
			const next = argv[++index];
			if (next === undefined || next.startsWith('--')) {
				throw new Error(`${flag} requires a value`);
			}
			return next;
		};
		const key = {
			'--revision-label': 'revisionLabel',
			'--resolved-commit': 'resolvedCommit',
			'--label': 'label',
			'--throughput-dir': 'throughputDir',
			'--cpu-reports-dir': 'cpuReportsDir',
			'--cpu-loads-dir': 'cpuLoadsDir',
			'--memory-summary': 'memorySummary',
			'--site-editor': 'siteEditor',
			'--wordpress-version': 'wordpressVersion',
			'--php-version': 'phpVersion',
			'--server-cpus': 'serverCpuSet',
			'--client-cpus': 'clientCpuSet',
			'--host-architecture': 'hostArchitecture',
			'--host-cpu-model': 'hostCpuModel',
			'--host-kernel-release': 'hostKernelRelease',
			'--host-logical-cpu-count': 'hostLogicalCpuCount',
			'--output': 'output',
		}[flag];
		if (!key) throw new Error(`unknown argument: ${argument}`);
		options[key] = value();
	}
	for (const key of [
		'revisionLabel',
		'resolvedCommit',
		'label',
		'throughputDir',
		'cpuReportsDir',
		'cpuLoadsDir',
		'memorySummary',
		'siteEditor',
		'wordpressVersion',
		'phpVersion',
		'serverCpuSet',
		'clientCpuSet',
		'hostArchitecture',
		'hostCpuModel',
		'hostKernelRelease',
		'hostLogicalCpuCount',
		'output',
	]) {
		if (!options[key]) throw new Error(`missing ${key}`);
	}
	for (const key of [
		'throughputDir',
		'cpuReportsDir',
		'cpuLoadsDir',
		'memorySummary',
		'siteEditor',
		'output',
	]) {
		options[key] = resolve(options[key]);
	}
	options.hostLogicalCpuCount = Number(options.hostLogicalCpuCount);
	if (
		!Number.isInteger(options.hostLogicalCpuCount) ||
		options.hostLogicalCpuCount <= 0
	) {
		throw new Error('hostLogicalCpuCount must be a positive integer');
	}
	return options;
}

async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'));
}

function finitePositive(value, context) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) {
		throw new Error(`${context} must be finite and greater than zero`);
	}
	return number;
}

function exactRow(rows, predicate, context) {
	if (!Array.isArray(rows)) throw new Error(`${context} rows are missing`);
	const matches = rows.filter(predicate);
	if (matches.length !== 1) {
		throw new Error(`${context} expected one row, found ${matches.length}`);
	}
	return matches[0];
}

function fixedLoadIsValid(run, label, workload, round) {
	return (
		run.schema_version === 1 &&
		run.label === label &&
		run.workload === workload &&
		run.round === round &&
		run.concurrency === 6 &&
		run.requests_per_worker === 36 &&
		run.exact_request_target === 216 &&
		run.cookie_scope ===
			{ public: 'none', mixed: 'admin', admin: 'all' }[workload] &&
		run.summary?.errors === 0 &&
		run.summary?.requests === 216 &&
		run.summary?.successes === 216 &&
		Number.isFinite(run.elapsed_s) &&
		run.elapsed_s > 0 &&
		Number.isFinite(run.summary?.successful_rps) &&
		run.summary.successful_rps > 0 &&
		Array.isArray(run.records) &&
		run.records.length === 216 &&
		run.records.every((record) => record.ok === true)
	);
}

async function throughputMetrics(root, label) {
	const result = {};
	for (const workload of WORKLOADS) {
		const directory = join(root, workload);
		const names = (await readdir(directory))
			.filter((name) => /^round-\d+-load\.json$/.test(name))
			.sort();
		if (names.length !== 4) {
			throw new Error(`${workload} throughput expected four rounds`);
		}
		const expectedNames = [1, 2, 3, 4].map(
			(round) => `round-${round}-load.json`
		);
		if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
			throw new Error(
				`${workload} throughput rounds must be exactly 1-4`
			);
		}
		const runs = await Promise.all(
			names.map((name) => readJson(join(directory, name)))
		);
		for (const [index, run] of runs.entries()) {
			if (!fixedLoadIsValid(run, label, workload, index + 1)) {
				throw new Error(
					`${workload} throughput contains an invalid run`
				);
			}
		}
		result[workload] =
			runs.reduce(
				(sum, run) =>
					sum +
					finitePositive(
						run.summary.successful_rps,
						`${workload} successful_rps`
					),
				0
			) / runs.length;
	}
	return result;
}

async function cpuMetrics(reportsDirectory, loadsRoot, label) {
	const result = {};
	for (const workload of WORKLOADS) {
		const reportNames = (await readdir(reportsDirectory))
			.filter((name) => name.startsWith(`${label}-${workload}-r`))
			.sort();
		const expectedReportNames = [1, 2, 3, 4, 5, 6].map(
			(round) => `${label}-${workload}-r${round}.json`
		);
		if (
			JSON.stringify(reportNames) !== JSON.stringify(expectedReportNames)
		) {
			throw new Error(`${workload} CPU expected six error-free rounds`);
		}
		const loadsDirectory = join(loadsRoot, workload);
		const loadNames = (await readdir(loadsDirectory))
			.filter((name) => /^round-\d+-load\.json$/.test(name))
			.sort();
		const expectedLoadNames = [1, 2, 3, 4, 5, 6].map(
			(round) => `round-${round}-load.json`
		);
		if (JSON.stringify(loadNames) !== JSON.stringify(expectedLoadNames)) {
			throw new Error(`${workload} CPU expected six raw load rounds`);
		}
		const [reports, loads] = await Promise.all([
			Promise.all(
				reportNames.map((name) =>
					readJson(join(reportsDirectory, name))
				)
			),
			Promise.all(
				loadNames.map((name) => readJson(join(loadsDirectory, name)))
			),
		]);
		for (const [index, report] of reports.entries()) {
			const load = loads[index];
			if (!fixedLoadIsValid(load, label, workload, index + 1)) {
				throw new Error(`${workload} CPU contains an invalid raw load`);
			}
			const memoryEvents = report.memory_events_delta ?? {};
			if (
				report.schema_version !== 1 ||
				report.label !== label ||
				report.workload !== workload ||
				report.round !== index + 1 ||
				report.successes !== 216 ||
				report.errors !== 0 ||
				report.nr_throttled !== 0 ||
				report.throttled_seconds !== 0 ||
				['oom', 'oom_kill', 'oom_group_kill'].some(
					(key) => Number(memoryEvents[key] ?? 0) !== 0
				) ||
				report.successes !== load.summary.successes ||
				report.errors !== load.summary.errors ||
				report.elapsed_s !== load.elapsed_s ||
				report.successful_rps !== load.summary.successful_rps
			) {
				throw new Error(
					`${workload} CPU report does not match its raw load round`
				);
			}
		}
		result[workload] = median(
			reports.map((report) =>
				finitePositive(
					report.cpu_ms_per_request,
					`${workload} cpu_ms_per_request`
				)
			)
		);
	}
	return result;
}

function median(values) {
	const ordered = [...values].sort((left, right) => left - right);
	const middle = Math.floor(ordered.length / 2);
	return ordered.length % 2
		? ordered[middle]
		: (ordered[middle - 1] + ordered[middle]) / 2;
}

function memoryMetrics(summary, label) {
	if (summary.schema_version !== 1) {
		throw new Error('memory summary has unsupported schema');
	}
	const row = exactRow(
		summary.memory_rows,
		(candidate) => candidate.label === label,
		'memory'
	);
	if (!Number.isInteger(row.idle_samples) || row.idle_samples < 20) {
		throw new Error(
			'memory summary requires at least 20 warm-idle samples'
		);
	}
	const workloads = WORKLOADS.map((workload) =>
		exactRow(
			summary.workload_rows,
			(candidate) =>
				candidate.label === label && candidate.workload === workload,
			`${workload} memory`
		)
	);
	if (
		workloads.some(
			(workload) =>
				!Number.isInteger(workload.samples) || workload.samples < 5
		)
	) {
		throw new Error('memory summary requires at least five active samples');
	}
	const expectedPssPeak = Math.max(
		...workloads.map((workload) => workload.active_pss_peak_mib)
	);
	const expectedCgroupPeak = Math.max(
		...workloads.map((workload) => workload.active_cgroup_memory_peak_mib)
	);
	if (
		row.active_pss_peak_mib !== expectedPssPeak ||
		row.active_cgroup_memory_peak_mib !== expectedCgroupPeak
	) {
		throw new Error('memory summary peaks do not match workload samples');
	}
	return {
		warmIdlePss: finitePositive(
			row.idle_pss_median_mib,
			'idle_pss_median_mib'
		),
		peakActivePss: finitePositive(
			row.active_pss_peak_mib,
			'active_pss_peak_mib'
		),
		peakCgroup: finitePositive(
			row.active_cgroup_memory_peak_mib,
			'active_cgroup_memory_peak_mib'
		),
	};
}

function siteEditorMetrics(report, label) {
	if (
		report.schemaVersion !== 1 ||
		report.configuration?.warmups !== 2 ||
		report.configuration?.samples !== 7 ||
		report.configuration?.quietWindowMs !== 750
	) {
		throw new Error('Site Editor report does not match benchmark protocol');
	}
	const result = exactRow(
		report.results,
		(candidate) => candidate.label === label,
		'Site Editor'
	);
	if (
		result.successfulSamples !== 7 ||
		result.failedSamples !== 0 ||
		result.fullyLoadedStatuses?.ok !== 7 ||
		result.fullyLoadedStatuses?.quietWindowTimeout !== 0 ||
		result.fullyLoadedStatuses?.error !== 0 ||
		['navigationTtfbMs', 'firstMeaningfulPaintMs', 'fullyLoadedMs'].some(
			(metric) => result.metrics?.[metric]?.observations !== 7
		)
	) {
		throw new Error(
			'Site Editor expected seven fully loaded successful samples'
		);
	}
	return {
		ttfb: finitePositive(
			result.metrics?.navigationTtfbMs?.median,
			'Site Editor TTFB'
		),
		meaningful: finitePositive(
			result.metrics?.firstMeaningfulPaintMs?.median,
			'Site Editor meaningful paint'
		),
		fullyLoaded: finitePositive(
			result.metrics?.fullyLoadedMs?.median,
			'Site Editor fully loaded'
		),
	};
}

export async function normalizeArtifacts(options) {
	const [throughput, cpu, memorySummary, siteEditor] = await Promise.all([
		throughputMetrics(options.throughputDir, options.label),
		cpuMetrics(options.cpuReportsDir, options.cpuLoadsDir, options.label),
		readJson(options.memorySummary),
		readJson(options.siteEditor),
	]);
	const memory = memoryMetrics(memorySummary, options.label);
	const editor = siteEditorMetrics(siteEditor, options.label);
	return {
		schemaVersion: 1,
		revisionLabel: options.revisionLabel,
		resolvedCommit: options.resolvedCommit,
		protocol: {
			harnessVersion: 1,
			wordpressVersion: options.wordpressVersion,
			phpVersion: options.phpVersion,
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
			serverCpuSet: options.serverCpuSet,
			clientCpuSet: options.clientCpuSet,
			hostArchitecture: options.hostArchitecture,
			hostCpuModel: options.hostCpuModel,
			hostKernelRelease: options.hostKernelRelease,
			hostLogicalCpuCount: options.hostLogicalCpuCount,
		},
		metrics: {
			'throughput.public_rps': throughput.public,
			'throughput.mixed_rps': throughput.mixed,
			'throughput.admin_rps': throughput.admin,
			'cpu.public_ms_per_request': cpu.public,
			'cpu.mixed_ms_per_request': cpu.mixed,
			'cpu.admin_ms_per_request': cpu.admin,
			'memory.warm_idle_pss_mib': memory.warmIdlePss,
			'memory.peak_active_pss_mib': memory.peakActivePss,
			'memory.peak_cgroup_mib': memory.peakCgroup,
			'site_editor.ttfb_ms': editor.ttfb,
			'site_editor.first_meaningful_paint_ms': editor.meaningful,
			'site_editor.fully_loaded_ms': editor.fullyLoaded,
		},
		metadata: {
			throughput: 'arithmetic mean of four fixed-count rounds',
			cpu: 'median of six cgroup-v2 rounds cross-checked against raw fixed-count loads',
			memory: 'median warm-idle PSS and maximum active PSS/cgroup peak',
			siteEditor: 'median of seven fully loaded Chromium samples',
		},
	};
}

async function atomicWrite(path, contents) {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	await writeFile(temporary, contents);
	await rename(temporary, path);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const snapshot = await normalizeArtifacts(options);
	await atomicWrite(options.output, `${JSON.stringify(snapshot, null, 2)}\n`);
	process.stdout.write(`${options.output}\n`);
}

const isMain =
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
	main().catch((error) => {
		process.stderr.write(
			`benchmark-regression-normalize: ${error.message}\n`
		);
		process.exitCode = 1;
	});
}
