import { describe, expect, it, vi } from 'vitest';
import { createGitHubExportTool } from '../../src/github-export';

describe('playground_export_to_github', () => {
	it('passes validated options to the host and returns the PR result', async () => {
		const result = {
			url: 'https://github.com/owner/repo/pull/1',
			forked: true,
		};
		const exportToGithub = vi.fn().mockResolvedValue(result);
		const tool = createGitHubExportTool(exportToGithub);

		expect(
			await tool.execute({
				repoUrl: 'https://github.com/owner/repo',
				contentType: 'plugin',
				plugin: 'demo',
				toPathInRepo: 'plugins/demo',
			})
		).toEqual(result);
		expect(exportToGithub).toHaveBeenCalledWith(
			expect.objectContaining({
				plugin: 'demo',
				toPathInRepo: 'plugins/demo',
			})
		);
	});

	it.each([
		{ contentType: 'plugin', plugin: '' },
		{ contentType: 'theme', theme: 42 },
		{ contentType: 'unknown' },
		{ contentType: 'wp-content', includeZip: 'yes' },
	])(
		'rejects invalid input before invoking the export: %j',
		async (input) => {
			const exportToGithub = vi.fn();
			const tool = createGitHubExportTool(exportToGithub);
			expect(
				await tool.execute({
					repoUrl: 'https://github.com/owner/repo',
					...input,
				})
			).toHaveProperty('error');
			expect(exportToGithub).not.toHaveBeenCalled();
		}
	);

	it('reports host failures to the caller', async () => {
		const tool = createGitHubExportTool(
			vi
				.fn()
				.mockRejectedValue(
					new Error('GitHub authentication is required.')
				)
		);
		expect(
			await tool.execute({
				repoUrl: 'https://github.com/owner/repo',
				contentType: 'wp-content',
			})
		).toEqual({
			error: 'GitHub export failed: GitHub authentication is required.',
		});
	});

	it('leaves omitted arguments to the host launch defaults', async () => {
		const exportToGithub = vi.fn();
		await createGitHubExportTool(exportToGithub).execute({});
		expect(exportToGithub).toHaveBeenCalledWith({});
	});
});
