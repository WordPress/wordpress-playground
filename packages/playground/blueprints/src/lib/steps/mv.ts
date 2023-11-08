import { StepHandler } from '.';

/**
 * @inheritDoc mv
 * @hasRunnableExample
 * @landingPage /index2.php
 * @example
 *
 * <code>
 * {
 * 		"step": "mv",
 * 		"fromPath": "/wordpress/index.php",
 * 		"toPath": "/wordpress/index2.php"
 * }
 * </code>
 */
export interface MvStep {
	step: 'mv';
	/** Source path */
	fromPath: string;
	/** Target path */
	toPath: string;
}

/**
 * Moves a file or directory from one path to another.
 */
export const mv: StepHandler<MvStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.mv(fromPath, toPath);
};
