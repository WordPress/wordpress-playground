const gulp = require('gulp');
const path = require('path');
const glob = require('glob');
const fs = require('fs');
const { spawnSync } = require('child_process');

const {
	build: buildWordPress,
} = require('./src/wordpress-playground/wordpress/gulpfile');
const { build: buildPHP } = require('./src/php-wasm/wasm/gulpfile');

const outputDir = path.join(__dirname, 'build');

console.log('Building the PHP WASM module...');

async function collectBuiltWordPress() {
	glob.sync(`${outputDir}/wp-${ process.env.OUT_FILENAME }*`).map((filePath) =>
		fs.rmSync(filePath, { force: true, recursive: true })
	);
	fs.rmSync(`${outputDir}/wp.js`, { force: true });
	fs.rmSync(`${outputDir}/wp.data`, { force: true });

	const wpOutputDir = path.join(__dirname, 'build-wp');
	await asyncPipe(
		gulp
			.src([`${wpOutputDir}/**/*`], { base: wpOutputDir })
			.pipe(gulp.dest(outputDir))
	);
}

async function collectBuiltPHP() {
	const phpOutputDir = path.join(__dirname, 'build-php');
	await asyncPipe(gulp.src([`${phpOutputDir}/*`]).pipe(gulp.dest(outputDir)));
}

async function buildHtaccess() {
	const htAccess = glob
		.sync(`src/*/.htaccess`)
		.map((filePath) => fs.readFileSync(filePath).toString())
		.join('\n');
	const outPath = `${outputDir}/.htaccess`;
	fs.writeFileSync(outPath, htAccess);
	console.log('  ' + outPath);
}

async function buildModules() {
	const { main: esbuildModules } = require('./esbuild');
	await esbuildModules();
}

function buildDocs(cb) {
	const dtsPath = (suffix) => path.join(__dirname, 'build-types', suffix);
	spawnSync(
		'node',
		[
			'build-scripts/tsdoc-to-api-markdown.js',
			'-e',
			dtsPath('php-wasm/index.d.ts'),
			dtsPath('php-wasm-browser/index.d.ts'),
			dtsPath('php-wasm-browser/service-worker/worker-library.d.ts'),
			dtsPath('php-wasm-browser/worker-thread/worker-library.d.ts'),
			dtsPath('wordpress-playground/index.d.ts'),
			dtsPath('wordpress-playground/service-worker.d.ts'),
			dtsPath('wordpress-playground/worker-thread.d.ts'),
			dtsPath('wordpress-plugin-ide/index.d.ts'),
			'-o',
			path.join(__dirname, 'docs', 'api'),
		],
		{
			cwd: __dirname,
			stdio: 'inherit',
		}
	);
	cb();
}

exports.copyBuiltWordPress = collectBuiltWordPress;
exports.collectBuiltPHP = collectBuiltPHP;
exports.copyBuiltAssets = gulp.parallel(collectBuiltWordPress, collectBuiltPHP);
exports.buildHtaccess = buildHtaccess;
exports.buildWordPress = gulp.series(buildWordPress, collectBuiltWordPress);
exports.buildPHP = gulp.series(buildPHP, collectBuiltPHP);
exports.buildJS = buildModules;
exports.buildApiReference = buildDocs;

exports.buildAll = gulp.parallel(
	exports.buildHtaccess,
	exports.buildWordPress,
	exports.buildPHP,
	exports.buildJS
);

function asyncPipe(pipe) {
	return new Promise(async (resolve, reject) => {
		pipe.on('finish', resolve).on('error', reject);
	});
}
