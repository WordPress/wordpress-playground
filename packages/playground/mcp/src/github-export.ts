import { z } from 'zod';
import type { PlaygroundBridgeConfig } from './bridge-client';
import type { ModelContextTool } from './webmcp';
import { stringifyError } from './tools/tool-definitions';

export function createGitHubExportTool(
	exportToGithub: NonNullable<PlaygroundBridgeConfig['exportToGithub']>
) {
	return {
		name: 'playground_export_to_github',
		description:
			'Export files from the active Playground site to GitHub by creating or updating a pull request. ' +
			'Requires the user to sign in through Export to GitHub first. ' +
			'The destination directory is synchronized with the exported files, including deletions. ' +
			'Returns the pull request URL and whether a fork was used.',
		inputSchema: z.toJSONSchema(githubExportSchema, { io: 'input' }),
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: true,
		},
		execute: async (input) => {
			try {
				const options = githubExportSchema.parse(input);
				if (options.contentType === 'plugin' && !options.plugin) {
					throw new Error('Specify the plugin to export.');
				}
				if (options.contentType === 'theme' && !options.theme) {
					throw new Error('Specify the theme to export.');
				}
				return await exportToGithub(options);
			} catch (error) {
				return {
					error: `GitHub export failed: ${stringifyError(error)}`,
				};
			}
		},
	} satisfies ModelContextTool;
}

export const githubExportSchema = z.object({
	repoUrl: z
		.string()
		.url()
		.describe(
			'GitHub repository URL to create a PR, or pull request URL to update it.'
		),
	contentType: z.enum(['plugin', 'theme', 'wp-content', 'custom-paths']),
	plugin: z
		.string()
		.min(1)
		.optional()
		.describe('Plugin directory name, required for plugin exports.'),
	theme: z
		.string()
		.min(1)
		.optional()
		.describe('Theme directory name, required for theme exports.'),
	toPathInRepo: z
		.string()
		.optional()
		.describe(
			'Destination directory. Defaults to the plugin or theme name, otherwise the repository root. ' +
				'Its contents are replaced by the export.'
		),
	fromPlaygroundRoot: z
		.string()
		.default('/wordpress')
		.describe('Source root for custom-paths exports.'),
	relativeExportPaths: z
		.array(z.string())
		.default(['/'])
		.describe(
			'Paths relative to the source root for custom-paths exports.'
		),
	commitMessage: z
		.string()
		.trim()
		.min(1)
		.default('Changes from WordPress Playground'),
	includeZip: z
		.boolean()
		.default(false)
		.describe('Also include a ZIP for Playground previews.'),
});

export type GitHubExportOptions = z.infer<typeof githubExportSchema>;
