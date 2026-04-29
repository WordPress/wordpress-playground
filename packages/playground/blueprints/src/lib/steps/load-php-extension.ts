import {
	loadPHPExtension as loadPHPExtensionFromSource,
	type LoadedPHPExtension,
	type PHPExtensionIniDirective,
	type PHPExtensionLoadTiming,
	type PHPExtensionSourceFormat,
	type PHPWasmAsyncMode,
} from '@php-wasm/universal';
import type { StepHandler } from '.';
import type { Directory } from '../v1/resources';

type SourceFile = File & { sourceUrl?: string };

/**
 * @inheritDoc loadPHPExtension
 * @example
 *
 * <code>
 * {
 * 		"step": "loadPHPExtension",
 * 		"source": {
 * 			"resource": "url",
 * 			"url": "https://example.com/extensions/example/manifest.json"
 * 		},
 * 		"sourceFormat": "manifest"
 * }
 * </code>
 */
export interface LoadPHPExtensionStep<FileResource, DirectoryResource> {
	step: 'loadPHPExtension';
	/** The extension `.so` file or a compile-extension `manifest.json`. */
	source: FileResource;
	/** Defaults to "manifest" for `.json` files and "so" otherwise. */
	sourceFormat?: PHPExtensionSourceFormat;
	/** Required when loading a `.so` file whose filename is not named after the extension. */
	name?: string;
	/** Defaults to "auto". */
	loadTiming?: PHPExtensionLoadTiming;
	/** Defaults to "extension". Use "zend_extension" for extensions like Xdebug. */
	loadWithIniDirective?: PHPExtensionIniDirective;
	/** Extra `php.ini` entries to write next to the extension. */
	iniEntries?: Record<string, string>;
	/** Extra files required by the extension, such as ICU data or shared libraries. */
	extraFiles?: DirectoryResource;
	/** Where to write `extraFiles`. Defaults to an extension-specific assets directory. */
	extraFilesPath?: string;
	/** Runtime environment variables needed by the extension. */
	env?: Record<string, string>;
	/** Overrides manifest artifact selection. Defaults to the running PHP version. */
	phpVersion?: string;
	/** Overrides manifest artifact selection. Defaults to the running async mode. */
	asyncMode?: PHPWasmAsyncMode;
	/** Base URL for relative artifact paths in an inline or bundled manifest. */
	manifestBaseUrl?: string;
	/** Where to install the extension `.so` and `.ini` files. */
	extensionDir?: string;
}

export const loadPHPExtension: StepHandler<
	LoadPHPExtensionStep<File, Directory>,
	Promise<LoadedPHPExtension>
> = async (
	playground,
	{
		source,
		sourceFormat,
		name,
		loadTiming,
		loadWithIniDirective,
		iniEntries,
		extraFiles,
		extraFilesPath,
		env,
		phpVersion,
		asyncMode,
		manifestBaseUrl,
		extensionDir,
	}
) => {
	const format = sourceFormat ?? inferSourceFormat(source);
	const bytes = new Uint8Array(await source.arrayBuffer());

	return await loadPHPExtensionFromSource(playground, {
		source:
			format === 'manifest'
				? {
						format,
						manifest: JSON.parse(new TextDecoder().decode(bytes)),
						baseUrl: manifestBaseUrl ?? getSourceUrl(source),
					}
				: {
						format,
						name: name ?? inferExtensionName(source),
						bytes,
					},
		name,
		loadTiming,
		loadWithIniDirective,
		iniEntries,
		extraFiles: extraFiles
			? {
					targetPath: extraFilesPath,
					files: extraFiles.files,
				}
			: undefined,
		env,
		phpVersion,
		asyncMode,
		extensionDir,
	});
};

function inferSourceFormat(source: File): PHPExtensionSourceFormat {
	return source.name.endsWith('.json') ? 'manifest' : 'so';
}

function inferExtensionName(source: File): string | undefined {
	return source.name.endsWith('.so') ? source.name.slice(0, -3) : undefined;
}

function getSourceUrl(source: SourceFile): string | undefined {
	return source.sourceUrl;
}
