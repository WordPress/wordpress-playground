import type { StepDefinition } from '@wp-playground/blueprints';
import {
	appendGitDirectoryStepToOriginalBlueprint,
	deriveFolderNameFromGitUrl,
	extractGitDirectorySource,
	normalizeGitUrl,
	parseGitHubTreeUrl,
	patchGitDirectoryStepFolderName,
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

describe('appendGitDirectoryStepToOriginalBlueprint', () => {
	it('appends the step to an existing declaration and reports its index', () => {
		const originalBlueprint = { steps: [{ step: 'login' }] };
		const result = appendGitDirectoryStepToOriginalBlueprint(
			originalBlueprint,
			gitInstallPluginStep
		);
		expect(result).not.toBeNull();
		expect(result!.stepIndex).toBe(1);
		expect((result!.updated as any).steps).toEqual([
			{ step: 'login' },
			gitInstallPluginStep,
		]);
		// The original declaration is not mutated in place.
		expect(originalBlueprint.steps).toHaveLength(1);
	});

	it('seeds a steps array when originalBlueprint has none', () => {
		const result = appendGitDirectoryStepToOriginalBlueprint(
			{ preferredVersions: { php: '8.2' } },
			gitInstallPluginStep
		);
		expect(result!.stepIndex).toBe(0);
		expect((result!.updated as any).steps).toEqual([gitInstallPluginStep]);
	});

	it('returns null for a filesystem-backed BlueprintBundle', () => {
		const bundle = {
			listFiles: async () => [],
			isDir: async () => false,
			read: async () => new Blob(),
			fileExists: async () => false,
		};
		expect(
			appendGitDirectoryStepToOriginalBlueprint(
				bundle,
				gitInstallPluginStep
			)
		).toBeNull();
	});
});

describe('patchGitDirectoryStepFolderName', () => {
	it('sets targetFolderName on the step at the given index', () => {
		const originalBlueprint = { steps: [gitInstallPluginStep] };
		const patched = patchGitDirectoryStepFolderName(
			originalBlueprint,
			0,
			'renamed-plugin'
		);
		expect((patched as any).steps[0].options.targetFolderName).toBe(
			'renamed-plugin'
		);
		// Everything else about the step is preserved.
		expect((patched as any).steps[0].pluginData).toEqual(
			(gitInstallPluginStep as any).pluginData
		);
	});

	it('preserves other existing options', () => {
		const stepWithOptions: StepDefinition = {
			...gitInstallPluginStep,
			options: { activate: false },
		} as any;
		const patched = patchGitDirectoryStepFolderName(
			{ steps: [stepWithOptions] },
			0,
			'renamed-plugin'
		);
		expect((patched as any).steps[0].options).toEqual({
			activate: false,
			targetFolderName: 'renamed-plugin',
		});
	});

	it('returns null when the index does not point at an install step', () => {
		const originalBlueprint = { steps: [{ step: 'login' }] };
		expect(
			patchGitDirectoryStepFolderName(originalBlueprint, 0, 'x')
		).toBeNull();
	});

	it('returns null when the index is out of range', () => {
		const originalBlueprint = { steps: [gitInstallPluginStep] };
		expect(
			patchGitDirectoryStepFolderName(originalBlueprint, 5, 'x')
		).toBeNull();
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
