import type { PlaygroundClient } from '@wp-playground/client';
import type { GitHubExportOptions } from '@wp-playground/mcp/client';
import { staticAnalyzeGitHubURL } from './analyze-github-url';
import { exportToGithub } from './github-export-form/form';
import { resetAuthenticatedGitHubClient } from './client';
import { setOAuthToken } from './state';
import { joinPaths } from '@php-wasm/util';

export async function exportActiveSiteToGithub(
	playground: PlaygroundClient,
	options: GitHubExportOptions
) {
	const target = staticAnalyzeGitHubURL(options.repoUrl);
	if (target.type !== 'repo' && target.type !== 'pr') {
		throw new Error('Specify a GitHub repository or pull request URL.');
	}
	try {
		return await exportToGithub(playground, {
			...options,
			toPathInRepo:
				options.toPathInRepo ??
				joinPaths(
					'/',
					options.contentType === 'plugin'
						? options.plugin!
						: options.contentType === 'theme'
							? options.theme!
							: ''
				),
			prAction: target.type === 'pr' ? 'update' : 'create',
			prNumber: target.pr ? String(target.pr) : '',
		});
	} catch (error) {
		if ((error as { status?: number })?.status === 401) {
			setOAuthToken(undefined);
			resetAuthenticatedGitHubClient();
		}
		throw error;
	}
}
