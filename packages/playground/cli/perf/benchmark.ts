#!/usr/bin/env -S node --experimental-strip-types --experimental-transform-types --disable-warning=ExperimentalWarning
/**
 * Playground CLI — Site Editor Performance Benchmark
 *
 * Spawns the Playground CLI via Nx targets, launches headless
 * Chromium to measure site-editor performance, and outputs results
 * as JSON + a console table.
 *
 * Adapted from Automattic/studio's
 * tools/benchmark-site-editor/.
 *
 * Usage:
 *   npx nx perf playground-cli
 *   npx nx perf playground-cli -- --rounds=3 --mode=built
 *   npx nx perf playground-cli -- --with-plugins
 *
 * Options:
 *   --rounds=N        Benchmark rounds (default: 3)
 *   --mode=<mode>     "unbuilt-jspi" (default) or "built"
 *   --with-plugins    Also run with the plugins blueprint
 *   --headed          Chromium in headed mode for debugging
 *   --port=<port>     Server port (default: 9876)
 *   --wp=<version>    WordPress version (default: latest)
 *   --php=<version>   PHP version (default: 8.2)
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseArgs } from 'util';
import { measureSiteEditor, METRIC_NAMES } from './measure-site-editor.ts';
import type { MeasurementResult } from './measure-site-editor.ts';

interface Options {
	rounds: number;
	mode: 'unbuilt-jspi' | 'built';
	withPlugins: boolean;
	headed: boolean;
	port: number;
	wp: string;
	php: string;
}

interface ServerHandle {
	process: ChildProcess;
	url: string;
	startupMs: number;
}

interface BenchmarkResult {
	environment: string;
	metrics: Record<string, number>;
}

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../..');

async function main() {
	const opts = getOptions();

	console.log('\n=== Playground CLI Site Editor Benchmark ===');
	console.log(`Platform: ${os.platform()} ${os.arch()}`);
	console.log(`Node: ${process.version}`);
	console.log(`CPUs: ${os.cpus().length}`);
	console.log(`Rounds: ${opts.rounds}`);
	console.log(`Mode: ${opts.mode}`);
	console.log(`WordPress: ${opts.wp}, PHP: ${opts.php}`);
	console.log(`Date: ${new Date().toISOString()}`);
	console.log('');

	const environments: Array<{
		name: string;
		blueprintPath?: string;
	}> = [{ name: 'bare' }];

	if (opts.withPlugins) {
		environments.push({
			name: 'with-plugins',
			blueprintPath: path.resolve(
				import.meta.dirname,
				'plugins-blueprint.json'
			),
		});
	}

	const allResults: BenchmarkResult[] = [];
	let activeHandle: ServerHandle | undefined;

	// Clean up spawned server on unexpected exit
	const cleanup = () => {
		if (activeHandle?.process.pid) {
			try {
				process.kill(-activeHandle.process.pid, 'SIGKILL');
			} catch {
				// Already gone
			}
		}
	};
	process.on('SIGINT', () => {
		cleanup();
		process.exit(130);
	});
	process.on('SIGTERM', () => {
		cleanup();
		process.exit(143);
	});
	process.on('exit', cleanup);

	for (const env of environments) {
		console.log(`\n--- ${env.name} ---`);

		try {
			activeHandle = await startServer(opts, env.blueprintPath);
			console.log(`  Startup: ${formatDuration(activeHandle.startupMs)}`);
			const metrics = await runBenchmark(
				activeHandle.url,
				opts.rounds,
				opts.headed
			);

			if (metrics) {
				allResults.push({
					environment: env.name,
					metrics: {
						serverStartup: activeHandle.startupMs,
						...metrics,
					},
				});
				console.log('  Done.');
			} else {
				console.log('  Failed — no successful rounds.');
			}
		} catch (err) {
			console.error(`  Error: ${err}`);
		} finally {
			if (activeHandle) {
				console.log('  Stopping server...');
				await stopServer(activeHandle);
				activeHandle = undefined;
			}
		}
	}

	printResultsTable(allResults);
	const savedPath = saveResults(allResults);
	console.log(`\nResults saved to: ${savedPath}`);

	process.exit(0);
}

function getOptions(): Options {
	const { values } = parseArgs({
		options: {
			rounds: { type: 'string', default: '3' },
			mode: { type: 'string', default: 'unbuilt-jspi' },
			'with-plugins': { type: 'boolean', default: false },
			headed: { type: 'boolean', default: false },
			port: { type: 'string', default: '9876' },
			wp: { type: 'string', default: 'latest' },
			php: { type: 'string', default: '8.2' },
		},
		strict: false,
		allowPositionals: true,
	});

	const mode = values.mode as string;
	if (mode !== 'unbuilt-jspi' && mode !== 'built') {
		console.error(
			`Invalid --mode: ${mode}. Must be "unbuilt-jspi" or "built".`
		);
		process.exit(1);
	}

	return {
		rounds: parseInt(values.rounds as string, 10),
		mode,
		withPlugins: values['with-plugins'] as boolean,
		headed: values.headed as boolean,
		port: parseInt(values.port as string, 10),
		wp: values.wp as string,
		php: values.php as string,
	};
}

async function startServer(
	opts: Options,
	blueprintPath?: string
): Promise<ServerHandle> {
	const { command, args } = buildNxCommand(opts, blueprintPath);

	console.log(`  Starting CLI: ${command} ${args.join(' ')}`);

	const startTime = Date.now();
	const proc = spawn(command, args, {
		cwd: WORKSPACE_ROOT,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, FORCE_COLOR: '0' },
		detached: process.platform !== 'win32',
		shell: process.platform === 'win32',
	});

	let stderr = '';
	proc.stderr?.on('data', (data) => {
		stderr += data.toString();
	});
	proc.stdout?.on('data', (data) => {
		const line = data.toString().trim();
		if (line) {
			console.log(`  [cli] ${line}`);
		}
	});

	const url = `http://127.0.0.1:${opts.port}`;
	const ready = await waitForServer(url);
	if (!ready) {
		proc.kill('SIGKILL');
		if (stderr) {
			console.error(stderr.slice(0, 1000));
		}
		throw new Error(
			`Playground CLI server failed to start on port ${opts.port}`
		);
	}

	const startupMs = Date.now() - startTime;
	console.log(`  Server ready at ${url}`);
	return { process: proc, url, startupMs };
}

async function stopServer(handle: ServerHandle): Promise<void> {
	if (!handle.process.pid) {
		return;
	}
	try {
		if (process.platform === 'win32') {
			spawn('taskkill', ['/F', '/T', '/PID', String(handle.process.pid)]);
		} else {
			process.kill(-handle.process.pid, 'SIGTERM');
		}
	} catch {
		// Process may have already exited
	}
	// Wait for graceful shutdown
	await sleep(3000);
	// Force-kill any remaining processes
	try {
		process.kill(-handle.process.pid, 'SIGKILL');
	} catch {
		// Already gone
	}
}

function buildNxCommand(
	opts: Options,
	blueprintPath?: string
): { command: string; args: string[] } {
	const nxTarget = opts.mode === 'built' ? 'start' : opts.mode;
	const cliArgs = [
		'server',
		`--port=${opts.port}`,
		`--wp=${opts.wp}`,
		`--php=${opts.php}`,
		'--login',
		'--skip-browser',
	];

	if (blueprintPath) {
		cliArgs.push(`--blueprint=${blueprintPath}`);
	}

	return {
		command: 'npx',
		args: ['nx', nxTarget, 'playground-cli', '--', ...cliArgs],
	};
}

async function runBenchmark(
	url: string,
	rounds: number,
	headed: boolean
): Promise<Record<string, number> | null> {
	console.log(`  Running ${rounds} round${rounds > 1 ? 's' : ''}...`);

	const allMeasurements: MeasurementResult[] = [];

	for (let round = 1; round <= rounds; round++) {
		if (rounds > 1) {
			console.log(`    Round ${round}/${rounds}...`);
		}
		try {
			const result = await Promise.race([
				measureSiteEditor({ url, headed }),
				sleep(600_000).then(() => {
					throw new Error('Measurement timed out');
				}),
			]);
			allMeasurements.push(result);

			const parts = METRIC_NAMES.filter((m) => result[m] !== undefined)
				.map((m) => `${m}=${formatDuration(result[m]!)}`)
				.join(', ');
			console.log(`    ${parts}`);
		} catch (err) {
			console.warn(`    Round ${round} failed: ${err}`);
		}

		if (round < rounds) {
			await sleep(1000);
		}
	}

	if (allMeasurements.length === 0) {
		return null;
	}

	const medians: Record<string, number> = {};
	for (const metric of METRIC_NAMES) {
		const values = allMeasurements
			.map((m) => m[metric])
			.filter((v): v is number => v !== undefined);
		if (values.length > 0) {
			medians[metric] = median(values);
		}
	}

	return medians;
}

function printResultsTable(results: BenchmarkResult[]): void {
	if (results.length === 0) {
		console.log('\nNo results to display.');
		return;
	}

	const allMetrics = new Set<string>();
	for (const r of results) {
		Object.keys(r.metrics).forEach((k) => allMetrics.add(k));
	}
	const metrics = [...allMetrics].sort();

	const metricColWidth = Math.max(20, ...metrics.map((m) => m.length + 2));
	const envColWidth = Math.max(
		12,
		...results.map((r) => r.environment.length + 2)
	);
	const lineWidth = metricColWidth + envColWidth * results.length;

	console.log('\n\nResults');
	console.log('='.repeat(lineWidth));

	const header =
		'Metric'.padEnd(metricColWidth) +
		results.map((r) => r.environment.padEnd(envColWidth)).join('');
	console.log(header);
	console.log('-'.repeat(lineWidth));

	for (const metric of metrics) {
		let row = metric.padEnd(metricColWidth);
		for (const r of results) {
			const value = r.metrics[metric];
			row +=
				value !== undefined
					? formatDuration(value).padEnd(envColWidth)
					: '\u2014'.padEnd(envColWidth);
		}
		console.log(row);
	}

	console.log('='.repeat(lineWidth));
}

function saveResults(results: BenchmarkResult[]): string {
	const artifactsDir = path.resolve(import.meta.dirname, 'artifacts');
	fs.mkdirSync(artifactsDir, { recursive: true });

	const summaryPath = path.join(artifactsDir, `benchmark-${Date.now()}.json`);
	const summary = {
		date: new Date().toISOString(),
		platform: os.platform(),
		arch: os.arch(),
		nodeVersion: process.version,
		cpus: os.cpus().length,
		results,
	};
	fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
	return summaryPath;
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms.toFixed(0)}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(
	url: string,
	timeoutMs = 180_000
): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url);
			if (
				response.ok ||
				response.status === 302 ||
				response.status === 301
			) {
				return true;
			}
		} catch {
			// Server not ready yet
		}
		await sleep(1000);
	}
	return false;
}

main().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
