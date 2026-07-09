import type { BlueprintV2Declaration } from './blueprint-v2-declaration';

/**
 * Describes how WordPress Playground handles a Blueprint v2 schema field.
 */
export type BlueprintV2PlaygroundSupportStatus =
	| 'supported'
	| 'partially-supported'
	| 'metadata-only'
	| 'not-applicable';

/**
 * Documents the runtime status and relevant limitations of one schema field.
 */
export type BlueprintV2PlaygroundSupportEntry = {
	status: BlueprintV2PlaygroundSupportStatus;
	description: string;
};

type BlueprintV2PlaygroundSupportContract = {
	[Field in keyof BlueprintV2Declaration]-?: BlueprintV2PlaygroundSupportEntry;
};

/**
 * Defines Playground's support contract for every top-level Blueprint v2 field.
 *
 * Keep this object exhaustive. The mapped type makes typechecking fail when the
 * Blueprint v2 schema adds or removes a field without updating this contract.
 */
export const blueprintV2PlaygroundSupport = {
	version: {
		status: 'supported',
		description: 'Selects the Blueprint v2 compiler and runner.',
	},
	$schema: {
		status: 'not-applicable',
		description:
			'Used by authoring tools; Blueprint execution does not resolve or fetch it.',
	},
	blueprintMeta: {
		status: 'metadata-only',
		description:
			'Used by Playground surfaces such as site naming and has no runner effect.',
	},
	applicationOptions: {
		status: 'supported',
		description:
			'Applies Playground landing page, login, and network access options.',
	},
	siteLanguage: {
		status: 'supported',
		description: 'Sets the site locale and installs its translations.',
	},
	siteOptions: {
		status: 'supported',
		description: 'Updates declared WordPress site options.',
	},
	constants: {
		status: 'supported',
		description: 'Defines declared WordPress configuration constants.',
	},
	wordpressVersion: {
		status: 'partially-supported',
		description:
			'Supports named versions, constraints, and HTTP(S) ZIP URLs. ' +
			'Execution-context and structured data references are rejected.',
	},
	phpVersion: {
		status: 'supported',
		description:
			'Resolves exact versions, latest, and constraints. The next build is web-only.',
	},
	activeTheme: {
		status: 'supported',
		description: 'Installs and activates the declared theme.',
	},
	themes: {
		status: 'supported',
		description: 'Installs declared inactive themes.',
	},
	plugins: {
		status: 'supported',
		description:
			'Installs declared plugins and applies activation options.',
	},
	muPlugins: {
		status: 'supported',
		description: 'Writes declared must-use plugins into WordPress.',
	},
	postTypes: {
		status: 'partially-supported',
		description:
			'Registers inline and file-backed post types with generated mu-plugins ' +
			"without enforcing the schema's Secure Custom Fields requirement.",
	},
	fonts: {
		status: 'partially-supported',
		description:
			'Supports file references and font collections. Inline-directory and ' +
			'Git data references are not supported.',
	},
	media: {
		status: 'supported',
		description: 'Imports declared files into the Media Library.',
	},
	content: {
		status: 'supported',
		description: 'Imports MySQL dumps, posts, and WXR content.',
	},
	users: {
		status: 'supported',
		description: 'Creates or updates declared WordPress users.',
	},
	roles: {
		status: 'supported',
		description: 'Creates or updates declared WordPress roles.',
	},
	additionalStepsAfterExecution: {
		status: 'supported',
		description:
			'Runs every imperative step currently declared by the v2 schema.',
	},
} as const satisfies BlueprintV2PlaygroundSupportContract;
