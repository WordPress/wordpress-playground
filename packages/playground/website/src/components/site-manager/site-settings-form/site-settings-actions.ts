import type { SiteFormData } from './unconnected-site-settings-form';

type SiteSettingAction =
	| { action: 'apply' }
	| { action: 'fresh'; label: string };

// Classifying every field here makes a new setting a type error until its
// lifecycle behavior is deliberate.
const siteSettingActions: Record<keyof SiteFormData, SiteSettingAction> = {
	phpVersion: { action: 'apply' },
	withNetworking: { action: 'apply' },
	wpVersion: { action: 'fresh', label: 'WordPress version' },
	language: { action: 'fresh', label: 'language' },
	multisite: { action: 'fresh', label: 'multisite' },
};

export function getFreshPlaygroundReason(
	values: SiteFormData,
	defaultValues: SiteFormData
): string | undefined {
	const changedFields = Object.keys(siteSettingActions)
		.map((field) => field as keyof SiteFormData)
		.filter((field) => {
			return (
				siteSettingActions[field].action === 'fresh' &&
				values[field] !== defaultValues[field]
			);
		})
		.map((field) => {
			const setting = siteSettingActions[field];
			return setting.action === 'fresh' ? setting.label : '';
		});

	if (changedFields.length === 0) {
		return undefined;
	}

	return `Changing ${formatList(changedFields)} requires a fresh Playground.`;
}

function formatList(items: string[]): string {
	if (items.length === 1) {
		return items[0];
	}
	if (items.length === 2) {
		return items.join(' and ');
	}
	return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
