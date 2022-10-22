const os = require('os');
const gulp = require('gulp');
const path = require('path');
const util = require('util');
const fs = require('fs');
const rmAsync = util.promisify(fs.rm);
const { spawn } = require('child_process');

const sourceDir = __dirname;
const buildDir = path.join(__dirname, '..', 'build-wp');
const tmpWorkDir = path.join(buildDir, 'tmp');

async function prepareWordPress() {
    if (!fs.existsSync(tmpWorkDir)) {
        fs.mkdirSync(tmpWorkDir);
    }

    await asyncPipe(
        gulp.src([
            `${sourceDir}/prepare-wordpress.sh`,
            `${sourceDir}/requests_transport_fetch.php`
        ]).pipe(gulp.dest(tmpWorkDir))
    )
    
    await asyncSpawn('bash', ['prepare-wordpress.sh'], { cwd: tmpWorkDir, stdio: 'inherit' });
}

async function copyWPStaticAssets(_, options) {
    const { source, dest } = {
        source: `${tmpWorkDir}/wordpress-static`,
        dest: buildDir,
        ...options
    }
    await rmAsync(`${dest}/wp-admin`, { recursive: true, force: true });
    await rmAsync(`${dest}/wp-content`, { recursive: true, force: true })
    await rmAsync(`${dest}/wp-includes`, { recursive: true, force: true })

    return asyncPipe(
        gulp.src([
            `${source}/wp-admin/**/*`,
            `${source}/wp-content/**/*`,
            `${source}/wp-includes/**/*`,
        ], { "base" : source }).pipe(gulp.dest(dest))
    );
}

async function bundlePHPFiles() {
    await asyncPipe(
        gulp.src([
            `${sourceDir}/Dockerfile`,
            `${sourceDir}/bundle-wp.data.sh`
        ]).pipe(gulp.dest(tmpWorkDir))
    )
    
    await asyncSpawn('bash', ['bundle-wp.data.sh'], { cwd: tmpWorkDir, stdio: 'inherit' });
}

async function copyWPDataBundle(_, options) {
    const { source, dest } = {
        source: tmpWorkDir,
        dest: buildDir,
        ...options
    }
    await rmAsync(`${dest}/wp.js`, { force: true })
    await rmAsync(`${dest}/wp.data`, { force: true })

    return asyncPipe(
        gulp.src([
            `${source}/wp.js`,
            `${source}/wp.data`,
        ]).pipe(gulp.dest(dest))
    );
}

async function cleanBuildDir() {
    await rmAsync(buildDir, { recursive: true, force: true });
    fs.mkdirSync(buildDir);
}
async function cleanTmpFiles() {
    await rmAsync(tmpWorkDir, { recursive: true, force: true });
}

exports.cleanTmpFiles = cleanTmpFiles;
exports.prepareWordPress = gulp.series(cleanTmpFiles, prepareWordPress);
exports.copyWPStaticAssets = copyWPStaticAssets;
exports.bundlePHPFiles = bundlePHPFiles;
exports.copyWPDataBundle = copyWPDataBundle;
exports.build = gulp.series(cleanBuildDir, exports.prepareWordPress, copyWPStaticAssets, bundlePHPFiles, copyWPDataBundle);
exports.buildCleanTmp = gulp.series(exports.build, cleanTmpFiles);

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
