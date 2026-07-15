// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { InMemoryFilesystemBackend } from '@wp-playground/storage';
import { readSiteBlueprintJson } from './SiteBlueprintBundleEditor';

vi.mock('../../lib/state/redux/store', () => ({
	useAppDispatch: vi.fn(),
	useAppSelector: vi.fn(),
}));

describe('readSiteBlueprintJson', () => {
	it('seeds a minimal Blueprint when no declaration exists', async () => {
		const blueprintJson = await readSiteBlueprintJson(undefined);

		expect(JSON.parse(blueprintJson)).toEqual({
			$schema: 'https://playground.wordpress.net/blueprint-schema.json',
			steps: [],
		});
	});

	it('does not modify a persisted bundle while reading it', async () => {
		const backend = new InMemoryFilesystemBackend();

		await expect(readSiteBlueprintJson(backend)).rejects.toThrow(
			'File not found: /blueprint.json'
		);
		expect(await backend.fileExists('/blueprint.json')).toBe(false);
	});
});
