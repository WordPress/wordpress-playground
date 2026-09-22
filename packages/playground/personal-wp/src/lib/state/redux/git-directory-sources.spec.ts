import { describe, expect, it } from 'vitest';
import type { StepDefinition } from '@wp-playground/blueprints';
import { extractGitDirectorySource } from './git-directory-sources';

const step: StepDefinition = {
	step: 'installPlugin',
	pluginData: {
		resource: 'git:directory',
		url: 'https://github.com/example/plugin',
		ref: 'main',
	},
};

describe('extractGitDirectorySource', () => {
	it('records the actual install path reported by the step', () => {
		expect(
			extractGitDirectorySource(step, {
				assetPath: '/wordpress/wp-content/plugins/plugin',
			})
		).toEqual({
			assetPath: '/wordpress/wp-content/plugins/plugin',
			source: step.pluginData,
		});
	});

	it('does not attribute a skipped existing folder to the repository', () => {
		expect(
			extractGitDirectorySource(step, {
				assetPath: '/wordpress/wp-content/plugins/plugin',
				installationStatus: 'skipped-already-existed',
			})
		).toBeNull();
	});
});
