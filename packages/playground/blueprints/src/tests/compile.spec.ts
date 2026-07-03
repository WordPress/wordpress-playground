import { InMemoryFilesystem } from '@wp-playground/storage';
import { vi } from 'vitest';
import { compileBlueprintForExecution } from '../lib/compile';
import type { BlueprintV1Declaration } from '../lib/v1/types';
import { runBlueprintV2 } from '../lib/v2/run-blueprint-v2';

vi.mock('../lib/v2/run-blueprint-v2', () => ({
	runBlueprintV2: vi.fn(),
}));

describe('compileBlueprintForExecution', () => {
	beforeEach(() => {
		vi.mocked(runBlueprintV2).mockReset();
	});

	it('compiles Blueprint v1 declarations through the v1 compiler', async () => {
		const declaration: BlueprintV1Declaration = {
			steps: [
				{
					step: 'mkdir',
					path: '/wordpress/cache',
				},
			],
		};

		const compiled = await compileBlueprintForExecution(declaration);

		expect(compiled.version).toBe(1);
		expect(compiled.declaration).toBe(declaration);
		expect(compiled.compiled).toHaveProperty('versions');
		expect(compiled.run).toBe(compiled.compiled.run);
	});

	it('compiles Blueprint v1 bundles with bundled resources', async () => {
		const bundle = new InMemoryFilesystem({
			'message.txt': 'Hello from a bundled file.',
			'blueprint.json': JSON.stringify({
				steps: [
					{
						step: 'writeFile',
						path: '/message.txt',
						data: {
							resource: 'bundled',
							path: 'message.txt',
						},
					},
				],
			}),
		});
		const playground = {
			writeFile: vi.fn(),
		};

		const compiled = await compileBlueprintForExecution(bundle);
		await compiled.run(playground as any);

		expect(compiled.version).toBe(1);
		expect(compiled.declaration).toEqual({
			steps: [
				{
					step: 'writeFile',
					path: '/message.txt',
					data: {
						resource: 'bundled',
						path: 'message.txt',
					},
				},
			],
		});
		expect(playground.writeFile).toHaveBeenCalledTimes(1);
		const [path, data] = playground.writeFile.mock.calls[0];
		expect(path).toBe('/message.txt');
		expect(await new File([data], 'message.txt').text()).toBe(
			'Hello from a bundled file.'
		);
	});

	it('compiles Blueprint v2 declarations through the v2 runner', async () => {
		const declaration = {
			version: 2,
		} as const;
		const playground = {};

		const compiled = await compileBlueprintForExecution(declaration);
		await compiled.run(playground as any);

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.declaration).toBe(declaration);
		expect(compiled.compiled.runtime).toMatchObject({
			wpVersion: 'latest',
			networking: true,
		});
		expect(runBlueprintV2).toHaveBeenCalledWith({
			php: playground,
			blueprint: declaration,
		});
	});
});
