import { __ } from '@wordpress/i18n';
import { OlderWordPressVersions } from './older-wordpress-versions';
import { formatWordPressVersionLabel } from './wordpress-release-names';

type WordPressVersionOption = {
	label: string;
	value: string;
	disabled?: boolean;
};

export function getWordPressVersionOptions({
	supportedWPVersions,
	includeOlderVersions,
	selectedVersion,
}: {
	supportedWPVersions: Record<string, string>;
	includeOlderVersions: boolean;
	selectedVersion: string;
}): WordPressVersionOption[] {
	const modernOptions = Object.keys(supportedWPVersions).map((version) => ({
		label: formatWordPressVersionLabel(`${supportedWPVersions[version]}`),
		value: version,
	}));

	// The version index comes from the running client and can lag behind a
	// settings-triggered reboot. Keep the site's selected value visible instead
	// of letting the native select collapse to its empty placeholder meanwhile.
	if (
		selectedVersion &&
		!modernOptions.some((option) => option.value === selectedVersion) &&
		(!includeOlderVersions ||
			!(OlderWordPressVersions as readonly string[]).includes(
				selectedVersion
			))
	) {
		modernOptions.unshift({
			label: formatWordPressVersionLabel(selectedVersion),
			value: selectedVersion,
		});
	}

	if (!includeOlderVersions) {
		return [
			// Without an empty option, React sometimes says the
			// current selected version is "trunk" when `wp` is
			// actually "6.4".
			{
				label: __('-- Select a version --', 'playground-website'),
				value: '',
			},
			...modernOptions,
		];
	}

	return [
		{
			label: __('-- Select a version --', 'playground-website'),
			value: '',
		},
		{
			label: __('── Current versions ──', 'playground-website'),
			value: '__modern_sep',
			disabled: true,
		},
		...modernOptions,
		{
			label: __('── Older versions ──', 'playground-website'),
			value: '__older_sep',
			disabled: true,
		},
		...OlderWordPressVersions.map((version) => ({
			label: formatWordPressVersionLabel(version),
			value: version,
		})),
	];
}
