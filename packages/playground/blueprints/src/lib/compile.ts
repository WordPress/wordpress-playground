import { ProgressTracker } from '@php-wasm/progress';
import { Semaphore } from '@php-wasm/util';
import {
	LatestSupportedPHPVersion,
	SupportedPHPExtension,
	SupportedPHPExtensionsList,
	SupportedPHPExtensionBundles,
	SupportedPHPVersion,
	SupportedPHPVersions,
	UniversalPHP,
} from '@php-wasm/universal';
import type { SupportedPHPExtensionBundle } from '@php-wasm/universal';
import { FileReference, isFileReference, Resource } from './resources';
import { Step, StepDefinition, WriteFileStep } from './steps';
import * as allStepHandlers from './steps/handlers';
import { Blueprint } from './blueprint';
import { logger } from '@php-wasm/logger';

// @TODO: Configure this in the `wp-cli` step, not here.
const { wpCLI, ...otherStepHandlers } = allStepHandlers;
const keyedStepHandlers = {
	...otherStepHandlers,
	'wp-cli': wpCLI,
	importFile: otherStepHandlers.importWxr,
};

import Ajv from 'ajv';
/**
 * The JSON schema stored in this directory is used to validate the Blueprints
 * and is autogenerated from the Blueprints TypeScript types.
 *
 * Whenever the types are modified, the schema needs to be rebuilt using
 * `nx build playground-blueprints` and then committed to the repository.
 *
 * Unfortunately, it is not auto-rebuilt in `npm run dev` mode as the
 * `dts-bundle-generator` utility we use for type rollyps does not support
 * watching for changes.
 */
import blueprintSchema from '../../public/blueprint-schema.json';
import type { ValidateFunction } from 'ajv';

export type CompiledStep = (php: UniversalPHP) => Promise<void> | void;

export interface CompiledBlueprint {
	/** The requested versions of PHP and WordPress for the blueprint */
	versions: {
		php: SupportedPHPVersion;
		wp: string;
	};
	/** The requested PHP extensions to load */
	phpExtensions: SupportedPHPExtension[];
	features: {
		/** Should boot with support for network request via wp_safe_remote_get? */
		networking: boolean;
		/** Should boot with WP-CLI support. */
		wpCli: boolean;
	};
	/** The compiled steps for the blueprint */
	run: (playground: UniversalPHP) => Promise<void>;
}

export type OnStepCompleted = (output: any, step: StepDefinition) => any;

export interface CompileBlueprintOptions {
	/** Optional progress tracker to monitor progress */
	progress?: ProgressTracker;
	/** Optional semaphore to control access to a shared resource */
	semaphore?: Semaphore;
	/** Optional callback with step output */
	onStepCompleted?: OnStepCompleted;
}

/**
 * Compiles Blueprint into a form that can be executed.
 *
 * @param playground The PlaygroundClient to use for the compilation
 * @param blueprint The bBueprint to compile
 * @param options Additional options for the compilation
 * @returns The compiled blueprint
 */
export function compileBlueprint(
	blueprint: Blueprint,
	{
		progress = new ProgressTracker(),
		semaphore = new Semaphore({ concurrency: 3 }),
		onStepCompleted = () => {},
	}: CompileBlueprintOptions = {}
): CompiledBlueprint {
	blueprint = {
		...blueprint,
		steps: (blueprint.steps || [])
			.filter(isStepDefinition)
			.filter(isStepStillSupported),
	};
	// Convert legacy importFile steps to importWxr
	for (const step of blueprint.steps!) {
		if (typeof step === 'object' && (step as any).step === 'importFile') {
			(step as any).step = 'importWxr';
			logger.warn(
				`The "importFile" step is deprecated. Use "importWxr" instead.`
			);
		}
	}

	// Experimental declarative syntax {{{
	if (blueprint.constants) {
		blueprint.steps!.unshift({
			step: 'defineWpConfigConsts',
			consts: blueprint.constants,
		});
	}
	if (blueprint.siteOptions) {
		blueprint.steps!.unshift({
			step: 'setSiteOptions',
			options: blueprint.siteOptions,
		});
	}
	if (blueprint.plugins) {
		// Translate an array of strings into a map of pluginName => true to
		// install the latest version of the plugin from wordpress.org
		const steps = blueprint.plugins
			.map((value) => {
				if (typeof value === 'string') {
					if (value.startsWith('https://')) {
						return {
							resource: 'url',
							url: value,
						} as FileReference;
					} else {
						return {
							resource: 'wordpress.org/plugins',
							slug: value,
						} as FileReference;
					}
				}
				return value;
			})
			.map((resource) => ({
				step: 'installPlugin',
				pluginZipFile: resource,
			})) as StepDefinition[];
		blueprint.steps!.unshift(...steps);
	}
	if (blueprint.login) {
		blueprint.steps!.push({
			step: 'login',
			...(blueprint.login === true
				? { username: 'admin', password: 'password' }
				: blueprint.login),
		});
	}
	if (!blueprint.phpExtensionBundles) {
		blueprint.phpExtensionBundles = [];
	}

	if (!blueprint.phpExtensionBundles) {
		blueprint.phpExtensionBundles = [];
	}
	// Default to the "kitchen sink" PHP extensions bundle if no
	// other bundles are specified.
	if (blueprint.phpExtensionBundles.length === 0) {
		blueprint.phpExtensionBundles.push('kitchen-sink');
	}

	/**
	 * Download WP-CLI. {{{
	 * Hardcoding this in the compile() function is a temporary solution
	 * to provide the wpCLI step with the wp-cli.phar file it needs. Eventually,
	 * each Blueprint step may be able to specify any pre-requisite resources.
	 * Also, wp-cli should only be downloaded if it's not already present.
	 */
	const wpCliStepIndex = blueprint.steps?.findIndex(
		(step) => typeof step === 'object' && step?.step === 'wp-cli'
	);
	if (
		blueprint?.features?.wpCli === true ||
		(wpCliStepIndex !== undefined && wpCliStepIndex > -1)
	) {
		if (blueprint.phpExtensionBundles.includes('light')) {
			blueprint.phpExtensionBundles =
				blueprint.phpExtensionBundles.filter(
					(bundle) => bundle !== 'light'
				);
			logger.warn(
				`The wpCli step used in your Blueprint requires the iconv and mbstring PHP extensions. ` +
					`However, you did not specify the kitchen-sink extension bundle. Playground will override your ` +
					`choice and load the kitchen-sink PHP extensions bundle to prevent the WP-CLI step from failing. `
			);
		}
		const wpCliInstallStep: WriteFileStep<FileReference> = {
			step: 'writeFile',
			data: {
				resource: 'url',
				/**
				 * Use compression for downloading the wp-cli.phar file.
				 * The official release, hosted at raw.githubusercontent.com, is ~7MB and the
				 * transfer is uncompressed. playground.wordpress.net supports transfer compression
				 * and only transmits ~1.4MB.
				 *
				 * @TODO: minify the wp-cli.phar file. It can be as small as 1MB when all the
				 *        whitespaces and are removed, and even 500KB when libraries like the
				 *        JavaScript parser or Composer are removed.
				 */
				url: 'https://playground.wordpress.net/wp-cli.phar',
			},
			path: '/tmp/wp-cli.phar',
		};
		if (wpCliStepIndex !== undefined && wpCliStepIndex > -1) {
			blueprint.steps?.splice(wpCliStepIndex, 0, wpCliInstallStep);
		} else {
			blueprint.steps?.push(wpCliInstallStep);
		}
	}

	/**
	 * Download the WordPress-importer plugin. {{{
	 * Hardcoding this in the compile() function is a temporary solution
	 */
	const importWxrStepIndex = blueprint.steps?.findIndex(
		(step) => typeof step === 'object' && step?.step === 'importWxr'
	);
	if (importWxrStepIndex !== undefined && importWxrStepIndex > -1) {
		if (blueprint.phpExtensionBundles.includes('light')) {
			blueprint.phpExtensionBundles =
				blueprint.phpExtensionBundles.filter(
					(bundle) => bundle !== 'light'
				);
			logger.warn(
				`The importWxr step used in your Blueprint requires the iconv and mbstring PHP extensions. ` +
					`However, you did not specify the kitchen-sink extension bundle. Playground will override your ` +
					`choice and load the kitchen-sink PHP extensions bundle to prevent the WP-CLI step from failing. `
			);
		}
		blueprint.steps?.splice(importWxrStepIndex, 0, {
			step: 'installPlugin',
			pluginZipFile: {
				resource: 'url',
				url: 'https://playground.wordpress.net/wordpress-importer.zip',
				caption: 'Downloading the WordPress Importer plugin',
			},
		});
	}

	const { valid, errors } = validateBlueprint(blueprint);
	if (!valid) {
		const e = new Error(
			`Invalid blueprint: ${errors![0].message} at ${
				errors![0].instancePath
			}`
		);
		// Attach Ajv output to the thrown object for easier debugging
		(e as any).errors = errors;
		throw e;
	}

	const steps = (blueprint.steps || []) as StepDefinition[];
	const totalProgressWeight = steps.reduce(
		(total, step) => total + (step.progress?.weight || 1),
		0
	);
	const compiled = steps.map((step) =>
		compileStep(step, {
			semaphore,
			rootProgressTracker: progress,
			totalProgressWeight,
		})
	);

	return {
		versions: {
			php: compileVersion(
				blueprint.preferredVersions?.php,
				SupportedPHPVersions,
				LatestSupportedPHPVersion
			),
			wp: blueprint.preferredVersions?.wp || 'latest',
		},
		phpExtensions: compilePHPExtensions(
			[],
			blueprint.phpExtensionBundles || []
		),
		features: {
			// Disable networking by default
			networking: blueprint.features?.networking ?? false,
			// Disable wpCli by default
			wpCli: blueprint.features?.wpCli ?? false,
		},
		run: async (playground: UniversalPHP) => {
			try {
				// Start resolving resources early
				for (const { resources } of compiled) {
					for (const resource of resources) {
						resource.setPlayground(playground);
						if (resource.isAsync) {
							resource.resolve();
						}
					}
				}

				for (const [i, { run, step }] of Object.entries(compiled)) {
					try {
						const result = await run(playground);
						onStepCompleted(result, step);
					} catch (e) {
						logger.error(e);
						throw new Error(
							`Error when executing the blueprint step #${i} (${JSON.stringify(
								step
							)}) ${e instanceof Error ? `: ${e.message}` : e}`,
							{ cause: e }
						);
					}
				}
			} finally {
				try {
					await (playground as any).goTo(
						blueprint.landingPage || '/'
					);
				} catch (e) {
					/*
					 * PHP exposes no goTo method.
					 * We can't use `goto` in playground here,
					 * because it may be a Comlink proxy object
					 * with no such method.
					 */
				}
				progress.finish();
			}
		},
	};
}

const ajv = new Ajv({ discriminator: true });
let blueprintValidator: ValidateFunction | undefined;
export function validateBlueprint(blueprintMaybe: object) {
	blueprintValidator = ajv.compile(blueprintSchema);
	const valid = blueprintValidator(blueprintMaybe);
	if (valid) {
		return { valid };
	}

	/**
	 * Each entry of "steps" can be either an object, null, undefined etc
	 * via the "anyOf" part of the schema.
	 *
	 * If the step has any error in it, like a missing property, Ajv will
	 * also return errors for each case listed in "anyOf" which means we'll
	 * learn that step is not a null, undefined etc. This is not helpful, so
	 * we filter out those errors.
	 *
	 * However, if the "anyOf" error is the only error we have then we want
	 * to keep it because the step is likely, say, a number, and we want to
	 * let the developer know.
	 */
	const hasErrorsDifferentThanAnyOf: Set<string> = new Set();
	for (const error of blueprintValidator.errors!) {
		if (!error.schemaPath.startsWith('#/properties/steps/items/anyOf')) {
			hasErrorsDifferentThanAnyOf.add(error.instancePath);
		}
	}
	const errors = blueprintValidator.errors?.filter(
		(error) =>
			!(
				error.schemaPath.startsWith('#/properties/steps/items/anyOf') &&
				hasErrorsDifferentThanAnyOf.has(error.instancePath)
			)
	);

	return {
		valid,
		errors,
	};
}

/**
 * Compiles a preferred version string into a supported version
 *
 * @param value The value to compile
 * @param supported The list of supported versions
 * @param latest The latest supported version
 * @returns The compiled version
 */
function compileVersion<T>(
	value: string | undefined | null,
	supported: readonly T[],
	latest: string
): T {
	if (value && supported.includes(value as any)) {
		return value as T;
	}
	return latest as T;
}

/**
 * Compiles a list of requested PHP extensions provided as strings
 * into a valid list of supported PHP extensions.
 *
 * @param requestedExtensions The extensions to compile
 * @returns The compiled extensions
 */
function compilePHPExtensions(
	requestedExtensions: string[],
	requestedBundles: string[]
): SupportedPHPExtension[] {
	const extensions = SupportedPHPExtensionsList.filter((extension) =>
		requestedExtensions.includes(extension)
	) as SupportedPHPExtension[];
	const extensionsFromBundles = requestedBundles.flatMap((bundle) =>
		bundle in SupportedPHPExtensionBundles
			? SupportedPHPExtensionBundles[
					bundle as SupportedPHPExtensionBundle
			  ]
			: []
	) as SupportedPHPExtension[];
	// Deduplicate
	return Array.from(new Set([...extensions, ...extensionsFromBundles]));
}

/**
 * Determines if a step is a StepDefinition object
 *
 * @param step The object to test
 * @returns Whether the object is a StepDefinition
 */
function isStepDefinition(
	step: Step | string | undefined | false | null
): step is StepDefinition {
	return !!(typeof step === 'object' && step);
}

/**
 * Determines if a step is still supported, or was it deprecated
 * and removed.
 *
 * @param step The step definition to test.
 * @returns Whether the step is still supported.
 */
function isStepStillSupported(
	step: Record<string, any>
): step is StepDefinition {
	if (['setPhpIniEntry', 'request'].includes(step['step'])) {
		logger.warn(
			`The "${step['step']}" Blueprint is no longer supported and you can remove it from your Blueprint.`
		);
		return false;
	}
	return true;
}

interface CompileStepArgsOptions {
	/** Optional semaphore to control access to a shared resource */
	semaphore?: Semaphore;
	/** The root progress tracker for the compilation */
	rootProgressTracker: ProgressTracker;
	/** The total progress weight of all the steps in the blueprint */
	totalProgressWeight: number;
}

/**
 * Compiles a single Blueprint step into a form that can be executed
 *
 * @param playground The PlaygroundClient to use for the compilation
 * @param step The step to compile
 * @param options Additional options for the compilation
 * @returns The compiled step
 */
function compileStep<S extends StepDefinition>(
	step: S,
	{
		semaphore,
		rootProgressTracker,
		totalProgressWeight,
	}: CompileStepArgsOptions
): { run: CompiledStep; step: S; resources: Array<Resource> } {
	const stepProgress = rootProgressTracker.stage(
		(step.progress?.weight || 1) / totalProgressWeight
	);

	const args: any = {};
	for (const key of Object.keys(step)) {
		let value = (step as any)[key];
		if (isFileReference(value)) {
			value = Resource.create(value, {
				semaphore,
			});
		}
		args[key] = value;
	}

	const run = async (playground: UniversalPHP) => {
		try {
			stepProgress.fillSlowly();
			return await keyedStepHandlers[step.step](
				playground,
				await resolveArguments(args),
				{
					tracker: stepProgress,
					initialCaption: step.progress?.caption,
				}
			);
		} finally {
			stepProgress.finish();
		}
	};

	/**
	 * The weight of each async resource is the same, and is the same as the
	 * weight of the step itself.
	 */
	const resources = getResources(args);
	const asyncResources = getResources(args).filter(
		(resource) => resource.isAsync
	);

	const evenWeight = 1 / (asyncResources.length + 1);
	for (const resource of asyncResources) {
		resource.progress = stepProgress.stage(evenWeight);
	}

	return { run, step, resources };
}

/**
 * Gets the resources used by a specific compiled step
 *
 * @param step The compiled step
 * @returns The resources used by the compiled step
 */
function getResources<S extends StepDefinition>(args: S) {
	const result: Resource[] = [];
	for (const argName in args) {
		const resourceMaybe = (args as any)[argName];
		if (resourceMaybe instanceof Resource) {
			result.push(resourceMaybe);
		}
	}
	return result;
}

/**
 * Replaces Resource objects with their resolved values
 *
 * @param step The compiled step
 * @returns The resources used by the compiled step
 */
async function resolveArguments<T extends Record<string, unknown>>(args: T) {
	const resolved: any = {};
	for (const argName in args) {
		const resourceMaybe = (args as any)[argName];
		if (resourceMaybe instanceof Resource) {
			resolved[argName] = await resourceMaybe.resolve();
		} else {
			resolved[argName] = resourceMaybe;
		}
	}
	return resolved;
}

export async function runBlueprintSteps(
	compiledBlueprint: CompiledBlueprint,
	playground: UniversalPHP
) {
	await compiledBlueprint.run(playground);
}
