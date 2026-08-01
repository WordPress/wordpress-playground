import * as fs from 'fs';
import { createPackageJson } from '@nx/js';
import * as ts from 'typescript';
import type {
	ExecutorContext,
	FileData,
	ProjectFileMap,
	ProjectGraphDependency,
} from '@nx/devkit';
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
import { readFileMapCache } from 'nx/src/project-graph/nx-deps-cache';
import { fileDataDepTarget } from 'nx/src/config/project-graph';
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

	const sourceFileMap = getSourceOnlyFileMap();
	const sourceDeps = getSourceDependencyTargets(
		sourceFileMap,
		context.projectName
	);
	const monorepoDependencies = getMonorepoDependencies(
		context,
		sourceDeps,
		sourceFileMap
	);

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
				originalOptionalDependencies,
				sourceFileMap,
				sourceDeps
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
	originalOptionalDependencies?: Record<string, string>,
	sourceFileMap?: ProjectFileMap,
	sourceDeps?: Set<string>
) {
	const packageJson = createPackageJson(
		context.projectName,
		context.projectGraph,
		{
			target: context.targetName,
			root: context.root,
			isProduction: true,
			helperDependencies: helperDependencies.map((dep) => dep.target),
		} as any,
		sourceFileMap
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

	// Remove external dependencies that are not directly imported by source
	// files. createPackageJson flattens transitive dependencies, but published
	// libraries should only declare their direct dependencies.
	if (sourceDeps) {
		for (const name of Object.keys(packageJson.dependencies)) {
			if (!sourceDeps.has(`npm:${name}`)) {
				delete packageJson.dependencies[name];
			}
		}
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
}

interface MonorepoDependency {
	name: string;
	version: string;
}

function isSourceFile(filePath: string): boolean {
	return /\/src\//.test(filePath) && !/\/tests?\//.test(filePath);
}

function getSourceOnlyFileMap(): ProjectFileMap {
	const cache = readFileMapCache();
	const fullFileMap = cache?.fileMap?.projectFileMap || {};
	const filtered: ProjectFileMap = {};
	for (const [project, files] of Object.entries(fullFileMap)) {
		filtered[project] = (files as FileData[]).filter((f) =>
			isSourceFile(f.file)
		);
	}
	return filtered;
}

function getSourceDependencyTargets(
	sourceFileMap: ProjectFileMap,
	projectName?: string
): Set<string> {
	const targets = new Set<string>();
	if (projectName) {
		const projectFiles = sourceFileMap[projectName] || [];
		for (const fileData of projectFiles) {
			for (const dep of fileData.deps || []) {
				targets.add(fileDataDepTarget(dep));
			}
		}
	}
	return targets;
}

function getMonorepoDependencies(
	context: ExecutorContext,
	sourceDeps: Set<string>,
	sourceFileMap: ProjectFileMap
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
		if (!sourceDeps.has(repoDep.target)) {
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
		if (
			!hasRuntimeImport(
				context.root,
				sourceFileMap[context.projectName] || [],
				packageJson.name
			)
		) {
			continue;
		}
		monorepoDeps.push({
			name: packageJson.name,
			version: packageJson.version,
		});
	}
	return monorepoDeps;
}

function hasRuntimeImport(
	workspaceRoot: string,
	files: FileData[],
	packageName: string
): boolean {
	return files.some((file) => {
		const sourceText = fs.readFileSync(
			`${workspaceRoot}/${file.file}`,
			'utf8'
		);
		return hasRuntimeImportInSource(sourceText, file.file, packageName);
	});
}

export function hasRuntimeImportInSource(
	sourceText: string,
	fileName: string,
	packageName: string
): boolean {
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true
	);
	let hasRuntimeImport = false;

	function visit(node: ts.Node) {
		if (hasRuntimeImport) {
			return;
		}
		if (
			(ts.isImportDeclaration(node) &&
				!isTypeOnlyImport(node.importClause) &&
				isPackageImport(node.moduleSpecifier, packageName)) ||
			(ts.isExportDeclaration(node) &&
				!isTypeOnlyExport(node) &&
				isPackageImport(node.moduleSpecifier, packageName)) ||
			(isDynamicImport(node) &&
				isPackageImport(node.arguments[0], packageName)) ||
			(isRequireCall(node) &&
				isPackageImport(node.arguments[0], packageName))
		) {
			hasRuntimeImport = true;
			return;
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return hasRuntimeImport;
}

function isTypeOnlyImport(importClause: ts.ImportClause | undefined): boolean {
	if (!importClause || !importClause.namedBindings) {
		return importClause?.isTypeOnly === true;
	}
	return (
		importClause.isTypeOnly ||
		(ts.isNamedImports(importClause.namedBindings) &&
			importClause.namedBindings.elements.every(
				(specifier) => specifier.isTypeOnly
			))
	);
}

function isTypeOnlyExport(node: ts.ExportDeclaration): boolean {
	if (!node.exportClause || !ts.isNamedExports(node.exportClause)) {
		return node.isTypeOnly;
	}
	return (
		node.isTypeOnly ||
		node.exportClause.elements.every((specifier) => specifier.isTypeOnly)
	);
}

function isPackageImport(
	moduleSpecifier: ts.Expression | undefined,
	packageName: string
): boolean {
	return (
		moduleSpecifier !== undefined &&
		ts.isStringLiteral(moduleSpecifier) &&
		(moduleSpecifier.text === packageName ||
			moduleSpecifier.text.startsWith(`${packageName}/`))
	);
}

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
	return (
		ts.isCallExpression(node) &&
		node.expression.kind === ts.SyntaxKind.ImportKeyword
	);
}

function isRequireCall(node: ts.Node): node is ts.CallExpression {
	return (
		ts.isCallExpression(node) &&
		ts.isIdentifier(node.expression) &&
		node.expression.text === 'require'
	);
}
