import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

import { bootPosixKernelWordPress } from '../../src/posix-kernel/boot';
import type {
	KernelRuntime,
	PosixKernelBootResult,
} from '../../src/posix-kernel/boot';
import { KernelLimitedPHPApi } from '../../src/posix-kernel/php-api';
import { prepareWordPressForPosixKernel } from '../../src/posix-kernel/prepare-wordpress';
import {
	createPosixKernelTempDir,
	type PosixKernelTempDir,
} from '../../src/posix-kernel/temp-dir';

const TEST_PORT = 49152 + (process.pid % 16384);

describe('--experimental-posix-kernel KernelLimitedPHPApi.run stdout capture', () => {
	let tempDir: PosixKernelTempDir;
	let booted: PosixKernelBootResult;
	let api: KernelLimitedPHPApi;

	beforeAll(async () => {
		tempDir = await createPosixKernelTempDir();
		const wordPressRootHostPath = join(tempDir.hostPath, 'wordpress');
		const wordPressRootKernelPath = `${tempDir.kernelPath}/wordpress`;
		await prepareWordPressForPosixKernel({
			wordPressRoot: wordPressRootHostPath,
			wpVersionQuery: 'latest',
		});
		booted = await bootPosixKernelWordPress({
			port: TEST_PORT,
			wordPressRootHostPath,
			wordPressRootKernelPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
		});
		api = new KernelLimitedPHPApi({
			serverUrl: booted.serverUrl,
			wordPressRootHostPath,
			wordPressRootKernelPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
			phpWasmPath: booted.runtime.phpWasmPath,
			runtime: booted.runtime,
		});
	}, 300_000);

	afterAll(async () => {
		await booted?.[Symbol.asyncDispose]?.();
		await tempDir?.cleanup?.();
	});

	it('preserves stdout across many sequential runs (no cross-pid leak)', async () => {
		for (let i = 0; i < 10; i++) {
			const marker = `SEQ_${i}`;
			const response = await api.run({
				code: `<?php echo "${marker}";`,
			});
			expect(response.text).toBe(marker);
		}
	}, 120_000);

	it('preserves stdout when many spawns race in parallel', async () => {
		const markers = Array.from({ length: 8 }, (_, i) => `PAR_${i}`);
		const results = await Promise.all(
			markers.map((marker) =>
				api.run({ code: `<?php echo "${marker}";` })
			)
		);
		for (let i = 0; i < markers.length; i++) {
			expect(results[i].text).toBe(markers[i]);
		}
	}, 120_000);

	it('lets in-kernel PHP read a /tmp file staged through writeFile', async () => {
		api.writeFile('/tmp/staged-probe.txt', 'STAGED_OK');
		const response = await api.run({
			code: `<?php echo file_get_contents('/tmp/staged-probe.txt');`,
		});
		expect(response.text).toBe('STAGED_OK');
	}, 60_000);

	it('resolves scriptPath against the kernel-side doc root', async () => {
		api.writeFile(
			'/wordpress/script-path-probe.php',
			`<?php echo "SCRIPTPATH_OK";`
		);
		const response = await api.run({
			scriptPath: '/wordpress/script-path-probe.php',
		});
		expect(response.text).toBe('SCRIPTPATH_OK');
	}, 60_000);
});

function makeStubRuntime(): KernelRuntime & {
	spawnCapturing: ReturnType<typeof vi.fn>;
} {
	const spawnCapturing = vi.fn(async () => ({
		exitCode: 0,
		stdout: new Uint8Array(),
		stderr: new Uint8Array(),
	}));
	return {
		kernelHost: {} as any,
		phpWasmPath: '/unused-by-stub.wasm',
		spawnCapturing,
	};
}

describe('KernelLimitedPHPApi (unit)', () => {
	let tempDirHostPath: string;
	let hostRoot: string;
	let fakeWasmPath: string;
	let api: KernelLimitedPHPApi;
	let runtime: ReturnType<typeof makeStubRuntime>;

	const tempDirKernelPath = '/tmp/kernel-doc';

	beforeEach(() => {
		tempDirHostPath = mkdtempSync(join(tmpdir(), 'kernel-php-api-unit-'));
		hostRoot = join(tempDirHostPath, 'wordpress');
		mkdirSync(hostRoot, { recursive: true });
		fakeWasmPath = join(tempDirHostPath, 'fake.wasm');
		writeFileSync(fakeWasmPath, new Uint8Array([0x00, 0x61, 0x73, 0x6d]));
		runtime = makeStubRuntime();
		api = new KernelLimitedPHPApi({
			serverUrl: 'http://127.0.0.1:0',
			wordPressRootHostPath: hostRoot,
			wordPressRootKernelPath: `${tempDirKernelPath}/wordpress`,
			tempDirHostPath,
			tempDirKernelPath,
			phpWasmPath: fakeWasmPath,
			runtime,
		});
	});

	afterEach(() => {
		rmSync(tempDirHostPath, { recursive: true, force: true });
	});

	describe('path translation', () => {
		it('writes /wordpress/foo.txt into the host root', () => {
			api.writeFile('/wordpress/foo.txt', 'hi');
			expect(readFileSync(join(hostRoot, 'foo.txt'), 'utf8')).toBe('hi');
		});

		it('creates nested directories via mkdir', () => {
			api.mkdir('/wordpress/wp-content/uploads/deep');
			expect(api.isDir('/wordpress/wp-content/uploads/deep')).toBe(true);
		});

		it('reads back a file written under the documentRoot prefix', () => {
			writeFileSync(join(hostRoot, 'bar.txt'), 'bar');
			expect(
				api.readFileAsText(`${tempDirKernelPath}/wordpress/bar.txt`)
			).toBe('bar');
		});

		it('passes a native Windows host path through untranslated', async () => {
			await api.run({ scriptPath: 'C:\\sites\\probe.php' });
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toBe('C:\\sites\\probe.php');
		});

		it('writes /tmp/foo.zip into the kernel-visible scratch dir', () => {
			api.writeFile('/tmp/foo.zip', 'zip');
			expect(
				readFileSync(
					join(tempDirHostPath, 'vfs-tmp', 'foo.zip'),
					'utf8'
				)
			).toBe('zip');
		});

		it('resolves the bare /tmp root to the scratch dir', () => {
			expect(api.isDir('/tmp')).toBe(true);
			expect(api.listFiles('/tmp')).toEqual([]);
		});

		it('reads back a /tmp file the host wrote to the scratch dir', () => {
			writeFileSync(join(tempDirHostPath, 'vfs-tmp', 'baz.txt'), 'baz');
			expect(api.readFileAsText('/tmp/baz.txt')).toBe('baz');
		});

		it('leaves an already-kernel script path alone', async () => {
			const scriptPath = `${tempDirKernelPath}/wordpress/run-cli.php`;
			await api.run({ scriptPath });
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toBe(scriptPath);
		});

		it('resolves a /tmp script path to the same place writeFile used', async () => {
			api.writeFile('/tmp/probe.php', '<?php');
			await api.run({ scriptPath: '/tmp/probe.php' });
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toBe(
				`${tempDirKernelPath}/vfs-tmp/probe.php`
			);
		});
	});

	describe('run() failure semantics', () => {
		it('throws on a non-zero exit code, mirroring PHP.run()', async () => {
			runtime.spawnCapturing.mockResolvedValueOnce({
				exitCode: 255,
				stdout: new Uint8Array(),
				stderr: new TextEncoder().encode('Fatal error: boom'),
			});
			await expect(api.run({ code: '<?php exit(255);' })).rejects.toThrow(
				/exit code 255[\s\S]*Fatal error: boom/
			);
		});
	});

	describe('defineConstant + run({code})', () => {
		it('prepends defines and rewrites /wordpress references', async () => {
			api.defineConstant('MY_STRING', "it's me");
			api.defineConstant('MY_BOOL', true);
			api.defineConstant('MY_NULL', null);
			api.defineConstant('MY_NUMBER', 42);

			await api.run({ code: "<?php echo '/wordpress/foo';" });

			expect(runtime.spawnCapturing).toHaveBeenCalledTimes(1);
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			const code = argv[argv.length - 1];
			expect(code).toContain("define('MY_STRING', 'it\\'s me')");
			expect(code).toContain("define('MY_BOOL', true)");
			expect(code).toContain("define('MY_NULL', null)");
			expect(code).toContain("define('MY_NUMBER', 42)");
			expect(code).toContain("echo '/tmp/kernel-doc/wordpress/foo'");
			expect(code).not.toContain("'/wordpress/foo'");
		});

		it('rewrites /tmp references to the kernel-visible scratch dir', async () => {
			await api.run({ code: "<?php echo '/tmp/file.zip';" });

			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			const code = argv[argv.length - 1];
			expect(code).toContain(
				`echo '${tempDirKernelPath}/vfs-tmp/file.zip'`
			);
			expect(code).not.toContain("'/tmp/file.zip'");
		});

		it('leaves an already-kernel path under the mount root alone', async () => {
			const kernelPath = `${tempDirKernelPath}/wordpress/x.php`;
			await api.run({ code: `<?php echo '${kernelPath}';` });

			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toContain(`echo '${kernelPath}'`);
		});

		it('rewrites /tmp references passed through env', async () => {
			await api.run({
				code: '<?php echo 1;',
				env: { PLAYGROUND_UNZIP_ZIP_PATH: '/tmp/file.zip' },
			});

			const env = runtime.spawnCapturing.mock.calls[0][0].options
				.env as string[];
			expect(env).toContain(
				`PLAYGROUND_UNZIP_ZIP_PATH=${tempDirKernelPath}/vfs-tmp/file.zip`
			);
		});

		it('rejects non-finite numbers when serializing constants', async () => {
			api.defineConstant('BAD', Number.POSITIVE_INFINITY);
			await expect(api.run({ code: '<?php echo 1;' })).rejects.toThrow(
				/non-finite/
			);
		});

		it('persists constants across CLI restarts via the defines store', async () => {
			api.defineConstant('SHARED', 'one');
			const second = new KernelLimitedPHPApi({
				serverUrl: 'http://127.0.0.1:0',
				wordPressRootHostPath: hostRoot,
				wordPressRootKernelPath: `${tempDirKernelPath}/wordpress`,
				tempDirHostPath,
				tempDirKernelPath,
				phpWasmPath: fakeWasmPath,
				runtime,
			});
			await second.run({ code: '<?php echo 1;' });
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toContain("define('SHARED', 'one')");
		});
	});

	describe('run({scriptPath})', () => {
		it('translates a /wordpress script path to the kernel-side doc root', async () => {
			await api.run({ scriptPath: '/wordpress/script.php' });
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toBe(
				'/tmp/kernel-doc/wordpress/script.php'
			);
		});

		it('throws when neither code nor scriptPath is provided', async () => {
			await expect(api.run({} as any)).rejects.toThrow(
				/`code` or `scriptPath`/
			);
		});
	});
});
