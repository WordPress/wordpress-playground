const { spawn, exec, execSync } = require('child_process');
const os = require('os');
const gulp = require('gulp');
const path = require('path');
const util = require('util');
const fs = require('fs');
const asyncExec = util.promisify(require('child_process').exec);

const sourcePath = __dirname;
const buildPath = path.join(__dirname, '..', 'build-wp');
const tmpWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-'));

async function prepareWordPress() {
    await asyncPipe(
        gulp.src([
            `${sourcePath}/prepare-wordpress.sh`,
            `${sourcePath}/request_transport_fetch.php`
        ]).pipe(gulp.dest(tmpWorkDir))
    )
    
    await asyncExec('bash prepare-wordpress.sh', [''], { cwd: tmpWorkDir, stdio: 'inherit' });
}

async function bundleWordPress() {
    await asyncPipe(
        gulp.src([
            `${sourcePath}/Dockefile`,
            `${sourcePath}/bundle-data.sh`
        ]).pipe(gulp.dest(tmpWorkDir))
    )
    
    await asyncExec('bash bundle-data.sh', [''], { cwd: tmpWorkDir, stdio: 'inherit' });

    return asyncPipe(
        gulp.src([
            `${tmpWorkDir}/wp.js`,
            `${tmpWorkDir}/wp.data`,
            `${tmpWorkDir}/wp-admin`,
            `${tmpWorkDir}/wp-content`,
            `${tmpWorkDir}/wp-includes`,
        ]).pipe(gulp.dest(buildPath))
    );
}

exports.build = gulp.series(prepareWordPress, bundleWordPress);

function asyncPipe(pipe) {
    return new Promise(async (resolve, reject) => {
        pipe.on('finish', resolve)
            .on('error', reject);
    });
}
