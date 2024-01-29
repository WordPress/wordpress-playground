import { phpVars } from '@php-wasm/util';
import { StepHandler } from '.';
import { runPhpWithZipFunctions } from '../utils/run-php-with-zip-functions';

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
	/** The path of the zip file to extract */
	zipPath?: string;
	/** The zip file to extract */
	zipFile?: Blob;
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
export const unzip: StepHandler<UnzipStep> = async (
	playground,
	{ zipFile, zipPath, extractToPath }
) => {
	if (zipFile) {
		zipPath = tmpPath;
		await playground.writeFile(
			tmpPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	}
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await runPhpWithZipFunctions(
		playground,
		`unzip(${js.zipPath}, ${js.extractToPath});`
	);
	if (zipFile) {
		await playground.unlink(tmpPath);
	}
};
