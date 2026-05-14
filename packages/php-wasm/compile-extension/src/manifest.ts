import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ExtensionAsyncMode = 'jspi';
export type AsyncMode = typeof ExtensionAsyncMode;

/**
 * One sidecar file or empty directory staged alongside an artifact.
 *
 * Mirrors `PHPExtensionManifestExtraFile` in `@php-wasm/universal`.
 */
export interface ExtensionManifestExtraFile {
	/** Joined with the group's `vfsRoot` to form the final VFS path. */
	vfsPath: string;
	/** Defaults to "file". Only file nodes need a `sourcePath`. */
	type?: 'file' | 'directory';
	/** Relative to the manifest URL/base URL, or an absolute URL. */
	sourcePath?: string;
}

export interface ExtensionManifestExtraFiles {
	/** Absolute VFS prefix joined with each node's `vfsPath`. */
	vfsRoot?: string;
	nodes?: ExtensionManifestExtraFile[];
}

export interface ExtensionArtifact {
	phpVersion: string;
	/** Path to the `.so` file, relative to the manifest URL or absolute. */
	sourcePath: string;
	/** URL-backed files needed only by this artifact. */
	extraFiles?: ExtensionManifestExtraFiles;
}

export interface ExtensionManifest {
	name: string;
	version: string;
	/**
	 * The first directive of the generated startup `.ini` file. Defaults to
	 * `extension`; use `zend_extension` for Zend extensions like Xdebug.
	 */
	loadWithIniDirective?: 'extension' | 'zend_extension';
	/** Additional `key=value` lines for the generated startup `.ini` file. */
	iniEntries?: Record<string, string>;
	/** Environment variables added before the extension is loaded. */
	env?: Record<string, string>;
	/**
	 * VFS directory where PHP.wasm writes the extension `.so` file and its
	 * per-extension ini file.
	 */
	extensionDir?: string;
	artifacts: ExtensionArtifact[];
	/** URL-backed files shared by every artifact in this manifest. */
	extraFiles?: ExtensionManifestExtraFiles;
}

export interface BuiltArtifact {
	phpVersion: string;
	/** Path to the `.so` file, relative to the manifest URL. */
	sourcePath: string;
	/** Absolute path on disk where the `.so` was written. */
	path: string;
}

export async function createManifest(options: {
	name: string;
	version: string;
	artifacts: BuiltArtifact[];
	extraFiles?: ExtensionManifestExtraFiles;
}): Promise<ExtensionManifest> {
	const manifest: ExtensionManifest = {
		name: options.name,
		version: options.version,
		artifacts: options.artifacts.map((artifact) => ({
			phpVersion: artifact.phpVersion,
			sourcePath: artifact.sourcePath,
		})),
	};
	if (options.extraFiles) {
		manifest.extraFiles = options.extraFiles;
	}
	return manifest;
}

export async function writeManifest(options: {
	outDir: string;
	manifest: ExtensionManifest;
}): Promise<string> {
	await mkdir(options.outDir, { recursive: true });
	const manifestPath = path.join(options.outDir, 'manifest.json');
	await writeFile(
		manifestPath,
		`${JSON.stringify(options.manifest, null, 2)}\n`
	);
	return manifestPath;
}

export function findExtensionArtifact(
	manifest: ExtensionManifest,
	phpVersion: string
): ExtensionArtifact | undefined {
	return manifest.artifacts.find(
		(artifact) => artifact.phpVersion === phpVersion
	);
}
