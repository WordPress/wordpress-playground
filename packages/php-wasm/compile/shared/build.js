import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { phpVersions } from '../../supported-php-versions.mjs';

// yargs parse
import yargs from 'yargs';
const argParser = yargs(process.argv.slice(2))
	.usage('Usage: $0 [options]')
	.options({
		LIBRARY_NAME: {
			type: 'string',
			description: 'The library to build',
			required: true,
		},
		PHP_VERSION: {
			type: 'string',
			description: 'The PHP version to build',
			required: true,
		},
		OUTPUT_DIR: {
			type: 'string',
			description: 'The output directory',
			required: true,
		},
		WITH_DEBUG: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with DWARF debug information.',
		},
		WITH_JSPI: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with JSPI support',
		},
	});

const args = argParser.argv;

const platformDefaults = {
	all: {
		PHP_VERSION: '8.0.24',
		WITH_DEBUG: 'no',
		WITH_JSPI: 'no',
	},
};

const getArg = (name) => {
	let value =
		name in args
			? args[name]
			: name in platformDefaults.all
			? platformDefaults.all[name]
			: 'no';
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
const outputDir = path.resolve(process.cwd(), args['OUTPUT_DIR']);

// Build the base image
await asyncSpawn('make', ['base-image'], {
	cwd: path.dirname(sourceDir),
	stdio: 'inherit',
});

const library = args['LIBRARY_NAME'];

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
		getArg('WITH_DEBUG'),
		'--build-arg',
		getArg('WITH_JSPI'),
	],
	{ cwd: path.dirname(sourceDir), stdio: 'inherit' }
);

const version = args['PHP_VERSION'].replace('.', '_');

// Store the shared library
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
		`rm -rf /output/extensions/${library}/${version} && \
			mkdir -p /output/extensions/${library}/${version} && \
			cp -rf /root/${library}/modules/* /output/extensions/${library}/${version}`,
	],
	{ cwd: path.dirname(sourceDir), stdio: 'inherit' }
);

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
	const publicDir = `${path.dirname(
		outputDir
	)}/src/lib/extensions/${library}/shared`;
	await asyncSpawn(
		'sh',
		['-c', `cp ${sourceDir}/${library}/data/* ${publicDir}`],
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
