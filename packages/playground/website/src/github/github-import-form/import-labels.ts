import type { ContentType } from '../import-from-github';

export function getImportTargetLabel(contentType: ContentType): string {
	switch (contentType) {
		case 'plugin':
			return 'plugin';
		case 'theme':
			return 'theme';
		case 'wp-content':
			return 'wp-content';
		case 'custom-paths':
			return 'files';
	}
}

export function getGitHubImportSuccessTitle(
	pluginOrThemeName: string,
	contentType: ContentType
): string {
	if (contentType === 'plugin' || contentType === 'theme') {
		return `${pluginOrThemeName} imported as a ${contentType}`;
	}
	if (contentType === 'wp-content') {
		return `${pluginOrThemeName} imported as wp-content`;
	}
	return `${pluginOrThemeName} imported`;
}
