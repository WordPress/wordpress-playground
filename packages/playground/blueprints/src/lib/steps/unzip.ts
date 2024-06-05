import { StepHandler } from '.';
import { unzipFile } from '@wp-playground/common';
import { logger } from '@php-wasm/logger';

/**
 * @inheritDoc unzip
 * @example
 *
 * <code>
 * {
 * 		"step": "unzip",
 * 		"zipFile": {
 * 			"resource": "vfs",
 * 			"path": "/wordpress/data.zip"
 * 		},
 * 		"extractToPath": "/wordpress"
 * }
 * </code>
 */
export interface UnzipStep<ResourceType> {
	step: 'unzip';
	/** The zip file to extract */
	zipFile?: ResourceType;
	/**
	 * The path of the zip file to extract
	 * @deprecated Use zipFile instead.
	 */
	zipPath?: string;
	/** The path to extract the zip file to */
	extractToPath: string;
}

/**
 * Unzip a zip file.
 *
 * @param playground Playground client.
 * @param zipPath The zip file to unzip.
 * @param extractTo The directory to extract the zip file to.
 */
export const unzip: StepHandler<UnzipStep<File>> = async (
	playground,
	{ zipFile, zipPath, extractToPath }
) => {
	if (zipPath) {
		// @TODO: Remove the zipPath option in the next major version
		logger.warn(
			`The "zipPath" option of the unzip() Blueprint step is deprecated and will be removed. ` +
				`Use "zipFile" instead.`
		);
	} else if (!zipFile) {
		throw new Error('Either zipPath or zipFile must be provided');
	}
	await unzipFile(playground, (zipFile || zipPath)!, extractToPath);
};
