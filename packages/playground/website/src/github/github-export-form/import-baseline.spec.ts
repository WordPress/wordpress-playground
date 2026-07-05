import {
	createGitHubImportBaselineForExport,
	exportValuesMatchGitHubImportBaseline,
} from './import-baseline';

describe('createGitHubImportBaselineForExport', () => {
	it('prepares update values for pull request imports', () => {
		expect(
			createGitHubImportBaselineForExport({
				url: 'https://github.com/WordPress/gutenberg/pull/123',
				path: 'packages/demo',
				contentType: 'plugin',
				pluginOrThemeName: 'demo',
				filesCommitSha: 'head-sha',
				urlInformation: { pr: 123 },
			})
		).toEqual({
			initialValues: {
				repoUrl: 'https://github.com/WordPress/gutenberg/pull/123',
				prNumber: '123',
				toPathInRepo: 'packages/demo',
				prAction: 'update',
				contentType: 'plugin',
				plugin: 'demo',
			},
			filesCommitSha: 'head-sha',
		});
	});

	it('keeps create values defined for branch and repository imports', () => {
		expect(
			createGitHubImportBaselineForExport({
				url: 'https://github.com/WordPress/gutenberg/tree/trunk/packages/demo',
				path: 'packages/demo',
				contentType: 'plugin',
				pluginOrThemeName: 'demo',
				filesCommitSha: 'base-sha',
				urlInformation: {},
			}).initialValues
		).toMatchObject({
			prNumber: '',
			prAction: 'create',
		});
	});
});

describe('exportValuesMatchGitHubImportBaseline', () => {
	it('ignores commit-message-only edits', () => {
		const baseline = {
			repoUrl: 'https://github.com/WordPress/gutenberg/pull/123',
			prAction: 'update' as const,
			prNumber: '123',
			contentType: 'plugin' as const,
			toPathInRepo: 'packages/demo',
			plugin: 'demo',
		};

		expect(
			exportValuesMatchGitHubImportBaseline(
				{
					...baseline,
					commitMessage: 'Custom message',
					theme: '',
				},
				baseline
			)
		).toBe(true);
	});

	it('ignores irrelevant hidden plugin or theme fields', () => {
		expect(
			exportValuesMatchGitHubImportBaseline(
				{
					repoUrl: 'https://github.com/WordPress/gutenberg/pull/123',
					prAction: 'update',
					prNumber: '123',
					contentType: 'theme',
					toPathInRepo: 'packages/demo',
					plugin: '',
					theme: 'demo',
				},
				{
					repoUrl: 'https://github.com/WordPress/gutenberg/pull/123',
					prAction: 'update',
					prNumber: '123',
					contentType: 'theme',
					toPathInRepo: 'packages/demo',
					plugin: 'demo',
					theme: 'demo',
				}
			)
		).toBe(true);
	});

	it('detects target path edits', () => {
		const baseline = {
			repoUrl: 'https://github.com/WordPress/gutenberg/pull/123',
			prAction: 'update' as const,
			prNumber: '123',
			contentType: 'plugin' as const,
			toPathInRepo: 'packages/demo',
			plugin: 'demo',
		};

		expect(
			exportValuesMatchGitHubImportBaseline(
				{ ...baseline, toPathInRepo: 'packages/other' },
				baseline
			)
		).toBe(false);
	});
});
