import type {
	SerializedSiteErrorDetails,
	SerializedBlueprintStepErrorDetails,
} from '../../lib/state/redux/slice-ui';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import type { BlueprintStepError } from './types';

export function extractBlueprintStepError(
	errorDetails?: SerializedSiteErrorDetails
): BlueprintStepError | undefined {
	if (!errorDetails || typeof errorDetails === 'string') {
		return undefined;
	}

	const maybeBlueprintStepError =
		errorDetails as SerializedBlueprintStepErrorDetails;

	if (maybeBlueprintStepError.type !== 'blueprint-step-error') {
		return undefined;
	}

	const step = maybeBlueprintStepError.step;
	const stepJson = JSON.stringify(step, null, 2);
	const messages = maybeBlueprintStepError.messages || [];

	return {
		stepNumber: maybeBlueprintStepError.stepNumber,
		step,
		stepJson,
		description: describeBlueprintStepAction(step),
		messages,
		rawMessage:
			maybeBlueprintStepError.rawMessage ||
			maybeBlueprintStepError.message ||
			'',
	};
}

export function getBlueprintSourceUrl(site?: SiteInfo): string | undefined {
	const source = site?.metadata?.originalBlueprintSource;
	if (source?.type !== 'remote-url') {
		return undefined;
	}
	try {
		const url = new URL(source.url);
		if (url.searchParams.has('blueprint-url')) {
			return url.searchParams.get('blueprint-url') || undefined;
		}
		return source.url;
	} catch {
		return undefined;
	}
}

export function formatErrorDetails(
	errorDetails?: SerializedSiteErrorDetails,
	messageToOmit?: string
): string | undefined {
	if (!errorDetails) {
		return undefined;
	}
	if (typeof errorDetails === 'string') {
		const trimmed = errorDetails.trim();
		if (messageToOmit && trimmed.startsWith(messageToOmit)) {
			const remainder = trimmed.slice(messageToOmit.length).trim();
			return remainder || undefined;
		}
		return trimmed;
	}
	let message = errorDetails.message;
	if (message && messageToOmit && message.startsWith(messageToOmit)) {
		message = message.slice(messageToOmit.length).trim();
	}
	return [errorDetails.name, message, errorDetails.stack]
		.filter(Boolean)
		.join('\n\n');
}

function describeBlueprintStepAction(step: Record<string, unknown>): string {
	const stepName = typeof step?.step === 'string' ? step.step : undefined;
	const readableName = stepName ? humanizeStepName(stepName) : undefined;
	const stepAny = step as Record<string, any>;

	switch (stepName) {
		case 'installPlugin': {
			const slug =
				stepAny?.pluginData?.slug ||
				stepAny?.pluginData?.pluginZipFile?.slug ||
				stepAny?.pluginZipFile?.slug;
			return slug ? `install plugin "${slug}"` : 'install plugin';
		}
		case 'installTheme': {
			const slug = stepAny?.themeData?.slug || stepAny?.theme?.slug;
			return slug ? `install theme "${slug}"` : 'install theme';
		}
		case 'runPHP':
			return 'run custom PHP code';
		case 'runSQL':
			return 'run SQL statements';
		case 'importWxr':
			return 'import WordPress XML content';
		case 'importWordPressFiles':
			return 'import a WordPress site archive';
		case 'installMuPlugin':
			return 'install an MU plugin';
		default:
			return readableName || 'run this step';
	}
}

function humanizeStepName(stepName: string): string {
	const spaced = stepName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
	return spaced.charAt(0).toLowerCase() + spaced.slice(1);
}
