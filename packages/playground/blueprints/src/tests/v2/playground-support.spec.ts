import { blueprintV2PlaygroundSupport } from '../../lib/v2/playground-support';

describe('Blueprint v2 Playground support contract', () => {
	it('classifies every top-level schema field', () => {
		expect(
			Object.fromEntries(
				Object.entries(blueprintV2PlaygroundSupport).map(
					([field, support]) => [field, support.status]
				)
			)
		).toEqual({
			version: 'supported',
			$schema: 'not-applicable',
			blueprintMeta: 'metadata-only',
			applicationOptions: 'supported',
			siteLanguage: 'supported',
			siteOptions: 'supported',
			constants: 'supported',
			wordpressVersion: 'partially-supported',
			phpVersion: 'supported',
			activeTheme: 'supported',
			themes: 'supported',
			plugins: 'supported',
			muPlugins: 'supported',
			postTypes: 'partially-supported',
			fonts: 'partially-supported',
			media: 'supported',
			content: 'supported',
			users: 'supported',
			roles: 'supported',
			additionalStepsAfterExecution: 'supported',
		});
	});

	it('explains every support classification', () => {
		for (const support of Object.values(blueprintV2PlaygroundSupport)) {
			expect(support.description.trim()).not.toBe('');
		}
	});
});
