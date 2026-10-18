import { describe, expect, it, vi } from 'vitest';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { PHPRequestHandler } from '@php-wasm/universal';
import type { PHP } from '@php-wasm/universal';
import { KernelPlaygroundWorkerEndpoint } from './playground-worker-endpoint';

vi.hoisted(() => {
	vi.stubGlobal('self', { postMessage: () => undefined });
});

vi.mock('@php-wasm/web', () => ({
	exposeAPI: () => [() => undefined, () => undefined],
}));

function makeEndpoint(absoluteUrl: string): KernelPlaygroundWorkerEndpoint {
	const endpoint = new KernelPlaygroundWorkerEndpoint(
		new EmscriptenDownloadMonitor()
	);
	endpoint.absoluteUrl = absoluteUrl;
	return endpoint;
}

function makeHandler(absoluteUrl: string): PHPRequestHandler {
	return new PHPRequestHandler({
		absoluteUrl,
		php: { isDir: () => true, chdir: () => undefined } as unknown as PHP,
	});
}

const scoped = 'http://127.0.0.1:5400/scope:abc';

describe('KernelPlaygroundWorkerEndpoint.pathToInternalUrl', () => {
	it.each([
		[scoped, '/wp-admin/', `${scoped}/wp-admin/`],
		[`${scoped}/`, '/wp-admin/', `${scoped}/wp-admin/`],
		[scoped, 'wp-admin', `${scoped}/wp-admin`],
		[`${scoped}/`, '/', `${scoped}/`],
		[
			'http://127.0.0.1:5400',
			'/wp-admin/',
			'http://127.0.0.1:5400/wp-admin/',
		],
	])('maps %s + %s like PHPRequestHandler', async (base, path, expected) => {
		expect(await makeEndpoint(base).pathToInternalUrl(path)).toBe(expected);
		expect(makeHandler(base).pathToInternalUrl(path)).toBe(expected);
	});
});

describe('KernelPlaygroundWorkerEndpoint.internalUrlToPath', () => {
	it.each([
		[scoped, `${scoped}/wp-admin/?page=foo#bar`, '/wp-admin/?page=foo#bar'],
		[`${scoped}/`, `${scoped}/wp-admin/`, '/wp-admin/'],
		[
			scoped,
			'http://127.0.0.1:5400/scope:other/wp-admin/',
			'/scope:other/wp-admin/',
		],
		[
			'http://127.0.0.1:5400',
			'http://127.0.0.1:5400/wp-admin/?page=foo',
			'/wp-admin/?page=foo',
		],
	])('maps %s + %s like PHPRequestHandler', async (base, url, expected) => {
		expect(await makeEndpoint(base).internalUrlToPath(url)).toBe(expected);
		expect(makeHandler(base).internalUrlToPath(url)).toBe(expected);
	});
});
