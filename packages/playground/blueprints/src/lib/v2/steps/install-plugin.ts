import type { V2StepHandler, ResolvedDirectory } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { DataReferenceResolverImpl } from '../data-references/resolver';
import { joinPaths, phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface InstallPluginArgs {
	source: DataSources.DataReference | DataSources.PluginDirectoryReference;
	active?: boolean;
	activationOptions?: Record<string, unknown>;
	targetDirectoryName?: string;
	onError?: 'throw' | 'skip';
}

/**
 * Installs a WordPress plugin.
 *
 * The source can be a WordPress.org slug (e.g. "jetpack"),
 * a URL to a zip file, an execution context path, or an
 * inline file/directory object.
 */
const handler: V2StepHandler<InstallPluginArgs> = async (args, context) => {
	const { php } = context;
	const docroot = await php.documentRoot;
	const pluginsDir = joinPaths(docroot, 'wp-content', 'plugins');

	const source = args.source;
	const active = args.active !== undefined ? args.active : true;
	const targetDirectoryName = args.targetDirectoryName;

	try {
		if (isPluginSlug(source)) {
			await installFromSlug(
				source,
				pluginsDir,
				targetDirectoryName,
				context
			);
		} else {
			await installFromDataReference(
				source as DataSources.DataReference,
				pluginsDir,
				targetDirectoryName,
				context
			);
		}

		if (active) {
			await activateInstalledPlugin(
				pluginsDir,
				targetDirectoryName,
				context
			);
		}
	} catch (error) {
		if (args.onError === 'skip') {
			return;
		}
		throw error;
	}
};

/**
 * Installs a plugin from a WordPress.org slug by resolving
 * the slug via the resolver implementation.
 */
async function installFromSlug(
	slug: string,
	pluginsDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const resolver = context.dataReferenceResolver as DataReferenceResolverImpl;
	const file = await resolver.resolvePluginReference(slug);
	await extractZipToPlugins(
		file.contents,
		pluginsDir,
		targetDirectoryName,
		context
	);
}

/**
 * Installs a plugin from a generic data reference (URL,
 * execution context path, inline file/directory, etc.).
 */
async function installFromDataReference(
	ref: DataSources.DataReference,
	pluginsDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { dataReferenceResolver } = context;

	// Try resolving as a directory first (for inline directories
	// or execution-context directory paths).
	if (isDirectoryLikeReference(ref)) {
		const dir = await dataReferenceResolver.resolveDirectory(ref);
		const dirName = targetDirectoryName || dir.name;
		const targetPath = joinPaths(pluginsDir, dirName);
		await writeResolvedDirectory(dir, targetPath, context);
		return;
	}

	// Otherwise resolve as a file (zip or URL).
	const file = await dataReferenceResolver.resolveFile(ref);
	if (looksLikeZip(file.contents)) {
		await extractZipToPlugins(
			file.contents,
			pluginsDir,
			targetDirectoryName,
			context
		);
	} else {
		// Single PHP file — write directly to plugins directory.
		const fileName = targetDirectoryName
			? joinPaths(pluginsDir, targetDirectoryName, file.name)
			: joinPaths(pluginsDir, file.name);
		await context.php.writeFile(fileName, file.contents);
	}
}

/**
 * Extracts a zip file into the plugins directory using PHP
 * ZipArchive.
 */
async function extractZipToPlugins(
	zipContents: Uint8Array,
	pluginsDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php } = context;
	const tempZipPath = '/tmp/plugin-install.zip';
	await php.writeFile(tempZipPath, zipContents);

	const extractDir = targetDirectoryName
		? joinPaths(pluginsDir, targetDirectoryName)
		: pluginsDir;

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
 * Activates the most recently installed plugin by scanning
 * the target directory for PHP files with plugin headers.
 */
async function activateInstalledPlugin(
	pluginsDir: string,
	targetDirectoryName: string | undefined,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php } = context;
	const docroot = await php.documentRoot;

	// When a targetDirectoryName is given we know the exact
	// folder. Otherwise we ask PHP to find the plugin file
	// in the plugins directory.
	const searchDir = targetDirectoryName
		? joinPaths(pluginsDir, targetDirectoryName)
		: pluginsDir;

	await php.run({
		code: `<?php
define('WP_ADMIN', true);
require_once(${phpVar(docroot)} . '/wp-load.php');
require_once(${phpVar(docroot)} . '/wp-admin/includes/plugin.php');

wp_set_current_user(
	get_users(array('role' => 'Administrator'))[0]->ID
);

$search_dir = ${phpVar(searchDir)};
$plugin_dir = ${phpVar(pluginsDir)};

// Try to activate the directory directly first.
if (is_dir($search_dir) && $search_dir !== $plugin_dir) {
	$relative = str_replace(
		rtrim($plugin_dir, '/') . '/',
		'',
		$search_dir
	);
	foreach (glob($search_dir . '/*.php') ?: [] as $file) {
		$info = get_plugin_data($file, false, false);
		if (!empty($info['Name'])) {
			$relative_file = $relative . '/' . basename($file);
			activate_plugin($relative_file);
			return;
		}
	}
}

// Fallback: scan top-level subdirectories inside the
// plugins directory for newly added plugin directories.
foreach (glob($plugin_dir . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
	foreach (glob($dir . '/*.php') ?: [] as $file) {
		$info = get_plugin_data($file, false, false);
		if (!empty($info['Name'])) {
			$relative_file = basename($dir) . '/' . basename($file);
			if (!is_plugin_active($relative_file)) {
				activate_plugin($relative_file);
				return;
			}
		}
	}
}
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
 * WordPress.org plugin slug rather than a URL, execution
 * context path, or inline object.
 */
function isPluginSlug(source: unknown): source is string {
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
 * Determines whether a data reference is likely a directory
 * (inline directory or execution-context directory path
 * ending with `/`).
 */
function isDirectoryLikeReference(ref: DataSources.DataReference): boolean {
	if (typeof ref === 'object' && ref !== null && 'directoryName' in ref) {
		return true;
	}
	return false;
}

/**
 * Checks the first four bytes of a buffer for the ZIP file
 * signature (PK\x03\x04).
 */
function looksLikeZip(contents: Uint8Array): boolean {
	if (contents.length < 4) {
		return false;
	}
	return (
		contents[0] === 0x50 &&
		contents[1] === 0x4b &&
		contents[2] === 0x03 &&
		contents[3] === 0x04
	);
}

registerV2StepHandler('installPlugin', handler);
