import type { ContentType } from '../import-from-github';

export type PullRequestAction = 'update' | 'create';

export function asPullRequestAction(value: unknown): PullRequestAction {
	if (value === 'update' || value === 'create') {
		return value;
	}
	return 'create';
}

export interface ExportFormValues {
	repoUrl: string;
	prAction?: PullRequestAction;
	prNumber: string;
	contentType?: ContentType;
	toPathInRepo: string;
	fromPlaygroundRoot: string;
	relativeExportPaths: string[];
	commitMessage: string;
	plugin?: string;
	theme?: string;
	includeZip: boolean;
}
