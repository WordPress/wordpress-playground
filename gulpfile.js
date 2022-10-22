const os = require('os');
const gulp = require('gulp');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
const path = require('path');
const util = require('util');
const glob = require('glob');
const fs = require('fs');
const rmAsync = util.promisify(fs.rm);
const { spawn } = require('child_process');

const { copyWPStaticAssets, copyWPDataBundle, build: buildWordPressInPackage } = require('./packages/wordpress-wasm/wordpress/gulpfile')
const { build: buildPHPInPackage } = require('./packages/php-wasm/wasm/gulpfile')

const packagesDir = path.join(__dirname, 'packages');
const outputDir = path.join(__dirname, 'build');

console.log('Building the PHP WASM module...');
console.log('Target path: $OUTDIR');

async function collectBuiltWordPress() {
    await copyWPStaticAssets(null, { source: `${packagesDir}/wordpress-wasm/build-wp/`, dest: outputDir });
    await copyWPDataBundle(null, { source: `${packagesDir}/wordpress-wasm/build-wp/`, dest: outputDir });
}

async function collectBuiltPHP() {
    glob.sync(`${outputDir}/php-*.js`).map(path => fs.rmSync(path, { force: true }));
    fs.rmSync(`${outputDir}/php.wasm`, { force: true });

    await asyncPipe(
        gulp.src([
            `${packagesDir}/php-wasm/build-wasm/*`,
        ]).pipe(gulp.dest(outputDir))
    );
}

async function buildHtaccess() {
    const htAccess = glob.sync(`${packagesDir}/*/build/.htaccess`)
        .map((filePath) => fs.readFileSync(filePath).toString())
        .join("\n");
    const outPath = `${outputDir}/.htaccess`;
    fs.writeFileSync(outPath, htAccess);
    console.log('  ' + outPath);
}

async function buildModules() {
    const { main: esbuildModules } = require('./esbuild-packages');
    await esbuildModules();
}

exports.copyBuiltWordPress = collectBuiltWordPress;
exports.collectBuiltPHP = collectBuiltPHP;
exports.copyBuiltAssets = gulp.parallel(collectBuiltWordPress, collectBuiltPHP);
exports.buildHtaccess = buildHtaccess;
exports.buildWordPress = gulp.series(buildWordPressInPackage, collectBuiltWordPress);
exports.buildPHP = gulp.series(buildPHPInPackage, collectBuiltPHP);
exports.buildJS = buildModules;

exports.buildAll = gulp.parallel(
    exports.buildHtaccess,
    exports.buildWordPress,
    exports.buildPHP,
    exports.buildJS
);


function asyncPipe(pipe) {
    return new Promise(async (resolve, reject) => {
        pipe.on('finish', resolve)
            .on('error', reject);
    });
}
