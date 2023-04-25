import { ProgressTracker } from '@php-wasm/progress';
import { Semaphore } from '@php-wasm/util';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
	SupportedPHPVersions,
	UniversalPHP,
} from '@php-wasm/universal';
import { isFileReference, Resource } from './resources';
import { StepDefinition, stepHandlers } from './steps';

export interface Blueprint {
	/**
	 * The URL to navigate to after the blueprint has been run.
	 */
	landingPage?: string;
	/**
	 * The preferred PHP and WordPress versions to use.
	 */
	preferredVersions?: {
		/**
		 * The preferred PHP version to use.
		 * If not specified, the latest supported version will be used
		 */
		php: SupportedPHPVersion | 'latest';
		/**
		 * The preferred WordPress version to use.
		 * If not specified, the latest supported version will be used
		 */
		wp: string | 'latest';
	};
	/**
	 * The steps to run.
	 */
	steps?: Array<StepDefinition | string | undefined | false | null>;
}

export type CompiledStep = (php: UniversalPHP) => Promise<void> | void;

const supportedWordPressVersions = ['6.2', '6.1', '6.0', '5.9'] as const;
type supportedWordPressVersion = (typeof supportedWordPressVersions)[number];
export interface CompiledBlueprint {
	/** The requested versions of PHP and WordPress for the blueprint */
	versions: {
		php: SupportedPHPVersion;
		wp: supportedWordPressVersion;
	};
	/** The compiled steps for the blueprint */
	run: (playground: UniversalPHP) => Promise<void>;
}

export interface CompileBlueprintOptions {
	/** Optional progress tracker to monitor progress */
	progress?: ProgressTracker;
	/** Optional semaphore to control access to a shared resource */
	semaphore?: Semaphore;
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
	}: CompileBlueprintOptions = {}
): CompiledBlueprint {
	const steps = (blueprint.steps || []).filter(isStepDefinition);

	const totalProgressWeight = steps.reduce(
		(total, step) => total + (step.progress?.weight || 1),
		0
	);
	const compiledSteps: CompiledStep[] = [];
	const resources: Resource[] = [];
	for (const step of steps) {
		const r = compileStep(step, {
			semaphore,
			rootProgressTracker: progress,
			totalProgressWeight,
		});
		compiledSteps.push(r.compiledStep);
		resources.push(...r.resources);
	}

	return {
		versions: {
			php: compileVersion(
				blueprint.preferredVersions?.php,
				SupportedPHPVersions,
				LatestSupportedPHPVersion
			),
			wp: compileVersion(
				blueprint.preferredVersions?.wp,
				supportedWordPressVersions,
				'6.2'
			),
		},
		run: async (playground: UniversalPHP) => {
			for (const resource of resources) {
				await resource.resolve();
			}
			for (const step of compiledSteps) {
				await step(playground);
			}
			if ('goTo' in playground) {
				await (playground as any).goTo(blueprint.landingPage || '/');
			}
			progress.finish();
		},
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
 * Determines if a step is a StepDefinition object
 *
 * @param step The object to test
 * @returns Whether the object is a StepDefinition
 */
function isStepDefinition(
	step: StepDefinition | string | undefined | false | null
): step is StepDefinition {
	return !!(typeof step === 'object' && step);
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
function compileStep<Step extends StepDefinition>(
	step: Step,
	{
		semaphore,
		rootProgressTracker,
		totalProgressWeight,
	}: CompileStepArgsOptions
): { compiledStep: CompiledStep; resources: Array<Resource> } {
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

	const compiledStep = async (playground: UniversalPHP) => {
		stepProgress.fillSlowly();
		await stepHandlers[step.step](
			playground,
			await resolveResources(args),
			{
				tracker: stepProgress,
				initialCaption: step.progress?.caption,
			}
		);
		stepProgress.finish();
	};

	const resources = getResources(step);
	const asyncResources = resources.filter((resource) => resource.isAsync);

	/**
	 * The weight of each async resource is the same, and is the same as the
	 * weight of the step itself.
	 */
	const evenWeight = 1 / (asyncResources.length + 1);
	for (const resource of asyncResources) {
		resource.progress = stepProgress.stage(evenWeight);
	}

	return { compiledStep, resources: asyncResources };
}

/**
 * Gets the resources used by a specific compiled step
 *
 * @param step The compiled step
 * @returns The resources used by the compiled step
 */
function getResources<Step extends StepDefinition>(step: Step) {
	const result: Resource[] = [];
	for (const argName in step) {
		const resourceMaybe = (step as any)[argName];
		if (resourceMaybe instanceof Resource) {
			result.push(resourceMaybe);
		}
	}
	return result;
}

/**
 * Gets the resources used by a specific compiled step
 *
 * @param step The compiled step
 * @returns The resources used by the compiled step
 */
async function resolveResources<T extends Record<string, unknown>>(args: T) {
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

// function fileToUint8Array(file: File) {
// 	return new Promise<Uint8Array>((resolve, reject) => {
// 		const reader = new FileReader();
// 		reader.onload = () => {
// 			resolve(new Uint8Array(reader.result as ArrayBuffer));
// 		};
// 		reader.onerror = reject;
// 		reader.readAsArrayBuffer(file);
// 	});
// }
