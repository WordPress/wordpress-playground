import { StepHandler } from '.';
import { unzip as _unzip } from '@wp-playground/php-bridge';

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
 * @param zipFile The zip file to unzip.
 * @param extractTo The directory to extract the zip file to.
 */
export const unzip: StepHandler<UnzipStep<File>> = async (
	playground,
	{ zipFile, zipPath, extractToPath }
) => {
	if (zipPath) {
		zipFile = new File(
			[await playground.readFileAsBuffer(zipPath)],
			'file.zip'
		);
		console.warn(
			`The "zipPath" option of the unzip() Blueprint step is deprecated and will be removed. ` +
				`Use "zipFile" instead.`
		);
	}

	if (!zipFile) {
		throw new Error('Either zipPath or zipFile must be provided');
	}
	return await _unzip(playground, zipFile, extractToPath);
};
