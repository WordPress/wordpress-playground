import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { getRepositoryFilesForScopes, pushToGithub } from './form';

const storageMocks = vi.hoisted(() => ({
	changeset: vi.fn(),
	createClient: vi.fn(),
	createCommit: vi.fn(),
	createOrUpdateBranch: vi.fn(),
	createTree: vi.fn(),
	decodeGitHubBase64Content: vi.fn(),
	filesListToObject: vi.fn(),
	fork: vi.fn(),
	getFilesFromDirectory: vi.fn(),
	iterateFiles: vi.fn(),
	mayPush: vi.fn(),
}));

vi.mock('@wp-playground/client', () => ({
	wpContentFilesExcludedFromExport: [],
	zipWpContent: vi.fn(),
}));

vi.mock('@wp-playground/storage', () => storageMocks);

vi.mock('../github-oauth-guard', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../state', () => ({
	oAuthState: { value: { token: 'token' } },
	setOAuthToken: vi.fn(),
}));

describe('pushToGithub', () => {
	beforeEach(() => {
		for (const mock of Object.values(storageMocks)) {
			mock.mockReset();
		}
		storageMocks.createTree.mockResolvedValue('tree-sha');
		storageMocks.createCommit.mockResolvedValue('commit-sha');
		storageMocks.createOrUpdateBranch.mockResolvedValue(undefined);
		storageMocks.fork.mockResolvedValue('playground-user');
	});

	it('stops a new PR export when the target branch moved after comparison', async () => {
		storageMocks.mayPush.mockResolvedValue(true);
		const octokit = createOctokit({ branchSha: 'new-base-sha' });

		await expect(
			pushToGithub(octokit as any, {
				owner: 'WordPress',
				repo: 'wordpress-playground',
				commitMessage: 'Changes from Playground',
				changeset: createChangeset(),
				shouldCreateNewPR: true,
				create: {
					againstBranch: 'trunk',
					branchName: 'playground-changes',
					expectedBaseSha: 'old-base-sha',
					title: 'Update plugin',
				},
				update: {
					prNumber: 0,
				},
			})
		).rejects.toThrow('target branch changed');

		expect(storageMocks.createTree).not.toHaveBeenCalled();
		expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
		expect(octokit.rest.pulls.create).not.toHaveBeenCalled();
	});

	it('branches fork exports from the target repository base commit', async () => {
		storageMocks.mayPush.mockResolvedValue(false);
		const changeset = createChangeset();
		const octokit = createOctokit({ branchSha: 'base-sha' });

		const result = await pushToGithub(octokit as any, {
			owner: 'WordPress',
			repo: 'wordpress-playground',
			commitMessage: 'Changes from Playground',
			changeset,
			shouldCreateNewPR: true,
			create: {
				againstBranch: 'trunk',
				branchName: 'playground-changes',
				expectedBaseSha: 'base-sha',
				title: 'Update plugin',
			},
			update: {
				prNumber: 0,
			},
		});

		expect(octokit.rest.repos.getBranch).toHaveBeenCalledWith({
			owner: 'WordPress',
			repo: 'wordpress-playground',
			branch: 'trunk',
		});
		expect(storageMocks.createTree).toHaveBeenCalledWith(
			octokit,
			'playground-user',
			'wordpress-playground',
			'base-sha',
			changeset
		);
		expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
			owner: 'playground-user',
			repo: 'wordpress-playground',
			sha: 'commit-sha',
			ref: 'refs/heads/playground-changes',
		});
		expect(result).toEqual({
			url: 'https://github.com/WordPress/wordpress-playground/pull/1',
			forked: true,
		});
	});

	it('does not create a commit when there are no export changes', async () => {
		storageMocks.mayPush.mockResolvedValue(true);
		storageMocks.createTree.mockResolvedValue(null);
		const octokit = createOctokit({ branchSha: 'base-sha' });

		await expect(
			pushToGithub(octokit as any, {
				owner: 'WordPress',
				repo: 'wordpress-playground',
				commitMessage: 'Changes from Playground',
				changeset: createChangeset(),
				shouldCreateNewPR: true,
				create: {
					againstBranch: 'trunk',
					branchName: 'playground-changes',
					expectedBaseSha: 'base-sha',
					title: 'Update plugin',
				},
				update: {
					prNumber: 0,
				},
			})
		).rejects.toThrow('There are no changes to export');

		expect(storageMocks.createCommit).not.toHaveBeenCalled();
		expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
		expect(octokit.rest.pulls.create).not.toHaveBeenCalled();
	});
});

function createChangeset() {
	return {
		create: new Map([
			['wp-content/plugins/demo/demo.php', new Uint8Array()],
		]),
		update: new Map(),
		delete: new Set<string>(),
	};
}

function createOctokit({ branchSha }: { branchSha: string }) {
	return {
		rest: {
			repos: {
				getBranch: vi.fn(async () => ({
					data: {
						commit: {
							sha: branchSha,
						},
					},
				})),
			},
			git: {
				createRef: vi.fn(async () => ({})),
			},
			pulls: {
				create: vi.fn(async () => ({
					data: {
						html_url:
							'https://github.com/WordPress/wordpress-playground/pull/1',
					},
				})),
				get: vi.fn(),
			},
		},
	};
}

describe('getRepositoryFilesForScopes', () => {
	it('rejects single-file comparison when GitHub omits inline file content', async () => {
		const content = {
			name: 'large.zip',
			path: 'wp-content/plugins/demo/large.zip',
			content: '',
			encoding: 'none',
		};
		storageMocks.decodeGitHubBase64Content.mockImplementation(() => {
			throw new Error(
				'GitHub did not return inline file content for wp-content/plugins/demo/large.zip'
			);
		});
		const octokit = {
			rest: {
				repos: {
					getContent: vi.fn(async () => ({ data: content })),
				},
			},
		};

		await expect(
			getRepositoryFilesForScopes(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'head-sha',
				'wp-content/plugins/demo/large.zip',
				[
					{
						path: 'wp-content/plugins/demo/large.zip',
						recursive: false,
					},
				]
			)
		).rejects.toThrow(
			'GitHub did not return inline file content for wp-content/plugins/demo/large.zip'
		);
		expect(storageMocks.decodeGitHubBase64Content).toHaveBeenCalledWith(
			content,
			'wp-content/plugins/demo/large.zip'
		);
	});

	it('rejects single-file comparison when GitHub omits the content field', async () => {
		const content = {
			name: 'large.zip',
			path: 'wp-content/plugins/demo/large.zip',
		};
		storageMocks.decodeGitHubBase64Content.mockImplementation(() => {
			throw new Error(
				'No content found for wp-content/plugins/demo/large.zip'
			);
		});
		const octokit = {
			rest: {
				repos: {
					getContent: vi.fn(async () => ({ data: content })),
				},
			},
		};

		await expect(
			getRepositoryFilesForScopes(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'head-sha',
				'wp-content/plugins/demo/large.zip',
				[
					{
						path: 'wp-content/plugins/demo/large.zip',
						recursive: false,
					},
				]
			)
		).rejects.toThrow(
			'No content found for wp-content/plugins/demo/large.zip'
		);
		expect(storageMocks.decodeGitHubBase64Content).toHaveBeenCalledWith(
			content,
			'wp-content/plugins/demo/large.zip'
		);
	});

	it('rejects exporting a single file over an existing repository directory', async () => {
		const octokit = {
			rest: {
				repos: {
					getContent: vi.fn(async () => ({
						data: [
							{
								name: 'nested.php',
								path: 'wp-content/plugins/demo/nested.php',
								type: 'file',
							},
						],
					})),
				},
			},
		};

		await expect(
			getRepositoryFilesForScopes(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'head-sha',
				'wp-content/plugins/demo',
				[
					{
						path: 'wp-content/plugins/demo',
						recursive: false,
					},
				]
			)
		).rejects.toThrow(
			'The selected repository path is a directory. Enter a file path for a single-file export.'
		);
	});
});
