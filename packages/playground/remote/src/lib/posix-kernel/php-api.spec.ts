import { describe, expect, it, vi } from 'vitest';
import { CookieJar } from './cookie-jar';
import { KernelLimitedPHPApi } from './php-api';
import type { KernelSpawnAdapter } from './kernel-spawn-adapter';

function makeApi(
	adapter: Partial<Record<keyof KernelSpawnAdapter, unknown>>,
	sendRequest: ReturnType<typeof vi.fn> = vi.fn()
): KernelLimitedPHPApi {
	return new KernelLimitedPHPApi({
		absoluteUrl: 'http://127.0.0.1:0/scope:foo/',
		adapter: adapter as unknown as KernelSpawnAdapter,
		sendRequest,
		cookieJar: new CookieJar(),
	});
}

function makeRunPhpCli(): ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue({
		exitCode: 0,
		stdout: new Uint8Array(),
		stderr: new Uint8Array(),
	});
}

async function runCode(code: string): Promise<string> {
	const runPhpCli = makeRunPhpCli();
	await makeApi({ runPhpCli }).run({ code });
	return runPhpCli.mock.calls[0][0].argv.at(-1);
}

function makeBridgeResponse(headers: Record<string, string> = {}) {
	return { status: 200, headers, body: new Uint8Array() };
}

describe('KernelLimitedPHPApi.run failure semantics', () => {
	it('throws on a non-zero exit code, mirroring PHP.run()', async () => {
		const runPhpCli = vi.fn().mockResolvedValue({
			exitCode: 255,
			stdout: new Uint8Array(),
			stderr: new TextEncoder().encode('Fatal error: boom'),
		});
		const api = makeApi({ runPhpCli });
		await expect(api.run({ code: '<?php exit(255);' })).rejects.toThrow(
			/exit code 255[\s\S]*Fatal error: boom/
		);
	});

	it('returns the response on a zero exit code', async () => {
		const runPhpCli = vi.fn().mockResolvedValue({
			exitCode: 0,
			stdout: new TextEncoder().encode('ok'),
			stderr: new Uint8Array(),
		});
		const api = makeApi({ runPhpCli });
		const response = await api.run({ code: '<?php echo "ok";' });
		expect(response.text).toBe('ok');
		expect(response.exitCode).toBe(0);
	});
});

describe('KernelLimitedPHPApi.runStream failure semantics', () => {
	it('reports a non-zero exit code instead of throwing, mirroring PHP.runStream()', async () => {
		const runPhpCli = vi.fn().mockResolvedValue({
			exitCode: 1,
			stdout: new TextEncoder().encode('partial output'),
			stderr: new TextEncoder().encode('Warning: skipped'),
		});
		const api = makeApi({ runPhpCli });
		const response = await api.runStream({ code: '<?php exit(1);' });
		expect(await response.exitCode).toBe(1);
		expect(await response.stdoutText).toBe('partial output');
		expect(await response.stderrText).toBe('Warning: skipped');
	});
});

describe('KernelLimitedPHPApi path translation', () => {
	it.each([
		['/wordpress', '/var/www/html'],
		['/wordpress/wp-config.php', '/var/www/html/wp-config.php'],
		['/wordpressfoo', '/wordpressfoo'],
		['/var/www/html/foo', '/var/www/html/foo'],
	])('maps %s to %s for fileExists', async (path, expected) => {
		const fileExists = vi.fn().mockResolvedValue(true);
		await makeApi({ fileExists }).fileExists(path);
		expect(fileExists).toHaveBeenCalledWith(expected);
	});

	it('maps the target and its parent directory for writeFile', async () => {
		const mkdir = vi.fn().mockResolvedValue(undefined);
		const writeFile = vi.fn().mockResolvedValue(undefined);
		await makeApi({ mkdir, writeFile }).writeFile(
			'/wordpress/foo/bar.txt',
			'baz'
		);
		expect([mkdir.mock.calls, writeFile.mock.calls]).toEqual([
			[['/var/www/html/foo']],
			[['/var/www/html/foo/bar.txt', 'baz']],
		]);
	});
});

describe('KernelLimitedPHPApi.run code translation', () => {
	it.each([
		[
			"require '/wordpress/wp-load.php';",
			"require '/var/www/html/wp-load.php';",
		],
		['echo "/wordpress";', 'echo "/var/www/html";'],
		['chdir(/wordpress);', 'chdir(/var/www/html);'],
	])('rewrites a standalone /wordpress in %s', async (code, expected) => {
		expect(await runCode(code)).toBe(expected);
	});

	it.each([
		"'/srv/wordpress/foo'",
		"'foo-/wordpress/bar'",
		"'//wordpress/foo'",
		"'/wordpressfoo'",
		"'/wordpress-foo'",
		"'/var/www/html/wordpress/foo'",
	])('leaves %s unchanged', async (code) => {
		expect(await runCode(code)).toBe(code);
	});
});

describe('KernelLimitedPHPApi.defineConstant', () => {
	async function runWithConstant(
		value: string | number | boolean | null
	): Promise<string> {
		const runPhpCli = makeRunPhpCli();
		const api = makeApi({
			runPhpCli,
			mkdir: vi.fn().mockResolvedValue(undefined),
			writeFile: vi.fn().mockResolvedValue(undefined),
		});
		await api.defineConstant('FOO', value);
		await api.run({ code: '<?php echo FOO;' });
		return runPhpCli.mock.calls[0][0].argv.at(-1);
	}

	it('prefixes the code with a guarded define', async () => {
		expect(await runWithConstant('bar')).toBe(
			"if (!defined('FOO')) { define('FOO', 'bar'); }\n echo FOO;"
		);
	});

	it('escapes quotes and backslashes in string values', async () => {
		expect(await runWithConstant("it's C:\\bar")).toContain(
			"define('FOO', 'it\\'s C:\\\\bar');"
		);
	});

	it.each([
		[true, 'true'],
		[false, 'false'],
		[null, 'null'],
		[42, '42'],
		[1.5, '1.5'],
	])('renders %s as the PHP literal %s', async (value, literal) => {
		expect(await runWithConstant(value)).toContain(
			`define('FOO', ${literal});`
		);
	});

	it('rejects run when a constant is a non-finite number', async () => {
		await expect(runWithConstant(Infinity)).rejects.toThrow(
			/non-finite number Infinity/
		);
	});
});

describe('KernelLimitedPHPApi.request', () => {
	it('strips the scope from the URL sent to the bridge', async () => {
		const sendRequest = vi.fn().mockResolvedValue(makeBridgeResponse());
		await makeApi({}, sendRequest).request({ url: '/wp-admin/' });
		expect(sendRequest.mock.calls[0][0].url).toBe(
			'http://127.0.0.1:0/wp-admin/'
		);
	});

	it('sends a stored set-cookie on the next request', async () => {
		const sendRequest = vi
			.fn()
			.mockResolvedValueOnce(
				makeBridgeResponse({ 'set-cookie': 'foo=bar; Path=/' })
			)
			.mockResolvedValueOnce(makeBridgeResponse());
		const api = makeApi({}, sendRequest);
		await api.request({ url: '/wp-login.php' });
		await api.request({ url: '/wp-admin/' });
		expect(sendRequest.mock.calls[1][0].headers.cookie).toBe('foo=bar');
	});

	it('keeps a cookie header set by the caller', async () => {
		const sendRequest = vi
			.fn()
			.mockResolvedValue(makeBridgeResponse({ 'set-cookie': 'foo=bar' }));
		const api = makeApi({}, sendRequest);
		await api.request({ url: '/' });
		await api.request({ url: '/', headers: { Cookie: 'baz=qux' } });
		expect(sendRequest.mock.calls[1][0].headers.cookie).toBe('baz=qux');
	});
});
