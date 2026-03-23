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
 *   --wp=<version>    WordPress version (default: latest)
 *   --php=<version>   PHP version (default: Current Playground recommended PHP version)
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseArgs } from 'util';
import {
	measureSiteEditor,
	METRIC_NAMES,
	type MeasurementResult,
} from './measure-site-editor';
import { RecommendedPHPVersion } from '@wp-playground/common';

interface Options {
	rounds: number;
	mode: 'unbuilt-jspi' | 'built';
	withPlugins: boolean;
	headed: boolean;
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

			allResults.push({
				environment: env.name,
				metrics: {
					serverStartup: activeHandle.startupMs,
					...metrics,
				},
			});
			console.log('  Done.');
		} catch (err) {
			console.error(`  FAILED: ${err}`);
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

	if (allResults.length < environments.length) {
		console.error(
			`\n${environments.length - allResults.length} environment(s) failed.`
		);
		process.exit(1);
	}
	process.exit(0);
}

function getOptions(): Options {
	const { values } = parseArgs({
		options: {
			help: { type: 'boolean', default: false },
			rounds: { type: 'string', default: '3' },
			mode: { type: 'string', default: 'unbuilt-jspi' },
			'with-plugins': { type: 'boolean', default: false },
			headed: { type: 'boolean', default: false },
			wp: { type: 'string', default: 'latest' },
			php: { type: 'string', default: RecommendedPHPVersion },
		},
		strict: false,
		allowPositionals: true,
	});

	if (values.help) {
		console.log(`Usage: npx nx perf playground-cli [-- <options>]

Measure WordPress site editor performance in a Playground CLI environment.

Options:
  --rounds=N         Successful rounds required (default: 3, retries up to 2x)
  --mode=<mode>      "unbuilt-jspi" or "built" (default: unbuilt-jspi)
  --with-plugins     Also benchmark with a plugins blueprint
  --headed           Run Chromium in headed mode (for debugging)
  --wp=<version>     WordPress version (default: latest)
  --php=<version>    PHP version (default: Current Playground recommended PHP version: ${RecommendedPHPVersion})
  --help             Show this help message`);
		process.exit(0);
	}

	const mode = values.mode as string;
	if (mode !== 'unbuilt-jspi' && mode !== 'built') {
		console.error(
			`Invalid --mode: ${mode}. Must be "unbuilt-jspi" or "built".`
		);
		process.exit(1);
	}
	const rounds = parseInt(values.rounds as string, 10);
	if (!Number.isInteger(rounds) || rounds < 1) {
		console.error(
			`Invalid --rounds: ${values.rounds}. Must be an integer >= 1.`
		);
		process.exit(1);
	}

	return {
		rounds,
		mode,
		withPlugins: values['with-plugins'] as boolean,
		headed: values.headed as boolean,
		wp: values.wp as string,
		php: values.php as string,
	};
}

async function startServer(
	opts: Options,
	blueprintPath?: string
): Promise<ServerHandle> {
	const { command, args } = buildCommand(opts, blueprintPath);

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

	const url = await new Promise<string>((resolve, reject) => {
		const readyPattern = /running on (https?:\/\/\S+)/i;
		const timeoutId = setTimeout(() => {
			reject(
				new Error(
					'Playground CLI server did not print a ready URL' +
						(stderr ? `\nstderr: ${stderr.slice(0, 1000)}` : '')
				)
			);
		}, 180_000);

		proc.stdout?.on('data', (data) => {
			const text = data.toString();
			for (const line of text.split('\n')) {
				const trimmed = line.trim();
				if (trimmed) {
					console.log(`  [cli] ${trimmed}`);
				}
			}
			const match = text.match(readyPattern);
			if (match) {
				clearTimeout(timeoutId);
				resolve(match[1]);
			}
		});

		proc.on('exit', (code) => {
			clearTimeout(timeoutId);
			reject(
				new Error(
					`CLI exited with code ${code}` +
						(stderr ? `\nstderr: ${stderr.slice(0, 1000)}` : '')
				)
			);
		});
	});

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
	await sleep(2000);
	try {
		process.kill(-handle.process.pid, 'SIGKILL');
	} catch {
		// Already gone
	}
}

function buildCommand(
	opts: Options,
	blueprintPath?: string
): { command: string; args: string[] } {
	const cliArgs = [
		'server',
		`--wp=${opts.wp}`,
		`--php=${opts.php}`,
		'--login',
	];

	if (blueprintPath) {
		cliArgs.push(`--blueprint=${blueprintPath}`);
	}

	const nodeFlags = [
		'--experimental-strip-types',
		'--experimental-transform-types',
		'--disable-warning=ExperimentalWarning',
		'--import',
		'./packages/meta/src/node-es-module-loader/register.mts',
	];

	if (opts.mode === 'built') {
		return {
			command: process.execPath,
			args: [
				...nodeFlags,
				'dist/packages/playground/cli/wp-playground.js',
				...cliArgs,
			],
		};
	}

	return {
		command: process.execPath,
		args: [
			'--experimental-wasm-jspi',
			...nodeFlags,
			'./packages/playground/cli/src/cli.ts',
			...cliArgs,
		],
	};
}

async function runBenchmark(
	url: string,
	rounds: number,
	headed: boolean
): Promise<Record<string, number>> {
	const maxAttempts = rounds * 2;
	console.log(
		`  Collecting ${rounds} successful round${rounds > 1 ? 's' : ''} (up to ${maxAttempts} attempts)...`
	);

	const allMeasurements: MeasurementResult[] = [];
	let attempts = 0;

	while (allMeasurements.length < rounds && attempts < maxAttempts) {
		attempts++;
		const label =
			`${allMeasurements.length + 1}/${rounds}` +
			(attempts > allMeasurements.length + 1
				? ` (attempt ${attempts}/${maxAttempts})`
				: '');
		console.log(`    Round ${label}...`);

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
			console.warn(`    Attempt ${attempts} failed: ${err}`);
		}

		if (allMeasurements.length < rounds) {
			await sleep(1000);
		}
	}

	if (allMeasurements.length < rounds) {
		throw new Error(
			`Only ${allMeasurements.length}/${rounds} rounds succeeded` +
				` after ${maxAttempts} attempts`
		);
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

main().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
