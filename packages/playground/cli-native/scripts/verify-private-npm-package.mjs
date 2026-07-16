#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
	access,
	cp,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const repositoryRoot = resolve(projectRoot, '../../..');
const manifestPath = join(projectRoot, 'Cargo.toml');
const builtPackage = join(
	repositoryRoot,
	'dist/packages/playground/cli-native'
);
const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const platformTargets = new Map([
	['linux/x64', ['x86_64-unknown-linux-gnu', 'linux-x64-gnu']],
	['linux/arm64', ['aarch64-unknown-linux-gnu', 'linux-arm64-gnu']],
	['darwin/x64', ['x86_64-apple-darwin', 'darwin-x64']],
	['darwin/arm64', ['aarch64-apple-darwin', 'darwin-arm64']],
	['win32/x64', ['x86_64-pc-windows-msvc', 'win32-x64']],
	['win32/arm64', ['aarch64-pc-windows-msvc', 'win32-arm64']],
]);

function targetConfiguration() {
	const detected = platformTargets.get(`${process.platform}/${process.arch}`);
	if (!detected) {
		throw new Error(
			`No cli-native verification target for ${process.platform}/${process.arch}`
		);
	}
	return {
		rustTarget:
			process.env['WP_PLAYGROUND_NATIVE_TARGET_TRIPLE'] ?? detected[0],
		packageTarget:
			process.env['WP_PLAYGROUND_NATIVE_TARGET_LABEL'] ?? detected[1],
	};
}

async function run(command, args, options = {}) {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? repositoryRoot,
			env: { ...process.env, ...options.env },
			stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
			windowsHide: true,
		});
		let stdout = '';
		let stderr = '';
		child.stdout?.on('data', (chunk) => (stdout += chunk));
		child.stderr?.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('close', (code, signal) => {
			if (code === 0 && signal === null) {
				resolvePromise({ stdout, stderr });
				return;
			}
			reject(
				new Error(
					`${command} ${args.join(' ')} failed with ${signal ?? `exit ${code}`}\n${stderr.slice(-8_000)}`
				)
			);
		});
	});
}

async function listen(server) {
	await new Promise((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolvePromise();
		});
	});
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('Could not inspect fixture server');
	return `http://127.0.0.1:${address.port}/`;
}

async function close(server) {
	if (!server.listening) return;
	await new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

async function main() {
	const { rustTarget, packageTarget } = targetConfiguration();
	const workspaceVersion = String(
		JSON.parse(await readFile(join(repositoryRoot, 'lerna.json'), 'utf8'))
			.version
	);
	const temporaryRoot = await mkdtemp(
		join(tmpdir(), 'wp-playground-cli-native-verify-')
	);
	const outputPackage = join(temporaryRoot, 'npm-package');
	const packageOutput = join(temporaryRoot, 'native-package');
	const fixtureRoot = join(temporaryRoot, 'fixture');
	const packOutput = join(temporaryRoot, 'pack');
	const consumerRoot = join(temporaryRoot, 'consumer');
	const cacheRoot = join(temporaryRoot, 'cache');
	const targetRoot = join(projectRoot, 'target', rustTarget, 'release');
	const hostBinary = join(
		targetRoot,
		`wp-playground-native${executableSuffix}`
	);
	const packageBinary = join(
		targetRoot,
		`package-native-cli${executableSuffix}`
	);
	let fixtureServer;

	try {
		await access(join(builtPackage, 'package.json'));
		await cp(builtPackage, outputPackage, { recursive: true });
		await run(
			'cargo',
			[
				'build',
				'--manifest-path',
				manifestPath,
				'--release',
				'--bins',
				'--target',
				rustTarget,
			],
			{ env: { WP_PLAYGROUND_NATIVE_VERSION: workspaceVersion } }
		);
		await access(hostBinary);
		await access(packageBinary);

		await run(
			packageBinary,
			[
				'--binary',
				hostBinary,
				'--asset-root',
				repositoryRoot,
				'--out-dir',
				packageOutput,
				'--name',
				'runtime-assets',
				'--no-precompile-wasmtime',
				'--skip-archive',
				'--smoke-wordpress-server',
				'--smoke-run-blueprint',
				'--smoke-build-snapshot',
			],
			{
				env: {
					WP_PLAYGROUND_NATIVE_TARGET_TRIPLE: rustTarget,
					WP_PLAYGROUND_NATIVE_SOURCE_COMMIT:
						process.env['GITHUB_SHA'] ?? 'local-verification',
				},
			}
		);

		await run(process.execPath, [
			join(scriptDir, 'stage-npm-runtime-assets.mjs'),
			'--source-package',
			join(packageOutput, 'runtime-assets'),
			'--package-dir',
			outputPackage,
		]);
		await run(process.execPath, [
			join(scriptDir, 'create-npm-host-fixture.mjs'),
			'--binary',
			hostBinary,
			'--target',
			packageTarget,
			'--fixture-dir',
			fixtureRoot,
			'--package-dir',
			outputPackage,
		]);
		await run(process.execPath, [
			join(scriptDir, 'verify-private-package-boundary.mjs'),
			'--package-dir',
			outputPackage,
		]);

		await mkdir(packOutput, { recursive: true });
		const packed = await run(
			npmExecutable,
			['pack', outputPackage, '--json', '--pack-destination', packOutput],
			{ capture: true }
		);
		const packReport = JSON.parse(packed.stdout);
		const report = packReport[0];
		if (!report?.filename || !Array.isArray(report.files)) {
			throw new Error(
				`npm pack returned an unexpected report: ${packed.stdout}`
			);
		}
		for (const file of report.files) {
			if (
				file.path.endsWith('.cwasm') ||
				/(^|\/)wp-playground-native(?:\.exe)?$/.test(file.path)
			) {
				throw new Error(
					`npm tarball contains forbidden native payload ${file.path}`
				);
			}
		}

		await mkdir(consumerRoot, { recursive: true });
		await writeFile(
			join(consumerRoot, 'package.json'),
			'{"name":"cli-native-private-verification","private":true,"type":"module"}\n'
		);
		const tarball = join(packOutput, report.filename);
		await run(
			npmExecutable,
			[
				'install',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
				'--no-package-lock',
				tarball,
			],
			{ cwd: consumerRoot }
		);

		let hostRequests = 0;
		fixtureServer = createServer(async (request, response) => {
			try {
				const requestPath = decodeURIComponent(
					new URL(request.url ?? '/', 'http://fixture').pathname
				);
				if (!/^\/hosts\/[a-zA-Z0-9._-]+\.gz$/.test(requestPath)) {
					response.writeHead(404).end();
					return;
				}
				const bytes = await readFile(join(fixtureRoot, requestPath));
				hostRequests++;
				response.writeHead(200, {
					'content-type': 'application/gzip',
					'content-length': bytes.length,
				});
				response.end(bytes);
			} catch {
				response.writeHead(404).end();
			}
		});
		const baseUrl = await listen(fixtureServer);
		const installedPackage = join(
			consumerRoot,
			'node_modules/@wp-playground/cli-native'
		);
		const launcher = join(installedPackage, 'wp-playground.js');
		const runtimeEnvironment = {
			WP_PLAYGROUND_NATIVE_HOST_BASE_URL: baseUrl,
			WP_PLAYGROUND_NATIVE_CACHE_DIR: cacheRoot,
		};

		const versions = await Promise.all([
			run(process.execPath, [launcher, '--version'], {
				cwd: consumerRoot,
				env: runtimeEnvironment,
				capture: true,
			}),
			run(process.execPath, [launcher, '--version'], {
				cwd: consumerRoot,
				env: runtimeEnvironment,
				capture: true,
			}),
		]);
		for (const version of versions) {
			if (
				version.stdout.trim() !==
				`wp-playground-native ${workspaceVersion}`
			) {
				throw new Error(
					`Installed --version mismatch: expected wp-playground-native ${workspaceVersion}, received ${version.stdout.trim()}`
				);
			}
		}
		if (hostRequests !== 1) {
			throw new Error(
				`Concurrent first launcher invocations made ${hostRequests} host requests instead of one`
			);
		}
		await close(fixtureServer);
		fixtureServer = undefined;

		await run(process.execPath, [launcher, '--version'], {
			cwd: consumerRoot,
			env: {
				...runtimeEnvironment,
				WP_PLAYGROUND_NATIVE_HOST_BASE_URL: 'http://127.0.0.1:1/',
			},
		});
		await run(process.execPath, [launcher, 'runtime', 'install'], {
			cwd: consumerRoot,
			env: {
				...runtimeEnvironment,
				WP_PLAYGROUND_NATIVE_HOST_BASE_URL: 'http://127.0.0.1:1/',
			},
		});
		await run(
			npmExecutable,
			['exec', '--offline', '--', 'wp-playground-cli', '--version'],
			{
				cwd: consumerRoot,
				env: {
					...runtimeEnvironment,
					WP_PLAYGROUND_NATIVE_HOST_BASE_URL: 'http://127.0.0.1:1/',
				},
			}
		);

		await writeFile(
			join(consumerRoot, 'module-smoke.mjs'),
			"import { resolveWorkerCount, mergeDefinedConstants } from '@wp-playground/cli-native';\n" +
				"if (resolveWorkerCount(2) !== 2) throw new Error('bad ESM helper');\n" +
				"if (mergeDefinedConstants({define:{A:'b'}}).A !== 'b') throw new Error('bad merge');\n"
		);
		await writeFile(
			join(consumerRoot, 'module-smoke.cjs'),
			"const native = require('@wp-playground/cli-native');\n" +
				"if (native.resolveWorkerCount(2) !== 2) throw new Error('bad CJS helper');\n" +
				'native.ensureNativeHost().then((host) => {\n' +
				"  if (!host.assetRoot.includes('@wp-playground')) throw new Error('bad CJS asset root: ' + host.assetRoot);\n" +
				'}).catch((error) => { console.error(error); process.exitCode = 1; });\n'
		);
		await writeFile(
			join(consumerRoot, 'module-smoke.ts'),
			"import { runCLI, type RunCLIServer } from '@wp-playground/cli-native';\n" +
				"const running: Promise<RunCLIServer> = runCLI({ command: 'start', port: 0 });\n" +
				'void running;\n'
		);
		await run(process.execPath, ['module-smoke.mjs'], {
			cwd: consumerRoot,
		});
		await run(process.execPath, ['module-smoke.cjs'], {
			cwd: consumerRoot,
			env: {
				...runtimeEnvironment,
				WP_PLAYGROUND_NATIVE_HOST_BASE_URL: 'http://127.0.0.1:1/',
			},
		});
		await run(
			process.execPath,
			[
				join(repositoryRoot, 'node_modules/typescript/bin/tsc'),
				'--noEmit',
				'--strict',
				'--skipLibCheck',
				'--target',
				'ES2022',
				'--module',
				'NodeNext',
				'--moduleResolution',
				'NodeNext',
				'--lib',
				'ES2023,DOM,ESNext.Disposable',
				'--typeRoots',
				join(repositoryRoot, 'node_modules/@types'),
				'--types',
				'node',
				'module-smoke.ts',
			],
			{ cwd: consumerRoot }
		);

		const siteRoot = join(temporaryRoot, 'site');
		await mkdir(siteRoot, { recursive: true });
		await writeFile(
			join(siteRoot, 'index.php'),
			'<?php echo "native-api-ok:" . $_SERVER["SERVER_PORT"] . ":" . ($_SERVER["HTTPS"] ?? "off");'
		);
		await writeFile(
			join(consumerRoot, 'api-smoke.mjs'),
			`import { runCLI } from '@wp-playground/cli-native';
const running = await runCLI({
  command: 'server',
  port: 0,
  workers: 2,
  verbosity: 'quiet',
  login: false,
  mount: [{ hostPath: ${JSON.stringify(siteRoot)}, vfsPath: '/wordpress' }],
  wordpressInstallMode: 'do-not-attempt-installing',
  skipSqliteSetup: true,
});
try {
  if (!(running.server && running.server.listening)) throw new Error('Node server is not listening');
	if (!running.serverUrl.startsWith('http://127.0.0.1:')) throw new Error('serverUrl is not the Node proxy URL: ' + running.serverUrl);
	if (new URL(await running.playground.absoluteUrl).origin !== new URL(running.serverUrl).origin) throw new Error('native absoluteUrl mismatch');
	let escapingPathRejected = false;
	try {
		await running.playground.pathToInternalUrl('/wordpress@example.com/escape');
	} catch {
		escapingPathRejected = true;
	}
	if (!escapingPathRejected) throw new Error('pathToInternalUrl accepted a non-document-root prefix');
  const response = await fetch(running.serverUrl);
	const responseText = await response.text();
	const publicPort = new URL(running.serverUrl).port;
	if (!responseText.includes('native-api-ok:' + publicPort + ':off')) throw new Error('proxy response/server metadata mismatch: ' + responseText);
	const controlled = await running.playground.request({ path: '/' });
	if (!controlled.text.includes('native-api-ok')) throw new Error('RPC request mismatch');
	const streamed = await running.playground.requestStreamed({ path: '/' });
	if (!(await streamed.stdoutText).includes('native-api-ok')) throw new Error('streamed RPC request mismatch');
	await running.playground.mkdirTree('/wordpress/rpc-dir/nested');
  await running.playground.writeFile('/wordpress/control.txt', 'control-ok');
  if (await running.playground.readFileAsText('/wordpress/control.txt') !== 'control-ok') throw new Error('RPC filesystem mismatch');
	await running.playground.writeFile('/wordpress/rpc-dir/data.bin', new Uint8Array([0, 1, 2, 255]));
	const binary = await running.playground.readFileAsBuffer('/wordpress/rpc-dir/data.bin');
	if (binary.length !== 4 || binary[3] !== 255) throw new Error('RPC binary filesystem mismatch');
	if (!(await running.playground.listFiles('/wordpress/rpc-dir')).includes('data.bin')) throw new Error('RPC listFiles mismatch');
	await running.playground.mv('/wordpress/control.txt', '/wordpress/control-moved.txt');
	if (!await running.playground.fileExists('/wordpress/control-moved.txt')) throw new Error('RPC mv mismatch');
	await running.playground.writeFile('/wordpress/rpc-script.php', '<?php echo getenv("RPC_ENV") . ":" . $_SERVER["RPC_SERVER"];');
	const php = await running.playground.run({
		scriptPath: '/wordpress/rpc-script.php',
		protocol: 'http',
		env: { RPC_ENV: 'env-ok' },
		server: { RPC_SERVER: 'server-ok' },
	});
	if (php.text !== 'env-ok:server-ok') throw new Error('RPC PHP context mismatch: ' + php.text);
	let nonzeroRejected = false;
	try {
		await running.playground.run({ code: '<?php exit(7);' });
	} catch (error) {
		nonzeroRejected = String(error).includes('7');
	}
	if (!nonzeroRejected) throw new Error('RPC PHP nonzero exit was not rejected');
	await running.playground.unlink('/wordpress/control-moved.txt');
	if (await running.playground.fileExists('/wordpress/control-moved.txt')) throw new Error('RPC unlink mismatch');
} finally {
  await running[Symbol.asyncDispose]();
}
	if (running.server.listening) throw new Error('Node server still listening after disposal');
`
		);
		await run(process.execPath, ['api-smoke.mjs'], {
			cwd: consumerRoot,
			env: {
				...runtimeEnvironment,
				WP_PLAYGROUND_NATIVE_HOST_BASE_URL: 'http://127.0.0.1:1/',
			},
		});
	} finally {
		if (fixtureServer) await close(fixtureServer);
		if (process.env['WP_PLAYGROUND_NATIVE_KEEP_VERIFY_TEMP'] === '1') {
			process.stdout.write(
				`Kept cli-native verification files at ${temporaryRoot}\n`
			);
		} else {
			await rm(temporaryRoot, { recursive: true, force: true });
		}
	}
}

main().catch((error) => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
