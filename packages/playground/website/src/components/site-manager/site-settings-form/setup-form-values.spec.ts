import { describe, expect, it } from 'vitest';
import { getSetupFormDefaultValues } from './setup-form-values';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';

describe('getSetupFormDefaultValues', () => {
	it('combines runtime configuration with setup URL fields', () => {
		const values = getSetupFormDefaultValues({
			originalUrlParams: {
				searchParams: {
					language: 'pl_PL',
					multisite: 'yes',
				},
			},
			metadata: {
				runtimeConfiguration: {
					phpVersion: '8.3',
					wpVersion: '6.8',
					networking: false,
				},
			},
		} as unknown as SiteInfo);

		expect(values).toEqual({
			phpVersion: '8.3',
			wpVersion: '6.8',
			withNetworking: false,
			language: 'pl_PL',
			multisite: true,
		});
	});

	it('does not overwrite form defaults with missing runtime fields', () => {
		const values = getSetupFormDefaultValues({
			originalUrlParams: { searchParams: {} },
			metadata: { runtimeConfiguration: {} },
		} as unknown as SiteInfo);

		expect(values).toEqual({
			language: '',
			multisite: false,
		});
	});
});
