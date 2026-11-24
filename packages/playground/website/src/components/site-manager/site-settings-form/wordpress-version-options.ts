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
			{ label: '-- Select a version --', value: '' },
			...modernOptions,
		];
	}

	return [
		{ label: '-- Select a version --', value: '' },
		{
			label: '── Current versions ──',
			value: '__modern_sep',
			disabled: true,
		},
		...modernOptions,
		{
			label: '── Older versions ──',
			value: '__older_sep',
			disabled: true,
		},
		...OlderWordPressVersions.map((version) => ({
			label: formatWordPressVersionLabel(version),
			value: version,
		})),
	];
}
