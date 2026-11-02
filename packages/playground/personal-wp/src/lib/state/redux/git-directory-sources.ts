import type {
	GitDirectoryReference,
	StepDefinition,
} from '@wp-playground/blueprints';

export function extractGitDirectorySource(
	step: StepDefinition,
	result: unknown
): { assetPath: string; source: GitDirectoryReference } | null {
	if (step.step !== 'installPlugin' && step.step !== 'installTheme') {
		return null;
	}
	const resource = (step as any).pluginData ?? (step as any).themeData;
	if (!resource || resource.resource !== 'git:directory') {
		return null;
	}
	const { assetPath, installationStatus } =
		(result as
			| {
					assetPath?: string;
					installationStatus?:
						| 'installed'
						| 'skipped-already-existed';
			  }
			| undefined) ?? {};
	if (!assetPath || installationStatus === 'skipped-already-existed') {
		return null;
	}
	return { assetPath, source: resource as GitDirectoryReference };
}

export function normalizeGitUrl(input: string): string {
	const trimmed = input.trim();
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function deriveFolderNameFromGitUrl(url: string): string {
	const trimmed = url
		.trim()
		.replace(/\/+$/, '')
		.replace(/\.git$/i, '');
	const lastSegment = trimmed.split('/').pop() || '';
	const sanitized = lastSegment.replace(/[^a-zA-Z0-9-_.]/g, '-');
	return sanitized || 'git-mount';
}
