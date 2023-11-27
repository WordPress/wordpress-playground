import { phpVars } from '@php-wasm/util';
import { StepHandler } from '.';
import { runPhpWithZipFunctions } from './common';

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
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await runPhpWithZipFunctions(
		playground,
		`unzip(${js.zipPath}, ${js.extractToPath});`
	);
};
