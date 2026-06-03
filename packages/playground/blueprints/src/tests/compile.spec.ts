import { describe, expect, it, vi } from 'vitest';
import type { BlueprintV2Declaration } from '../lib/v2/blueprint-v2-declaration';
import { compileBlueprintForExecution } from '../lib/compile';
import { InMemoryFilesystem } from '@wp-playground/storage';

describe('compileBlueprintForExecution', () => {
	it('routes Blueprint v1 declarations through the v1 compiler', async () => {
		const compiled = await compileBlueprintForExecution({
			steps: [
				{
					step: 'mkdir',
					path: '/wordpress/cache',
				},
			],
		});

		expect(compiled.version).toBe(1);
		expect(compiled.declaration).toMatchObject({
			steps: [
				{
					step: 'mkdir',
					path: '/wordpress/cache',
				},
			],
		});
	});

	it('preserves bundled resource access for Blueprint v1 bundles', async () => {
		const bundle = new InMemoryFilesystem({
			'message.txt': 'Hello from the bundle',
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
		expect(playground.writeFile).toHaveBeenCalledWith(
			'/message.txt',
			expect.any(Uint8Array)
		);
		const [, data] = playground.writeFile.mock.calls[0];
		expect(new TextDecoder().decode(data)).toBe('Hello from the bundle');
	});

	it('routes Blueprint v2 declarations through the v2 compiler', async () => {
		const onBlueprintValidated = vi.fn();
		const declaration: BlueprintV2Declaration = {
			version: 2 as const,
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: '/wordpress/cache',
				},
			],
		};

		const compiled = await compileBlueprintForExecution(declaration, {
			onBlueprintValidated,
		});

		expect(compiled.version).toBe(2);
		expect(compiled.declaration).toEqual(declaration);
		expect(onBlueprintValidated).toHaveBeenCalledWith(declaration);
	});

	it('can force the v2 execution path for Blueprint v1 declarations', async () => {
		const compiled = await compileBlueprintForExecution(
			{
				steps: [
					{
						step: 'mkdir',
						path: '/wordpress/cache',
					},
				],
			},
			{
				executionPath: 'v2',
			}
		);

		expect(compiled.version).toBe(2);
		expect(compiled.declaration).toMatchObject({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: '/cache',
				},
			],
		});
	});
});
