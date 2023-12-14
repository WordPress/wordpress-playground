import { StepHandler } from '.';
import { unzipFiles } from '../zip';
import { writeToPathStream } from '@php-wasm/universal';

/**
 * @inheritDoc unzip
 * @example
 *
 * <code>
 * {
 * 		"step": "unzip",
 * 		"zipPath": "/wordpress/data.zip",
 * 		"extractToPath": "/wordpress"
 * }
 * </code>
 */
export interface UnzipStep {
	step: 'unzip';
	/** The zip file to extract */
	zipPath: string;
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
export const unzip: StepHandler<UnzipStep> = async (
	playground,
	{ zipPath, extractToPath }
) => {
	const zipBytes = await playground.readFileAsBuffer(zipPath);
	const zipStream = new Blob([zipBytes]).stream();
	await unzipFiles(zipStream).pipeTo(
		writeToPathStream(playground, extractToPath)
	);
};
