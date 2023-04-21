import { ProgressTracker } from '@php-wasm/progress';
import { Semaphore } from '@php-wasm/util';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/web';
import { PlaygroundClient } from '../..';
import { FileReference, isFileReference, Resource } from './resources';
import { Step } from './steps';

export type StepDefinition = Step<FileReference>;
export type CompiledStep = {
	args: Step<Resource>;
	progress: ProgressTracker;
};

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

const supportedWordPressVersions = ['6.2', '6.1', '6.0', '5.9'] as const;
type supportedWordPressVersion = (typeof supportedWordPressVersions)[number];
export interface CompiledBlueprint {
	/** The URL of the landing page for the blueprint */
	landingPage: string;
	/** The preferred versions of PHP and WordPress for the blueprint */
	versions: {
		php: SupportedPHPVersion;
		wp: supportedWordPressVersion;
	};
	/** The compiled steps for the blueprint */
	steps: Array<CompiledStep>;
	/** The resources used by the compiled steps */
	resources: Array<{ resource: Resource; step: CompiledStep }>;
}

interface CompileBlueprintOptions {
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
	playground: PlaygroundClient,
	blueprint: Blueprint,
	{
		progress = new ProgressTracker(),
		semaphore,
	}: CompileBlueprintOptions = {}
): CompiledBlueprint {
	const steps = (blueprint.steps || []).filter(isStepDefinition);

	const totalProgressWeight = steps.reduce(
		(total, step) => total + (step.progress?.weight || 1),
		0
	);
	const compiledSteps = steps.map((step) =>
		compileStep(playground, step, {
			semaphore,
			rootProgressTracker: progress,
			totalProgressWeight,
		})
	);
	return {
		landingPage: blueprint.landingPage || '/',
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
		steps: compiledSteps,
		resources: getResources(compiledSteps),
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
function compileStep(
	playground: PlaygroundClient,
	step: StepDefinition,
	{
		semaphore,
		rootProgressTracker,
		totalProgressWeight,
	}: CompileStepArgsOptions
): CompiledStep {
	const stepProgress = rootProgressTracker.stage(
		(step.progress?.weight || 1) / totalProgressWeight
	);

	const args: any = {};
	for (const key of Object.keys(step)) {
		let value = (step as any)[key];
		if (isFileReference(value)) {
			value = Resource.create(value, {
				playground,
				semaphore,
			});
		}
		args[key] = value;
	}

	const compiledStep = {
		args: args as CompiledStep['args'],
		progress: stepProgress,
	};

	const asyncResources = getResourcesFromStep(compiledStep).filter(
		(resource) => resource.isAsync
	);

	/**
	 * The weight of each async resource is the same, and is the same as the
	 * weight of the step itself.
	 */
	const evenWeight = 1 / (asyncResources.length + 1);
	for (const resource of asyncResources) {
		resource.progress = stepProgress.stage(evenWeight);
	}

	return compiledStep;
}

/**
 * Gets all the resources used by compiled steps
 *
 * @param steps The list of compiled steps
 * @returns The resources used by the compiled steps
 */
function getResources(steps: CompiledStep[]) {
	let result: { resource: Resource; step: CompiledStep }[] = [];
	for (const step of steps) {
		result = result.concat(
			getResourcesFromStep(step).map((resource) => ({ resource, step }))
		);
	}
	return result;
}

/**
 * Gets the resources used by a specific compiled step
 *
 * @param step The compiled step
 * @returns The resources used by the compiled step
 */
function getResourcesFromStep(step: CompiledStep) {
	const result: Resource[] = [];
	for (const argName in step.args) {
		const resourceMaybe = (step.args as any)[argName];
		if (resourceMaybe instanceof Resource) {
			result.push(resourceMaybe);
		}
	}
	return result;
}
