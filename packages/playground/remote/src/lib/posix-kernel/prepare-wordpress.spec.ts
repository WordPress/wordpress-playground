import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { prepareWordPressZips } from './prepare-wordpress';

vi.mock('@wp-playground/wordpress', () => ({
	resolveWordPressRelease: vi.fn(),
}));

vi.mock('@wp-playground/wordpress-builds', () => ({
	MinifiedWordPressVersionsList: ['6.8'],
	getWordPressModuleDetails: () => ({ url: '/foo/wp-6.8.zip', size: 1 }),
	LatestSqliteDriverVersion: 'trunk',
	wpVersionToStaticAssetsDirectory: () => 'foo',
	getSqliteDriverModuleDetails: () => ({ url: '/foo/sqlite.zip', size: 1 }),
}));

const proxy = 'https://proxy.test/?';
let requested: string[];

function releaseAt(releaseUrl: string) {
	vi.mocked(resolveWordPressRelease).mockResolvedValue({
		releaseUrl,
		version: '6.9',
		source: 'api',
	});
}

beforeEach(() => {
	requested = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			requested.push(url);
			return new Response(new Uint8Array([1]));
		})
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('prepareWordPressZips strip directory', () => {
	it('strips <repo>-<ref> from a GitHub branch archive', async () => {
		releaseAt(
			'https://github.com/WordPress/WordPress/archive/refs/heads/master.zip?ts=1'
		);
		const result = await prepareWordPressZips({ wpVersionQuery: 'trunk' });
		expect(result.wpZipStripLeadingDir).toBe('WordPress-master');
	});

	it('strips wordpress from a wordpress.org release', async () => {
		releaseAt('https://wordpress.org/wordpress-6.9.zip');
		const result = await prepareWordPressZips({ wpVersionQuery: '6.9' });
		expect(result.wpZipStripLeadingDir).toBe('wordpress');
	});

	it('strips nothing from a bundled build', async () => {
		const result = await prepareWordPressZips({ wpVersionQuery: '6.8' });
		expect(result.wpZipStripLeadingDir).toBeUndefined();
	});
});

describe('prepareWordPressZips CORS proxy', () => {
	it.each([
		'https://github.com/WordPress/WordPress/archive/refs/heads/master.zip',
		'https://downloads.w.org/release/wordpress-6.9.zip',
		'https://downloads.wordpress.org/release/wordpress-6.9.zip',
		'https://wordpress.org/wordpress-6.9.zip',
	])('proxies %s', async (url) => {
		releaseAt(url);
		await prepareWordPressZips({
			wpVersionQuery: '6.9',
			corsProxyUrl: proxy,
		});
		expect(requested[0]).toBe(`${proxy}${url}`);
	});

	it('fetches other hosts directly', async () => {
		releaseAt('https://foo.test/wordpress.zip');
		await prepareWordPressZips({
			wpVersionQuery: '6.9',
			corsProxyUrl: proxy,
		});
		expect(requested[0]).toBe('https://foo.test/wordpress.zip');
	});

	it('fetches allowlisted hosts directly without a proxy URL', async () => {
		releaseAt('https://wordpress.org/wordpress-6.9.zip');
		await prepareWordPressZips({ wpVersionQuery: '6.9' });
		expect(requested[0]).toBe('https://wordpress.org/wordpress-6.9.zip');
	});

	it('fetches bundled builds directly', async () => {
		await prepareWordPressZips({
			wpVersionQuery: '6.8',
			corsProxyUrl: proxy,
		});
		expect(requested).toEqual([
			'/foo/wp-6.8.zip',
			'/foo/wordpress-static.zip',
			'/foo/sqlite.zip',
		]);
	});
});
