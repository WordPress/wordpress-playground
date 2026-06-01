import type {
	Blueprint,
	BlueprintDeclaration,
} from '@wp-playground/blueprints';
import {
	BlueprintReflection,
	isStepDefinition,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { GENERATED_GUTENBERG_INSTALLER_MARKER } from './gutenberg-preview';
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
export const logBlueprintEvents = async (
	blueprint: Blueprint | BlueprintDeclaration
) => {
	/**
	 * Log the names of provided Blueprint steps.
	 * Only the names (e.g. "runPhp" or "login") are logged. Step options like
	 * code, password, URLs are never sent anywhere.
	 *
	 * For installPlugin and installTheme, the plugin/theme slug is logged.
	 */
	const blueprintDeclaration =
		'version' in blueprint || 'steps' in blueprint
			? blueprint
			: (await BlueprintReflection.create(blueprint)).getDeclaration();
	if ((blueprintDeclaration as any).version === 2) {
		logBlueprintV2Events(blueprintDeclaration as any);
		return;
	}
	if ('steps' in blueprintDeclaration && blueprintDeclaration.steps) {
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

function logBlueprintV2Events(blueprint: any) {
	if (Array.isArray(blueprint.plugins)) {
		for (const plugin of blueprint.plugins) {
			logV2InstallAsset('installPlugin', plugin, 'plugin');
		}
	}
	if (Array.isArray(blueprint.themes)) {
		for (const theme of blueprint.themes) {
			logV2InstallAsset('installTheme', theme, 'theme');
		}
	}
	if (blueprint.activeTheme) {
		logV2InstallAsset('installTheme', blueprint.activeTheme, 'theme');
	}
	if (Array.isArray(blueprint.content) && blueprint.content.length > 0) {
		logTrackingEvent('step', { step: 'importContent' });
	}
	if (Array.isArray(blueprint.media) && blueprint.media.length > 0) {
		logTrackingEvent('step', { step: 'importMedia' });
	}
	if (blueprint.fonts) {
		logTrackingEvent('step', { step: 'installFonts' });
	}
	for (const step of blueprint.additionalStepsAfterExecution || []) {
		if (
			!step ||
			typeof step !== 'object' ||
			typeof step.step !== 'string'
		) {
			continue;
		}
		if (step.step === 'installPlugin') {
			logV2InstallAsset('installPlugin', step, 'plugin');
		} else if (step.step === 'installTheme') {
			logV2InstallAsset('installTheme', step, 'theme');
		} else if (isGeneratedGutenbergInstallerStep(step)) {
			logTrackingEvent('step', { step: step.step });
			logTrackingEvent('step', { step: 'installPlugin' });
			logTrackingEvent('installPlugin', {
				resource: 'vfs',
				plugin: 'gutenberg',
			});
		} else {
			logTrackingEvent('step', { step: step.step });
		}
	}
}

function isGeneratedGutenbergInstallerStep(step: any) {
	return (
		step?.step === 'runPHP' &&
		step?.env?.[GENERATED_GUTENBERG_INSTALLER_MARKER] === '1'
	);
}

function logV2InstallAsset(
	event: 'installPlugin' | 'installTheme',
	definition: any,
	slugKey: 'plugin' | 'theme'
) {
	const source =
		definition && typeof definition === 'object' && 'source' in definition
			? definition.source
			: definition &&
				  typeof definition === 'object' &&
				  slugKey === 'plugin' &&
				  'pluginData' in definition
				? definition.pluginData
				: definition &&
					  typeof definition === 'object' &&
					  slugKey === 'theme' &&
					  'themeData' in definition
					? definition.themeData
					: definition;
	const data: Record<string, string> = {
		resource: getV2DataReferenceResource(source, slugKey),
	};
	const slug = getV2DirectorySlug(source);
	if (slug) {
		data[slugKey] = slug;
	}
	logTrackingEvent('step', {
		step: event === 'installPlugin' ? 'installPlugin' : 'installTheme',
	});
	logTrackingEvent(event, data);
}

function getV2DataReferenceResource(source: any, slugKey: 'plugin' | 'theme') {
	if (typeof source === 'string') {
		if (source.startsWith('http://') || source.startsWith('https://')) {
			return 'url';
		}
		if (source.startsWith('/') || source.startsWith('./')) {
			return 'bundled';
		}
		return `wordpress.org/${slugKey}s`;
	}
	if (source && typeof source === 'object') {
		if (typeof source.resource === 'string') {
			return source.resource;
		}
		if ('gitRepository' in source) {
			return 'git:directory';
		}
		if ('directoryName' in source) {
			return 'literal:directory';
		}
		if ('filename' in source) {
			return 'literal';
		}
	}
	return 'unknown';
}

function getV2DirectorySlug(source: any) {
	if (
		source &&
		typeof source === 'object' &&
		typeof source.slug === 'string'
	) {
		return source.slug;
	}
	if (typeof source !== 'string') {
		return undefined;
	}
	if (
		source.startsWith('http://') ||
		source.startsWith('https://') ||
		source.startsWith('/') ||
		source.startsWith('./')
	) {
		return undefined;
	}
	return source.split('@')[0];
}
