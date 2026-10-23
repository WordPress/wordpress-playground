import type { BlueprintV1Declaration } from '@wp-playground/client';
import { createStoredBlueprint } from './blueprint';
import { parseSetupBlueprint } from './site';

describe('re-saving a restored Spacefast Blueprint', () => {
	it('keeps the installation while discarding the previous snapshot restore', async () => {
		const setup: BlueprintV1Declaration = {
			steps: [{ step: 'runPHP', code: '<?php echo "setup";' }],
		};
		const stored = createStoredBlueprint(
			setup,
			{
				formatVersion: 2,
				spaceId: 'spc_test',
				siteUrl: 'https://playground.test/scope:old/',
				uploads: ['2026/10/photo.jpg'],
			},
			'https://example.space.fast/',
			'admin'
		);
		const nextSetup = await parseSetupBlueprint(JSON.stringify(stored));
		expect(nextSetup.steps).toEqual(setup.steps);
		expect(setup.steps).toEqual([
			{ step: 'runPHP', code: '<?php echo "setup";' },
		]);
	});
});
