import type { BlueprintV1 } from '@wp-playground/blueprints';
import {
	getBlueprintDeclaration,
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
export const logBlueprintEvents = async (blueprint: BlueprintV1) => {
	/**
	 * Log the names of provided Blueprint steps.
	 * Only the names (e.g. "runPhp" or "login") are logged. Step options like
	 * code, password, URLs are never sent anywhere.
	 *
	 * For installPlugin and installTheme, the plugin/theme slug is logged.
	 * When there is no slug, the prefixed resource type is logged instead.
	 */
	const blueprintDeclaration = await getBlueprintDeclaration(blueprint);
	if (blueprintDeclaration.steps) {
		for (const step of blueprintDeclaration.steps) {
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
};

function getResourceIdentifier(resource: { resource: string; slug?: string }) {
	if (resource.slug) {
		return resource.slug;
	}
	return `resource:${resource.resource}`;
}
