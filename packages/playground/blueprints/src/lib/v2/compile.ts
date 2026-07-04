import type { UniversalPHP } from '@php-wasm/universal';
import type { RuntimeConfiguration } from '../types';
import { resolveRuntimeConfiguration } from '../resolve-runtime-configuration';
import type { BlueprintV2Declaration } from './blueprint-v2-declaration';

export class UnsupportedBlueprintV2FeatureError extends Error {
	public readonly featurePath: string;

	constructor(
		featurePath: string,
		message = 'This Blueprint v2 feature is not supported by the TypeScript runner yet.'
	) {
		super(`${featurePath}: ${message}`);
		this.name = 'UnsupportedBlueprintV2FeatureError';
		this.featurePath = featurePath;
	}
}

type BlueprintV2ApplicationOptions =
	BlueprintV2Declaration['applicationOptions'];
type BlueprintV2Constants = NonNullable<BlueprintV2Declaration['constants']>;
type BlueprintV2SiteOptions = NonNullable<
	BlueprintV2Declaration['siteOptions']
>;
type BlueprintV2MuPlugin = NonNullable<
	BlueprintV2Declaration['muPlugins']
>[number];
type BlueprintV2Theme = NonNullable<BlueprintV2Declaration['themes']>[number];
type BlueprintV2ActiveTheme = NonNullable<
	BlueprintV2Declaration['activeTheme']
>;
type BlueprintV2Plugin = NonNullable<BlueprintV2Declaration['plugins']>[number];
type BlueprintV2Fonts = NonNullable<BlueprintV2Declaration['fonts']>;
type BlueprintV2Media = NonNullable<BlueprintV2Declaration['media']>[number];
type BlueprintV2Role = NonNullable<BlueprintV2Declaration['roles']>[number];
type BlueprintV2User = NonNullable<BlueprintV2Declaration['users']>[number];
type BlueprintV2PostTypes = NonNullable<BlueprintV2Declaration['postTypes']>;
type BlueprintV2Content = NonNullable<
	BlueprintV2Declaration['content']
>[number];
type BlueprintV2Step = NonNullable<
	BlueprintV2Declaration['additionalStepsAfterExecution']
>[number];

export type BlueprintV2ExecutionPlan = BlueprintV2ExecutionPlanItem[];

export type BlueprintV2ExecutionPlanItem =
	| {
			type: 'defineWpConfigConsts';
			consts: BlueprintV2Constants;
	  }
	| {
			type: 'setSiteOptions';
			options: BlueprintV2SiteOptions;
	  }
	| {
			type: 'installMuPlugin';
			muPlugin: BlueprintV2MuPlugin;
			sourcePath: string;
	  }
	| {
			type: 'installTheme';
			theme: BlueprintV2Theme;
			active: false;
			sourcePath: string;
	  }
	| {
			type: 'installTheme';
			theme: BlueprintV2ActiveTheme;
			active: true;
			sourcePath: string;
	  }
	| {
			type: 'installPlugin';
			plugin: BlueprintV2Plugin;
			sourcePath: string;
	  }
	| {
			type: 'installFonts';
			fonts: BlueprintV2Fonts;
	  }
	| {
			type: 'importMedia';
			media: BlueprintV2Media;
			sourcePath: string;
	  }
	| {
			type: 'setSiteLanguage';
			language: string;
	  }
	| {
			type: 'defineRoles';
			roles: BlueprintV2Role[];
	  }
	| {
			type: 'defineUsers';
			users: BlueprintV2User[];
	  }
	| {
			type: 'definePostTypes';
			postTypes: BlueprintV2PostTypes;
	  }
	| {
			type: 'importContent';
			content: BlueprintV2Content;
			sourcePath: string;
	  }
	| {
			type: 'runStep';
			step: BlueprintV2Step;
			sourcePath: string;
	  };

export type CompiledBlueprintV2 = {
	runtime: RuntimeConfiguration;
	applicationOptions?: BlueprintV2ApplicationOptions;
	plan: BlueprintV2ExecutionPlan;
	run: (playground: UniversalPHP) => Promise<void>;
};

export async function compileBlueprintV2(
	declaration: BlueprintV2Declaration
): Promise<CompiledBlueprintV2> {
	const runtime = await resolveRuntimeConfiguration(declaration);
	const plan = createBlueprintV2ExecutionPlan(declaration);
	return {
		runtime,
		applicationOptions: declaration.applicationOptions,
		plan,
		run: async () => {
			if (plan.length > 0) {
				throw new UnsupportedBlueprintV2FeatureError(
					'executionPlan',
					'Blueprint v2 execution plans are not runnable by the TypeScript runner yet.'
				);
			}
		},
	};
}

export function createBlueprintV2ExecutionPlan(
	declaration: BlueprintV2Declaration
): BlueprintV2ExecutionPlan {
	const plan: BlueprintV2ExecutionPlan = [];

	if (
		declaration.constants &&
		Object.keys(declaration.constants).length > 0
	) {
		plan.push({
			type: 'defineWpConfigConsts',
			consts: declaration.constants,
		});
	}

	if (
		declaration.siteOptions &&
		Object.keys(declaration.siteOptions).length > 0
	) {
		plan.push({
			type: 'setSiteOptions',
			options: declaration.siteOptions,
		});
	}

	for (const [index, muPlugin] of (declaration.muPlugins ?? []).entries()) {
		plan.push({
			type: 'installMuPlugin',
			muPlugin,
			sourcePath: `/muPlugins/${index}`,
		});
	}

	for (const [index, theme] of (declaration.themes ?? []).entries()) {
		plan.push({
			type: 'installTheme',
			theme,
			active: false,
			sourcePath: `/themes/${index}`,
		});
	}

	if (declaration.activeTheme !== undefined) {
		plan.push({
			type: 'installTheme',
			theme: declaration.activeTheme,
			active: true,
			sourcePath: '/activeTheme',
		});
	}

	for (const [index, plugin] of (declaration.plugins ?? []).entries()) {
		plan.push({
			type: 'installPlugin',
			plugin,
			sourcePath: `/plugins/${index}`,
		});
	}

	if (declaration.fonts && Object.keys(declaration.fonts).length > 0) {
		plan.push({
			type: 'installFonts',
			fonts: declaration.fonts,
		});
	}

	for (const [index, media] of (declaration.media ?? []).entries()) {
		plan.push({
			type: 'importMedia',
			media,
			sourcePath: `/media/${index}`,
		});
	}

	if (declaration.siteLanguage) {
		plan.push({
			type: 'setSiteLanguage',
			language: declaration.siteLanguage,
		});
	}

	if (declaration.roles?.length) {
		plan.push({
			type: 'defineRoles',
			roles: declaration.roles,
		});
	}

	if (declaration.users?.length) {
		plan.push({
			type: 'defineUsers',
			users: declaration.users,
		});
	}

	if (
		declaration.postTypes &&
		Object.keys(declaration.postTypes).length > 0
	) {
		plan.push({
			type: 'definePostTypes',
			postTypes: declaration.postTypes,
		});
	}

	for (const [index, content] of (declaration.content ?? []).entries()) {
		plan.push({
			type: 'importContent',
			content,
			sourcePath: `/content/${index}`,
		});
	}

	for (const [index, step] of (
		declaration.additionalStepsAfterExecution ?? []
	).entries()) {
		plan.push({
			type: 'runStep',
			step,
			sourcePath: `/additionalStepsAfterExecution/${index}`,
		});
	}

	return plan;
}
