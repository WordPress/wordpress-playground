import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import type { StepDefinition } from '@wp-playground/client';

const CATALOG_PATH = 'blueprint-library/index.json';
const SETTINGS_STORAGE_KEY = 'playground-blueprint-library-settings';
export const BLUEPRINT_LIBRARY_SETTINGS_CHANGED_EVENT =
	'playground-blueprint-library-settings-changed';

export type BlueprintLibraryInput = {
	id: string;
	label: string;
	type: 'secret';
	setting?: string;
	constant?: string;
};

export type BlueprintLibraryItem = {
	id: string;
	title: string;
	description: string;
	author?: string;
	categories: string[];
	inputs?: BlueprintLibraryInput[];
	blueprint: BlueprintV1Declaration;
};

export type BlueprintLibraryCatalog = {
	version: number;
	source: {
		type: string;
		repository: string;
		branch: string;
	};
	items: BlueprintLibraryItem[];
};

export type BlueprintLibrarySettings = {
	version: 1;
	alwaysLoad: string[];
	secrets: Record<string, string>;
};

export type PreparedBlueprint = {
	blueprint: BlueprintV1Declaration;
	missingInputs: string[];
};

export function getEmptyBlueprintLibrarySettings(): BlueprintLibrarySettings {
	return {
		version: 1,
		alwaysLoad: [],
		secrets: {},
	};
}

export async function loadBlueprintLibraryCatalog(): Promise<BlueprintLibraryCatalog> {
	const baseUrl = import.meta.env.BASE_URL || '/';
	const catalogUrl = `${baseUrl.replace(/\/?$/, '/')}${CATALOG_PATH}`;
	const response = await fetch(catalogUrl);
	if (!response.ok) {
		throw new Error('Could not load Extra Tools.');
	}
	return response.json();
}

export function loadBlueprintLibrarySettings(): BlueprintLibrarySettings {
	if (typeof localStorage === 'undefined') {
		return getEmptyBlueprintLibrarySettings();
	}

	try {
		return normalizeBlueprintLibrarySettings(
			JSON.parse(
				localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null'
			) as unknown
		);
	} catch {
		return getEmptyBlueprintLibrarySettings();
	}
}

export function saveBlueprintLibrarySettings(
	settings: BlueprintLibrarySettings
) {
	if (typeof localStorage === 'undefined') {
		return;
	}
	localStorage.setItem(
		SETTINGS_STORAGE_KEY,
		JSON.stringify(normalizeBlueprintLibrarySettings(settings))
	);
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new Event(BLUEPRINT_LIBRARY_SETTINGS_CHANGED_EVENT)
		);
	}
}

export function normalizeBlueprintLibrarySettings(
	value: unknown
): BlueprintLibrarySettings {
	if (!value || typeof value !== 'object') {
		return getEmptyBlueprintLibrarySettings();
	}
	const candidate = value as Partial<BlueprintLibrarySettings>;
	const alwaysLoad = Array.isArray(candidate.alwaysLoad)
		? [...new Set(candidate.alwaysLoad.filter(isNonEmptyString))]
		: [];
	const secrets =
		candidate.secrets && typeof candidate.secrets === 'object'
			? Object.fromEntries(
					Object.entries(candidate.secrets).filter(
						(entry): entry is [string, string] =>
							isNonEmptyString(entry[0]) &&
							typeof entry[1] === 'string'
					)
				)
			: {};

	return {
		version: 1,
		alwaysLoad,
		secrets,
	};
}

export function prepareBlueprintLibraryItem(
	item: BlueprintLibraryItem,
	settings: BlueprintLibrarySettings
): PreparedBlueprint {
	const missingInputs: string[] = [];
	const blueprint = replaceSecretPlaceholders(
		structuredClone(item.blueprint),
		settings,
		missingInputs
	) as BlueprintV1Declaration;

	return {
		blueprint,
		missingInputs: [...new Set(missingInputs)],
	};
}

export function mergeBlueprintLibraryItems(
	blueprint: BlueprintV1Declaration,
	items: BlueprintLibraryItem[],
	settings: BlueprintLibrarySettings
): PreparedBlueprint {
	const merged = structuredClone(blueprint);
	const missingInputs: string[] = [];
	const steps: StepDefinition[] = [
		...((merged.steps || []) as StepDefinition[]),
	];

	for (const item of items) {
		const prepared = prepareBlueprintLibraryItem(item, settings);
		if (prepared.missingInputs.length > 0) {
			missingInputs.push(...prepared.missingInputs);
			continue;
		}
		steps.push(...((prepared.blueprint.steps || []) as StepDefinition[]));
	}

	return {
		blueprint: {
			...merged,
			steps,
		},
		missingInputs: [...new Set(missingInputs)],
	};
}

function replaceSecretPlaceholders(
	value: unknown,
	settings: BlueprintLibrarySettings,
	missingInputs: string[]
): unknown {
	if (typeof value === 'string') {
		return value.replace(
			/\{\{\s*secrets\.([a-zA-Z0-9_-]+)\s*\}\}/g,
			(_match, inputId: string) => {
				const secret = settings.secrets[inputId];
				if (!secret) {
					missingInputs.push(inputId);
					return '';
				}
				return secret;
			}
		);
	}

	if (Array.isArray(value)) {
		return value.map((item) =>
			replaceSecretPlaceholders(item, settings, missingInputs)
		);
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				replaceSecretPlaceholders(item, settings, missingInputs),
			])
		);
	}

	return value;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}
