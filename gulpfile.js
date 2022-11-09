const gulp = require('gulp');
const path = require('path');
const glob = require('glob');
const fs = require('fs');

const {
	build: buildWordPress,
} = require('./src/wordpress-wasm/wordpress/gulpfile');
const { build: buildPHP } = require('./src/php-wasm/wasm/gulpfile');

const outputDir = path.join(__dirname, 'build');

console.log('Building the PHP WASM module...');
console.log('Target path: $OUTDIR');

async function collectBuiltWordPress() {
	glob.sync(`${outputDir}/wp-*`).map((filePath) =>
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
	glob.sync(`${outputDir}/php.js`).map((filePath) =>
		fs.rmSync(filePath, { force: true })
	);
	fs.rmSync(`${outputDir}/php.wasm`, { force: true });

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

exports.copyBuiltWordPress = collectBuiltWordPress;
exports.collectBuiltPHP = collectBuiltPHP;
exports.copyBuiltAssets = gulp.parallel(collectBuiltWordPress, collectBuiltPHP);
exports.buildHtaccess = buildHtaccess;
exports.buildWordPress = gulp.series(buildWordPress, collectBuiltWordPress);
exports.buildPHP = gulp.series(buildPHP, collectBuiltPHP);
exports.buildJS = buildModules;

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
