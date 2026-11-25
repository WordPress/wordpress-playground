import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	bundleReprint,
	resolveReprintRelease,
} from '../../../bin/reprint-assets.mjs';

const bytes = Buffer.from('a verified Reprint client');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const release = { version: 'v1.2.3', sha256 };

describe('Reprint build asset', () => {
	let directory: URL;
	beforeEach(async () => {
		directory = pathToFileURL(
			(await mkdtemp(`${tmpdir()}/reprint-assets-`)) + '/'
		);
		vi.stubGlobal('fetch', vi.fn());
	});
	afterEach(async () => {
		vi.unstubAllGlobals();
		await rm(directory, { recursive: true, force: true });
	});

	it('reuses verified bytes without a network request', async () => {
		await writeFile(new URL(`reprint-${sha256}.phar`, directory), bytes);
		await bundleReprint(release, directory);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('replaces corrupt cache bytes and removes old clients from the public bundle', async () => {
		const destination = new URL(`reprint-${sha256}.phar`, directory);
		await writeFile(destination, 'corrupt');
		await writeFile(new URL('reprint-old.phar', directory), 'old client');
		vi.mocked(fetch).mockResolvedValueOnce(new Response(bytes));
		await bundleReprint(release, directory);
		expect(await readFile(destination)).toEqual(bytes);
		expect(await readdir(directory)).toEqual([`reprint-${sha256}.phar`]);
	});

	it.each(['checksum mismatch', 'HTTP failure'])(
		'leaves the previous client untouched after a %s',
		async (failure) => {
			const old = new URL('reprint-old.phar', directory);
			await writeFile(old, 'old client');
			vi.mocked(fetch).mockResolvedValueOnce(
				new Response('wrong bytes', {
					status: failure === 'HTTP failure' ? 503 : 200,
				})
			);
			await expect(bundleReprint(release, directory)).rejects.toThrow();
			expect(await readFile(old, 'utf8')).toBe('old client');
			expect(await readdir(directory)).toEqual(['reprint-old.phar']);
		}
	);

	it('selects the PHAR checksum rather than another release asset', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			Response.json({
				tag_name: release.version,
				assets: [
					{ name: 'server.zip', digest: `sha256:${'0'.repeat(64)}` },
					{ name: 'reprint.phar', digest: `sha256:${sha256}` },
				],
			})
		);
		expect(await resolveReprintRelease(release.version)).toEqual(release);
		expect(fetch).toHaveBeenCalledWith(
			`https://api.github.com/repos/WordPress/reprint/releases/tags/${release.version}`,
			expect.any(Object)
		);
	});

	it('does not select a release without a PHAR checksum', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			Response.json({
				tag_name: release.version,
				assets: [{ name: 'reprint.phar', digest: null }],
			})
		);
		await expect(resolveReprintRelease('latest')).rejects.toThrow(
			'checksum'
		);
	});
});
