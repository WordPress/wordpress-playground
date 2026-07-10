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
 * Log Blueprint events
 * @param blueprint The Blueprint
 */
export const logBlueprintEvents = async (blueprint: Blueprint) => {
	/**
	 * Log the names of declared Blueprint operations.
	 * Only the names (e.g. "runPHP" or "login") are logged. Options like code,
	 * passwords, and URLs are never sent anywhere.
	 *
	 * For installPlugin and installTheme, the plugin/theme slug is logged.
	 * When there is no slug, the prefixed resource type is logged instead.
	 */
	const blueprintDeclaration = (
		await BlueprintReflection.create(blueprint)
	).getDeclaration();
	if (isBlueprintV2Declaration(blueprintDeclaration)) {
		logBlueprintV2Events(blueprintDeclaration);
		return;
	}
	logBlueprintV1Events(blueprintDeclaration);
};

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

function getBlueprintV2AssetSource(asset: BlueprintV2Asset): unknown {
	if (asset && typeof asset === 'object' && 'source' in asset) {
		return asset.source;
	}
	return asset;
}

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

function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

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
