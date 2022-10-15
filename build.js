const { build } = require('esbuild')
const yargs = require('yargs');
const { execSync } = require("child_process");

const argv = yargs( process.argv.slice( 2 ) )
    .command( 'build', 'Builds the project files' )
    .options( {
        platform: {
            type: 'string',
            default: 'browser',
            describe: 'The platform to build for.',
            choices: ['browser', 'node']
        },
        watch: {
            type: 'boolean',
            default: false,
            describe: 'Should watch the files and rebuild on change?'
        },
    } )
    .help()
    .alias( 'help', 'h' )
    .argv;

const defaults = {
    logLevel: "info",
    platform: argv.platform,
    bundle: true,
    define: {},
    watch: argv.watch
}
let options;
if (argv.platform === "browser") {
    // Provided by esbuild – see build.js in the repo root.
    const serviceWorkerOrigin = process.env.SERVICE_WORKER_ORIGIN || 'http://127.0.0.1:8777';
    const serviceWorkerUrl = `${serviceWorkerOrigin}/service-worker.js`;
    const wasmWorkerBackend = process.env.WASM_WORKER_BACKEND || 'iframe';
    let wasmWorkerUrl;
    if (wasmWorkerBackend === 'iframe') {
        const wasmWorkerOrigin = process.env.WASM_WORKER_ORIGIN || 'http://127.0.0.1:8778';
        wasmWorkerUrl = `${wasmWorkerOrigin}/iframe-worker.html`;
    } else {
        wasmWorkerUrl = `${serviceWorkerOrigin}/wasm-worker.js`;
    }

    options = {
        ...defaults,
        entryPoints: {
            'app': './src/web/app.mjs',
            'service-worker': './src/web/service-worker.js',
            'wasm-worker': './src/web/wasm-worker.js',
        },
        target: ['es6', 'chrome90', 'firefox60','safari11'],
        outdir: './dist-web',
        external: ['xmlhttprequest'],
        define: {
            ...defaults.define,
            SERVICE_WORKER_URL: JSON.stringify( serviceWorkerUrl ),
            WASM_WORKER_URL: JSON.stringify( wasmWorkerUrl ),
            WASM_WORKER_BACKEND: JSON.stringify( wasmWorkerBackend ),
            PHP_WASM_SIZE: JSON.stringify( Number( execSync("cat dist-web/php-web.wasm | wc -c").toString().trim() ) ),
            WP_DATA_SIZE: JSON.stringify( Number( execSync("cat dist-web/wp.data | wc -c").toString().trim() ) ),
        }
    };
} else if (argv.platform === "node") {
    options = {
        ...defaults,
        platform: 'node',
        // format: 'esm',
        entryPoints: ['./src/node/index.mjs'],
        outfile: './dist-node/index.js',
        target: 'node14.19.0',
        external: [
            'express',
            'yargs',
            'body-parser',
            'cookie-parser',
            './src/node/node-php.js'
        ]
    }
}

build(options).catch((e) => {
    console.error(e);
    process.exit(1)
})
