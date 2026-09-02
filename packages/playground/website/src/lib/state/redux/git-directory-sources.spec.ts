import type { StepDefinition } from '@wp-playground/blueprints';
import type { GitDirectorySource } from './slice-sites';
import {
	buildGitDirectoryStep,
	buildUpdatedBlueprintDeclaration,
	deriveFolderNameFromGitUrl,
	extractGitDirectorySource,
	normalizeGitUrl,
	parseGitHubTreeUrl,
} from './git-directory-sources';

const gitInstallPluginStep: StepDefinition = {
	step: 'installPlugin',
	pluginData: {
		resource: 'git:directory',
		url: 'https://github.com/WordPress/wordpress-playground',
		ref: 'trunk',
		path: 'packages/playground',
	},
} as any;

const gitSource: GitDirectorySource = {
	url: 'https://github.com/WordPress/wordpress-playground',
	ref: 'trunk',
	path: 'packages/playground',
};

/** A minimal bundle-shaped mock: anything with a `read()` method satisfies `isBlueprintBundle`. */
function mockBundle(declaration: Record<string, unknown>) {
	return {
		read: async () => new Blob([JSON.stringify(declaration)]),
	};
}

describe('extractGitDirectorySource', () => {
	it('extracts the repo, ref, and resolved path from a git:directory installPlugin step', () => {
		const extracted = extractGitDirectorySource(gitInstallPluginStep, {
			assetPath: '/wordpress/wp-content/plugins/hello-dolly',
		});
		expect(extracted).toEqual({
			assetPath: '/wordpress/wp-content/plugins/hello-dolly',
			source: {
				url: 'https://github.com/WordPress/wordpress-playground',
				ref: 'trunk',
				refType: undefined,
				path: 'packages/playground',
			},
		});
	});

	it('returns null for a non-git:directory installPlugin step', () => {
		const step: StepDefinition = {
			step: 'installPlugin',
			pluginData: {
				resource: 'wordpress.org/plugins',
				slug: 'hello-dolly',
			},
		} as any;
		expect(extractGitDirectorySource(step, { assetPath: '/x' })).toBeNull();
	});

	it('returns null for an unrelated step', () => {
		const step: StepDefinition = { step: 'login' } as any;
		expect(extractGitDirectorySource(step, {})).toBeNull();
	});

	it('returns null when the step result carries no assetPath', () => {
		expect(
			extractGitDirectorySource(gitInstallPluginStep, undefined)
		).toBeNull();
	});
});

describe('buildGitDirectoryStep', () => {
	it('builds an installPlugin step for a plugins-folder path', () => {
		const step = buildGitDirectoryStep(
			'/wordpress/wp-content/plugins/hello-dolly',
			gitSource
		) as any;
		expect(step.step).toBe('installPlugin');
		expect(step.pluginData).toEqual({
			resource: 'git:directory',
			url: gitSource.url,
			ref: gitSource.ref,
			path: gitSource.path,
		});
		expect(step.options).toEqual({
			activate: false,
			targetFolderName: 'hello-dolly',
		});
	});

	it('builds an installTheme step for a themes-folder path', () => {
		const step = buildGitDirectoryStep(
			'/wordpress/wp-content/themes/my-theme',
			gitSource
		) as any;
		expect(step.step).toBe('installTheme');
		expect(step.themeData.resource).toBe('git:directory');
		expect(step.options.targetFolderName).toBe('my-theme');
	});

	it('uses the current basename, reflecting a rename', () => {
		const step = buildGitDirectoryStep(
			'/wordpress/wp-content/plugins/renamed-plugin',
			gitSource
		) as any;
		expect(step.options.targetFolderName).toBe('renamed-plugin');
	});

	it('omits refType/path when absent', () => {
		const step = buildGitDirectoryStep('/wordpress/wp-content/plugins/x', {
			url: gitSource.url,
			ref: gitSource.ref,
		}) as any;
		expect(step.pluginData).toEqual({
			resource: 'git:directory',
			url: gitSource.url,
			ref: gitSource.ref,
		});
	});
});

describe('buildUpdatedBlueprintDeclaration', () => {
	it('appends a step only for sources marked addedLive', async () => {
		const originalBlueprint = { steps: [{ step: 'login' }] };
		const declaration = await buildUpdatedBlueprintDeclaration(
			originalBlueprint,
			{
				'/wordpress/wp-content/plugins/from-boot': gitSource, // not addedLive
				'/wordpress/wp-content/plugins/from-mount': {
					...gitSource,
					addedLive: true,
				},
			}
		);
		expect((declaration as any).steps).toHaveLength(2);
		expect((declaration as any).steps[0]).toEqual({ step: 'login' });
		expect((declaration as any).steps[1].options.targetFolderName).toBe(
			'from-mount'
		);
		// The original declaration is not mutated in place.
		expect(originalBlueprint.steps).toHaveLength(1);
	});

	it('returns the base declaration unchanged when there are no live mounts', async () => {
		const originalBlueprint = { steps: [{ step: 'login' }] };
		const declaration = await buildUpdatedBlueprintDeclaration(
			originalBlueprint,
			{ '/wordpress/wp-content/plugins/from-boot': gitSource }
		);
		expect(declaration).toEqual(originalBlueprint);
	});

	it('returns an empty declaration when originalBlueprint is missing and there are no live mounts', async () => {
		expect(
			await buildUpdatedBlueprintDeclaration(undefined, undefined)
		).toEqual({});
	});

	it('seeds a steps array when originalBlueprint has none', async () => {
		const declaration = await buildUpdatedBlueprintDeclaration(
			{ preferredVersions: { php: '8.2' } },
			{
				'/wordpress/wp-content/plugins/from-mount': {
					...gitSource,
					addedLive: true,
				},
			}
		);
		expect((declaration as any).steps).toHaveLength(1);
	});

	it('flattens a bundle-shaped wrapper into a plain declaration', async () => {
		// This is the shape a plain remote-JSON Blueprint (e.g. the default
		// "New Playground" welcome Blueprint, or `?blueprint-url=...`) takes
		// once wrapped for `resource: "bundled"` resolution — see
		// resolveRemoteBlueprint(). Since this is only ever used to build a
		// preview (never written back to the site), it's safe to read
		// through it regardless of what it wraps.
		const wrapper = mockBundle({ steps: [{ step: 'login' }] });
		const declaration = await buildUpdatedBlueprintDeclaration(wrapper, {
			'/wordpress/wp-content/plugins/from-mount': {
				...gitSource,
				addedLive: true,
			},
		});
		expect((declaration as any).steps).toEqual([
			{ step: 'login' },
			expect.objectContaining({ step: 'installPlugin' }),
		]);
	});

	it('falls back to an empty base when a bundle cannot be read as JSON', async () => {
		const bundle = { read: async () => new Blob(['not json']) };
		const declaration = await buildUpdatedBlueprintDeclaration(bundle, {
			'/wordpress/wp-content/plugins/from-mount': {
				...gitSource,
				addedLive: true,
			},
		});
		expect((declaration as any).steps).toHaveLength(1);
	});
});

describe('normalizeGitUrl', () => {
	it('leaves an absolute URL untouched', () => {
		expect(normalizeGitUrl('https://github.com/owner/repo')).toBe(
			'https://github.com/owner/repo'
		);
		expect(normalizeGitUrl('http://example.com/owner/repo')).toBe(
			'http://example.com/owner/repo'
		);
	});

	it('adds https:// to a bare host+path', () => {
		expect(normalizeGitUrl('github.com/owner/repo')).toBe(
			'https://github.com/owner/repo'
		);
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeGitUrl('  github.com/owner/repo  ')).toBe(
			'https://github.com/owner/repo'
		);
	});
});

describe('parseGitHubTreeUrl', () => {
	it('splits a tree URL into the repo URL and the full remainder as ref', () => {
		expect(
			parseGitHubTreeUrl(
				'https://github.com/akirk/ai-assistant/tree/dist/main'
			)
		).toEqual({
			url: 'https://github.com/akirk/ai-assistant',
			ref: 'dist/main',
		});
	});

	it('works without a scheme', () => {
		expect(parseGitHubTreeUrl('github.com/owner/repo/tree/main')).toEqual({
			url: 'https://github.com/owner/repo',
			ref: 'main',
		});
	});

	it('returns null for a plain (non-tree) repo URL', () => {
		expect(parseGitHubTreeUrl('https://github.com/owner/repo')).toBeNull();
	});

	it('returns null for a non-GitHub URL', () => {
		expect(
			parseGitHubTreeUrl('https://gitlab.com/owner/repo/tree/main')
		).toBeNull();
	});
});

describe('deriveFolderNameFromGitUrl', () => {
	it('uses the repository name as the folder name', () => {
		expect(
			deriveFolderNameFromGitUrl(
				'https://github.com/WordPress/wordpress-playground'
			)
		).toBe('wordpress-playground');
	});

	it('strips a trailing .git', () => {
		expect(
			deriveFolderNameFromGitUrl(
				'https://github.com/WordPress/wordpress-playground.git'
			)
		).toBe('wordpress-playground');
	});

	it('strips a trailing slash', () => {
		expect(
			deriveFolderNameFromGitUrl(
				'https://github.com/WordPress/wordpress-playground/'
			)
		).toBe('wordpress-playground');
	});
});
