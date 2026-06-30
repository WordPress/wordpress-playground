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
	 */
	const blueprintDeclaration = await getBlueprintDeclaration(blueprint);
	if (blueprintDeclaration.steps) {
		for (const step of blueprintDeclaration.steps) {
			if (!isStepDefinition(step)) {
				continue;
			}
			logTrackingEvent('step', { step: step.step });
			if (step.step === 'installPlugin') {
				const data = {
					resource: (step as any).pluginData.resource,
				};
				if ((step as any).pluginData.slug) {
					(data as any).plugin = (step as any).pluginData.slug;
				}
				logTrackingEvent('installPlugin', data);
			} else if (step.step === 'installTheme') {
				const data = {
					resource: (step as any).themeData.resource,
				};
				if ((step as any).themeData.slug) {
					(data as any).theme = (step as any).themeData.slug;
				}
				logTrackingEvent('installTheme', data);
			}
		}
	}
};
