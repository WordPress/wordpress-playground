import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { phpVersions } from '../../supported-php-versions.mjs';

// yargs parse
import yargs from 'yargs';
const argParser = yargs(process.argv.slice(2))
	.usage('Usage: $0 [options]')
	.options({
		LIBRARY: {
			type: 'string',
			required: true,
			description: 'The library to build',
		},
		PLATFORM: {
			type: 'string',
			choices: ['web', 'node'],
			required: true,
			description: 'The platform to build',
		},
		PHP_VERSION: {
			type: 'string',
			required: true,
			description: 'The PHP version to build',
		},
		JSPI: {
			type: 'string',
			choices: ['yes', 'no'],
			default: 'no',
			description: 'Build with JSPI support',
		},
		DEBUG: {
			type: 'string',
			choices: ['yes', 'no'],
			default: 'no',
			description: 'Build with DWARF debug information.',
		},
	});

const args = argParser.argv;

const getArg = (name) => {
	let value = name in args ? args[name] : 'no';
	if (name === 'PHP_VERSION') {
		value = fullyQualifiedPHPVersion(value);
	}
	return `${name}=${value}`;
};

const requestedVersion = getArg('PHP_VERSION');
if (!requestedVersion || requestedVersion === 'undefined') {
	process.stdout.write(`PHP version ${requestedVersion} is not supported\n`);
	process.stdout.write(await argParser.getHelp());
	process.exit(1);
}

const sourceDir = path.dirname(new URL(import.meta.url).pathname);

const outputDir = computeOutputDir();

// Build the base image
await asyncSpawn('make', ['base-image'], {
	cwd: path.dirname(sourceDir),
	stdio: 'inherit',
});

const library = args['LIBRARY'];

// Build the shared library
await asyncSpawn(
	'docker',
	[
		'build',
		'-f',
		`shared/${library}/Dockerfile`,
		'.',
		`--tag=playground-php-wasm:${library}`,
		'--progress=plain',
		'--build-arg',
		getArg('PHP_VERSION'),
		'--build-arg',
		getArg('DEBUG'),
		'--build-arg',
		getArg('JSPI'),
	],
	{ cwd: path.dirname(sourceDir), stdio: 'inherit' }
);

// Store the shared library in output directories
await asyncSpawn(
	'docker',
	[
		'run',
		'--name',
		'playground-php-wasm-tmp',
		'--rm',
		'-v',
		`${outputDir}:/output`,
		`playground-php-wasm:${library}`,
		// Use sh -c because wildcards are a shell feature and
		// they don't work without running cp through shell.
		'sh',
		'-c',
		`rm -rf /output/extensions/${library} && \
			mkdir -p /output/extensions/${library} && \
			cp -rf /root/${library}/modules/* /output/extensions/${library}`,
	],
	{ cwd: path.dirname(sourceDir), stdio: 'inherit' }
);

const sharedDir = computeSharedDir();

// Store the shared data if any
await asyncSpawn(
	'docker',
	[
		'run',
		'--name',
		'playground-php-data-tmp',
		'--rm',
		'-v',
		`${sourceDir}/${library}:/output`,
		`playground-php-wasm:${library}`,
		// Use sh -c because wildcards are a shell feature and
		// they don't work without running cp through shell.
		'sh',
		'-c',
		`[ -d /root/${library}/data ] &&
			rm -rf /output/data && mkdir -p /output/data && \
			cp -rf /root/${library}/data/* /output/data || true`,
	],
	{ cwd: path.dirname(sourceDir), stdio: 'inherit' }
);

// Copy data files
if (fs.existsSync(`${sourceDir}/${library}/data`)) {
	await asyncSpawn(
		'sh',
		['-c', `cp ${sourceDir}/${library}/data/* ${sharedDir}`],
		{ cwd: sourceDir, stdio: 'inherit' }
	);
}

function asyncSpawn(...args) {
	console.log('Running', args[0], args[1].join(' '), '...');
	return new Promise((resolve, reject) => {
		const child = spawn(...args);
		child.on('close', (code) => {
			if (code === 0) resolve(code);
			else reject(new Error(`Process exited with code ${code}`));
		});
	});
}

function fullyQualifiedPHPVersion(requestedVersion) {
	for (const { version, lastRelease } of phpVersions) {
		if (requestedVersion === version) {
			return lastRelease;
		}
	}
	return requestedVersion;
}

function computeOutputDir() {
	const platformDir = `${args.PLATFORM}-builds`;
	const versionDir = args.PHP_VERSION.split('.').slice(0, 2).join('-');
	const jspiOrAsyncify = args.JSPI === 'yes' ? 'jspi' : 'asyncify';
	return path.resolve(
		process.cwd(),
		`packages/php-wasm/${platformDir}/${versionDir}/${jspiOrAsyncify}`
	);
}

function computeSharedDir() {
	return path.resolve(
		process.cwd(),
		`packages/php-wasm/${args.PLATFORM}/src/lib/extensions/${args.LIBRARY}/shared`
	);
}
