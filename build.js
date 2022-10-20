const { build } = require('esbuild');
const yargs = require('yargs');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
const fs = require('fs');
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
	
const defaults = {
	logLevel: 'info',
	platform: argv.platform,
	bundle: true,
	define: {},
	watch: argv.watch,
};

let options;
if (argv.platform === 'browser') {
	// Attached to all script URLs to force browsers to download the
	// resources again.
	const CACHE_BUSTER = Math.random().toFixed(16).slice(2);

	// Provided by esbuild – see build.js in the repo root.
	const serviceWorkerOrigin =
		process.env.SERVICE_WORKER_ORIGIN || 'http://127.0.0.1:8777';
	const serviceWorkerUrl = `${serviceWorkerOrigin}/service-worker.js`;
	const wasmWorkerBackend = process.env.WASM_WORKER_BACKEND || 'iframe';
	let wasmWorkerUrl;
	if (wasmWorkerBackend === 'iframe') {
		const wasmWorkerOrigin =
			process.env.WASM_WORKER_ORIGIN || 'http://127.0.0.1:8778';
		wasmWorkerUrl = `${wasmWorkerOrigin}/iframe-worker.html?${CACHE_BUSTER}`;
	} else {
		wasmWorkerUrl = `${serviceWorkerOrigin}/wasm-worker.js?${CACHE_BUSTER}`;
	};

	function sha256(buffer) {
		const hash = crypto.createHash('sha256');
		hash.update(buffer);
		return hash.digest('hex');
	}

	const outDir = './dist-web';
	options = {
		...defaults,
		entryPoints: {
			app: './src/web/app.mjs',
			'service-worker': './src/web/service-worker.js',
			'wasm-worker': './src/web/wasm-worker.js',
		},
		target: ['es6', 'chrome90', 'firefox60', 'safari11'],
		outdir: outDir,
		external: ['xmlhttprequest'],
		define: {
			...defaults.define,
			SERVICE_WORKER_URL: JSON.stringify(serviceWorkerUrl),
			WASM_WORKER_URL: JSON.stringify(wasmWorkerUrl),
			WASM_WORKER_BACKEND: JSON.stringify(wasmWorkerBackend),
			PHP_WASM_SIZE: JSON.stringify(
				fs.readFileSync(`${outDir}/php.wasm`).byteLength
			),
			WP_DATA_SIZE: JSON.stringify(
				fs.readFileSync(`${outDir}/wp.data`).byteLength
			),
			PHP_WASM_CACHE_BUSTER: JSON.stringify(
				sha256(
					Buffer.concat([
						fs.readFileSync(`${outDir}/php.wasm`),
						fs.readFileSync(`${outDir}/php-web.js`)
					])
				)
			),
			WP_DATA_CACHE_BUSTER: JSON.stringify(
				sha256(
					Buffer.concat([
						fs.readFileSync(`${outDir}/wp.data`),
						fs.readFileSync(`${outDir}/wp.js`)
					])
				)
			),
			CACHE_BUSTER: JSON.stringify(CACHE_BUSTER),
		},
	};

	function copyToDist(path) {
		const filename = path.split('/').pop();
		const outPath = `${options.outdir}/${filename}`;
		fs.copyFileSync(path, outPath);
		return outPath;
	}
	function buildHTMLFile(path) {
		let content = fs.readFileSync(path).toString();
		content = content.replace(
			/(<script[^>]+src=")([^"]+)("><\/script>)/,
			`$1$2?${CACHE_BUSTER}$3`
		);
		const filename = path.split('/').pop();
		const outPath = `${options.outdir}/${filename}`;
		fs.writeFileSync(outPath, content);
		return outPath;
	}

	function logBuiltFile(outPath) {
		const outPathToLog = outPath.replace(/^\.\//, '');
		console.log(`  ${outPathToLog}`)
	}

	if (options.watch) {
		chokidar.watch('src/web/*.html').on('change', buildHTMLFile);
		chokidar.watch('src/web/*.php').on('change', copyToDist);
	} else {
		console.log("HTML files built: ")
		console.log("")
		glob.sync('src/web/*.html').map(buildHTMLFile).forEach(logBuiltFile);
		glob.sync('src/web/*.php').map(copyToDist).forEach(logBuiltFile);
		console.log("")
		console.log("Esbuild output: ")
	}
} else if (argv.platform === 'node') {
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
			'./src/node/node-php.js',
		],
	};
}

build(options).catch((e) => {
	console.error(e);
	process.exit(1);
});
