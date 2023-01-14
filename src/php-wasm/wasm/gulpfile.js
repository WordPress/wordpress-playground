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
	const phpVersion = process.env.PHP_VERSION || '8.0.24';
	// VRZNO does not work for most supported PHP versions – let's force disable it for now
	const withVRZNO = 'no'; //phpVersion.startsWith('7.') ? 'yes' : 'no';
	const platform = process.env.PLATFORM === 'node' ? 'node' : 'web';
	const withNodeFs = platform === 'node' ? 'yes' : 'no';
	const withLibxml = process.env.WITH_LIBXML === 'yes' ? 'yes' : 'no';

	// Build PHP
	await asyncSpawn(
		'docker',
		[
			'build',
			'.',
			'--tag=php-wasm',
			'--progress=plain',
			'--build-arg',
			`PHP_VERSION=${phpVersion}`,
			'--build-arg',
			`WITH_VRZNO=${withVRZNO}`,
			'--build-arg',
			`WITH_LIBXML=${withLibxml}`,
			'--build-arg',
			`WITH_LIBZIP=no`,
			'--build-arg',
			`WITH_NODEFS=${withNodeFs}`,
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
			`cp /root/output/php* /output`,
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
