import { StepHandler } from '.';

/**
 * @inheritDoc mkdir
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "mkdir",
 * 		"path": "/wordpress/my-new-folder"
 * }
 * </code>
 */
export interface MkdirStep {
	step: 'mkdir';
	/** The path of the directory you want to create */
	path: string;
}

/**
 * Creates a directory at the specified path.
 */
export const mkdir: StepHandler<MkdirStep> = async (playground, { path }) => {
	await playground.mkdir(path);
};
