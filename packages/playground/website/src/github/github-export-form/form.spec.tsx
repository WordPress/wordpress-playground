import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { pushToGithub } from './form';

const storageMocks = vi.hoisted(() => ({
	changeset: vi.fn(),
	createCommit: vi.fn(),
	createOrUpdateBranch: vi.fn(),
	createTree: vi.fn(),
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

vi.mock('../client', () => ({
	getAuthenticatedGitHubClient: vi.fn(),
	resetAuthenticatedGitHubClient: vi.fn(),
}));

vi.mock('../github-oauth-guard', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../state', () => ({
	setOAuthToken: vi.fn(),
}));

describe('pushToGithub', () => {
	beforeEach(() => {
		vi.stubGlobal('document', {
			location: {
				origin: 'https://playground.test',
				pathname: '/website-server/',
			},
		});
		for (const mock of Object.values(storageMocks)) {
			mock.mockReset();
		}
		storageMocks.createTree.mockResolvedValue('tree-sha');
		storageMocks.createCommit.mockResolvedValue('commit-sha');
		storageMocks.createOrUpdateBranch.mockResolvedValue(undefined);
		storageMocks.fork.mockResolvedValue('playground-user');
	});

	it('updates an existing PR by pushing to the PR head repository', async () => {
		storageMocks.mayPush.mockResolvedValue(true);
		const changeset = createChangeset();
		const octokit = createOctokit({
			pullRequest: createPullRequest({
				headOwner: 'contributor',
				headRepo: 'wordpress-playground-fork',
				headSha: 'head-sha',
				headRef: 'playground-export',
				htmlUrl:
					'https://github.com/WordPress/wordpress-playground/pull/12',
			}),
		});

		const result = await pushToGithub(octokit as any, {
			owner: 'WordPress',
			repo: 'wordpress-playground',
			commitMessage: 'Changes from Playground',
			changeset,
			shouldCreateNewPR: false,
			create: {
				againstBranch: 'trunk',
				branchName: 'unused',
				title: 'Update plugin',
			},
			update: {
				prNumber: 12,
			},
		});

		expect(storageMocks.fork).not.toHaveBeenCalled();
		expect(octokit.rest.repos.getBranch).not.toHaveBeenCalled();
		expect(storageMocks.mayPush).toHaveBeenCalledWith(
			octokit,
			'contributor',
			'wordpress-playground-fork'
		);
		expect(storageMocks.createTree).toHaveBeenCalledWith(
			octokit,
			'contributor',
			'wordpress-playground-fork',
			'head-sha',
			changeset
		);
		expect(storageMocks.createCommit).toHaveBeenCalledWith(
			octokit,
			'contributor',
			'wordpress-playground-fork',
			'Changes from Playground',
			'head-sha',
			'tree-sha'
		);
		expect(storageMocks.createOrUpdateBranch).toHaveBeenCalledWith(
			octokit,
			'contributor',
			'wordpress-playground-fork',
			'playground-export',
			'commit-sha'
		);
		expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
		expect(octokit.rest.pulls.create).not.toHaveBeenCalled();
		expect(result).toEqual({
			url: 'https://github.com/WordPress/wordpress-playground/pull/12',
			forked: false,
		});
	});

	it('adds zip preview links that use the PR head before merge', async () => {
		storageMocks.mayPush.mockResolvedValue(true);
		const octokit = createOctokit({
			pullRequest: createPullRequest({
				headOwner: 'contributor',
				headRepo: 'wordpress-playground-fork',
				headRef: 'feature/export',
				htmlUrl:
					'https://github.com/WordPress/wordpress-playground/pull/12',
			}),
		});

		await pushToGithub(octokit as any, {
			owner: 'WordPress',
			repo: 'wordpress-playground',
			commitMessage: 'Changes from Playground',
			changeset: createChangeset(),
			zipPathForPreview: 'wp-content/plugins/demo/playground.zip',
			shouldCreateNewPR: false,
			create: {
				againstBranch: 'unused',
				branchName: 'unused',
				title: 'Update plugin',
			},
			update: {
				prNumber: 12,
			},
		});

		const commitMessage = storageMocks.createCommit.mock.calls[0][3];
		expect(commitMessage).toContain('Also exported as a zip file.');
		expect(commitMessage).toContain(
			'raw.githubusercontent.com%2Fcontributor%2Fwordpress-playground-fork%2Frefs%2Fheads%2Ffeature%2Fexport%2Fwp-content%2Fplugins%2Fdemo%2Fplayground.zip'
		);
		expect(commitMessage).toContain(
			'raw.githubusercontent.com%2FWordPress%2Fwordpress-playground%2Frefs%2Fheads%2Ftrunk%2Fwp-content%2Fplugins%2Fdemo%2Fplayground.zip'
		);
	});

	it('creates a fork branch when the target repository cannot be pushed', async () => {
		storageMocks.mayPush.mockResolvedValue(false);
		const changeset = createChangeset();
		const octokit = createOctokit({
			branchSha: 'base-sha',
		});

		const result = await pushToGithub(octokit as any, {
			owner: 'WordPress',
			repo: 'wordpress-playground',
			commitMessage: 'Changes from Playground',
			changeset,
			shouldCreateNewPR: true,
			create: {
				againstBranch: 'trunk',
				branchName: 'playground-changes',
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

	it('does not push a commit when there are no changes to export', async () => {
		storageMocks.mayPush.mockResolvedValue(true);
		storageMocks.createTree.mockResolvedValue(null);
		const octokit = createOctokit();

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
					title: 'Update plugin',
				},
				update: {
					prNumber: 0,
				},
			})
		).rejects.toThrow(
			'There are no changes to export. Make an edit in the Playground before exporting to GitHub.'
		);

		expect(storageMocks.createCommit).not.toHaveBeenCalled();
		expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
		expect(storageMocks.createOrUpdateBranch).not.toHaveBeenCalled();
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

function createOctokit({
	branchSha = 'base-sha',
	pullRequest = createPullRequest({}),
} = {}) {
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
				get: vi.fn(async () => ({
					data: pullRequest,
				})),
			},
		},
	};
}

function createPullRequest({
	headOwner = 'WordPress',
	headRepo = 'wordpress-playground',
	headSha = 'head-sha',
	headRef = 'playground-changes',
	baseRef = 'trunk',
	htmlUrl = 'https://github.com/WordPress/wordpress-playground/pull/1',
}: {
	headOwner?: string;
	headRepo?: string;
	headSha?: string;
	headRef?: string;
	baseRef?: string;
	htmlUrl?: string;
}) {
	return {
		html_url: htmlUrl,
		head: {
			sha: headSha,
			ref: headRef,
			repo: {
				name: headRepo,
				owner: {
					login: headOwner,
				},
			},
		},
		base: {
			ref: baseRef,
		},
	};
}
