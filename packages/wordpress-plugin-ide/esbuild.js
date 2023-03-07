const { build } = require('esbuild');
const yargs = require('yargs');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const crypto = require('crypto');

const argv = yargs(process.argv.slice(2))
	.command('build', 'Builds the project files')
	.options({
		platform: {
			type: 'string',
			default: 'browser',
			describe: 'The platform to build for.',
			choices: ['browser'],
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
}

const globalOutDir = 'build';

async function main() {
	const copyToDist = copyToPath(globalOutDir);
	const baseConfig = {
		logLevel: 'info',
		platform: argv.platform,
		outdir: globalOutDir,
		watch: argv.watch,
		target: ['chrome106', 'firefox100', 'safari15'],
		bundle: true,
		nodePaths: ['packages', 'src/wordpress-plugin-ide/bundler/polyfills'],
		loader: {
			'.php': 'text',
			'.txt.js': 'text',
			'.js': 'jsx',
		},
		treeShaking: true,
		minify: true,
	};
	// This build step exists solely to compute the hash of service-worker.js.
	//
	// The browsers tend to cling to the service worker script even when the
	// code itself changes. Computing the script hash allows us to compare
	// the expected and registered service worker versions and force the
	// invalidation.
	build({
		...baseConfig,
		minify: false,
		entryPoints: {
			'service-worker': 'src/wordpress-playground/service-worker.ts',
		},
		entryNames: 'sw-mock-to-get-hash.[hash]',
		plugins: [
			// Delete the outdated "hashful" service worker builds.
			cleanup({ pattern: 'sw-mock-to-get-hash.*.js' }),
			{
				name: 'import-json-file',
				setup(currentBuild) {
					currentBuild.initialOptions.metafile = true;

					// Whenever the build is finished, write the hash to
					// "service-worker-version.ts" where it can be imported by
					// both the frontend script and the service worker.
					currentBuild.onEnd((result) => {
						const filename = Object.keys(
							result.metafile.outputs
						)[0];
						const hash = filename.split('.')[1];
						fs.writeFileSync(
							'src/wordpress-playground/service-worker-version.ts',
							`/* Automatically refreshed by esbuild.js */ ` +
								`export default ${JSON.stringify(hash)}; \n`
						);
					});

					// Instead of importing the actual service worker version, provide
					// an empty string to avoid an infinite loop of building the service
					// worker, refreshing the hash, building a new service worker with the
					// updated hash, refreshing the hash again, etc.
					currentBuild.onLoad(
						{
							filter: /.*/,
							namespace: 'service-worker-version',
						},
						() => ({
							contents: `export default ""`,
							loader: 'ts',
						})
					);

					// Make sure the "service-worker-version" import will be handled by
					// the onLoad call above.
					currentBuild.onResolve(
						{ filter: /service-worker-version$/ },
						(args) => ({
							path: args.path,
							namespace: 'service-worker-version',
						})
					);
				},
			},
		],
	});
	build({
		...baseConfig,
		entryPoints: {
			'service-worker': 'src/wordpress-playground/service-worker.ts',
			'setup-fast-refresh-runtime':
				'src/wordpress-plugin-ide/bundler/react-fast-refresh/setup-react-refresh-runtime.js',
		},
	});
	build({
		...baseConfig,
		define: {
			CACHE_BUSTER: JSON.stringify(CACHE_BUSTER),
			'process.env.BUILD_PLATFORM': JSON.stringify(argv.platform),
			'process.env.NODE_ENV': JSON.stringify('development'),
			SERVICE_WORKER_URL: JSON.stringify(serviceWorkerUrl),
			WASM_WORKER_THREAD_SCRIPT_URL: JSON.stringify(workerThreadScript),
			WASM_WORKER_BACKEND: JSON.stringify(wasmWorkerBackend),
			WP_JS_HASH: JSON.stringify(hashFiles([`build/wp.js`])),
			PHP_JS_HASH: JSON.stringify(hashFiles(glob.sync('build/php-*.js'))),
		},
		entryPoints: {
			'worker-thread': 'src/wordpress-playground/worker-thread.ts',
			app: 'src/wordpress-playground/index.tsx',
			'wordpress-plugin-ide': 'src/wordpress-plugin-ide/index.ts',
			react: 'react',
			'react-dom': 'react-dom',
		},
		splitting: true,
		sourcemap: true,
		format: 'esm',
		metafile: true,
		plugins: [cleanup({ pattern: 'chunk-*' })],
	});
	build({
		logLevel: 'info',
		platform: 'node',
		outdir: './build-scripts/',
		bundle: true,
		external: ['@microsoft/*', 'node_modules/*'],
		entryPoints: [
			'./src/typescript-reference-doc-generator/bin/tsdoc-to-api-markdown.js',
		],
		sourcemap: true,
		watch: argv.watch,
	});
	build({
		logLevel: 'info',
		platform: 'node',
		outdir: './build-cli/',
		bundle: true,
		external: ['node_modules/*'],
		entryNames: '[name]',
		// minify: true,
		entryPoints: {
			'php-cli': './src/php-cli/index.ts',
			...Object.fromEntries(
				glob
					.sync('./build/php-*.node.js')
					.map((p) => [path.basename(p, '.js'), p])
			),
		},
		watch: argv.watch,
		plugins: [
			// Add the required #!/usr/bin/env node to the top of the
			// built php - cli.js file.
			{
				name: 'add-shebang',
				setup(currentBuild) {
					currentBuild.onEnd(() => {
						// Add a shebang to './build-cli/php-cli.js'
						const phpCliPath = path.join(
							__dirname,
							'./build-cli/php-cli.js'
						);
						const phpCliContents = fs.readFileSync(
							phpCliPath,
							'utf8'
						);
						fs.writeFileSync(
							phpCliPath,
							`#!/usr/bin/env node
${phpCliContents}`
						);
					});
				},
			},
		],
	});
	mapGlob(`./build/php-*.node.wasm`, copyToPath('./build-cli/'));
	mapGlob(`./src/php-cli/terminfo/x/*`, copyToPath('./build-cli/terminfo/x'));

	console.log('');
	console.log('Static files copied: ');
	mapGlob(`src/*/*.html`, buildHTMLFile);
	mapGlob(`src/wordpress-playground/bundling/test/*.html`, buildHTMLFile);

	mapGlob(`node_modules/react/umd/react.development.js`, copyToDist);
	mapGlob(`node_modules/react-dom/umd/react-dom.development.js`, copyToDist);
	mapGlob(`src/*/*.php`, copyToDist);
	if (argv.watch) {
		const liveServer = require('live-server');
		const request = require('request');

		liveServer.start({
			port: 8777,
			root: __dirname + '/build',
			open: '/wordpress.html',
			middleware: [
				(req, res, next) => {
					if (req.url.endsWith('iframe-worker.html')) {
						res.setHeader('Origin-Agent-Cluster', '?1');
					} else if (req.url.startsWith('/plugin-proxy')) {
						const url = new URL(req.url, 'http://127.0.0.1:8777');
						if (url.searchParams.has('plugin')) {
							const pluginName = url.searchParams
								.get('plugin')
								.replace(/[^a-zA-Z0-9\.\-_]/, '');
							request(
								`https://downloads.wordpress.org/plugin/${pluginName}`
							).pipe(res);
						} else if (url.searchParams.has('theme')) {
							const themeName = url.searchParams
								.get('theme')
								.replace(/[^a-zA-Z0-9\.\-_]/, '');
							request(
								`https://downloads.wordpress.org/theme/${themeName}`
							).pipe(res);
						} else {
							res.end('Invalid request');
						}
						return;
					}
					next();
				},
			],
		});

		// Serve the iframe worker from a different origin
		// to make the Origin-Agent-Cluster header work.
		// See https://web.dev/origin-agent-cluster/ for more info.
		liveServer.start({
			port: 8778,
			root: __dirname + '/build',
			open: false,
		});
	}
}

if (require.main === module) {
	main();
}
exports.main = main;

function mapGlob(pattern, mapper) {
	glob.sync(pattern).map(mapper).forEach(logBuiltFile);
	if (argv.watch) {
		chokidar.watch(pattern).on('change', mapper);
	}
}

function copyToPath(outdir) {
	if (!fs.existsSync(outdir)) {
		fs.mkdirSync(outdir, { recursive: true });
	}
	return function (filePath) {
		const filename = filePath.split('/').pop();
		const outPath = `${outdir}/${filename}`;
		fs.copyFileSync(filePath, outPath);
		return outPath;
	};
}

function buildHTMLFile(filePath) {
	const outdir = globalOutDir;
	let content = fs.readFileSync(filePath).toString();
	content = content.replace(
		/(<script[^>]+src=")([^"]+)(" type="module"><\/script>)/,
		`$1$2?${CACHE_BUSTER}$3`
	);
	const filename = filePath.split('/').pop();
	const outPath = `${outdir}/${filename}`;
	fs.writeFileSync(outPath, content);
	return outPath;
}

function logBuiltFile(outPath) {
	const outPathToLog = outPath.replace(/^\.\//, '');
	console.log(`  ${outPathToLog}`);
}

function hashFiles(filePaths) {
	// if all files exist
	if (!filePaths.every(fs.existsSync)) {
		return '';
	}
	return sha256(
		Buffer.concat(filePaths.map((filePath) => fs.readFileSync(filePath)))
	);
}

function sha256(buffer) {
	const hash = crypto.createHash('sha256');
	hash.update(buffer);
	return hash.digest('hex');
}

function cleanup({ pattern = '*' }) {
	return {
		name: 'cleanupFiles',
		setup(build) {
			const options = build.initialOptions;
			build.onEnd((result) => {
				if (!result.metafile) {
					return;
				}
				const safelist = new Set(Object.keys(result.metafile.outputs));
				const files = glob.sync(path.join(options.outdir, pattern));
				files.forEach((path) => {
					if (!safelist.has(path)) {
						fs.unlinkSync(path);
					}
				});
			});
		},
	};
}
