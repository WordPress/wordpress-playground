#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(projectRoot, '../../..');
const pythonArguments = [
	'-m',
	'unittest',
	'discover',
	'-s',
	resolve(scriptDirectory, 'tests'),
	'-p',
	'test_*.py',
];

let pythonResult;
for (const candidate of [
	{ command: 'python3', prefix: [] },
	{ command: 'python', prefix: [] },
	{ command: 'py', prefix: ['-3'] },
]) {
	pythonResult = spawnSync(
		candidate.command,
		[...candidate.prefix, ...pythonArguments],
		{
			cwd: repositoryRoot,
			stdio: 'inherit',
			windowsHide: true,
		}
	);
	if (!pythonResult.error || pythonResult.error.code !== 'ENOENT') break;
}
if (pythonResult?.error) throw pythonResult.error;
if (pythonResult?.status !== 0) process.exit(pythonResult?.status ?? 1);

const nodeResult = spawnSync(
	process.execPath,
	[
		'--test',
		resolve(scriptDirectory, 'tests/benchmark-site-editor.test.mjs'),
	],
	{
		cwd: repositoryRoot,
		stdio: 'inherit',
		windowsHide: true,
	}
);
if (nodeResult.error) throw nodeResult.error;
process.exit(nodeResult.status ?? 1);
