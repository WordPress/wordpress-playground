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
import { readWasm } from '../../src/posix-kernel/host-bridge';
import { KernelLimitedPHPApi } from '../../src/posix-kernel/php-api';
import { prepareWordPressForPosixKernel } from '../../src/posix-kernel/prepare-wordpress';
import {
	createPosixKernelTempDir,
	type PosixKernelTempDir,
} from '../../src/posix-kernel/temp-dir';
import { findFreePort } from './free-port';

describe('--experimental-posix-kernel KernelLimitedPHPApi.run stdout capture', () => {
	let tempDir: PosixKernelTempDir;
	let booted: PosixKernelBootResult;
	let api: KernelLimitedPHPApi;

	beforeAll(async () => {
		tempDir = await createPosixKernelTempDir();
		const wordPressRootHostPath = join(tempDir.hostPath, 'wordpress');
		await prepareWordPressForPosixKernel({
			wordPressRoot: wordPressRootHostPath,
			wpVersionQuery: 'latest',
		});
		booted = await bootPosixKernelWordPress({
			port: await findFreePort(),
			wordPressRootHostPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
		});
		api = new KernelLimitedPHPApi({
			serverUrl: booted.serverUrl,
			wordPressRootHostPath,
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
		await api.writeFile('/tmp/foo/bar.txt', 'baz');
		const response = await api.run({
			code: `<?php echo file_get_contents('/tmp/foo/bar.txt');`,
		});
		expect(response.text).toBe('baz');
	}, 60_000);

	it('reads a /tmp file that in-kernel PHP wrote', async () => {
		await api.run({
			code: `<?php file_put_contents('/tmp/qux.txt', 'quux');`,
		});
		expect(await api.readFileAsText('/tmp/qux.txt')).toBe('quux');
		expect(await api.fileExists('/tmp/qux.txt')).toBe(true);
		expect(await api.isDir('/tmp/qux.txt')).toBe(false);
	}, 60_000);

	it('moves, lists, and deletes kernel files', async () => {
		await api.mkdir('/tmp/corge/grault');
		await api.writeFile('/tmp/corge/grault/garply.txt', 'waldo');
		await api.mv('/tmp/corge/grault/garply.txt', '/tmp/corge/fred.txt');
		expect(await api.listFiles('/tmp/corge')).toEqual(
			expect.arrayContaining(['grault', 'fred.txt'])
		);
		await api.unlink('/tmp/corge/fred.txt');
		await api.rmdir('/tmp/corge');
		expect(await api.fileExists('/tmp/corge')).toBe(false);
	}, 60_000);

	it('moves a kernel file into the WordPress root', async () => {
		await api.writeFile('/tmp/plugh.txt', 'xyzzy');
		await api.mv('/tmp/plugh.txt', '/wordpress/plugh.txt');
		expect(await api.readFileAsText('/wordpress/plugh.txt')).toBe('xyzzy');
		expect(await api.fileExists('/tmp/plugh.txt')).toBe(false);
	}, 60_000);

	it('resolves scriptPath against the kernel-side doc root', async () => {
		await api.writeFile(
			'/wordpress/script-path-probe.php',
			`<?php echo "SCRIPTPATH_OK";`
		);
		const response = await api.run({
			scriptPath: '/wordpress/script-path-probe.php',
		});
		expect(response.text).toBe('SCRIPTPATH_OK');
	}, 60_000);

	it('keeps output of other kernel processes out of run()', async () => {
		const background = booted.runtime.kernelHost.spawn(
			readWasm(booted.runtime.phpWasmPath),
			[
				'php',
				'-r',
				'for ($i = 0; $i < 20; $i++) { fwrite(STDERR, "NOISE\\n"); usleep(50000); }',
			]
		);
		const response = await api.run({
			code: '<?php usleep(500000); fwrite(STDERR, "foo"); echo "bar";',
		});
		await background;
		expect(response.text).toBe('bar');
		expect(response.errors).toBe('foo');
	}, 60_000);

	it('keeps the file name and type of an uploaded File', async () => {
		await api.writeFile(
			'/wordpress/upload-probe.php',
			`<?php echo json_encode([$_FILES['foo']['name'], $_FILES['foo']['type']]);`
		);
		const response = await api.request({
			method: 'POST',
			url: '/upload-probe.php',
			body: { foo: new File(['bar'], 'baz.txt', { type: 'text/plain' }) },
		});
		expect(response.json).toEqual(['baz.txt', 'text/plain']);
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
			phpWasmPath: fakeWasmPath,
			runtime,
		});
	});

	afterEach(() => {
		rmSync(tempDirHostPath, { recursive: true, force: true });
	});

	describe('host-backed WordPress root', () => {
		it('writes /wordpress/foo.txt into the host root', async () => {
			await api.writeFile('/wordpress/foo.txt', 'hi');
			expect(readFileSync(join(hostRoot, 'foo.txt'), 'utf8')).toBe('hi');
		});

		it('creates nested directories via mkdir', async () => {
			await api.mkdir('/wordpress/wp-content/uploads/deep');
			expect(await api.isDir('/wordpress/wp-content/uploads/deep')).toBe(
				true
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
		it('prepends the defined constants to the code', async () => {
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
				phpWasmPath: fakeWasmPath,
				runtime,
			});
			await second.run({ code: '<?php echo 1;' });
			const argv = runtime.spawnCapturing.mock.calls[0][0]
				.argv as string[];
			expect(argv[argv.length - 1]).toContain("define('SHARED', 'one')");
		});
	});

	describe('run() arguments', () => {
		it('throws when neither code nor scriptPath is provided', async () => {
			await expect(api.run({} as any)).rejects.toThrow(
				/`code` or `scriptPath`/
			);
		});
	});
});
