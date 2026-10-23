import type { PlaygroundClient } from '@wp-playground/client';
import type { GitHubExportOptions } from '@wp-playground/mcp/client';
import { staticAnalyzeGitHubURL } from './analyze-github-url';
import { exportToGithub } from './github-export-form/form';
import { resetAuthenticatedGitHubClient } from './client';
import { setOAuthToken } from './state';
import { joinPaths } from '@php-wasm/util';
import { readInitialGitHubExportValues } from './github-export-defaults';

export async function exportActiveSiteToGithub(
	playground: PlaygroundClient,
	options: GitHubExportOptions,
	query = new URLSearchParams()
) {
	const values = { ...readInitialGitHubExportValues(query), ...options };
	if (!values.repoUrl) {
		throw new Error(
			'Specify a GitHub repository, branch, or pull request URL.'
		);
	}
	const target = staticAnalyzeGitHubURL(values.repoUrl);
	if (!['repo', 'branch', 'pr'].includes(target.type)) {
		throw new Error(
			'Specify a GitHub repository, branch, or pull request URL.'
		);
	}
	if (!values.contentType) {
		throw new Error('Specify what you want to export.');
	}
	if (values.contentType === 'plugin' && !values.plugin) {
		throw new Error('Specify the plugin to export.');
	}
	if (values.contentType === 'theme' && !values.theme) {
		throw new Error('Specify the theme to export.');
	}
	const prAction = options.repoUrl
		? target.pr
			? 'update'
			: 'create'
		: (values.prAction ?? (target.pr ? 'update' : 'create'));
	const prNumber = options.repoUrl
		? (target.pr?.toString() ?? '')
		: (values.prNumber ?? target.pr?.toString() ?? '');
	if (
		prAction === 'update' &&
		(!Number.isSafeInteger(Number(prNumber)) || Number(prNumber) <= 0)
	) {
		throw new Error('Specify a valid pull request number.');
	}
	try {
		return await exportToGithub(playground, {
			...values,
			repoUrl: values.repoUrl,
			contentType: values.contentType,
			toPathInRepo:
				values.toPathInRepo ??
				joinPaths(
					'/',
					values.contentType === 'plugin'
						? values.plugin!
						: values.contentType === 'theme'
							? values.theme!
							: ''
				),
			fromPlaygroundRoot: values.fromPlaygroundRoot ?? '/wordpress',
			relativeExportPaths: values.relativeExportPaths ?? ['/'],
			commitMessage:
				values.commitMessage ?? 'Changes from WordPress Playground',
			includeZip:
				values.includeZip === true &&
				(query.get('ghexport-allow-include-zip') ?? 'yes') === 'yes',
			prAction,
			prNumber,
		});
	} catch (error) {
		if ((error as { status?: number })?.status === 401) {
			setOAuthToken(undefined);
			resetAuthenticatedGitHubClient();
		}
		throw error;
	}
}
