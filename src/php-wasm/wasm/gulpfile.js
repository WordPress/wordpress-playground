const os = require('os');
const gulp = require('gulp');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
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
	const platform = process.env.PLATFORM === 'node' ? 'node' : 'web';
	const platformDefaults = {
		web: {
			withNodeFs: false,
			withLibxml: false,
			withCLI: false,
		},
		node: {
			withNodeFs: true,
			withLibxml: true,
			withCLI: true,
		},
	}[platform];
	const buildSettings = {
		phpVersion: process.env.PHP_VERSION || '8.0.24',
		// VRZNO does not work for most supported PHP versions – let's force disable it for now
		withVRZNO: false, // phpVersion.startsWith('7.') ? 'yes' : 'no';
		...platformDefaults,
		withLibxml:
			process.env.WITH_LIBXML === 'yes' || platformDefaults.withLibxml,
	};

	// Build PHP
	await asyncSpawn(
		'docker',
		[
			'build',
			'.',
			'--tag=php-wasm',
			'--progress=plain',
			'--build-arg',
			`PHP_VERSION=${buildSettings.phpVersion}`,
			'--build-arg',
			`WITH_VRZNO=${buildSettings.withVRZNO ? 'yes' : 'no'}`,
			'--build-arg',
			`WITH_LIBXML=${buildSettings.withLibxml ? 'yes' : 'no'}`,
			'--build-arg',
			`WITH_LIBZIP=yes`,
			'--build-arg',
			`WITH_LIBPNG=yes`,
			'--build-arg',
			`WITH_MBSTRING=yes`,
			'--build-arg',
			`WITH_SQLITE=yes`,
			'--build-arg',
			`WITH_CLI_SAPI=${buildSettings.withCLI ? 'yes' : 'no'}`,
			'--build-arg',
			`WITH_NODEFS=${buildSettings.withNodeFs ? 'yes' : 'no'}`,
			'--build-arg',
			`EMSCRIPTEN_ENVIRONMENT=${platform}`,
		],
		{ cwd: sourceDir, stdio: 'inherit' }
	);

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
			`cp /root/output/php* /output && mkdir -p /output/terminfo/x && cp /root/lib/share/terminfo/x/xterm /output/terminfo/x`,
		],
		{ cwd: sourceDir, stdio: 'inherit' }
	);
}

exports.build = gulp.series(cleanBuildDir, build);

function asyncPipe(pipe) {
	return new Promise(async (resolve, reject) => {
		pipe.on('finish', resolve).on('error', reject);
	});
}

function asyncSpawn(...args) {
	return new Promise((resolve, reject) => {
		const child = spawn(...args);

		child.on('close', (code) => {
			if (code === 0) resolve(code);
			else reject(new Error(`Process exited with code ${code}`));
		});
	});
}
