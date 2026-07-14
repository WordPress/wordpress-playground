import {
	access,
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
	internalsKeyForTesting,
	runCLI,
	type WasmtimeRunCLIArgs,
} from '../src';
import type { RunCLIArgs as LegacyRunCLIArgs } from '../src/run-cli';
import { wasmtimeBinaryEnvironmentVariable } from '../src/wasmtime-binary';
import { isErrorWithCode } from '../src/wasmtime-run-cli';

const wasmtimeDescribe =
	process.platform === 'win32' ? describe.skip : describe;
const fixtureArgumentsEnvironmentVariable =
	'PLAYGROUND_WASMTIME_TEST_ARGUMENTS';

test('recognizes filesystem errors created in another VM context', () => {
	const error = runInNewContext(
		`Object.assign(new Error('missing'), { code: 'ENOENT' })`
	);

	expect(error).not.toBeInstanceOf(Error);
	expect(isErrorWithCode(error, 'ENOENT')).toBe(true);
	expect(isErrorWithCode(error, 'EACCES')).toBe(false);
});

test('publishes PHP 8.2 as the Wasmtime programmatic option', () => {
	const args = {
		command: 'server',
		php: '8.2',
		blueprint: './blueprint.json',
	} satisfies WasmtimeRunCLIArgs;
	expect(args.php).toBe('8.2');
});

wasmtimeDescribe('Wasmtime runCLI()', () => {
	let previousBinary: string | undefined;
	let previousFixtureArguments: string | undefined;

	beforeEach(() => {
		previousBinary = process.env[wasmtimeBinaryEnvironmentVariable];
		previousFixtureArguments =
			process.env[fixtureArgumentsEnvironmentVariable];
	});

	afterEach(() => {
		if (previousBinary === undefined) {
			delete process.env[wasmtimeBinaryEnvironmentVariable];
		} else {
			process.env[wasmtimeBinaryEnvironmentVariable] = previousBinary;
		}
		if (previousFixtureArguments === undefined) {
			delete process.env[fixtureArgumentsEnvironmentVariable];
		} else {
			process.env[fixtureArgumentsEnvironmentVariable] =
				previousFixtureArguments;
		}
	});

	test('returns a Wasmtime-backed HTTP, VFS, and server facade', async () => {
		const fixture = await createWasmtimeHostFixture();
		process.env[wasmtimeBinaryEnvironmentVariable] = fixture.binary;

		try {
			await using server = await runCLI({
				command: 'server',
				port: 0,
				'site-url': 'https://wordpress.example.test/subdirectory',
				verbosity: 'quiet',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
			});
			const playground = server.playground;

			expect(server.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
			expect(await playground.absoluteUrl).toBe(
				'https://wordpress.example.test/subdirectory'
			);
			expect(
				server[internalsKeyForTesting].workerThreadCount
			).toBeGreaterThan(0);

			await playground.writeFile(
				'/wordpress/hello.txt',
				'hello wasmtime'
			);
			expect(
				await playground.readFileAsText('/wordpress/hello.txt')
			).toBe('hello wasmtime');
			expect(await playground.fileExists('/wordpress/hello.txt')).toBe(
				true
			);
			await playground.unlink('/wordpress/hello.txt');
			expect(await playground.fileExists('/wordpress/hello.txt')).toBe(
				false
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
			const streamedResponse = await playground.requestStreamed({
				method: 'POST',
				url: '/echo',
				body: 'streamed request body',
			});
			expect(await streamedResponse.httpStatusCode).toBe(200);
			expect(await streamedResponse.stdoutText).toContain(
				'streamed request body'
			);

			const runResponse = await playground.run({
				code: '<?php echo "wasmtime run";',
			});
			expect(runResponse.text).toBe('wasmtime run');
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
			await playground.writeFile(
				'/wordpress/file#encoded.php',
				'<?php echo "encoded file run";'
			);
			expect(
				(
					await playground.run({
						scriptPath: '/wordpress/file#encoded.php',
					})
				).text
			).toBe('encoded file run');

			await playground.writeFile('/wordpress/link-target.txt', 'target');
			await playground.symlink(
				'/wordpress/link-target.txt',
				'/wordpress/link.txt'
			);
			expect(await playground.readlink('/wordpress/link.txt')).toBe(
				'/wordpress/link-target.txt'
			);
			expect(await playground.readFileAsText('/wordpress/link.txt')).toBe(
				'target'
			);
			await expect(
				playground.run({ scriptPath: '/wordpress/missing.php' })
			).rejects.toThrow('does not exist');

			await expect(playground.cli(['php', '-v'])).rejects.toThrow(
				'does not expose a CLI-session ABI'
			);
			const serverArgs = JSON.parse(
				await readFile(fixture.argumentsPath, 'utf8')
			) as string[];
			expect(serverArgs.some((arg) => arg.startsWith('--php='))).toBe(
				false
			);
		} finally {
			await fixture.cleanup();
		}
	});

	test('supports a VFS root mount in the filesystem facade', async () => {
		const fixture = await createWasmtimeHostFixture();
		process.env[wasmtimeBinaryEnvironmentVariable] = fixture.binary;
		const rootMount = join(fixture.root, 'vfs-root');
		await mkdir(rootMount);
		await writeFile(join(rootMount, 'root-file.txt'), 'root mount');

		try {
			await using server = await runCLI({
				command: 'server',
				port: 0,
				'mount-before-install': [{ hostPath: rootMount, vfsPath: '/' }],
				verbosity: 'quiet',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
			});

			expect(
				await server.playground.readFileAsText('/root-file.txt')
			).toBe('root mount');
			expect(await server.playground.listFiles('/')).toContain(
				'root-file.txt'
			);
			expect(
				await server.playground.listFiles('/', { prependPath: true })
			).toContain('/root-file.txt');
		} finally {
			await fixture.cleanup();
		}
	});

	test('uses the Wasmtime mount table for start-managed WordPress storage', async () => {
		const fixture = await createWasmtimeHostFixture();
		process.env[wasmtimeBinaryEnvironmentVariable] = fixture.binary;

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

	test('awaits invocation cleanup when child close races disposal', async () => {
		const fixture = await createWasmtimeHostFixture();
		process.env[wasmtimeBinaryEnvironmentVariable] = fixture.binary;

		try {
			const server = await runCLI({
				command: 'server',
				port: 0,
				verbosity: 'quiet',
			});
			await server.playground.mkdirTree('/tmp/cleanup-race');
			await Promise.all(
				Array.from({ length: 128 }, (_, index) =>
					server.playground.writeFile(
						`/tmp/cleanup-race/${index}.txt`,
						'x'.repeat(1024)
					)
				)
			);

			const args = JSON.parse(
				await readFile(fixture.argumentsPath, 'utf8')
			) as string[];
			const tmpMount = mountHostPath(args, '/tmp');
			const invocationRoot = dirname(dirname(tmpMount));

			await Promise.all([
				server[Symbol.asyncDispose](),
				server[Symbol.asyncDispose](),
			]);
			await expect(access(invocationRoot)).rejects.toMatchObject({
				code: 'ENOENT',
			});
		} finally {
			await fixture.cleanup();
		}
	});

	test('serializes programmatic options and rejects Node-only options', async () => {
		const fixture = await createWasmtimeHostFixture();
		process.env[wasmtimeBinaryEnvironmentVariable] = fixture.binary;
		const customMount = join(fixture.root, 'custom');
		await writeFile(customMount, 'mounted file');

		try {
			await using server = await runCLI({
				command: 'server',
				php: '8.2',
				autoMount: true,
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
			expect(args).toContain('--php=8.2');
			expect(args).toContain('--auto-mount');
			expect(args).not.toContain('--no-intl');
			expect(args).not.toContain('--redis');
			expect(args).not.toContain('--memcached');
			expect(args).not.toContain('--xdebug');
			expect(args).toContain('STRING_VALUE');
			expect(args).toContain('--define-bool');
			expect(args).toContain('--define-number');
			expect(hasMount(args, '/custom.txt')).toBe(true);
			expect(await server.playground.readFileAsText('/custom.txt')).toBe(
				'mounted file'
			);

			await expect(
				(
					runCLI as unknown as (
						args: LegacyRunCLIArgs
					) => Promise<unknown>
				)({
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

	test('rejects unsupported PHP versions, extensions, and the php command', async () => {
		await expect(
			(runCLI as unknown as (args: LegacyRunCLIArgs) => Promise<unknown>)(
				{
					command: 'server',
					php: '8.1',
				}
			)
		).rejects.toThrow('only supports PHP 8.2');

		const unsupportedOptions: Array<[string, Partial<LegacyRunCLIArgs>]> = [
			['phpExtension', { phpExtension: ['custom.so'] }],
			['intl', { intl: true }],
			['redis', { redis: true }],
			['memcached', { memcached: true }],
			['xdebug', { xdebug: true }],
			[
				'hasExplicitBlueprintsV2Mode',
				{ hasExplicitBlueprintsV2Mode: true },
			],
			[
				'defaultedDebugConstants',
				{ defaultedDebugConstants: ['WP_DEBUG'] },
			],
		];
		for (const [name, option] of unsupportedOptions) {
			await expect(
				(
					runCLI as unknown as (
						args: LegacyRunCLIArgs
					) => Promise<unknown>
				)({
					command: 'server',
					...option,
				})
			).rejects.toThrow(name);
		}

		await expect(
			(runCLI as unknown as (args: LegacyRunCLIArgs) => Promise<unknown>)(
				{
					command: 'php',
				}
			)
		).rejects.toThrow('does not expose a standalone php command');
	});

	test('rejects host filesystem access through escaping symlinks', async () => {
		const fixture = await createWasmtimeHostFixture();
		process.env[wasmtimeBinaryEnvironmentVariable] = fixture.binary;
		const wordpress = join(fixture.root, 'wordpress');
		const outside = join(fixture.root, 'outside');
		await mkdir(wordpress);
		await mkdir(outside);
		await writeFile(join(outside, 'secret.txt'), 'outside');
		await symlink(outside, join(wordpress, 'escape'));
		await symlink(
			join(outside, 'created.txt'),
			join(wordpress, 'dangling')
		);

		try {
			await using server = await runCLI({
				command: 'server',
				port: 0,
				'mount-before-install': [
					{ hostPath: wordpress, vfsPath: '/wordpress' },
				],
				verbosity: 'quiet',
			});

			await expect(
				server.playground.readFileAsText('/wordpress/escape/secret.txt')
			).rejects.toThrow('escapes its mount through a symlink');
			await expect(
				server.playground.writeFile(
					'/wordpress/dangling',
					'created outside'
				)
			).rejects.toThrow('unresolved symlink');
			expect(await readFile(join(outside, 'secret.txt'), 'utf8')).toBe(
				'outside'
			);
			await expect(
				readFile(join(outside, 'created.txt'), 'utf8')
			).rejects.toMatchObject({ code: 'ENOENT' });

			await server.playground.unlink('/wordpress/escape');
			expect(
				await server.playground.fileExists('/wordpress/escape')
			).toBe(false);
		} finally {
			await fixture.cleanup();
		}
	});
});

async function createWasmtimeHostFixture() {
	const root = await mkdtemp(join(tmpdir(), 'playground-wasmtime-run-cli-'));
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
const output = process.env.PLAYGROUND_WASMTIME_TEST_ARGUMENTS;
if (output) {
  fs.writeFileSync(output, JSON.stringify(args));
}
const mounts = [];
for (let index = 1; index < args.length; index++) {
  if (args[index] === '--mount-dir-before-install' || args[index] === '--mount-dir') {
    mounts.push({ hostPath: args[index + 1], vfsPath: args[index + 2] });
    index += 2;
  }
}
if (command === 'start' && !mounts.some((mount) => mount.vfsPath === '/wordpress')) {
  const managed = path.join(path.dirname(process.env.WP_PLAYGROUND_WASMTIME_READY_FILE), 'managed-wordpress');
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
    const requestPath = decodeURIComponent(url.pathname);
    const file = wordpress && path.join(wordpress.hostPath, requestPath.replace(/^\\//, ''));
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
  fs.writeFileSync(process.env.WP_PLAYGROUND_WASMTIME_READY_FILE, JSON.stringify({
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
	return mountHostPath(args, vfsPath, false) !== undefined;
}

function mountHostPath(
	args: string[],
	vfsPath: string,
	required?: true
): string;
function mountHostPath(
	args: string[],
	vfsPath: string,
	required: false
): string | undefined;
function mountHostPath(
	args: string[],
	vfsPath: string,
	required = true
): string | undefined {
	for (let index = 0; index < args.length; index++) {
		if (
			(args[index] === '--mount-dir-before-install' ||
				args[index] === '--mount-dir') &&
			args[index + 2] === vfsPath
		) {
			return args[index + 1];
		}
	}
	if (required) {
		throw new Error(`Missing Wasmtime test mount for ${vfsPath}`);
	}
	return undefined;
}
