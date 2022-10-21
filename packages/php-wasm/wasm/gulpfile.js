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
const outputDir = path.join(__dirname, '..', 'build-wasm');

async function cleanBuildDir() {
    await rmAsync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir);
}

async function build() {
    const phpVersion = process.env.PHP_VERSION || '8.0.24';
    const withVRZNO = phpVersion.startsWith('7.') ? 'yes' : 'no';
    const platform = process.env.PLATFORM === 'node' ? 'node' : 'web';
    const withNodeFs = platform === 'node' ? 'yes' : 'no';
    
    // Build PHP
    await asyncSpawn('docker', [
        'build', '.',
        '--tag=php-wasm',
        '--progress=plain',
        '--build-arg', `PHP_VERSION=${phpVersion}`,
        '--build-arg', `WITH_VRZNO=${withVRZNO}`,
        '--build-arg', `WITH_LIBXML=no`,
        '--build-arg', `WITH_LIBZIP=yes`,
        '--build-arg', `WITH_NODEFS=${withNodeFs}`,
        '--build-arg', `EMSCRIPTEN_ENVIRONMENT=${platform}`,
    ], { cwd: sourceDir, stdio: 'inherit' });

    // Extract the PHP WASM module
    await asyncSpawn('docker', [
        'run',
        '--name', 'php-wasm-tmp',
        '--rm',
        '-v', `${outputDir}:/output`,
        'php-wasm',
        'cp',
        '/root/output/php.js', '/root/output/php.wasm',
        '/output/',
    ], { cwd: sourceDir, stdio: 'inherit' });

    // Post-process the built files
    if (platform === 'node') {
        // The default output file is fine and only needs to be renamed.
        fs.renameSync(`${outputDir}/php.js`, `${outputDir}/php-node.js`);
    } else {
        // The webworker loader only differs by boolean flag.
        // Let's avoid a separate build and update the hardcoded
        // config value in the output file.
        await asyncPipe(
            gulp.src(`${outputDir}/php.js`)
                .pipe(replace('var ENVIRONMENT_IS_WEB=true;', 'var ENVIRONMENT_IS_WEB=false;'))
                .pipe(replace('var ENVIRONMENT_IS_WORKER=false;', 'var ENVIRONMENT_IS_WORKER=true;'))
                .pipe(rename('php-webworker.js'))
                .pipe(gulp.dest(outputDir))
        );

        // The default output file is already compatible with the web so
        // we only need to rename it
        fs.renameSync(`${outputDir}/php.js`, `${outputDir}/php-web.js`);
    }
        
}

exports.build = gulp.series(cleanBuildDir, build);

function asyncPipe(pipe) {
    return new Promise(async (resolve, reject) => {
        pipe.on('finish', resolve)
            .on('error', reject);
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
