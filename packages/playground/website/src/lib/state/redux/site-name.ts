import type { Blueprint } from '@wp-playground/blueprints';

/**
 * Returns the display name for a new Playground created without an explicit
 * slug hint.
 *
 * Blueprint authors can provide a human-readable title for galleries,
 * examples, and share URLs. When that title exists, it is a better default
 * Playground name than a random fallback because it identifies the setup the
 * user just opened. Empty or malformed metadata is ignored so invalid optional
 * title data cannot produce a blank name.
 */
export function getDefaultSiteNameFromBlueprint(
	blueprint: Blueprint | undefined,
	fallbackName: string
) {
	const title = getBlueprintTitle(blueprint)?.trim();
	return title || fallbackName;
}

/**
 * Returns a display name that stays readable when a user creates the same
 * titled Blueprint more than once.
 *
 * The first Playground keeps the clean Blueprint title. Later Playgrounds get
 * their creation time appended so the list identifies which run is which
 * without using opaque counters such as "1" or "2".
 */
export function getSiteNameWithCreationTimeIfDuplicate(
	siteName: string,
	unavailableSiteNames: string[],
	createdAt: Date
) {
	const unavailableNames = new Set(unavailableSiteNames);
	if (!unavailableNames.has(siteName)) {
		return siteName;
	}

	const nameWithTimestamp = `${siteName} — ${formatSiteNameTimestamp(
		createdAt
	)}`;
	if (!unavailableNames.has(nameWithTimestamp)) {
		return nameWithTimestamp;
	}

	return `${siteName} — ${formatSiteNameTimestamp(createdAt, {
		includeMilliseconds: true,
	})}`;
}

function formatSiteNameTimestamp(
	createdAt: Date,
	options: { includeMilliseconds?: boolean } = {}
) {
	const formatted = new Intl.DateTimeFormat('en', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).format(createdAt);

	if (!options.includeMilliseconds) {
		return formatted;
	}

	return `${formatted}.${createdAt
		.getMilliseconds()
		.toString()
		.padStart(3, '0')}`;
}

function getBlueprintTitle(blueprint: Blueprint | undefined) {
	if (!blueprint || typeof blueprint !== 'object') {
		return undefined;
	}

	if ('meta' in blueprint && typeof blueprint.meta?.title === 'string') {
		return blueprint.meta.title;
	}

	if (
		'blueprintMeta' in blueprint &&
		typeof blueprint.blueprintMeta?.name === 'string'
	) {
		return blueprint.blueprintMeta.name;
	}

	return undefined;
}
