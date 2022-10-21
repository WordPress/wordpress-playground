const { build } = require('esbuild');
const yargs = require('yargs');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require("path")
const glob = require('glob');
const crypto = require('crypto');

const argv = yargs(process.argv.slice(2))
	.command('build', 'Builds the project files')
	.options({
		platform: {
			type: 'string',
			default: 'browser',
			describe: 'The platform to build for.',
			choices: ['browser', 'node'],
		},
		watch: {
			type: 'boolean',
			default: false,
			describe: 'Should watch the files and rebuild on change?',
		},
	})
	.help()
    .alias('help', 'h').argv;
    

// Attached to all script URLs to force browsers to download the
// resources again.
const CACHE_BUSTER = Math.random().toFixed(16).slice(2);

// Provided by esbuild – see build.js in the repo root.
const serviceWorkerOrigin =
    process.env.SERVICE_WORKER_ORIGIN || 'http://127.0.0.1:8777';
const serviceWorkerUrl = `${serviceWorkerOrigin}/service-worker.js`;
const wasmWorkerBackend = process.env.WASM_WORKER_BACKEND || 'iframe';
let workerThreadScript;
if (wasmWorkerBackend === 'iframe') {
    const wasmWorkerOrigin =
        process.env.WASM_WORKER_ORIGIN || 'http://127.0.0.1:8778';
    workerThreadScript = `${wasmWorkerOrigin}/iframe-worker.html?${CACHE_BUSTER}`;
} else {
    workerThreadScript = `${serviceWorkerOrigin}/worker-thread.js?${CACHE_BUSTER}`;
};

const baseConfig = {
    logLevel: 'info',
    platform: argv.platform,
    define: {
        CACHE_BUSTER: JSON.stringify(CACHE_BUSTER),
        'process.env.BUILD_PLATFORM': JSON.stringify(argv.platform),
    },
    watch: argv.watch,
    target: ['chrome90', 'firefox60', 'safari11'],
    bundle: true,
    external: ['xmlhttprequest'],
}

/* 
 * @TODO Support node.js build.
 * Some options to use:
 *	options = {
 *		platform: 'node',
 *		target: 'node14.19.0',
 *		external: [
 *			'express',
 *			'yargs',
 *			'body-parser',
 *			'cookie-parser',
 *			'./src/node/node-php.js',
 *		],
 *	}
 */


function getInternalDependencies() {
    return Object.entries(
        JSON.parse(fs.readFileSync(`package.json`)).dependencies
    ).filter(([name, version]) => version.startsWith('file:'))
    .map(([name, version]) => name)
}

// Build each package first
const configFor = (packageName, entrypoints = ['index']) => {
    const repoDeps = getInternalDependencies();
    return {
        ...baseConfig,
        external: [...baseConfig.external, ...repoDeps],
        entryPoints: Object.fromEntries(
            entrypoints.map((entrypoint) => [
                entrypoint,
                `packages/${packageName}/src/${entrypoint}.js`,
            ])
        ),
        format: 'cjs',
        outdir: `packages/${packageName}/build`,
    }
};

async function main() {
    // Build the packages first
    const configs = {
        'php-wasm': {
            ...configFor('php-wasm'),
            define: {
                ...baseConfig.define,
                PHP_WASM_SIZE: JSON.stringify(
                    fileSize(`packages/php-wasm/build/php.wasm`)
                ),
                PHP_WASM_HASH: JSON.stringify(
                    hashFiles([
                        `packages/php-wasm/build/php.wasm`,
                        `packages/php-wasm/build/php-web.js`
                    ])
                ),
            }
        },
        'php-wasm-browser': configFor('php-wasm-browser'),
        'wordpress-wasm': {
            ...configFor('wordpress-wasm', ['index', 'service-worker', 'worker-thread', 'example-app']),
            define: {
                ...baseConfig.define,
                SERVICE_WORKER_URL: JSON.stringify(serviceWorkerUrl),
                WASM_WORKER_THREAD_SCRIPT_URL: JSON.stringify(workerThreadScript),
                WASM_WORKER_BACKEND: JSON.stringify(wasmWorkerBackend),
                WP_DATA_SIZE: JSON.stringify(
                    fileSize(`packages/wordpress-wasm/wp.data`)
                ),
                WP_DATA_HASH: JSON.stringify(
                    hashFiles([
                        `packages/wordpress-wasm/build/wp.data`,
                        `packages/wordpress-wasm/build/wp.js`
                    ])
                ),
            }
        }
    };
    
    for (const [packageName, config] of Object.entries(configs)) {
        // Commonjs
        await build(config);

        // ES modules
        await build({
            ...config,
            format: 'esm',
            outdir: config.outdir + '-module',
        });

        const packageOutDir = config.outdir;

        const ops = [
            [`packages/${packageName}/src/**/*.html`, buildHTMLFile],
            [`packages/${packageName}/src/**/*.php`, copyToDist],
            [`packages/${packageName}/src/.htaccess`, copyToDist]
        ]

        for (const [pattern, mapper] of ops) {
            mapGlob(pattern, mapper.bind(null, packageOutDir));
        }
    }

    // Then build the entire project
    const globalOutDir = 'build';
    await build({
        ...baseConfig,
        outdir: globalOutDir,
        entryPoints: {
            'wordpress-wasm': 'packages/wordpress-wasm/build-module/index.js',
            'service-worker': 'packages/wordpress-wasm/build-module/service-worker.js',
            'worker-thread': 'packages/wordpress-wasm/build-module/worker-thread.js',
            'app': 'packages/wordpress-wasm/build-module/example-app.js',
        },
        nodePaths: ['packages']
    });

    console.log("")
    console.log("Static files copied: ")
    mapGlob('packages/*/build/*.html', buildHTMLFile.bind(null, globalOutDir))
    const patternsToCopy = [
        'packages/*/build/*.php',
        'packages/php-wasm/build-wasm/php-*.js',
        'packages/php-wasm/build-wasm/php.wasm',
        'packages/wordpress-wasm/build-wp/wp.js',
        'packages/wordpress-wasm/build-wp/wp.data'
    ];
    for (const pattern of patternsToCopy) {
        mapGlob(pattern, copyToDist.bind(null, globalOutDir));
    }
    // @TODO uncomment this without triggering a ton of esbuild "change detected" messages
    // Don't watch the WordPress static files – just perform a one-off copy 
    // glob.sync('packages/wordpress-wasm/build/wp-*').map((sourcePath) => {
    //     const destPath = `${globalOutDir}/${sourcePath.split('/').pop()}`;
    //     if (fs.existsSync(destPath)) {
    //         fs.rmSync(destPath, { recursive: true });
    //     }
    //     fs.mkdirSync(destPath);
    //     fs.cpSync(sourcePath, destPath, { recursive: true });
    //     return destPath;
    // });

    // Don't watch the .htaccess – just perform a one-off copy 
    const htAccess = glob.sync('packages/*/build/.htaccess')
        .map((filePath) => fs.readFileSync(filePath).toString())
        .join("\n");
    fs.writeFileSync(`${globalOutDir}/.htaccess`, htAccess);
    logBuiltFile(`${globalOutDir}/.htaccess`);
}
main();

function mapGlob(pattern, mapper) {
    if (argv.watch) {
        chokidar.watch(pattern).on('change', mapper);
    } else {
        glob.sync(pattern).map(mapper).forEach(logBuiltFile);
    }
}

function copyToDist(outdir, filePath) {
    const filename = filePath.split('/').pop();
    const outPath = `${outdir}/${filename}`;
    fs.copyFileSync(filePath, outPath);
    return outPath;
}

function buildHTMLFile(outdir, filePath) {
    let content = fs.readFileSync(filePath).toString();
    content = content.replace(
        /(<script[^>]+src=")([^"]+)("><\/script>)/,
        `$1$2?${CACHE_BUSTER}$3`
    );
    const filename = filePath.split('/').pop();
    const outPath = `${outdir}/${filename}`;
    fs.writeFileSync(outPath, content);
    return outPath;
}

function logBuiltFile(outPath) {
    const outPathToLog = outPath.replace(/^\.\//, '');
    console.log(`  ${outPathToLog}`)
}

function fileSize(filePath) {
    if (!fs.existsSync(filePath)) {
        return 0;
    }
    return fs.statSync(filePath).size;
}

function hashFiles(filePaths) {
    // if all files exist
    if (!filePaths.every(fs.existsSync)) {
        return '';
    }
    return sha256(
        Buffer.concat(
            filePaths.map((filePath) => fs.readFileSync(filePath))
        )
    );
}

function sha256(buffer) {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
}
