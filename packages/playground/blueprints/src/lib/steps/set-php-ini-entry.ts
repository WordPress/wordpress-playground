import { StepHandler } from '.';

/**
 * @inheritDoc setPhpIniEntry
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "setPhpIniEntry",
 * 		"key": "display_errors",
 * 		"value": "1"
 * }
 * </code>
 */
export interface SetPhpIniEntryStep {
	step: 'setPhpIniEntry';
	/** Entry name e.g. "display_errors" */
	key: string;
	/** Entry value as a string e.g. "1" */
	value: string;
}

/**
 * Sets a PHP ini entry.
 */
export const setPhpIniEntry: StepHandler<SetPhpIniEntryStep> = async (
	playground,
	{ key, value }
) => {
	await playground.setPhpIniEntry(key, value);
};
