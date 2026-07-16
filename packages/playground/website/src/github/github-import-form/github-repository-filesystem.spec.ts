import type { GithubClient } from '@wp-playground/storage';
import { GitHubRepositoryFilesystem } from './github-repository-filesystem';

describe('GitHubRepositoryFilesystem', () => {
	it('loads directories lazily and reuses entry types from their parent', async () => {
		const getContent = vi.fn(async ({ path }: { path: string }) => {
			if (path === '') {
				return {
					data: [
						{ name: 'plugin', type: 'dir' },
						{ name: 'readme.md', type: 'file' },
					],
				};
			}
			if (path === 'plugin') {
				return {
					data: [{ name: 'plugin.php', type: 'file' }],
				};
			}
			throw new Error(`Unexpected path: ${path}`);
		});
		const client = {
			rest: { repos: { getContent } },
		} as unknown as GithubClient;
		const filesystem = new GitHubRepositoryFilesystem(
			() => client,
			'owner',
			'repository',
			'commit-sha'
		);

		await expect(filesystem.listFiles('/')).resolves.toEqual([
			'plugin',
			'readme.md',
		]);
		await expect(filesystem.isDir('/plugin')).resolves.toBe(true);
		await expect(filesystem.isDir('/readme.md')).resolves.toBe(false);
		expect(getContent).toHaveBeenCalledTimes(1);

		await expect(filesystem.listFiles('/plugin')).resolves.toEqual([
			'plugin.php',
		]);
		expect(getContent).toHaveBeenLastCalledWith({
			owner: 'owner',
			repo: 'repository',
			ref: 'commit-sha',
			path: 'plugin',
		});
	});

	it('rejects filesystem mutations', async () => {
		const filesystem = new GitHubRepositoryFilesystem(
			() => ({}) as GithubClient,
			'owner',
			'repository',
			'commit-sha'
		);

		await expect(filesystem.mkdir('/new-directory')).rejects.toThrow(
			'read-only'
		);
	});
});
