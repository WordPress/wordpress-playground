import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
	chmod,
	mkdtemp,
	mkdir,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	METRIC_DEFINITIONS,
	compareSnapshots,
	formatComparisonTable,
	formatComparisonTsv,
	parseArgs,
	validateSnapshot,
} from '../benchmark-regression.mjs';
import { normalizeArtifacts } from '../benchmark-regression-normalize.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(testDirectory, 'fixtures');
const regressionScript = resolve(testDirectory, '../benchmark-regression.mjs');

async function fixture(name) {
	return JSON.parse(
		await readFile(
			join(fixtureDirectory, `benchmark-regression-${name}.json`)
		)
	);
}

async function writeJson(path, value) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, cwd) {
	const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
	assert.equal(
		result.status,
		0,
		`${command} ${args.join(' ')} failed: ${result.stderr}`
	);
	return result;
}

test('metric inventory covers every PR regression metric exactly once', () => {
	assert.equal(METRIC_DEFINITIONS.length, 12);
	assert.equal(
		new Set(METRIC_DEFINITIONS.map(({ id }) => id)).size,
		METRIC_DEFINITIONS.length
	);
	assert.deepEqual(
		METRIC_DEFINITIONS.filter(
			({ direction }) => direction === 'higher'
		).map(({ id }) => id),
		[
			'throughput.public_rps',
			'throughput.mixed_rps',
			'throughput.admin_rps',
		]
	);
});

test('comparison accepts improvements and regressions within five percent', async () => {
	const comparison = compareSnapshots(
		await fixture('baseline'),
		await fixture('pass'),
		5
	);
	assert.equal(comparison.passed, true);
	assert.equal(
		comparison.metrics.every(({ passed }) => passed),
		true
	);
	assert.match(formatComparisonTable(comparison), /Regression gate: PASS/);
	assert.equal(
		formatComparisonTsv(comparison).trimEnd().split('\n').length,
		13
	);
});

test('five-percent boundary is inclusive in both metric directions', async () => {
	const baseline = await fixture('baseline');
	const candidate = structuredClone(baseline);
	candidate.revisionLabel = 'boundary-candidate';
	for (const definition of METRIC_DEFINITIONS) {
		candidate.metrics[definition.id] =
			baseline.metrics[definition.id] *
			(definition.direction === 'higher' ? 0.95 : 1.05);
	}
	const comparison = compareSnapshots(baseline, candidate, 5);
	assert.equal(comparison.passed, true);
});

test('comparison rejects direction-aware regressions and identifies each metric', async () => {
	const comparison = compareSnapshots(
		await fixture('baseline'),
		await fixture('fail'),
		5
	);
	assert.equal(comparison.passed, false);
	assert.equal(
		comparison.metrics.every(({ passed }) => !passed),
		true
	);
	const table = formatComparisonTable(comparison);
	assert.match(table, /Public throughput/);
	assert.match(table, /Site Editor fully loaded/);
	assert.match(table, /Regression gate: FAIL/);
});

test('snapshot validation rejects missing, unknown, zero, and non-finite metrics', async () => {
	const baseline = await fixture('baseline');
	const missing = structuredClone(baseline);
	delete missing.metrics['cpu.admin_ms_per_request'];
	assert.throws(() => validateSnapshot(missing), /cpu\.admin_ms_per_request/);
	const unknown = structuredClone(baseline);
	unknown.metrics.typo = 1;
	assert.throws(() => validateSnapshot(unknown), /unknown metric typo/);
	const zero = structuredClone(baseline);
	zero.metrics['memory.peak_cgroup_mib'] = 0;
	assert.throws(() => validateSnapshot(zero), /greater than zero/);
	const infinite = structuredClone(baseline);
	infinite.metrics['site_editor.ttfb_ms'] = Number.POSITIVE_INFINITY;
	assert.throws(() => validateSnapshot(infinite), /finite/);
	const implicitCommit = structuredClone(baseline);
	delete implicitCommit.resolvedCommit;
	assert.throws(
		() => validateSnapshot(implicitCommit),
		/resolvedCommit must be explicit/
	);
	const abbreviatedCommit = structuredClone(baseline);
	abbreviatedCommit.resolvedCommit = 'aab6ca9e';
	assert.throws(
		() => validateSnapshot(abbreviatedCommit),
		/full hexadecimal Git commit/
	);
	const missingProtocol = structuredClone(baseline);
	delete missingProtocol.protocol.cpuRounds;
	assert.throws(() => validateSnapshot(missingProtocol), /protocol fields/);
	const mismatchedProtocol = await fixture('pass');
	mismatchedProtocol.protocol.serverCpuSet = '0-4,6';
	mismatchedProtocol.protocol.clientCpuSet = '5,7-11';
	assert.throws(
		() => compareSnapshots(baseline, mismatchedProtocol, 5),
		/protocol mismatch: serverCpuSet/
	);
	const overlappingCpuSets = structuredClone(baseline);
	overlappingCpuSets.protocol.clientCpuSet = '5-10';
	assert.throws(
		() => validateSnapshot(overlappingCpuSets),
		/CPU sets must not overlap/
	);
	const differentHost = await fixture('pass');
	differentHost.protocol.hostCpuModel = 'different fixture CPU';
	assert.throws(
		() => compareSnapshots(baseline, differentHost, 5),
		/protocol mismatch: hostCpuModel/
	);
});

test('argument parser supports the exact ref gate and portable result mode', () => {
	const refs = parseArgs(
		[
			'--baseline-ref=aab6ca9e',
			'--candidate-ref=HEAD',
			'--max-regression-pct=5',
		],
		'/repo'
	);
	assert.equal(refs.baselineRef, 'aab6ca9e');
	assert.equal(refs.candidateRef, 'HEAD');
	assert.equal(refs.maxRegressionPct, 5);
	const files = parseArgs(
		['--baseline-results', 'one.json', '--candidate-results=two.json'],
		'/repo'
	);
	assert.equal(files.baselineResults, resolve('/repo', 'one.json'));
	assert.equal(files.candidateResults, resolve('/repo', 'two.json'));
	assert.throws(
		() => parseArgs(['--baseline-results=one.json'], '/repo'),
		/must be provided together/
	);
});

async function createRawBenchmarkArtifacts(root) {
	const throughputRoot = join(root, 'throughput');
	for (const [workload, rates] of [
		['public', [10, 10, 10, 50]],
		['mixed', [40, 41, 42, 43]],
		['admin', [20, 21, 22, 23]],
	]) {
		for (let round = 1; round <= 4; round++) {
			const successfulRps = rates[round - 1];
			await writeJson(
				join(throughputRoot, workload, `round-${round}-load.json`),
				{
					schema_version: 1,
					label: 'wasmtime',
					round,
					concurrency: 6,
					requests_per_worker: 36,
					exact_request_target: 216,
					workload,
					cookie_scope: {
						public: 'none',
						mixed: 'admin',
						admin: 'all',
					}[workload],
					elapsed_s: 216 / successfulRps,
					summary: {
						requests: 216,
						successes: 216,
						errors: 0,
						successful_rps: successfulRps,
					},
					records: Array.from({ length: 216 }, () => ({ ok: true })),
				}
			);
		}
	}
	const cpuReportsDir = join(root, 'cpu-reports');
	const cpuLoadsDir = join(root, 'cpu-loads');
	for (const [workload, base] of [
		['public', 100],
		['mixed', 150],
		['admin', 200],
	]) {
		for (let round = 1; round <= 6; round++) {
			const elapsed = 2 + round / 10;
			const successfulRps = Number((216 / elapsed).toFixed(3));
			await writeJson(
				join(cpuLoadsDir, workload, `round-${round}-load.json`),
				{
					schema_version: 1,
					label: 'wasmtime',
					workload,
					round,
					concurrency: 6,
					requests_per_worker: 36,
					exact_request_target: 216,
					cookie_scope: {
						public: 'none',
						mixed: 'admin',
						admin: 'all',
					}[workload],
					elapsed_s: elapsed,
					summary: {
						requests: 216,
						successes: 216,
						errors: 0,
						successful_rps: successfulRps,
					},
					records: Array.from({ length: 216 }, () => ({ ok: true })),
				}
			);
			await writeJson(
				join(cpuReportsDir, `wasmtime-${workload}-r${round}.json`),
				{
					schema_version: 1,
					label: 'wasmtime',
					workload,
					round,
					successes: 216,
					errors: 0,
					elapsed_s: elapsed,
					successful_rps: successfulRps,
					cpu_ms_per_request: base + round,
					nr_throttled: 0,
					throttled_seconds: 0,
					memory_events_delta: {
						oom: 0,
						oom_kill: 0,
						oom_group_kill: 0,
					},
				}
			);
		}
	}
	const memorySummary = join(root, 'memory.json');
	await writeJson(memorySummary, {
		schema_version: 1,
		memory_rows: [
			{
				label: 'wasmtime',
				idle_samples: 20,
				idle_pss_median_mib: 300,
				active_pss_peak_mib: 350,
				active_cgroup_memory_peak_mib: 360,
			},
		],
		workload_rows: [
			{
				label: 'wasmtime',
				workload: 'public',
				samples: 5,
				active_pss_peak_mib: 320,
				active_cgroup_memory_peak_mib: 330,
			},
			{
				label: 'wasmtime',
				workload: 'mixed',
				samples: 6,
				active_pss_peak_mib: 340,
				active_cgroup_memory_peak_mib: 350,
			},
			{
				label: 'wasmtime',
				workload: 'admin',
				samples: 7,
				active_pss_peak_mib: 350,
				active_cgroup_memory_peak_mib: 360,
			},
		],
	});
	const siteEditor = join(root, 'site-editor.json');
	await writeJson(siteEditor, {
		schemaVersion: 1,
		configuration: { warmups: 2, samples: 7, quietWindowMs: 750 },
		results: [
			{
				label: 'wasmtime',
				successfulSamples: 7,
				failedSamples: 0,
				fullyLoadedStatuses: {
					ok: 7,
					quietWindowTimeout: 0,
					error: 0,
				},
				metrics: {
					navigationTtfbMs: { observations: 7, median: 250 },
					firstMeaningfulPaintMs: {
						observations: 7,
						median: 1000,
					},
					fullyLoadedMs: { observations: 7, median: 2400 },
				},
			},
		],
	});
	return {
		revisionLabel: 'normalizer-fixture',
		resolvedCommit: null,
		label: 'wasmtime',
		throughputDir: throughputRoot,
		cpuReportsDir,
		cpuLoadsDir,
		memorySummary,
		siteEditor,
		wordpressVersion: '6.9.4',
		phpVersion: '8.2',
		serverCpuSet: '0-5',
		clientCpuSet: '6-11',
		hostArchitecture: 'x86_64',
		hostCpuModel: 'fixture CPU',
		hostKernelRelease: '6.8.0-fixture',
		hostLogicalCpuCount: 12,
	};
}

test('artifact normalizer validates the raw protocol and uses throughput mean', async () => {
	const root = await mkdtemp(
		join(tmpdir(), 'benchmark-regression-normalize-')
	);
	try {
		const options = await createRawBenchmarkArtifacts(root);
		const snapshot = await normalizeArtifacts(options);
		assert.equal(snapshot.metrics['throughput.public_rps'], 20);
		assert.equal(snapshot.metrics['cpu.admin_ms_per_request'], 203.5);
		assert.equal(snapshot.metrics['memory.peak_cgroup_mib'], 360);
		assert.equal(snapshot.metrics['site_editor.fully_loaded_ms'], 2400);
		assert.equal(
			snapshot.protocol.throughputAggregation,
			'arithmetic-mean'
		);
		validateSnapshot(snapshot);

		const badThroughput = join(
			options.throughputDir,
			'public/round-1-load.json'
		);
		const throughput = JSON.parse(await readFile(badThroughput, 'utf8'));
		throughput.schema_version = 2;
		await writeJson(badThroughput, throughput);
		await assert.rejects(
			() => normalizeArtifacts(options),
			/throughput contains an invalid run/
		);
		throughput.schema_version = 1;
		await writeJson(badThroughput, throughput);

		const badCpu = join(options.cpuReportsDir, 'wasmtime-public-r1.json');
		const cpu = JSON.parse(await readFile(badCpu, 'utf8'));
		cpu.nr_throttled = 1;
		await writeJson(badCpu, cpu);
		await assert.rejects(
			() => normalizeArtifacts(options),
			/public CPU report does not match its raw load round/
		);
		cpu.nr_throttled = 0;
		await writeJson(badCpu, cpu);
		cpu.successful_rps += 1;
		await writeJson(badCpu, cpu);
		await assert.rejects(
			() => normalizeArtifacts(options),
			/public CPU report does not match its raw load round/
		);
		cpu.successful_rps -= 1;
		await writeJson(badCpu, cpu);

		const memory = JSON.parse(
			await readFile(options.memorySummary, 'utf8')
		);
		memory.memory_rows[0].idle_samples = 19;
		await writeJson(options.memorySummary, memory);
		await assert.rejects(
			() => normalizeArtifacts(options),
			/at least 20 warm-idle samples/
		);
		memory.memory_rows[0].idle_samples = 20;
		await writeJson(options.memorySummary, memory);

		const siteEditor = JSON.parse(
			await readFile(options.siteEditor, 'utf8')
		);
		siteEditor.configuration.samples = 6;
		await writeJson(options.siteEditor, siteEditor);
		await assert.rejects(
			() => normalizeArtifacts(options),
			/Site Editor report does not match benchmark protocol/
		);
		siteEditor.configuration.samples = 7;
		siteEditor.results[0].successfulSamples = 6;
		siteEditor.results[0].failedSamples = 1;
		siteEditor.results[0].fullyLoadedStatuses = {
			ok: 6,
			quietWindowTimeout: 0,
			error: 1,
		};
		await writeJson(options.siteEditor, siteEditor);
		await assert.rejects(
			() => normalizeArtifacts(options),
			/seven fully loaded successful samples/
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('CPU provenance rejects malformed, wrong-scope, and incomplete raw loads', async () => {
	const root = await mkdtemp(join(tmpdir(), 'benchmark-regression-cpu-raw-'));
	try {
		const options = await createRawBenchmarkArtifacts(root);
		const path = join(options.cpuLoadsDir, 'public/round-1-load.json');
		const original = JSON.parse(await readFile(path, 'utf8'));
		for (const [name, mutate] of [
			['malformed schema', (value) => (value.schema_version = 2)],
			['wrong cookie scope', (value) => (value.cookie_scope = 'all')],
			['missing record', (value) => value.records.pop()],
		]) {
			const value = structuredClone(original);
			mutate(value);
			await writeJson(path, value);
			await assert.rejects(
				() => normalizeArtifacts(options),
				/public CPU contains an invalid raw load/,
				name
			);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('portable CLI result mode writes JSON and TSV and returns gate status', async () => {
	const root = await mkdtemp(join(tmpdir(), 'benchmark-regression-cli-'));
	try {
		const common = [
			regressionScript,
			`--baseline-results=${join(fixtureDirectory, 'benchmark-regression-baseline.json')}`,
			'--max-regression-pct=5',
		];
		const passingOutput = join(root, 'passing');
		const passing = spawnSync(
			process.execPath,
			[
				...common,
				`--candidate-results=${join(fixtureDirectory, 'benchmark-regression-pass.json')}`,
				`--output-dir=${passingOutput}`,
			],
			{ cwd: root, encoding: 'utf8' }
		);
		assert.equal(passing.status, 0, passing.stderr);
		assert.match(passing.stdout, /Regression gate: PASS/);
		assert.equal(
			JSON.parse(
				await readFile(
					join(passingOutput, 'benchmark-regression.json'),
					'utf8'
				)
			).metrics.length,
			12
		);
		assert.equal(
			(
				await readFile(
					join(passingOutput, 'benchmark-regression.tsv'),
					'utf8'
				)
			)
				.trimEnd()
				.split('\n').length,
			13
		);

		const failing = spawnSync(
			process.execPath,
			[
				...common,
				`--candidate-results=${join(fixtureDirectory, 'benchmark-regression-fail.json')}`,
				`--output-dir=${join(root, 'failing')}`,
			],
			{ cwd: root, encoding: 'utf8' }
		);
		assert.equal(failing.status, 1, failing.stderr);
		assert.match(failing.stdout, /Regression gate: FAIL/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('results-file ref verification requires and accepts only a full resolved commit', async () => {
	const root = await mkdtemp(
		join(tmpdir(), 'benchmark-regression-result-ref-')
	);
	try {
		run('git', ['init', '--quiet'], root);
		run('git', ['config', 'user.email', 'benchmark@example.test'], root);
		run('git', ['config', 'user.name', 'Benchmark Test'], root);
		await writeFile(join(root, 'value.txt'), 'value\n');
		run('git', ['add', 'value.txt'], root);
		run('git', ['commit', '--quiet', '-m', 'fixture'], root);
		const commit = run('git', ['rev-parse', 'HEAD'], root).stdout.trim();
		const baseline = await fixture('baseline');
		const candidate = await fixture('pass');
		baseline.resolvedCommit = commit;
		candidate.resolvedCommit = commit;
		const baselinePath = join(root, 'baseline.json');
		const candidatePath = join(root, 'candidate.json');
		await writeJson(baselinePath, baseline);
		await writeJson(candidatePath, candidate);
		const common = [
			regressionScript,
			`--baseline-results=${baselinePath}`,
			`--candidate-results=${candidatePath}`,
			'--baseline-ref=HEAD',
			'--candidate-ref=HEAD',
			`--output-dir=${join(root, 'output')}`,
		];
		const passing = spawnSync(process.execPath, common, {
			cwd: root,
			encoding: 'utf8',
		});
		assert.equal(passing.status, 0, passing.stderr);

		baseline.resolvedCommit = null;
		await writeJson(baselinePath, baseline);
		const missingCommit = spawnSync(process.execPath, common, {
			cwd: root,
			encoding: 'utf8',
		});
		assert.equal(missingCommit.status, 2, missingCommit.stderr);
		assert.match(missingCommit.stderr, /has no resolvedCommit/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test(
	'ref mode uses detached worktrees and removes them after collection',
	{ skip: process.platform !== 'linux' },
	async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'benchmark-regression-worktrees-')
		);
		try {
			const repository = join(root, 'repository');
			await mkdir(repository);
			run('git', ['init', '--quiet'], repository);
			run(
				'git',
				['config', 'user.email', 'benchmark@example.test'],
				repository
			);
			run('git', ['config', 'user.name', 'Benchmark Test'], repository);
			await writeFile(join(repository, 'value.txt'), 'baseline\n');
			run('git', ['add', 'value.txt'], repository);
			run('git', ['commit', '--quiet', '-m', 'baseline'], repository);
			await writeFile(join(repository, 'value.txt'), 'candidate\n');
			run('git', ['commit', '--quiet', '-am', 'candidate'], repository);

			const collector = join(root, 'fake-collector.sh');
			await writeFile(
				collector,
				`#!/usr/bin/env bash
set -euo pipefail
revision=""
output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --revision) revision="$2"; shift 2 ;;
    --output) output="$2"; shift 2 ;;
    --repository) shift 2 ;;
    *) exit 2 ;;
  esac
done
node - "$revision" "$output" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const snapshot = JSON.parse(fs.readFileSync(${JSON.stringify(
					join(fixtureDirectory, 'benchmark-regression-baseline.json')
				)}, 'utf8'));
snapshot.revisionLabel = process.argv[2];
snapshot.resolvedCommit = process.argv[2];
fs.mkdirSync(path.dirname(process.argv[3]), { recursive: true });
fs.writeFileSync(process.argv[3], JSON.stringify(snapshot) + '\\n');
NODE
`
			);
			const output = join(root, 'output');
			const result = spawnSync(
				process.execPath,
				[
					regressionScript,
					'--baseline-ref=HEAD~1',
					'--candidate-ref=HEAD',
					`--collector=${collector}`,
					`--output-dir=${output}`,
				],
				{ cwd: repository, encoding: 'utf8' }
			);
			assert.equal(result.status, 0, result.stderr);
			assert.match(result.stdout, /Collecting baseline benchmark/);
			assert.match(result.stdout, /Regression gate: PASS/);
			const worktrees = run(
				'git',
				['worktree', 'list', '--porcelain'],
				repository
			).stdout;
			assert.equal(
				worktrees
					.split('\n')
					.filter((line) => line.startsWith('worktree ')).length,
				1
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);

test(
	'interruption during worktree add is latched before the collector and cleans up',
	{ skip: process.platform !== 'linux', timeout: 15_000 },
	async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'benchmark-regression-pre-collector-interruption-')
		);
		try {
			const repository = join(root, 'repository');
			await mkdir(repository);
			run('git', ['init', '--quiet'], repository);
			run(
				'git',
				['config', 'user.email', 'benchmark@example.test'],
				repository
			);
			run('git', ['config', 'user.name', 'Benchmark Test'], repository);
			await writeFile(join(repository, 'value.txt'), 'value\n');
			run('git', ['add', 'value.txt'], repository);
			run('git', ['commit', '--quiet', '-m', 'fixture'], repository);

			const realGit = run(
				'sh',
				['-c', 'command -v git'],
				repository
			).stdout.trim();
			const fakeBin = join(root, 'bin');
			await mkdir(fakeBin);
			const marker = join(root, 'worktree-add.pid');
			const gitWrapper = join(fakeBin, 'git');
			await writeFile(
				gitWrapper,
				`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == worktree && "\${2:-}" == add ]]; then
  echo $$ >${JSON.stringify(marker)}
  child=""
  cleanup() {
    if [[ -n "$child" ]]; then kill "$child" 2>/dev/null || true; fi
    exit 143
  }
  trap cleanup INT TERM
  sleep 300 &
  child=$!
  wait "$child"
fi
exec ${JSON.stringify(realGit)} "$@"
`
			);
			await chmod(gitWrapper, 0o700);
			const output = join(root, 'output');
			const controller = spawn(
				process.execPath,
				[
					regressionScript,
					'--baseline-ref=HEAD',
					'--candidate-ref=HEAD',
					'--collector=/bin/false',
					`--output-dir=${output}`,
				],
				{
					cwd: repository,
					env: {
						...process.env,
						PATH: `${fakeBin}:${process.env.PATH}`,
					},
					stdio: ['ignore', 'pipe', 'pipe'],
				}
			);
			let wrapperPid;
			for (let attempt = 0; attempt < 100; attempt++) {
				try {
					wrapperPid = Number(
						(await readFile(marker, 'utf8')).trim()
					);
					break;
				} catch {
					await new Promise((resolvePromise) =>
						setTimeout(resolvePromise, 25)
					);
				}
			}
			assert.ok(
				Number.isInteger(wrapperPid),
				'worktree add did not start'
			);
			controller.kill('SIGTERM');
			const exit = await new Promise((resolvePromise, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('controller did not stop')),
					8_000
				);
				controller.once('close', (code, signal) => {
					clearTimeout(timeout);
					resolvePromise({ code, signal });
				});
			});
			assert.deepEqual(exit, { code: 143, signal: null });
			const worktrees = run(
				'git',
				['worktree', 'list', '--porcelain'],
				repository
			).stdout;
			assert.equal(
				worktrees
					.split('\n')
					.filter((line) => line.startsWith('worktree ')).length,
				1
			);
			assert.throws(
				() => process.kill(wrapperPid, 0),
				(error) => error.code === 'ESRCH'
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);

test(
	'interruption terminates the collector and removes its detached worktree',
	{ skip: process.platform !== 'linux', timeout: 15_000 },
	async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'benchmark-regression-interruption-')
		);
		try {
			const repository = join(root, 'repository');
			await mkdir(repository);
			run('git', ['init', '--quiet'], repository);
			run(
				'git',
				['config', 'user.email', 'benchmark@example.test'],
				repository
			);
			run('git', ['config', 'user.name', 'Benchmark Test'], repository);
			await writeFile(join(repository, 'value.txt'), 'value\n');
			run('git', ['add', 'value.txt'], repository);
			run('git', ['commit', '--quiet', '-m', 'fixture'], repository);
			const collector = join(root, 'long-collector.sh');
			await writeFile(
				collector,
				`#!/usr/bin/env bash
set -euo pipefail
output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    --revision|--repository) shift 2 ;;
    *) exit 2 ;;
  esac
done
echo $$ >"$output.pid"
child=""
cleanup() {
  if [[ -n "$child" ]]; then kill "$child" 2>/dev/null || true; fi
  exit 143
}
trap cleanup INT TERM
sleep 300 &
child=$!
wait "$child"
`
			);
			const output = join(root, 'output');
			const controller = spawn(
				process.execPath,
				[
					regressionScript,
					'--baseline-ref=HEAD',
					'--candidate-ref=HEAD',
					`--collector=${collector}`,
					`--output-dir=${output}`,
				],
				{ cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] }
			);
			const pidFile = join(output, 'baseline-snapshot.json.pid');
			let collectorPid;
			for (let attempt = 0; attempt < 100; attempt++) {
				try {
					collectorPid = Number(
						(await readFile(pidFile, 'utf8')).trim()
					);
					break;
				} catch {
					await new Promise((resolvePromise) =>
						setTimeout(resolvePromise, 25)
					);
				}
			}
			assert.ok(
				Number.isInteger(collectorPid),
				'collector did not start'
			);
			controller.kill('SIGTERM');
			const exit = await new Promise((resolvePromise, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('controller did not stop')),
					8_000
				);
				controller.once('close', (code, signal) => {
					clearTimeout(timeout);
					resolvePromise({ code, signal });
				});
			});
			assert.deepEqual(exit, { code: 143, signal: null });
			const worktrees = run(
				'git',
				['worktree', 'list', '--porcelain'],
				repository
			).stdout;
			assert.equal(
				worktrees
					.split('\n')
					.filter((line) => line.startsWith('worktree ')).length,
				1
			);
			assert.throws(
				() => process.kill(collectorPid, 0),
				(error) => error.code === 'ESRCH'
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);
