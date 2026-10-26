import type { ExportFormValues } from './github-export-form/form';
import { asPullRequestAction } from './github-export-form/form';
import { asContentType } from './import-from-github';

export function readInitialGitHubExportValues(query: URLSearchParams) {
	const values: Partial<ExportFormValues> = {};
	if (query.get('ghexport-repo-url')) {
		values.repoUrl = query.get('ghexport-repo-url')!;
	}
	if (query.get('ghexport-base-branch')) {
		values.baseBranch = query.get('ghexport-base-branch')!;
	}
	if (query.get('ghexport-content-type')) {
		values.contentType = asContentType(query.get('ghexport-content-type'));
	}
	if (query.get('ghexport-pr-action')) {
		values.prAction = asPullRequestAction(query.get('ghexport-pr-action'));
	}
	if (query.get('ghexport-pr-number')) {
		values.prNumber = query.get('ghexport-pr-number')!;
	}
	if (query.get('ghexport-playground-root')) {
		values.fromPlaygroundRoot = query.get('ghexport-playground-root')!;
	}
	if (query.get('ghexport-repo-root')) {
		values.toPathInRepo = query.get('ghexport-repo-root')!;
	}
	if (query.get('ghexport-path')) {
		values.relativeExportPaths = query.getAll('ghexport-path');
	}
	if (query.get('ghexport-commit-message')) {
		values.commitMessage = query.get('ghexport-commit-message')!;
	}
	if (query.get('ghexport-plugin')) {
		values.plugin = query.get('ghexport-plugin')!;
	}
	if (query.get('ghexport-theme')) {
		values.theme = query.get('ghexport-theme')!;
	}
	return values;
}
