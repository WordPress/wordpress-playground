import * as fs from 'fs';
import { createPackageJson } from '@nx/js';
import type { ExecutorContext, ProjectGraphDependency } from '@nx/devkit';
import {
	serializeJson,
	logger,
	parseTargetString,
	runExecutor,
} from '@nx/devkit';
import {
	getHelperDependenciesFromProjectGraph,
	HelperDependency,
	readTsConfig,
} from '@nx/js';
import type { PackageJsonExecutorSchema } from './schema';

interface ExecutorEvent {
	outfile: string;
	success: boolean;
}

export default async function* packageJsonExecutor(
	options: PackageJsonExecutorSchema,
	context: ExecutorContext
) {
	// Ensure externalNodes exists to prevent "Cannot read properties of undefined"
	// errors in NX's createPackageJson. This can happen when NX's native module
	// doesn't track lockfiles (e.g., package-lock.json), causing the js plugin's
	// createNodes to never populate externalNodes.
	if (!context.projectGraph.externalNodes) {
		context.projectGraph.externalNodes = {};
	}

	const helperDependencies = getHelperDependenciesFromProjectGraph(
		context.root,
		context.projectName,
		context.projectGraph
	).filter((dep) => dep.target in context.projectGraph.externalNodes);

	const importHelpers = !!readTsConfig(options.tsConfig).options
		.importHelpers;
	const shouldAddHelperDependency =
		importHelpers &&
		HelperDependency.tsc in context.projectGraph.externalNodes &&
		helperDependencies.every((dep) => dep.target !== HelperDependency.tsc);

	if (shouldAddHelperDependency) {
		helperDependencies.push({
			type: 'static',
			source: context.projectName,
			target: HelperDependency.tsc,
		});
	}

	const monorepoDependencies = getMonorepoDependencies(context);

	// Read optional dependencies from the original package.json
	let originalOptionalDependencies: Record<string, string> | undefined;
	const originalPackageJsonPath = `${context.root}/package.json`;
	if (fs.existsSync(originalPackageJsonPath)) {
		const originalPackageJson = JSON.parse(
			fs.readFileSync(originalPackageJsonPath).toString()
		);
		originalOptionalDependencies = originalPackageJson.optionalDependencies;
	}

	for await (const event of startBuild(options, context)) {
		if (!event.success) {
			throw 'There was an error with the build. See above.';
		}
		if (event.success) {
			const built = await buildPackageJson(
				event,
				options,
				context,
				helperDependencies,
				monorepoDependencies,
				originalOptionalDependencies
			);
			if (built === false) {
				return {
					success: false,
				};
			}
		}
		yield event;
	}

	return {
		success: true,
	};
}

async function* startBuild(
	options: PackageJsonExecutorSchema,
	context: ExecutorContext
) {
	const buildTarget = parseTargetString(
		options.buildTarget,
		context.projectGraph
	);

	yield* await runExecutor<ExecutorEvent>(buildTarget, {}, context);
}

async function buildPackageJson(
	event: ExecutorEvent,
	options: PackageJsonExecutorSchema,
	context: ExecutorContext,
	helperDependencies: ProjectGraphDependency[],
	monorepoDependencies: MonorepoDependency[],
	originalOptionalDependencies?: Record<string, string>
) {
	const packageJson = createPackageJson(
		context.projectName,
		context.projectGraph,
		{
			target: context.targetName,
			root: context.root,
			isProduction: true,
			helperDependencies: helperDependencies.map((dep) => dep.target),
		} as any
	);

	let main = packageJson.main ?? event.outfile;
	if (!main) {
		logger.error(
			`Could not find the main file for the project. Please specify the "main" property ` +
				`in the "package.json" file or use a buildTarget that internally yields the "outfile" ` +
				`property (e.g.esbuild or webpack).)`
		);
		return false;
	}

	if (!packageJson.dependencies) {
		packageJson.dependencies = {};
	}

	for (const dep of monorepoDependencies) {
		packageJson.dependencies[dep.name] = dep.version;
	}

	// Preserve optionalDependencies from the original package.json
	if (originalOptionalDependencies) {
		packageJson.optionalDependencies = originalOptionalDependencies;

		// Remove optional dependencies from regular dependencies to avoid duplication
		for (const optionalDep of Object.keys(originalOptionalDependencies)) {
			if (
				packageJson.dependencies &&
				packageJson.dependencies[optionalDep]
			) {
				delete packageJson.dependencies[optionalDep];
			}
		}
	}

	// make main relative to context root
	if (main.startsWith(context.root)) {
		main = main.substring(context.root.length).replace(/^\//, '');
	}
	// make main relative to output path
	if (main.startsWith(options.outputPath)) {
		main = main.substring(options.outputPath.length).replace(/^\//, '');
	}
	packageJson.main = main;

	// Playground-client is a dependency-less package. Let's make sure it can be installed
	// without bringing in any other packages.
	if ('playground-client' === context.projectName) {
		delete packageJson.overrides;
		delete packageJson.dependencies;
		delete packageJson.devDependencies;
		delete packageJson.optionalDependencies;
	}

	fs.writeFileSync(
		options.outputPath + '/package.json',
		serializeJson(packageJson)
	);

	// Lock file doesn't work with monorepoDependencies
	// fs.writeFileSync(
	//   getLockFileName(),
	//   createLockFile(packageJson)
	// );
}

interface MonorepoDependency {
	name: string;
	version: string;
}

function getMonorepoDependencies(
	context: ExecutorContext
): MonorepoDependency[] {
	const monorepoDeps: MonorepoDependency[] = [];
	for (const repoDep of context.projectGraph.dependencies[
		context.projectName
	]) {
		if (repoDep.source !== context.projectName) {
			continue;
		}
		if (repoDep.type !== 'static') {
			continue;
		}
		if (!(repoDep.target in context.projectGraph.nodes)) {
			continue;
		}
		const targetSourceRoot =
			context.projectGraph.nodes[repoDep.target].data.root;
		const packageJsonPath = `${targetSourceRoot}/package.json`;
		if (!fs.existsSync(packageJsonPath)) {
			continue;
		}
		const packageJson = JSON.parse(
			fs.readFileSync(packageJsonPath).toString()
		);
		if (packageJson.private) {
			continue;
		}

		monorepoDeps.push({
			name: packageJson.name,
			version: packageJson.version,
		});
	}
	return monorepoDeps;
}
