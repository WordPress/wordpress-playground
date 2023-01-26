const gulp = require('gulp');
const path = require('path');
const util = require('util');
const fs = require('fs');
const rmAsync = util.promisify(fs.rm);
const { spawn } = require('child_process');

const sourceDir = __dirname;
const outputDir = path.join(__dirname, '..', '..', '..', 'build-php');

async function cleanBuildDir() {
	await rmAsync(outputDir, { recursive: true, force: true });
	fs.mkdirSync(outputDir);
}

async function build() {
	const platformDefaults = {
		all: {
			PHP_VERSION: '8.0.24',
			WITH_LIBZIP: 'yes',
			WITH_SQLITE: 'yes',
		},
		web: {},
		node: {
			WITH_LIBXML: 'yes',
			WITH_LIBPNG: 'yes',
			WITH_MBSTRING: 'yes',
			WITH_CLI_SAPI: 'yes',
			WITH_OPENSSL: 'yes',
			WITH_NODEFS: 'yes',
			WITH_MYSQL: 'yes',
			WITH_WS_NETWORKING_PROXY: 'yes',
		},
	};
	const platform = process.env.PLATFORM === 'node' ? 'node' : 'web';
	/* eslint-disable prettier/prettier */
	const getArg = (name) => {
		const value = (
			name in platformDefaults[platform] ? platformDefaults[platform][name] :
			name in process.env ? process.env[name] :
			name in platformDefaults.all ? platformDefaults.all[name] :
			'no'
		)
		return `${name}=${value}`;
	}

	// Build PHP
	await asyncSpawn(
		'docker',
		[
			'build',
			'.',
			'--tag=php-wasm',
			'--progress=plain',
			'--build-arg', getArg('PHP_VERSION'),
			'--build-arg', getArg('WITH_VRZNO'),
			'--build-arg', getArg('WITH_LIBXML'),
			'--build-arg', getArg('WITH_LIBZIP'),
			'--build-arg', getArg('WITH_LIBPNG'),
			'--build-arg', getArg('WITH_MBSTRING'),
			'--build-arg', getArg('WITH_CLI_SAPI'),
			'--build-arg', getArg('WITH_OPENSSL'),
			'--build-arg', getArg('WITH_NODEFS'),
			'--build-arg', getArg('WITH_CURL'),
			'--build-arg', getArg('WITH_SQLITE'),
			'--build-arg', getArg('WITH_MYSQL'),
			'--build-arg', getArg('WITH_WS_NETWORKING_PROXY'),
			'--build-arg', `EMSCRIPTEN_ENVIRONMENT=${platform}`,
		],
		{ cwd: sourceDir, stdio: 'inherit' }
	);
	/* eslint-enable prettier/prettier */

	// Extract the PHP WASM module
	await asyncSpawn(
		'docker',
		[
			'run',
			'--name',
			'php-wasm-tmp',
			'--rm',
			'-v',
			`${outputDir}:/output`,
			'php-wasm',
			// Use sh -c because wildcards are a shell feature and
			// they don't work without running cp through shell.
			'sh',
			'-c',
			`cp /root/output/php* /output && mkdir -p /output/terminfo/x ${
				getArg('WITH_CLI_SAPI') === 'yes'
					? '&& cp /root/lib/share/terminfo/x/xterm /output/terminfo/x'
					: ''
			}`,
		],
		{ cwd: sourceDir, stdio: 'inherit' }
	);
}

exports.build = gulp.series(cleanBuildDir, build);

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
