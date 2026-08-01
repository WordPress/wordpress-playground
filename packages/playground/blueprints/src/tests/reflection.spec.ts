import { getBlueprintDeclaration } from '../lib/reflection';

describe('getBlueprintDeclaration', () => {
	it('parses Blueprint declarations from raw JSON strings', async () => {
		await expect(
			getBlueprintDeclaration(
				JSON.stringify({
					version: 2,
					constants: {
						WP_DEBUG: true,
					},
				})
			)
		).resolves.toEqual({
			version: 2,
			constants: {
				WP_DEBUG: true,
			},
		});
	});

	it('rejects invalid raw JSON strings', async () => {
		await expect(getBlueprintDeclaration('{ "version": 2')).rejects.toThrow(
			'Raw JSON input must be valid JSON.'
		);
	});

	it.each(['null', '[]'])(
		'rejects raw JSON %s as a Blueprint declaration',
		async (rawJson) => {
			await expect(getBlueprintDeclaration(rawJson)).rejects.toThrow(
				'Raw JSON input must contain a Blueprint declaration object.'
			);
		}
	);
});
