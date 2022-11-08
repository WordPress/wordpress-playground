const gulp = require('gulp');
const path = require('path');
const glob = require('glob');
const fs = require('fs');

const {
	build: buildWordPressInPackage,
} = require('./packages/wordpress-wasm/wordpress/gulpfile');
const {
	build: buildPHPInPackage,
} = require('./packages/php-wasm/wasm/gulpfile');

const packagesDir = path.join(__dirname, 'packages');
const outputDir = path.join(__dirname, 'build');

console.log('Building the PHP WASM module...');
console.log('Target path: $OUTDIR');

async function collectBuiltWordPress() {
	glob.sync(`${outputDir}/wp-*`).map((path) =>
		fs.rmSync(path, { force: true, recursive: true })
	);
	fs.rmSync(`${outputDir}/wp.js`, { force: true });
	fs.rmSync(`${outputDir}/wp.data`, { force: true });

	const wpDir = `${packagesDir}/wordpress-wasm/build-wp`;
	await asyncPipe(
		gulp.src([`${wpDir}/**/*`], { base: wpDir }).pipe(gulp.dest(outputDir))
	);
}

async function collectBuiltPHP() {
	glob.sync(`${outputDir}/php.js`).map((path) =>
		fs.rmSync(path, { force: true })
	);
	fs.rmSync(`${outputDir}/php.wasm`, { force: true });

	await asyncPipe(
		gulp
			.src([`${packagesDir}/php-wasm/build-wasm/*`])
			.pipe(gulp.dest(outputDir))
	);
}

async function buildHtaccess() {
	const htAccess = glob
		.sync(`${packagesDir}/*/build/.htaccess`)
		.map((filePath) => fs.readFileSync(filePath).toString())
		.join('\n');
	const outPath = `${outputDir}/.htaccess`;
	fs.writeFileSync(outPath, htAccess);
	console.log('  ' + outPath);
}

async function buildModules() {
	const { main: esbuildModules } = require('./esbuild-packages');
	await esbuildModules();
}

async function watchDocGenerator() {
	buildDocGenerator({
		watch: true,
	});
}

async function buildDocGenerator(overrides = {}) {
	const { configFor } = require('./esbuild-packages');
	const esConfig = configFor('typescript-reference-doc-generator');
	const { build } = require('esbuild');
	build({
		...esConfig,
		platform: 'node',
		...overrides,
	});
}

exports.copyBuiltWordPress = collectBuiltWordPress;
exports.collectBuiltPHP = collectBuiltPHP;
exports.copyBuiltAssets = gulp.parallel(collectBuiltWordPress, collectBuiltPHP);
exports.buildHtaccess = buildHtaccess;
exports.buildWordPress = gulp.series(
	buildWordPressInPackage,
	collectBuiltWordPress
);
exports.buildPHP = gulp.series(buildPHPInPackage, collectBuiltPHP);
exports.buildJS = buildModules;
exports.watchDocGenerator = watchDocGenerator;
exports.buildDocGenerator = buildDocGenerator;

exports.buildAll = gulp.parallel(
	exports.buildHtaccess,
	exports.buildWordPress,
	exports.buildPHP,
	exports.buildJS,
	exports.buildDocGenerator
);

function asyncPipe(pipe) {
	return new Promise(async (resolve, reject) => {
		pipe.on('finish', resolve).on('error', reject);
	});
}
