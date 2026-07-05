import { afterEach, vi } from 'vitest';
import type { Changeset } from '../lib/changeset';
import {
	createOrUpdateBranch,
	createTreeNode,
	createTree,
	deleteFile,
	fork,
	getFilesFromDirectory,
} from '../lib/github';

afterEach(() => {
	vi.useRealTimers();
});

describe('getFilesFromDirectory', () => {
	it('decodes inline base64 content from the repository Contents API', async () => {
		const octokit = createContentOctokit({
			'': [
				{
					type: 'file',
					name: 'plugin.php',
					path: 'plugin.php',
				},
			],
			'plugin.php': {
				name: 'plugin.php',
				path: 'plugin.php',
				content: 'SGVs\nbG8=',
				encoding: 'base64',
			},
		});

		const files = await getFilesFromDirectory(
			octokit as any,
			'WordPress',
			'wordpress-playground',
			'trunk',
			''
		);

		expect(files).toHaveLength(1);
		expect(files[0]).toMatchObject({
			name: 'plugin.php',
			path: 'plugin.php',
		});
		expect(new TextDecoder().decode(files[0].content)).toBe('Hello');
	});

	it('rejects files that GitHub does not return as inline content', async () => {
		const octokit = createContentOctokit({
			'': [
				{
					type: 'file',
					name: 'large.zip',
					path: 'large.zip',
				},
			],
			'large.zip': {
				name: 'large.zip',
				path: 'large.zip',
				content: '',
				encoding: 'none',
			},
		});

		await expect(
			getFilesFromDirectory(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'trunk',
				''
			)
		).rejects.toThrow(
			'GitHub did not return inline file content for large.zip'
		);
	});
});

describe('createOrUpdateBranch', () => {
	it('updates an existing branch', async () => {
		const octokit = {
			request: vi.fn().mockResolvedValue({}),
		};

		await createOrUpdateBranch(
			octokit as any,
			'WordPress',
			'wordpress-playground',
			'playground-changes',
			'commit-sha'
		);

		expect(octokit.request).toHaveBeenNthCalledWith(
			1,
			'GET /repos/{owner}/{repo}/branches/{branch}',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
				branch: 'playground-changes',
			}
		);
		expect(octokit.request).toHaveBeenNthCalledWith(
			2,
			'PATCH /repos/{owner}/{repo}/git/refs/{ref}',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
				ref: 'heads/playground-changes',
				sha: 'commit-sha',
			}
		);
	});

	it('creates a missing branch', async () => {
		const notFound = new Error('Not found') as Error & { status: number };
		notFound.status = 404;
		const octokit = {
			request: vi
				.fn()
				.mockRejectedValueOnce(notFound)
				.mockResolvedValue({}),
		};

		await createOrUpdateBranch(
			octokit as any,
			'WordPress',
			'wordpress-playground',
			'playground-changes',
			'commit-sha'
		);

		expect(octokit.request).toHaveBeenNthCalledWith(
			2,
			'POST /repos/{owner}/{repo}/git/refs',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
				ref: 'refs/heads/playground-changes',
				sha: 'commit-sha',
			}
		);
	});

	it('reports non-missing branch lookup errors', async () => {
		const apiError = new Error('GitHub API failed') as Error & {
			status: number;
		};
		apiError.status = 500;
		const octokit = {
			request: vi.fn().mockRejectedValue(apiError),
		};

		await expect(
			createOrUpdateBranch(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'playground-changes',
				'commit-sha'
			)
		).rejects.toThrow('GitHub API failed');

		expect(octokit.request).toHaveBeenCalledTimes(1);
	});
});

describe('deleteFile', () => {
	it('returns a tree deletion node when the file exists', async () => {
		const octokit = {
			request: vi.fn().mockResolvedValue({}),
		};

		await expect(
			deleteFile(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'parent-sha',
				'plugin.php'
			)
		).resolves.toEqual({
			path: 'plugin.php',
			mode: '100644',
			type: 'blob',
			sha: null,
		});
		expect(octokit.request).toHaveBeenCalledWith(
			'HEAD /repos/{owner}/{repo}/contents/{path}',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
				ref: 'parent-sha',
				path: 'plugin.php',
			}
		);
	});

	it('ignores missing files', async () => {
		const notFound = new Error('Not found') as Error & { status: number };
		notFound.status = 404;
		const octokit = {
			request: vi.fn().mockRejectedValue(notFound),
		};

		await expect(
			deleteFile(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'parent-sha',
				'plugin.php'
			)
		).resolves.toBeUndefined();
	});

	it('reports non-missing lookup errors', async () => {
		const apiError = new Error('GitHub API failed') as Error & {
			status: number;
		};
		apiError.status = 500;
		const octokit = {
			request: vi.fn().mockRejectedValue(apiError),
		};

		await expect(
			deleteFile(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'parent-sha',
				'plugin.php'
			)
		).rejects.toThrow('GitHub API failed');
	});
});

describe('createTree', () => {
	it('uses the parent commit tree as the base tree', async () => {
		const octokit = {
			request: vi
				.fn()
				.mockResolvedValueOnce({
					data: {
						tree: {
							sha: 'parent-tree-sha',
						},
					},
				})
				.mockResolvedValueOnce({
					data: {
						sha: 'new-tree-sha',
					},
				}),
		};
		const changeset: Changeset = {
			create: new Map([
				['plugin.php', new TextEncoder().encode('<?php // plugin')],
			]),
			update: new Map(),
			delete: new Set(),
		};

		await expect(
			createTree(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'parent-commit-sha',
				changeset
			)
		).resolves.toBe('new-tree-sha');

		expect(octokit.request).toHaveBeenNthCalledWith(
			1,
			'GET /repos/{owner}/{repo}/git/commits/{commit_sha}',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
				commit_sha: 'parent-commit-sha',
			}
		);
		expect(octokit.request).toHaveBeenNthCalledWith(
			2,
			'POST /repos/{owner}/{repo}/git/trees',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
				base_tree: 'parent-tree-sha',
				tree: [
					{
						path: 'plugin.php',
						content: '<?php // plugin',
						mode: '100644',
						type: 'blob',
					},
				],
			}
		);
	});

	it('does not create a GitHub tree for an empty changeset', async () => {
		const octokit = {
			request: vi.fn(),
		};
		const changeset: Changeset = {
			create: new Map(),
			update: new Map(),
			delete: new Set(),
		};

		await expect(
			createTree(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'parent-commit-sha',
				changeset
			)
		).resolves.toBeNull();

		expect(octokit.request).not.toHaveBeenCalled();
	});
});

describe('createTreeNode', () => {
	it('creates a base64 blob for binary content', async () => {
		const octokit = {
			rest: {
				git: {
					createBlob: vi.fn().mockResolvedValue({
						data: {
							sha: 'binary-blob-sha',
						},
					}),
				},
			},
		};

		await expect(
			createTreeNode(
				octokit as any,
				'WordPress',
				'wordpress-playground',
				'image.bin',
				new Uint8Array([0xff, 0x00])
			)
		).resolves.toEqual({
			path: 'image.bin',
			mode: '100644',
			type: 'blob',
			sha: 'binary-blob-sha',
		});
		expect(octokit.rest.git.createBlob).toHaveBeenCalledWith({
			owner: 'WordPress',
			repo: 'wordpress-playground',
			encoding: 'base64',
			content: '/wA=',
		});
	});
});

describe('fork', () => {
	it('waits for newly-created forks before returning', async () => {
		vi.useFakeTimers();
		const notFound = new Error('Not found') as Error & { status: number };
		notFound.status = 404;
		const octokit = {
			request: vi
				.fn()
				.mockResolvedValueOnce({
					data: {
						login: 'playground-user',
					},
				})
				.mockResolvedValueOnce({
					data: [],
				})
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce(notFound)
				.mockResolvedValueOnce({}),
		};

		const forkPromise = fork(
			octokit as any,
			'WordPress',
			'wordpress-playground'
		);
		await vi.advanceTimersByTimeAsync(1000);

		await expect(forkPromise).resolves.toBe('playground-user');
		expect(octokit.request).toHaveBeenNthCalledWith(
			3,
			'POST /repos/{owner}/{repo}/forks',
			{
				owner: 'WordPress',
				repo: 'wordpress-playground',
			}
		);
		expect(octokit.request).toHaveBeenNthCalledWith(
			4,
			'GET /repos/{owner}/{repo}',
			{
				owner: 'playground-user',
				repo: 'wordpress-playground',
			}
		);
		expect(octokit.request).toHaveBeenNthCalledWith(
			5,
			'GET /repos/{owner}/{repo}',
			{
				owner: 'playground-user',
				repo: 'wordpress-playground',
			}
		);
	});

	it('reports fork readiness errors after the fork request succeeds', async () => {
		const apiError = new Error('GitHub API failed') as Error & {
			status: number;
		};
		apiError.status = 500;
		const octokit = {
			request: vi
				.fn()
				.mockResolvedValueOnce({
					data: {
						login: 'playground-user',
					},
				})
				.mockResolvedValueOnce({
					data: [],
				})
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce(apiError),
		};

		await expect(
			fork(octokit as any, 'WordPress', 'wordpress-playground')
		).rejects.toThrow('GitHub API failed');
	});
});

function createContentOctokit(contentsByPath: Record<string, unknown>) {
	return {
		rest: {
			repos: {
				getContent: vi.fn(async ({ path }: { path: string }) => {
					if (!(path in contentsByPath)) {
						throw new Error(`Unexpected getContent path: ${path}`);
					}
					return { data: contentsByPath[path] };
				}),
			},
		},
	};
}
