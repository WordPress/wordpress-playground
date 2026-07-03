import { compileBlueprintForExecution } from '../lib/compile';
import type { BlueprintV1Declaration } from '../lib/v1/types';

describe('compileBlueprintForExecution', () => {
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
});
