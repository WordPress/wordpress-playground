import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { resolveBlueprintV2WordPressSource } from '@wp-playground/blueprints';
import { collectBytes, encodeZip } from '@php-wasm/stream-compression';
import { resolveBlueprint } from '../src/resolve-blueprint';

describe('resolveBlueprint', () => {
	test('blocks local adjacent files by default', async () => {
		const dir = await createLocalBlueprintFixture();

		try {
			const blueprint = await resolveBlueprint({
				sourceString: path.join(dir, 'blueprint.json'),
				blueprintMayReadAdjacentFiles: false,
			});

			await expect(
				resolveBlueprintV2WordPressSource(blueprint as any)
			).rejects.toThrow(/blueprint-may-read-adjacent-files/);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('allows local adjacent files after explicit consent', async () => {
		const dir = await createLocalBlueprintFixture();

		try {
			const blueprint = await resolveBlueprint({
				sourceString: path.join(dir, 'blueprint.json'),
				blueprintMayReadAdjacentFiles: true,
			});

			const wordpressSource = await resolveBlueprintV2WordPressSource(
				blueprint as any
			);
			expect(await wordpressSource.wordPressZip?.text()).toBe(
				'local-wordpress'
			);
			expect(await (await (blueprint as any).read('plugin.zip')).text()).toBe(
				'local-plugin'
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('resolves local ZIP blueprint bundles using the exact file bytes', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'playground-blueprint-zip-'));
		const zipPath = path.join(dir, 'blueprint.zip');
		const zipBytes = await collectBytes(
			encodeZip(
				[
					new File(
						[
							JSON.stringify({
								version: 2,
								phpVersion: '8.3',
							}),
						],
						'blueprint.json'
					),
				][Symbol.iterator]()
			)
		);
		if (!zipBytes) {
			throw new Error('Failed to create blueprint ZIP fixture');
		}
		const prefix = Buffer.from('prefix');
		const padded = Buffer.concat([
			prefix,
			Buffer.from(zipBytes),
			Buffer.from('suffix'),
		]);
		const slicedZipBuffer = padded.subarray(
			prefix.byteLength,
			prefix.byteLength + zipBytes.byteLength
		);

		try {
			await writeFile(zipPath, slicedZipBuffer);
			const blueprint = await resolveBlueprint({
				sourceString: zipPath,
				blueprintMayReadAdjacentFiles: false,
			});

			expect(
				JSON.parse(await (await (blueprint as any).read('blueprint.json')).text())
			).toEqual({
				version: 2,
				phpVersion: '8.3',
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

async function createLocalBlueprintFixture() {
	const dir = await mkdtemp(path.join(tmpdir(), 'playground-blueprint-'));
	await writeFile(
		path.join(dir, 'blueprint.json'),
		JSON.stringify({
			version: 2,
			wordpressVersion: './wordpress.zip',
			plugins: ['./plugin.zip'],
		})
	);
	await writeFile(path.join(dir, 'wordpress.zip'), 'local-wordpress');
	await writeFile(path.join(dir, 'plugin.zip'), 'local-plugin');
	return dir;
}
