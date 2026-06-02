import { existsSync, readFileSync, lstatSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, resolve as resolvePath, dirname } from 'path';

interface TsConfig {
	compilerOptions: {
		baseUrl?: string;
		paths: Record<string, string[]>;
	};
}

// Read and parse tsconfig.base.json
const workspaceRoot = join(import.meta.dirname, '..', '..', '..', '..');
const tsconfigPath = join(workspaceRoot, 'tsconfig.base.json');
const tsconfig: TsConfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
const pathAliases = tsconfig.compilerOptions.paths;
const baseUrl = resolvePath(
	tsconfig.compilerOptions.baseUrl || '.',
	dirname(tsconfigPath)
);

// Use a URL so we can compare more easily with file:// URLs during load.
const playgroundPackageRootUrl = pathToFileURL(
	resolvePath(import.meta.dirname, '..', '..', '..')
);

const aliasMap = new Map<string, URL>();
for (const [alias, paths] of Object.entries(pathAliases)) {
	// Our config is simple and doesn't use wildcards,
	// so we can just use the first path
	const resolvedPath = resolvePath(baseUrl, paths[0]);
	const resolvedPathUrl = pathToFileURL(resolvedPath);
	aliasMap.set(alias, resolvedPathUrl);
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
	for (const [alias, aliasTargetUrl] of aliasMap.entries()) {
		if (specifier === alias && aliasTargetUrl.pathname.endsWith('.ts')) {
			return nextResolve(aliasTargetUrl.href, context);
		}

		const aliasSubpathPrefix = `${alias}/`;
		if (specifier.startsWith(aliasSubpathPrefix)) {
			const aliasTargetPath = fileURLToPath(aliasTargetUrl);
			const resolvedPath = resolvePath(
				aliasTargetPath,
				`${specifier.slice(aliasSubpathPrefix.length)}`
			);
			specifier = pathToFileURL(resolvedPath).href;
			break;
		}
	}

	const possibleModuleExtensions = [
		'',
		'.ts',
		'.tsx',
		'.mts',
		'.mjs',
		'.js',
		'.jsx',
	];

	const looksLikePackageImport = specifier.match(/^\w+/);
	if (looksLikePackageImport) {
		// Support resolving package imports with different file extensions.
		//
		// This was added to support importing a specific, nested comlink module.
		// Before this change, there was a conflict between TypeScript type
		// resolution and Node.js module resolution:
		// - Node.js would not find the module without its .mjs extension.
		// - TypeScript could not resolve import's .d.ts file when the .mjs extension was added.
		for (const extension of possibleModuleExtensions) {
			try {
				const candidate = `${specifier}${extension}`;
				return await nextResolve(candidate, context);
			} catch {}
		}
	}

	// Handle relative imports
	if (
		specifier.startsWith('.') &&
		context.parentURL &&
		context.parentURL.startsWith('file://')
	) {
		const [specifierPath, specifierSearchParams] = specifier.split('?');

		const moduleDoingRelativeImport = fileURLToPath(context.parentURL!);
		const relativeImportBase = dirname(moduleDoingRelativeImport);

		let resolvedImportPath = resolvePath(relativeImportBase, specifierPath);
		if (
			existsSync(resolvedImportPath) &&
			lstatSync(resolvedImportPath).isDirectory()
		) {
			// This is a directory. Let's try the index file.
			resolvedImportPath = join(resolvedImportPath, 'index');
		}

		const resolvedImportPathUrl = pathToFileURL(resolvedImportPath);

		// Restore any search params used for customizing module resolution.
		if (specifierSearchParams !== undefined) {
			resolvedImportPathUrl.search = specifierSearchParams;
		}

		specifier = resolvedImportPathUrl.href;
	}

	if (!specifier.startsWith('file://')) {
		// We've resolved aliases and relative paths, so let's assume anything that is not a
		// file:// URL is outside our codebase and should be handled by the default resolver.
		return nextResolve(specifier, context);
	}

	const specifierUrl = new URL(specifier, 'file://');
	for (const format of ['raw', 'json', 'url', 'base64']) {
		if (specifierUrl.searchParams.has(format)) {
			// This is a custom format import and can be handled by our custom loader.
			return {
				url: specifierUrl.href,
				format,
				shortCircuit: true,
			};
		}
	}

	for (const extension of possibleModuleExtensions) {
		const specifierPath = fileURLToPath(specifier);
		const candidateFilePath = `${specifierPath}${extension}`;

		if (
			existsSync(candidateFilePath) &&
			lstatSync(candidateFilePath).isFile()
		) {
			specifier = pathToFileURL(candidateFilePath).href;
			return nextResolve(specifier, context);
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
	if (!url.startsWith('file:/')) {
		return nextLoad(url, context);
	}

	const urlObj = new URL(url);

	if (context.format === 'url') {
		urlObj.search = '';
		return {
			format: 'module',
			source: `export default new URL(${JSON.stringify(urlObj.href)});`,
			// As mentioned in
			// https://github.com/WordPress/wordpress-playground/pull/2318
			// using pathname is preferred over href.
			shortCircuit: true,
		};
	}

	if (context.format === 'raw') {
		// Load raw file content
		const content = readFileSync(urlObj, 'utf8');
		return {
			format: 'module',
			shortCircuit: true,
			source: `export default ${JSON.stringify(content)};`,
		};
	}

	if (context.format === 'base64' || urlObj.searchParams.has('base64')) {
		// Load binary file content and export as base64 string
		const content = readFileSync(urlObj);
		const base64 = content.toString('base64');
		return {
			format: 'module',
			shortCircuit: true,
			source: `export default Uint8Array.from(atob(${JSON.stringify(
				base64
			)}), c => c.charCodeAt(0));`,
		};
	}

	if (context.format === 'json' || urlObj.pathname.endsWith('.json')) {
		const source = readFileSync(urlObj, 'utf8');
		return {
			format: 'json',
			source,
			shortCircuit: true,
		};
	}

	const supportedModuleFormats = ['module', 'module-typescript'];
	if (
		urlObj.pathname.startsWith(playgroundPackageRootUrl.pathname) &&
		supportedModuleFormats.includes(context.format!)
	) {
		const loadResult = await nextLoad(url, context);
		if (supportedModuleFormats.includes(loadResult.format)) {
			const source = (loadResult.source as Buffer).toString('utf8');
			// Some of our code uses __dirname and __filename which are not available in ES modules.
			// https://nodejs.org/api/esm.html#no-__filename-or-__dirname
			//
			// Let's try simple text replacement for now. It is fast and will probably be fine.
			// If we run into problems, we can consider an AST transform instead.
			const updatedSource = source.replace(
				// Replace __dirname and __filename but not if they are declarations.
				/(?<!(?:const|var|let)\s*)\b__(dirname|filename)/g,
				'import.meta.$1'
			);
			loadResult.source = updatedSource;
		}
		return loadResult;
	}

	// Pass everything else to the next loader
	return nextLoad(url, context);
}
