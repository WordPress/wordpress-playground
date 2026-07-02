import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

describe('Blueprint v2 declaration types', () => {
	it('accepts file data references for file-only fields', () => {
		const blueprint = {
			version: 2,
			content: [
				{
					type: 'mysql-dump',
					source: './dump.sql',
				},
				{
					type: 'posts',
					source: {
						filename: 'posts.json',
						content: '[]',
					},
				},
				{
					type: 'wxr',
					source: './content.wxr',
				},
			],
			media: [
				'./image.jpg',
				{
					source: {
						filename: 'image.jpg',
						content: 'image',
					},
					title: 'Image',
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: '<?php echo "Hello";',
					},
				},
				{
					step: 'runSQL',
					source: './dump.sql',
				},
				{
					step: 'unzip',
					zipFile: './archive.zip',
					extractToPath: '/tmp/archive',
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});
});

const blueprintWithDirectoryAsRunPHPCode = {
	version: 2,
	additionalStepsAfterExecution: [
		{
			step: 'runPHP',
			code: {
				// @ts-expect-error runPHP code must resolve to a single file.
				directoryName: 'scripts',
				files: {
					'index.php': '<?php echo "Hello";',
				},
			},
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithDirectoryAsMediaSource = {
	version: 2,
	media: [
		{
			source: {
				// @ts-expect-error media source must resolve to a single file.
				directoryName: 'images',
				files: {
					'image.jpg': 'image',
				},
			},
		},
	],
} satisfies BlueprintV2Declaration;

void blueprintWithDirectoryAsRunPHPCode;
void blueprintWithDirectoryAsMediaSource;
