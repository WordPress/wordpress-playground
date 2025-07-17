import path from 'path';
import { spawn } from 'child_process';
import { phpVersions } from '../../supported-php-versions.mjs';

// yargs parse
import yargs from 'yargs';
const argParser = yargs(process.argv.slice(2))
	.usage('Usage: $0 [options]')
	.options({
		PHP_VERSION: {
			type: 'string',
			description: 'The PHP version to build',
			required: true,
		},
		['output-dir']: {
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
			type: 'boolean',
			default: false,
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
const outputDir = path.resolve(process.cwd(), args.outputDir);

// Build the base image
await asyncSpawn('make', ['base-image'], {
	cwd: path.dirname(sourceDir),
	stdio: 'inherit',
});

// Build the xdebug.so extension
await asyncSpawn(
	'docker',
	[
		'build',
		'-f',
		'xdebug/Dockerfile',
		'.',
		'--tag=playground-php-wasm:xdebug',
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

await asyncSpawn(
	'docker',
	[
		'run',
		'--name',
		'playground-php-wasm-tmp',
		'--rm',
		'-v',
		`${outputDir}:/output`,
		'playground-php-wasm:xdebug',
		// Use sh -c because wildcards are a shell feature and
		// they don't work without running cp through shell.
		'sh',
		'-c',
		`mkdir -p /output/extensions/xdebug/${version} && cp -rf /root/xdebug/modules/* /output/extensions/xdebug/${version}`,
	],
	{ cwd: path.dirname(sourceDir), stdio: 'inherit' }
);

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
