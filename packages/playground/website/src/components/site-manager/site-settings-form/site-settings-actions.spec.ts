import { describe, expect, it } from 'vitest';
import type { SiteFormData } from './unconnected-site-settings-form';
import { getFreshPlaygroundReason } from './site-settings-actions';

const defaults: SiteFormData = {
	phpVersion: '8.3',
	wpVersion: '6.8',
	language: '',
	withNetworking: true,
	multisite: false,
};

describe('getFreshPlaygroundReason', () => {
	it('allows PHP and networking changes on the current Playground', () => {
		expect(
			getFreshPlaygroundReason(
				{
					...defaults,
					phpVersion: '8.4',
					withNetworking: false,
				},
				defaults
			)
		).toBeUndefined();
	});

	it('requires a fresh Playground for a WordPress version change', () => {
		expect(
			getFreshPlaygroundReason(
				{ ...defaults, wpVersion: '6.7' },
				defaults
			)
		).toBe('Changing WordPress version requires a fresh Playground.');
	});

	it('names every setting that prevents applying to the current Playground', () => {
		expect(
			getFreshPlaygroundReason(
				{
					...defaults,
					wpVersion: '6.7',
					language: 'pl_PL',
					multisite: true,
				},
				defaults
			)
		).toBe(
			'Changing WordPress version, language, and multisite requires a fresh Playground.'
		);
	});
});
