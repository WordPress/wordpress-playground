import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/client';
import type { GitHubExportOptions } from '@wp-playground/mcp/client';
import { exportActiveSiteToGithub } from './export-active-site';
import { exportToGithub } from './github-export-form/form';
import type * as GitHubExportForm from './github-export-form/form';
import { resetAuthenticatedGitHubClient } from './client';
import { setOAuthToken } from './state';

vi.mock('@wp-playground/client', () => ({
	getLegacyPlaygroundRuntimeWpContentPaths: vi.fn(),
	zipWpContent: vi.fn(),
}));

vi.mock('./github-export-form/form', async (importOriginal) => ({
	...(await importOriginal<typeof GitHubExportForm>()),
	exportToGithub: vi.fn(),
}));
vi.mock('./client', () => ({ resetAuthenticatedGitHubClient: vi.fn() }));
vi.mock('./state', () => ({ setOAuthToken: vi.fn() }));

describe('exportActiveSiteToGithub', () => {
	const playground = {} as PlaygroundClient;
	const actionQuery = new URLSearchParams({
		'ghexport-repo-url':
			'https://github.com/owner/repo/tree/feature/fix/plugins/demo',
		'ghexport-content-type': 'custom-paths',
		'ghexport-path': '.',
		'ghexport-plugin': 'demo',
		'ghexport-playground-root': '/wordpress/wp-content/plugins/demo',
		'ghexport-repo-root': 'plugins/demo',
		'ghexport-pr-action': 'create',
		'ghexport-base-branch': 'main',
		'ghexport-allow-include-zip': 'no',
		'ghexport-commit-message': 'Fixes #42',
	});
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

	it('inherits action launch settings when called without arguments', async () => {
		await exportActiveSiteToGithub(playground, {}, actionQuery);
		expect(exportToGithub).toHaveBeenCalledWith(playground, {
			repoUrl:
				'https://github.com/owner/repo/tree/feature/fix/plugins/demo',
			contentType: 'custom-paths',
			plugin: 'demo',
			fromPlaygroundRoot: '/wordpress/wp-content/plugins/demo',
			toPathInRepo: 'plugins/demo',
			relativeExportPaths: ['.'],
			prAction: 'create',
			baseBranch: 'main',
			prNumber: '',
			commitMessage: 'Fixes #42',
			includeZip: false,
		});
	});

	it('applies explicit overrides while retaining omitted launch settings', async () => {
		await exportActiveSiteToGithub(
			playground,
			{
				repoUrl: 'https://github.com/other/repo/pull/123',
				commitMessage: 'Reviewed fix',
				baseBranch: 'release',
				toPathInRepo: 'demo',
				includeZip: true,
			},
			actionQuery
		);
		expect(exportToGithub).toHaveBeenCalledWith(
			playground,
			expect.objectContaining({
				repoUrl: 'https://github.com/other/repo/pull/123',
				contentType: 'custom-paths',
				fromPlaygroundRoot: '/wordpress/wp-content/plugins/demo',
				toPathInRepo: 'demo',
				prAction: 'update',
				prNumber: '123',
				commitMessage: 'Reviewed fix',
				baseBranch: 'release',
				includeZip: false,
			})
		);
	});

	it('honors an update action and PR number supplied in the launch URL', async () => {
		const query = new URLSearchParams(actionQuery);
		query.set('ghexport-pr-action', 'update');
		query.set('ghexport-pr-number', '99');
		await exportActiveSiteToGithub(playground, {}, query);
		expect(exportToGithub).toHaveBeenCalledWith(
			playground,
			expect.objectContaining({
				prAction: 'update',
				prNumber: '99',
			})
		);
	});

	it.each([
		[{}, 'Specify a GitHub repository'],
		[
			{ repoUrl: 'https://github.com/owner/repo' },
			'Specify what you want to export',
		],
		[
			{ repoUrl: 'https://github.com/owner/repo', contentType: 'plugin' },
			'Specify the plugin',
		],
		[
			{ repoUrl: 'https://github.com/owner/repo', contentType: 'theme' },
			'Specify the theme',
		],
	] as const)(
		'rejects missing effective settings: %j',
		async (input, message) => {
			await expect(
				exportActiveSiteToGithub(playground, input)
			).rejects.toThrow(message);
			expect(exportToGithub).not.toHaveBeenCalled();
		}
	);

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
		).rejects.toThrow(
			'Specify a GitHub repository, branch, or pull request URL.'
		);
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
