import { existsSync, readFileSync, lstatSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, resolve as resolvePath, dirname } from 'path';

interface TsConfig {
	compilerOptions: {
		baseUrl?: string;
		paths: Record<string, string[]>;
	};
}

// Read and parse tsconfig.base.json
const workspaceRoot = process.cwd();
const tsconfigPath = join(workspaceRoot, 'tsconfig.base.json');
const tsconfig: TsConfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
const pathAliases = tsconfig.compilerOptions.paths;
const baseUrl = tsconfig.compilerOptions.baseUrl || '.';

const aliasMap = new Map<string, string>();
for (const [alias, paths] of Object.entries(pathAliases)) {
	// Our config is simple and doesn't use wildcards,
	// so we can just use the first path
	const resolvedPath = resolvePath(baseUrl, paths[0]);
	aliasMap.set(alias, resolvedPath);
}

interface ResolveContext {
	conditions: string[];
	importAssertions: Record<string, string>;
	parentURL?: string;
}

interface ResolveResult {
	url: string;
	format?: string;
	shortCircuit?: boolean;
}

export async function resolve(
	specifier: string,
	context: ResolveContext,
	nextResolve: (
		specifier: string,
		context: ResolveContext
	) => Promise<ResolveResult>
): Promise<ResolveResult> {
	// Resolve aliases to paths
	for (const [alias, resolvedPath] of aliasMap.entries()) {
		if (specifier === alias && resolvedPath.endsWith('.ts')) {
			return nextResolve(resolvedPath, context);
		}

		const aliasSubpathPrefix = `${alias}/`;
		if (specifier.startsWith(aliasSubpathPrefix)) {
			specifier = resolvePath(
				resolvedPath,
				`${specifier.slice(aliasSubpathPrefix.length)}`
			);
			break;
		}
	}

	// Resolve relative imports
	if (
		specifier.startsWith('.') &&
		context.parentURL &&
		context.parentURL.startsWith('file://')
	) {
		const moduleDoingRelativeImport = fileURLToPath(context.parentURL!);
		const relativeImportBase = dirname(moduleDoingRelativeImport);

		let resolvedImportPath = resolvePath(relativeImportBase, specifier);

		if (
			existsSync(resolvedImportPath) &&
			lstatSync(resolvedImportPath).isDirectory()
		) {
			// This is a directory. Let's try the index file.
			specifier = join(resolvedImportPath, 'index');
		} else {
			specifier = resolvedImportPath;
		}
	}

	if (specifier.endsWith('?raw')) {
		// This is a raw file import and can be handled by our custom loader.
		return {
			url: `file://${specifier}`,
			format: 'raw',
			shortCircuit: true,
		};
	}

	if (specifier.endsWith('?json')) {
		// This is a JSON file import and can be handled by our custom loader.
		return {
			url: `file://${specifier}`,
			format: 'json',
			shortCircuit: true,
		};
	}

	for (const extension of ['', '.ts', '.tsx', '.js', '.jsx']) {
		const candidateFilePath = `${specifier}${extension}`;

		if (
			existsSync(candidateFilePath) &&
			lstatSync(candidateFilePath).isFile()
		) {
			return nextResolve(candidateFilePath, context);
		}
	}

	// Pass everything else as-is to the next resolver.
	return nextResolve(specifier, context);
}

type LoadContext = {
	format?: string;
	importAssertions: Record<string, string>;
};

type LoaderNext = (url: string, context: LoadContext) => Promise<LoadResult>;

type LoadResult = {
	format: string;
	source: string | ArrayBuffer | SharedArrayBuffer | Uint8Array;
	shortCircuit?: boolean;
};

export async function load(
	url: string,
	context: LoadContext,
	nextLoad: LoaderNext
): Promise<LoadResult> {
	const urlObj = new URL(url);

	if (urlObj.protocol !== 'file:') {
		return nextLoad(url, context);
	}

	if (urlObj.searchParams.has('raw')) {
		// Load raw file content
		const content = readFileSync(urlObj.pathname, 'utf8');
		return {
			format: 'module',
			shortCircuit: true,
			source: `export default ${JSON.stringify(content)};`,
		};
	}

	if (urlObj.pathname.endsWith('.json')) {
		const source = readFileSync(urlObj.pathname, 'utf8');
		return {
			format: 'json',
			source,
			shortCircuit: true,
		};
	}

	// Pass everything else to the next loader
	return nextLoad(url, context);
}
