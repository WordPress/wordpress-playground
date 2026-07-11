import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { internalsKeyForTesting, runCLI } from '../src';
import { nativeBinaryEnvironmentVariable } from '../src/native-binary';

const nativeDescribe = process.platform === 'win32' ? describe.skip : describe;
const fixtureArgumentsEnvironmentVariable = 'PLAYGROUND_NATIVE_TEST_ARGUMENTS';

nativeDescribe('native runCLI()', () => {
	let previousBinary: string | undefined;
	let previousFixtureArguments: string | undefined;

	beforeEach(() => {
		previousBinary = process.env[nativeBinaryEnvironmentVariable];
		previousFixtureArguments =
			process.env[fixtureArgumentsEnvironmentVariable];
	});

	afterEach(() => {
		if (previousBinary === undefined) {
			delete process.env[nativeBinaryEnvironmentVariable];
		} else {
			process.env[nativeBinaryEnvironmentVariable] = previousBinary;
		}
		if (previousFixtureArguments === undefined) {
			delete process.env[fixtureArgumentsEnvironmentVariable];
		} else {
			process.env[fixtureArgumentsEnvironmentVariable] =
				previousFixtureArguments;
		}
	});

	test('returns a native-backed PHP, VFS, and server facade', async () => {
		const fixture = await createNativeHostFixture();
		process.env[nativeBinaryEnvironmentVariable] = fixture.binary;

		try {
			await using server = await runCLI({
				command: 'server',
				port: 0,
				verbosity: 'quiet',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
			});
			const playground = server.playground;

			expect(server.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
			expect(
				server[internalsKeyForTesting].workerThreadCount
			).toBeGreaterThan(0);

			await playground.writeFile('/wordpress/hello.txt', 'hello native');
			expect(
				await playground.readFileAsText('/wordpress/hello.txt')
			).toBe('hello native');
			expect(await playground.fileExists('/wordpress/hello.txt')).toBe(
				true
			);
			await playground.mkdir('/tools/example');
			expect(await playground.isDir('/tools/example')).toBe(true);

			const response = await playground.request({
				method: 'POST',
				url: '/echo',
				body: 'request body',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('request body');

			const runResponse = await playground.run({
				code: '<?php echo "native run";',
			});
			expect(runResponse.text).toBe('native run');
			await playground.writeFile(
				'/wordpress/file-run.php',
				'<?php echo "file run";'
			);
			expect(
				(
					await playground.run({
						scriptPath: '/wordpress/file-run.php',
					})
				).text
			).toBe('file run');
			await expect(
				playground.run({ scriptPath: '/wordpress/missing.php' })
			).rejects.toThrow('does not exist');

			const cliResponse = await (playground as any).cli([
				'php',
				'php',
				'-v',
			]);
			expect(await cliResponse.stdoutText).toBe('native php');
			const phpArgs = JSON.parse(
				await readFile(fixture.argumentsPath, 'utf8')
			) as string[];
			expect(phpArgs.slice(phpArgs.indexOf('--'))).toEqual([
				'--',
				'php',
				'-v',
			]);
		} finally {
			await fixture.cleanup();
		}
	});

	test('uses the native mount table for start-managed WordPress storage', async () => {
		const fixture = await createNativeHostFixture();
		process.env[nativeBinaryEnvironmentVariable] = fixture.binary;

		try {
			await using server = await runCLI({
				command: 'start',
				port: 0,
				autoMount: false,
				skipBrowser: true,
				verbosity: 'quiet',
			});
			await server.playground.writeFile(
				'/wordpress/managed.txt',
				'managed'
			);
			expect(
				await server.playground.readFileAsText('/wordpress/managed.txt')
			).toBe('managed');

			const args = JSON.parse(
				await readFile(fixture.argumentsPath, 'utf8')
			);
			expect(hasMount(args, '/wordpress')).toBe(false);
		} finally {
			await fixture.cleanup();
		}
	});

	test('serializes programmatic options and rejects Node-only options', async () => {
		const fixture = await createNativeHostFixture();
		process.env[nativeBinaryEnvironmentVariable] = fixture.binary;
		const customMount = join(fixture.root, 'custom');
		await writeFile(customMount, 'mounted file');

		try {
			await using server = await runCLI({
				command: 'server',
				port: 0,
				define: { STRING_VALUE: 'hello' },
				'define-bool': { BOOL_VALUE: true },
				'define-number': { NUMBER_VALUE: 42 },
				'mount-before-install': [
					{ hostPath: customMount, vfsPath: '/custom.txt' },
				],
				verbosity: 'quiet',
			});
			const args = JSON.parse(
				await readFile(fixture.argumentsPath, 'utf8')
			);

			expect(args).toContain('--define');
			expect(args).toContain('STRING_VALUE');
			expect(args).toContain('--define-bool');
			expect(args).toContain('--define-number');
			expect(hasMount(args, '/custom.txt')).toBe(true);
			expect(await server.playground.readFileAsText('/custom.txt')).toBe(
				'mounted file'
			);

			await expect(
				runCLI({
					command: 'server',
					pathAliases: [
						{ urlPrefix: '/alias', fsPath: '/tools/alias' },
					],
				})
			).rejects.toThrow('pathAliases');
		} finally {
			await fixture.cleanup();
		}
	});
});

async function createNativeHostFixture() {
	const root = await mkdtemp(join(tmpdir(), 'playground-native-run-cli-'));
	const binary = join(root, 'wp-playground-native');
	const argumentsPath = join(root, 'arguments.json');
	process.env[fixtureArgumentsEnvironmentVariable] = argumentsPath;
	await writeFile(
		binary,
		`#!/usr/bin/env node
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const args = process.argv.slice(2);
const command = args[0];
const output = process.env.PLAYGROUND_NATIVE_TEST_ARGUMENTS;
if (output) {
  fs.writeFileSync(output, JSON.stringify(args));
}
if (command === 'php') {
  process.stdout.write('native php');
  process.exit(0);
}

const mounts = [];
for (let index = 1; index < args.length; index++) {
  if (args[index] === '--mount-dir-before-install' || args[index] === '--mount-dir') {
    mounts.push({ hostPath: args[index + 1], vfsPath: args[index + 2] });
    index += 2;
  }
}
if (command === 'start' && !mounts.some((mount) => mount.vfsPath === '/wordpress')) {
  const managed = path.join(path.dirname(process.env.WP_PLAYGROUND_NATIVE_READY_FILE), 'managed-wordpress');
  fs.mkdirSync(managed, { recursive: true });
  mounts.push({ hostPath: managed, vfsPath: '/wordpress' });
}
const requestedPort = Number((args.find((arg) => arg.startsWith('--port=')) || '--port=0').slice(7));
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/echo') {
      response.end(JSON.stringify({ method: request.method, body: Buffer.concat(chunks).toString() }));
      return;
    }
    const wordpress = mounts.find((mount) => mount.vfsPath === '/wordpress');
    const file = wordpress && path.join(wordpress.hostPath, url.pathname.replace(/^\\//, ''));
    if (file && fs.existsSync(file)) {
      const source = fs.readFileSync(file, 'utf8');
      const echo = source.match(/echo\\s+['"]([^'"]*)['"]/);
      response.end(echo ? echo[1] : source);
      return;
    }
    response.statusCode = 404;
    response.end('not found');
  });
});
server.listen(requestedPort, '127.0.0.1', () => {
  const address = server.address();
  const serverUrl = 'http://127.0.0.1:' + address.port;
  fs.writeFileSync(process.env.WP_PLAYGROUND_NATIVE_READY_FILE, JSON.stringify({
    protocolVersion: 2,
    serverUrl,
    siteUrl: (args.find((arg) => arg.startsWith('--site-url=')) || '').slice(11) || serverUrl,
    pid: process.pid,
    mounts,
  }));
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
`
	);
	await chmod(binary, 0o755);

	return {
		root,
		binary,
		argumentsPath,
		cleanup: async () => {
			await rm(root, { recursive: true, force: true });
		},
	};
}

function hasMount(args: string[], vfsPath: string): boolean {
	for (let index = 0; index < args.length; index++) {
		if (
			(args[index] === '--mount-dir-before-install' ||
				args[index] === '--mount-dir') &&
			args[index + 2] === vfsPath
		) {
			return true;
		}
	}
	return false;
}
