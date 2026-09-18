import { describe, expect, it } from 'vitest';
import { getWordPressVersionOptions } from './wordpress-version-options';

describe('getWordPressVersionOptions', () => {
	it('keeps a selected version while the runtime index catches up', () => {
		const options = getWordPressVersionOptions({
			supportedWPVersions: {
				latest: '6.9',
				trunk: '7.0-beta1',
			},
			includeOlderVersions: false,
			selectedVersion: '6.8',
		});

		expect(options.map(({ value }) => value)).toEqual([
			'',
			'6.8',
			'latest',
			'trunk',
		]);
	});

	it('does not duplicate versions already in either list', () => {
		const currentOptions = getWordPressVersionOptions({
			supportedWPVersions: { '6.8': '6.8' },
			includeOlderVersions: false,
			selectedVersion: '6.8',
		});
		const olderOptions = getWordPressVersionOptions({
			supportedWPVersions: { '6.8': '6.8' },
			includeOlderVersions: true,
			selectedVersion: '6.2',
		});

		expect(
			currentOptions.filter(({ value }) => value === '6.8')
		).toHaveLength(1);
		expect(
			olderOptions.filter(({ value }) => value === '6.2')
		).toHaveLength(1);
	});

	it('keeps a selected older version when the older list is hidden', () => {
		const options = getWordPressVersionOptions({
			supportedWPVersions: { '6.8': '6.8' },
			includeOlderVersions: false,
			selectedVersion: '6.2',
		});

		expect(options.map(({ value }) => value)).toContain('6.2');
	});
});
