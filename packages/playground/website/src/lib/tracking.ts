import {
	BlueprintReflection,
	type Blueprint,
	type BlueprintV1Declaration,
	type BlueprintV2Declaration,
	createBlueprintV2ExecutionPlan,
	isStepDefinition,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
/**
 * Declare the global window.gtag function
 */
declare global {
	interface Window {
		gtag: any;
	}
}

/**
 * Google Analytics event names
 */
type GAEvent =
	| 'load'
	| 'step'
	| 'installPlugin'
	| 'installTheme'
	| 'error'
	| 'mcpConnect';

/**
 * Log a tracking event to Google Analytics
 * @param GAEvent The event name
 * @param Object Event data
 */
export const logTrackingEvent = (
	event: GAEvent,
	data?: { [key: string]: string }
) => {
	try {
		if (typeof window === 'undefined' || !window.gtag) {
			return;
		}
		window.gtag('event', event, data);
	} catch (error) {
		logger.warn('Failed to log tracking event', event, data, error);
	}
};

/**
 * Reports declared Blueprint operations without reporting their arguments.
 *
 * Each operation sends only its name; options such as code and passwords are
 * not reported. Plugin and theme installs also send a WordPress.org slug when
 * one exists. Every other source is reduced to its resource type so URLs,
 * paths, inline data, and Git details never enter analytics.
 *
 * @param blueprint The Blueprint declaration or bundle to inspect.
 */
export const logBlueprintEvents = async (blueprint: Blueprint) => {
	const blueprintDeclaration = (
		await BlueprintReflection.create(blueprint)
	).getDeclaration();
	if (isBlueprintV2Declaration(blueprintDeclaration)) {
		logBlueprintV2Events(blueprintDeclaration);
		return;
	}
	logBlueprintV1Events(blueprintDeclaration);
};

/**
 * Reports executable v1 steps and safe identifiers for asset installations.
 *
 * Non-step entries are ignored so analytics only reflects executable step
 * definitions.
 */
function logBlueprintV1Events(blueprint: BlueprintV1Declaration) {
	if (blueprint.steps) {
		for (const step of blueprint.steps) {
			if (!isStepDefinition(step)) {
				continue;
			}
			logTrackingEvent('step', { step: step.step });
			if (step.step === 'installPlugin') {
				const { pluginData } = step;
				const data = {
					resource: pluginData.resource,
					plugin: getResourceIdentifier(pluginData),
				};
				logTrackingEvent('installPlugin', data);
			} else if (step.step === 'installTheme') {
				const { themeData } = step;
				const data = {
					resource: themeData.resource,
					theme: getResourceIdentifier(themeData),
				};
				logTrackingEvent('installTheme', data);
			}
		}
	}
}

/**
 * Reports v2 operations from the ordered plan used by the TypeScript runner.
 *
 * Reading the execution plan keeps analytics aligned with operations implied
 * by top-level v2 fields as well as explicitly declared steps.
 */
function logBlueprintV2Events(blueprint: BlueprintV2Declaration) {
	for (const item of createBlueprintV2ExecutionPlan(blueprint)) {
		const step = item.type === 'runStep' ? item.step.step : item.type;
		logTrackingEvent('step', { step });
		if (item.type === 'installPlugin') {
			logBlueprintV2AssetEvent('plugin', item.plugin);
		} else if (item.type === 'installTheme') {
			logBlueprintV2AssetEvent('theme', item.theme);
		} else if (
			item.type === 'runStep' &&
			item.step.step === 'installPlugin'
		) {
			logBlueprintV2AssetEvent('plugin', item.step);
		} else if (
			item.type === 'runStep' &&
			item.step.step === 'installTheme'
		) {
			logBlueprintV2AssetEvent('theme', item.step);
		}
	}
}

type BlueprintV2Asset =
	| NonNullable<BlueprintV2Declaration['plugins']>[number]
	| NonNullable<BlueprintV2Declaration['themes']>[number]
	| NonNullable<BlueprintV2Declaration['activeTheme']>
	| Extract<
			NonNullable<
				BlueprintV2Declaration['additionalStepsAfterExecution']
			>[number],
			{ step: 'installPlugin' | 'installTheme' }
	  >;

/**
 * Reports an asset installation without exposing its data-reference contents.
 *
 * Only WordPress.org string sources are reported verbatim. URLs, bundled
 * paths, inline content, and Git references are represented by resource type.
 */
function logBlueprintV2AssetEvent(
	type: 'plugin' | 'theme',
	asset: BlueprintV2Asset
) {
	const source = getBlueprintV2AssetSource(asset);
	const resource = getBlueprintV2ResourceType(source, type);
	const identifier =
		typeof source === 'string' && resource === `wordpress.org/${type}s`
			? source
			: `resource:${resource}`;
	logTrackingEvent(type === 'plugin' ? 'installPlugin' : 'installTheme', {
		resource,
		[type]: identifier,
	});
}

/**
 * Returns the data reference from an asset's shorthand or `{ source }` form.
 */
function getBlueprintV2AssetSource(asset: BlueprintV2Asset): unknown {
	if (asset && typeof asset === 'object' && 'source' in asset) {
		return asset.source;
	}
	return asset;
}

/**
 * Maps a v2 source shape to the v1 resource name used by existing analytics.
 *
 * Unknown shapes stay anonymous rather than falling back to serialized source
 * data.
 */
function getBlueprintV2ResourceType(source: unknown, type: 'plugin' | 'theme') {
	if (typeof source === 'string') {
		if (isHttpUrl(source)) {
			return 'url';
		}
		if (source.startsWith('./') || source.startsWith('/')) {
			return 'bundled';
		}
		return `wordpress.org/${type}s`;
	}
	if (source && typeof source === 'object') {
		if ('filename' in source) {
			return 'literal';
		}
		if ('directoryName' in source) {
			return 'literal:directory';
		}
		if ('gitRepository' in source) {
			return 'git:directory';
		}
	}
	return 'unknown';
}

/** Indicates whether a source is an absolute HTTP(S) URL. */
function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/** Narrows a reflected declaration using v2's required version discriminator. */
function isBlueprintV2Declaration(
	blueprint: BlueprintV1Declaration | BlueprintV2Declaration
): blueprint is BlueprintV2Declaration {
	return (blueprint as { version?: unknown }).version === 2;
}

function getResourceIdentifier(resource: { resource: string; slug?: string }) {
	if (resource.slug) {
		return resource.slug;
	}
	return `resource:${resource.resource}`;
}
