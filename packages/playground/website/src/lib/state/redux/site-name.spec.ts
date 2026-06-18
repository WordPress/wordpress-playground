import {
	getDefaultSiteNameFromBlueprint,
	getSiteNameWithCreationTimeIfDuplicate,
} from './site-name';

describe('getDefaultSiteNameFromBlueprint', () => {
	it('uses the v1 Blueprint title when present', () => {
		expect(
			getDefaultSiteNameFromBlueprint(
				{
					meta: {
						title: 'WooCommerce Demo Store',
						author: 'wordpress',
					},
					steps: [],
				},
				'Random Playground'
			)
		).toBe('WooCommerce Demo Store');
	});

	it('uses the v2 Blueprint name when present', () => {
		expect(
			getDefaultSiteNameFromBlueprint(
				{
					version: 2,
					blueprintMeta: {
						name: 'Magazine Starter Site',
					},
				},
				'Random Playground'
			)
		).toBe('Magazine Starter Site');
	});

	it('falls back when the Blueprint has no title metadata', () => {
		expect(
			getDefaultSiteNameFromBlueprint({ steps: [] }, 'Random Playground')
		).toBe('Random Playground');
	});

	it('falls back when the Blueprint title is empty', () => {
		expect(
			getDefaultSiteNameFromBlueprint(
				{
					meta: {
						title: '   ',
						author: 'wordpress',
					},
					steps: [],
				},
				'Random Playground'
			)
		).toBe('Random Playground');
	});

	it('falls back when the v2 Blueprint name is empty', () => {
		expect(
			getDefaultSiteNameFromBlueprint(
				{
					version: 2,
					blueprintMeta: {
						name: '   ',
					},
				},
				'Random Playground'
			)
		).toBe('Random Playground');
	});

	it('falls back when the Blueprint title is not a string', () => {
		expect(
			getDefaultSiteNameFromBlueprint(
				{
					meta: {
						title: 42,
						author: 'wordpress',
					},
					steps: [],
				} as unknown as Parameters<
					typeof getDefaultSiteNameFromBlueprint
				>[0],
				'Random Playground'
			)
		).toBe('Random Playground');
	});

	it('falls back when the v2 Blueprint name is not a string', () => {
		expect(
			getDefaultSiteNameFromBlueprint(
				{
					version: 2,
					blueprintMeta: {
						name: 42,
					},
				} as unknown as Parameters<
					typeof getDefaultSiteNameFromBlueprint
				>[0],
				'Random Playground'
			)
		).toBe('Random Playground');
	});
});

describe('getSiteNameWithCreationTimeIfDuplicate', () => {
	const createdAt = new Date(2026, 5, 11, 14, 37, 5, 123);

	it('keeps the clean name when no existing Playground uses it', () => {
		expect(
			getSiteNameWithCreationTimeIfDuplicate(
				'WooCommerce Demo Store',
				[],
				createdAt
			)
		).toBe('WooCommerce Demo Store');
	});

	it('adds the creation time when the clean name is already used', () => {
		expect(
			getSiteNameWithCreationTimeIfDuplicate(
				'WooCommerce Demo Store',
				['WooCommerce Demo Store'],
				createdAt
			)
		).toBe('WooCommerce Demo Store — Jun 11, 14:37:05');
	});

	it('adds milliseconds when the second-level timestamp is already used', () => {
		expect(
			getSiteNameWithCreationTimeIfDuplicate(
				'WooCommerce Demo Store',
				[
					'WooCommerce Demo Store',
					'WooCommerce Demo Store — Jun 11, 14:37:05',
				],
				createdAt
			)
		).toBe('WooCommerce Demo Store — Jun 11, 14:37:05.123');
	});
});
