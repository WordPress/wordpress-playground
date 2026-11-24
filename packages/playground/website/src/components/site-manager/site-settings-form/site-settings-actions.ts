import { __, sprintf } from '@wordpress/i18n';
import type { SiteFormData } from './unconnected-site-settings-form';

type SiteSettingAction =
	| { action: 'apply' }
	| { action: 'fresh'; getLabel: () => string };

// Classifying every field here makes a new setting a type error until its
// lifecycle behavior is deliberate.
const siteSettingActions: Record<keyof SiteFormData, SiteSettingAction> = {
	phpVersion: { action: 'apply' },
	withNetworking: { action: 'apply' },
	wpVersion: {
		action: 'fresh',
		getLabel: () => __('WordPress version', 'playground-website'),
	},
	language: {
		action: 'fresh',
		getLabel: () => __('language', 'playground-website'),
	},
	multisite: {
		action: 'fresh',
		getLabel: () => __('multisite', 'playground-website'),
	},
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
			return setting.action === 'fresh' ? setting.getLabel() : '';
		});

	if (changedFields.length === 0) {
		return undefined;
	}

	return sprintf(
		/* translators: %s: List of changed Playground settings (e.g. "WordPress version and language"). */
		__('Changing %s requires a fresh Playground.', 'playground-website'),
		formatList(changedFields)
	);
}

function formatList(items: string[]): string {
	if (items.length === 1) {
		return items[0];
	}
	if (items.length === 2) {
		return sprintf(
			/* translators: 1: First setting name, 2: Second setting name. */
			__('%1$s and %2$s', 'playground-website'),
			items[0],
			items[1]
		);
	}
	return sprintf(
		/* translators: 1: Comma-separated setting names, 2: Final setting name. */
		__('%1$s, and %2$s', 'playground-website'),
		items.slice(0, -1).join(', '),
		items.at(-1)
	);
}
