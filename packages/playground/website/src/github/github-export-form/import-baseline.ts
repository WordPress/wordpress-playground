import type { ContentType } from '../import-from-github';
import type { ExportFormValues } from './form-types';

export interface GitHubImportDetailsForExport {
	url: string;
	path: string;
	pluginOrThemeName: string;
	contentType: ContentType;
	filesCommitSha?: string;
	urlInformation: {
		pr?: number;
	};
}

export interface GitHubImportBaselineForExport {
	initialValues: Partial<ExportFormValues>;
	filesCommitSha?: string;
}

// Keep only the commit fingerprint and form fields. The export form refetches
// repository files on demand so importing a large tree does not pin it in memory.
const baselinesBySiteSlug = new Map<string, GitHubImportBaselineForExport>();

export function createGitHubImportBaselineForExport(
	details: GitHubImportDetailsForExport
): GitHubImportBaselineForExport {
	const prNumber = details.urlInformation.pr
		? details.urlInformation.pr.toString()
		: '';
	const initialValues: Partial<ExportFormValues> = {
		repoUrl: details.url,
		prNumber,
		toPathInRepo: details.path,
		prAction: prNumber ? 'update' : 'create',
		contentType: details.contentType,
	};
	if (details.contentType === 'plugin') {
		initialValues.plugin = details.pluginOrThemeName;
	} else if (details.contentType === 'theme') {
		initialValues.theme = details.pluginOrThemeName;
	}

	return {
		initialValues,
		filesCommitSha: details.filesCommitSha,
	};
}

export function rememberGitHubImportBaselineForExport(
	siteSlug: string,
	baseline: GitHubImportBaselineForExport
) {
	baselinesBySiteSlug.set(siteSlug, baseline);
}

export function getGitHubImportBaselineForExport(siteSlug: string) {
	return baselinesBySiteSlug.get(siteSlug);
}

export function clearGitHubImportBaselineForExport(siteSlug: string) {
	baselinesBySiteSlug.delete(siteSlug);
}

export function exportValuesMatchGitHubImportBaseline(
	values: Partial<ExportFormValues>,
	baselineValues: Partial<ExportFormValues>
) {
	const commonValuesMatch =
		values.repoUrl === baselineValues.repoUrl &&
		values.prAction === baselineValues.prAction &&
		values.prNumber === baselineValues.prNumber &&
		values.contentType === baselineValues.contentType &&
		values.toPathInRepo === baselineValues.toPathInRepo;
	if (!commonValuesMatch) {
		return false;
	}
	if (baselineValues.contentType === 'plugin') {
		return values.plugin === baselineValues.plugin;
	}
	if (baselineValues.contentType === 'theme') {
		return values.theme === baselineValues.theme;
	}
	return true;
}
