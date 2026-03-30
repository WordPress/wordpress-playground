import type { V2StepHandler, ResolvedDirectory } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { DataReferenceResolverImpl } from '../data-references/resolver';
import { joinPaths, phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface InstallThemeArgs {
	source: DataSources.DataReference | DataSources.ThemeDirectoryReference;
	targetDirectoryName?: string;
}

/**
 * Installs a WordPress theme.
 *
 * The source can be a WordPress.org theme slug,
 * a URL to a zip file, an execution context path, or an
 * inline file/directory object.
 */
const handler: V2StepHandler<InstallThemeArgs> = async (args, context) => {
	const { php } = context;
	const docroot = await php.documentRoot;
	const themesDir = joinPaths(docroot, 'wp-content', 'themes');

	const source = args.source;
	const targetDirectoryName = args.targetDirectoryName;

	if (isThemeSlug(source)) {
		await installFromSlug(source, themesDir, targetDirectoryName, context);
	} else {
		await installFromDataReference(
			source as DataSources.DataReference,
			themesDir,
			targetDirectoryName,
			context
		);
	}
};

/**
 * Installs a theme from a WordPress.org slug by resolving
 * the slug via the resolver implementation.
 */
async function installFromSlug(
	slug: string,
	themesDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const resolver = context.dataReferenceResolver as DataReferenceResolverImpl;
	const file = await resolver.resolveThemeReference(slug);
	await extractZipToThemes(
		file.contents,
		themesDir,
		targetDirectoryName,
		context
	);
}

/**
 * Installs a theme from a generic data reference (URL,
 * execution context path, inline file/directory, etc.).
 */
async function installFromDataReference(
	ref: DataSources.DataReference,
	themesDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { dataReferenceResolver } = context;

	// Try resolving as a directory first.
	if (isDirectoryLikeReference(ref)) {
		const dir = await dataReferenceResolver.resolveDirectory(ref);
		const dirName = targetDirectoryName || dir.name;
		const targetPath = joinPaths(themesDir, dirName);
		await writeResolvedDirectory(dir, targetPath, context);
		return;
	}

	// Otherwise resolve as a file (zip).
	const file = await dataReferenceResolver.resolveFile(ref);
	await extractZipToThemes(
		file.contents,
		themesDir,
		targetDirectoryName,
		context
	);
}

/**
 * Extracts a zip file into the themes directory using PHP
 * ZipArchive.
 */
async function extractZipToThemes(
	zipContents: Uint8Array,
	themesDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php } = context;
	const tempZipPath = '/tmp/theme-install.zip';
	await php.writeFile(tempZipPath, zipContents);

	const extractDir = targetDirectoryName
		? joinPaths(themesDir, targetDirectoryName)
		: themesDir;

	await php.run({
		code: `<?php
$zip = new ZipArchive();
$res = $zip->open(${phpVar(tempZipPath)});
if ($res !== true) {
	throw new Exception('Failed to open zip: error code ' . $res);
}
$zip->extractTo(${phpVar(extractDir)});
$zip->close();
unlink(${phpVar(tempZipPath)});
`,
	});
}

/**
 * Writes a resolved directory tree to a target path
 * on the PHP filesystem.
 */
async function writeResolvedDirectory(
	dir: ResolvedDirectory,
	targetPath: string,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php } = context;
	await php.mkdir(targetPath);
	for (const [name, entry] of Object.entries(dir.files)) {
		const entryPath = joinPaths(targetPath, name);
		if (entry instanceof Uint8Array) {
			await php.writeFile(entryPath, entry);
		} else {
			await writeResolvedDirectory(
				entry as ResolvedDirectory,
				entryPath,
				context
			);
		}
	}
}

/**
 * Determines whether a source string looks like a
 * WordPress.org theme slug.
 */
function isThemeSlug(source: unknown): source is string {
	if (typeof source !== 'string') {
		return false;
	}
	if (source.startsWith('http://') || source.startsWith('https://')) {
		return false;
	}
	if (source.startsWith('./') || source.startsWith('/')) {
		return false;
	}
	return true;
}

/**
 * Determines whether a data reference is likely a directory.
 */
function isDirectoryLikeReference(ref: DataSources.DataReference): boolean {
	if (typeof ref === 'object' && ref !== null && 'directoryName' in ref) {
		return true;
	}
	return false;
}

registerV2StepHandler('installTheme', handler);
