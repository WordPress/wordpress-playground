#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
	compileExtensionMatrix,
	SupportedExtensionPHPVersions,
} from './compile';
import { detectExtensionName } from './detect';

const OptionsWithDashPrefixedValues = new Set([
	'--config-args',
	'--extra-cflags',
	'--extra-ldflags',
]);

export async function main(args = hideBin(process.argv)) {
	const argv = await yargs(normalizeDashPrefixedOptionValues(args))
		.scriptName('@php-wasm/compile-extension')
		.usage('Usage: $0 --source <dir> [options]')
		.options({
			source: {
				type: 'string',
				demandOption: true,
				description: 'Extension source directory containing config.m4',
			},
			name: {
				type: 'string',
				description: 'Extension name. Defaults to parsing config.m4.',
			},
			'php-versions': {
				type: 'string',
				default: SupportedExtensionPHPVersions.join(','),
				description: 'Comma-separated PHP major.minor versions.',
			},
			out: {
				type: 'string',
				default: './dist',
				description: 'Output directory.',
			},
			'extra-cflags': {
				type: 'string',
				description: 'Extra CFLAGS appended to the side-module build.',
			},
			'extra-ldflags': {
				type: 'string',
				description: 'Extra LDFLAGS appended to the side-module build.',
			},
			'config-args': {
				type: 'string',
				default: '',
				description:
					'Extra ./configure arguments, parsed as shell words.',
			},
			optimize: {
				type: 'string',
				default: '2',
				description: 'Optimization level passed as -O<level>.',
			},
			jobs: {
				type: 'number',
				description: 'Maximum concurrent docker builds.',
			},
		})
		.strict()
		.help()
		.parse();

	const workspaceRoot = findWorkspaceRoot(process.cwd());
	const sourceDir = path.resolve(workspaceRoot, argv['source'] as string);
	const name =
		(argv['name'] as string | undefined) ??
		(await detectExtensionName(sourceDir));
	const phpVersions = parseCsv(
		argv['php-versions'] as string,
		'php-versions'
	);
	const configArgs = splitShellWords((argv['config-args'] as string) || '');

	const result = await compileExtensionMatrix({
		workspaceRoot,
		sourceDir,
		outDir: argv['out'] as string,
		name,
		phpVersions,
		extraCflags: argv['extra-cflags'] as string | undefined,
		extraLdflags: argv['extra-ldflags'] as string | undefined,
		configArgs,
		optimize: argv['optimize'] as string,
		jobs: argv['jobs'] as number | undefined,
	});

	console.log(`Wrote ${result.artifacts.length} artifacts.`);
	console.log(`Wrote ${result.manifestPath}.`);
}

if (isCliEntrypoint(import.meta.url)) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}

export function normalizeDashPrefixedOptionValues(args: string[]): string[] {
	const normalized: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (
			OptionsWithDashPrefixedValues.has(arg) &&
			i + 1 < args.length &&
			!args[i + 1].startsWith(`${arg}=`)
		) {
			normalized.push(`${arg}=${args[i + 1]}`);
			i++;
			continue;
		}
		normalized.push(arg);
	}
	return normalized;
}

function parseCsv(value: string, name: string): string[] {
	const values = value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (values.length === 0) {
		throw new Error(`--${name} must contain at least one value.`);
	}
	return values;
}

export function splitShellWords(value: string): string[] {
	const words: string[] = [];
	let current = '';
	let quote: '"' | "'" | null = null;
	let escaping = false;

	for (const character of value) {
		if (escaping) {
			current += character;
			escaping = false;
			continue;
		}
		if (character === '\\') {
			escaping = true;
			continue;
		}
		if (quote) {
			if (character === quote) {
				quote = null;
			} else {
				current += character;
			}
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (/\s/.test(character)) {
			if (current.length > 0) {
				words.push(current);
				current = '';
			}
			continue;
		}
		current += character;
	}

	if (escaping) {
		current += '\\';
	}
	if (quote) {
		throw new Error('Unterminated quote in --config-args.');
	}
	if (current.length > 0) {
		words.push(current);
	}
	return words;
}

function findWorkspaceRoot(startDirectory: string): string {
	let directory = path.resolve(startDirectory);
	while (directory !== path.dirname(directory)) {
		if (
			existsSync(path.join(directory, 'packages/php-wasm/compile')) &&
			existsSync(path.join(directory, 'nx.json'))
		) {
			return directory;
		}
		directory = path.dirname(directory);
	}
	return process.cwd();
}

function isCliEntrypoint(metaUrl: string): boolean {
	const entrypoint = process.argv[1];
	if (!entrypoint) {
		return false;
	}
	try {
		return (
			realpathSync(entrypoint) === realpathSync(fileURLToPath(metaUrl))
		);
	} catch {
		return path.resolve(entrypoint) === fileURLToPath(metaUrl);
	}
}
