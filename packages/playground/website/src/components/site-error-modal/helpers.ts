import type { SerializedSiteErrorDetails } from '../../lib/state/redux/slice-ui';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import type { BlueprintStepError } from './types';

export function extractBlueprintStepError(
	errorDetails?: SerializedSiteErrorDetails
): BlueprintStepError | undefined {
	const baseMessage =
		typeof errorDetails === 'string' ? errorDetails : errorDetails?.message;
	if (
		!baseMessage ||
		!baseMessage.startsWith('Error when executing the blueprint step #')
	) {
		return undefined;
	}

	const indexMatch = baseMessage.match(
		/^Error when executing the blueprint step #(\d+)/
	);
	if (!indexMatch) {
		return undefined;
	}

	const firstParen = baseMessage.indexOf('(');
	if (firstParen === -1) {
		return undefined;
	}

	let closingParen = -1;
	let parsedStep: Record<string, unknown> | undefined;
	let stepJson = '';

	for (let i = firstParen + 1; i < baseMessage.length; i++) {
		if (baseMessage[i] !== ')') {
			continue;
		}
		const candidateJson = baseMessage.slice(firstParen + 1, i).trim();
		try {
			parsedStep = JSON.parse(candidateJson);
			stepJson = JSON.stringify(parsedStep, null, 2);
			closingParen = i;
			break;
		} catch {
			continue;
		}
	}

	if (!parsedStep || closingParen === -1) {
		return undefined;
	}

	const remainder = baseMessage
		.slice(closingParen + 1)
		.replace(/^\s*:\s*/, '')
		.trim();
	const messages = remainder
		? remainder
				.split(/\n+/)
				.map((line) => line.trim())
				.filter(Boolean)
		: [];

	return {
		stepNumber: Number(indexMatch[1]),
		step: parsedStep,
		stepJson,
		description: describeBlueprintStepAction(parsedStep),
		messages,
		rawMessage: baseMessage,
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
