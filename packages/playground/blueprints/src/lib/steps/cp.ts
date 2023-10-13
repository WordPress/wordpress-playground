import { StepHandler } from '.';

/**
 * @inheritDoc cp
 * @hasRunnableExample
 * @landingPage /index2.php
 * @example
 *
 * <code>
 * {
 * 		"step": "cp",
 * 		"fromPath": "/wordpress/index.php",
 * 		"toPath": "/wordpress/index2.php"
 * }
 * </code>
 */
export interface CpStep {
	step: 'cp';
	/** Source path */
	fromPath: string;
	/** Target path */
	toPath: string;
}

/**
 * Copies a file from one path to another.
 */
export const cp: StepHandler<CpStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.writeFile(
		toPath,
		await playground.readFileAsBuffer(fromPath)
	);
};
