import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('private npm package metadata', () => {
	it('cannot be published and has no lifecycle downloader', async () => {
		const metadata = JSON.parse(
			await readFile(join(packageRoot, 'package.json'), 'utf8')
		) as {
			private?: boolean;
			publishConfig?: unknown;
			scripts?: Record<string, string>;
			bin?: Record<string, string>;
		};
		expect(metadata.private).toBe(true);
		expect(metadata.publishConfig).toBeUndefined();
		expect(metadata.scripts?.['postinstall']).toBeUndefined();
		expect(metadata.bin).toEqual({
			'wp-playground-cli': 'wp-playground.js',
		});
	});

	it('contains no public host URL', async () => {
		const manifest = JSON.parse(
			await readFile(
				join(packageRoot, 'npm', 'native-host-manifest.json'),
				'utf8'
			)
		) as { targets?: unknown };
		expect(manifest.targets).toEqual({});
	});
});
