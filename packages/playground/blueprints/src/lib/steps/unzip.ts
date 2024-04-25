import { phpVars } from '@php-wasm/util';
import { StepHandler } from '.';
import { runPhpWithZipFunctions } from '../utils/run-php-with-zip-functions';
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

const tmpPath = '/tmp/file.zip';

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
		// Compatibility with the old Blueprints API
		// @TODO: Remove the zipPath option in the next major version
		await playground.writeFile(
			tmpPath,
			await playground.readFileAsBuffer(zipPath)
		);
		logger.warn(
			`The "zipPath" option of the unzip() Blueprint step is deprecated and will be removed. ` +
				`Use "zipFile" instead.`
		);
	} else if (zipFile) {
		await playground.writeFile(
			tmpPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	} else {
		throw new Error('Either zipPath or zipFile must be provided');
	}
	const js = phpVars({
		zipPath: tmpPath,
		extractToPath,
	});
	await runPhpWithZipFunctions(
		playground,
		`unzip(${js.zipPath}, ${js.extractToPath});`
	);
	if (playground.fileExists(tmpPath)) {
		await playground.unlink(tmpPath);
	}
};
