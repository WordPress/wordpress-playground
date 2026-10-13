import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/client';
import type { GitHubExportOptions } from '@wp-playground/mcp/client';
import { exportActiveSiteToGithub } from './export-active-site';
import { exportToGithub } from './github-export-form/form';
import { resetAuthenticatedGitHubClient } from './client';
import { setOAuthToken } from './state';

vi.mock('./github-export-form/form', () => ({ exportToGithub: vi.fn() }));
vi.mock('./client', () => ({ resetAuthenticatedGitHubClient: vi.fn() }));
vi.mock('./state', () => ({ setOAuthToken: vi.fn() }));

describe('exportActiveSiteToGithub', () => {
	const playground = {} as PlaygroundClient;
	const options: GitHubExportOptions = {
		repoUrl: 'https://github.com/owner/repo',
		contentType: 'plugin',
		plugin: 'demo',
		toPathInRepo: 'demo',
		fromPlaygroundRoot: '/wordpress',
		relativeExportPaths: ['/'],
		commitMessage: 'Update demo',
		includeZip: false,
	};

	beforeEach(() => vi.resetAllMocks());

	it.each([
		['https://github.com/owner/repo', 'create', ''],
		['https://github.com/owner/repo/pull/123', 'update', '123'],
	])(
		'routes %s to the shared export flow',
		async (repoUrl, prAction, prNumber) => {
			const result = {
				url: 'https://github.com/owner/repo/pull/123',
				forked: false,
			};
			vi.mocked(exportToGithub).mockResolvedValue(result);
			expect(
				await exportActiveSiteToGithub(playground, {
					...options,
					repoUrl,
				})
			).toEqual(result);
			expect(exportToGithub).toHaveBeenCalledWith(playground, {
				...options,
				repoUrl,
				prAction,
				prNumber,
			});
		}
	);

	it.each([
		'https://example.com/owner/repo',
		'https://github.com/owner/repo/pull/nope',
	])('rejects unsupported targets before exporting: %s', async (repoUrl) => {
		await expect(
			exportActiveSiteToGithub(playground, { ...options, repoUrl })
		).rejects.toThrow('Specify a GitHub repository or pull request URL.');
		expect(exportToGithub).not.toHaveBeenCalled();
	});

	it('clears expired credentials and preserves the error', async () => {
		const error = Object.assign(new Error('Bad credentials'), {
			status: 401,
		});
		vi.mocked(exportToGithub).mockRejectedValue(error);
		await expect(
			exportActiveSiteToGithub(playground, options)
		).rejects.toBe(error);
		expect(setOAuthToken).toHaveBeenCalledWith(undefined);
		expect(resetAuthenticatedGitHubClient).toHaveBeenCalledOnce();
	});

	it.each([
		['plugin', '/demo'],
		['theme', '/example-theme'],
		['wp-content', '/'],
	] as const)(
		'uses the form destination default for %s exports',
		async (contentType, toPathInRepo) => {
			await exportActiveSiteToGithub(playground, {
				...options,
				contentType,
				theme: 'example-theme',
				toPathInRepo: undefined,
			});
			expect(exportToGithub).toHaveBeenCalledWith(
				playground,
				expect.objectContaining({ toPathInRepo })
			);
		}
	);
});
