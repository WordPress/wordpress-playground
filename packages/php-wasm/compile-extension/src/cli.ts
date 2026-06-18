#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
	compileExtensionMatrix,
	prepareExtensionBuildImages,
	SupportedExtensionPHPVersions,
} from './compile';
import { detectExtensionName } from './detect';
import { parseExtraFilesSpec, stageExtraFilesIntoOutDir } from './extra-files';

const OptionsWithDashPrefixedValues = new Set([
	'--config-args',
	'--extra-cflags',
	'--extra-ldflags',
]);

export async function main(args = hideBin(process.argv)) {
	const argv = await parseCliArgs(args);
	const workspaceRoot = findWorkspaceRoot(process.cwd());
	const phpVersions = parseCsv(
		argv['php-versions'] as string,
		'php-versions'
	);

	if (argv['prepare-image']) {
		const result = await prepareExtensionBuildImages({
			workspaceRoot,
			phpVersions,
			jobs: argv['jobs'] as number | undefined,
		});
		console.log(
			`Prepared ${result.images.length} PHP.wasm extension build images.`
		);
		for (const image of result.images) {
			console.log(image.imageTag);
		}
		return;
	}

	const source = argv['source'] as string;
	const sourceDir = path.resolve(workspaceRoot, source);
	const name =
		(argv['name'] as string | undefined) ??
		(await detectExtensionName(sourceDir));
	const configArgs = splitShellWords((argv['config-args'] as string) || '');
	const extraFilesSpecs = (argv['extra-files'] as string[]).map(
		parseExtraFilesSpec
	);
	const outDir = path.resolve(workspaceRoot, argv['out'] as string);
	const extraFiles = await stageExtraFilesIntoOutDir(
		extraFilesSpecs,
		outDir,
		workspaceRoot
	);

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
		extraFiles,
	});

	console.log(`Wrote ${result.artifacts.length} artifacts.`);
	console.log(`Wrote ${result.manifestPath}.`);
}

export async function parseCliArgs(args: string[]) {
	return await yargs(normalizeDashPrefixedOptionValues(args))
		.scriptName('@php-wasm/compile-extension')
		.usage('Usage: $0 [--source <dir> | --prepare-image] [options]')
		.options({
			source: {
				type: 'string',
				description: 'Extension source directory containing config.m4',
			},
			'prepare-image': {
				type: 'boolean',
				description:
					'Build the Docker images for the requested PHP versions and exit without compiling an extension source directory.',
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
			'extra-files': {
				type: 'string',
				array: true,
				default: [] as string[],
				description:
					'Stage a host directory under an absolute VFS root. Format: <hostDir>:<vfsRoot>. Files are copied next to the manifest and recorded in extraFiles.',
			},
		})
		.conflicts('source', 'prepare-image')
		.check(validateCliMode)
		.exitProcess(false)
		.strict()
		.help()
		.parse();
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

export function validateCliMode(argv: {
	source?: unknown;
	'prepare-image'?: unknown;
	prepareImage?: unknown;
	help?: unknown;
}): true {
	if (argv.help) {
		return true;
	}
	const hasSource = typeof argv.source === 'string' && argv.source.length > 0;
	const prepareImage = Boolean(argv['prepare-image'] ?? argv.prepareImage);

	if (hasSource && prepareImage) {
		throw new Error('--source and --prepare-image cannot be used together.');
	}
	if (!hasSource && !prepareImage) {
		throw new Error('--source is required unless --prepare-image is set.');
	}

	return true;
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
			existsSync(
				path.join(
					directory,
					'packages/php-wasm/compile-extension/package.json'
				)
			) &&
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
