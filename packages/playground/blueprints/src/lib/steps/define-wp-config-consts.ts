import { StepHandler } from '.';
import { updateFile } from './common';

export const VFS_TMP_DIRECTORY = '/vfs-blueprints';

/**
 * @inheritDoc defineWpConfigConsts
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "defineWpConfigConsts",
 * 		"consts": {
 *          "WP_DEBUG": true
 *      }
 * }
 * </code>
 */
export interface DefineWpConfigConstsStep {
	step: 'defineWpConfigConsts';
	/** The constants to define */
	consts: Record<string, unknown>;
	/**
	 * @deprecated This option is noop and will be removed in a future version.
	 * This option is only kept in here to avoid breaking Blueprint schema validation
	 * for existing apps using this option.
	 */
	virtualize?: boolean;
}

/**
 * Defines constants to be used in wp-config.php file.
 *
 * Technically, this creates a wp-consts.php file in an in-memory
 * /vfs-blueprints directory and sets the auto_prepend_file PHP option
 * to always load that file.
 * @see https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts }) => {
	await playground.mkdir(VFS_TMP_DIRECTORY);
	const phpConstsFilePath = `${VFS_TMP_DIRECTORY}/wp-consts.php`;
	const jsonPath = `${VFS_TMP_DIRECTORY}/playground-consts.json`;
	await updateFile(playground, phpConstsFilePath, (contents) => {
		if (!contents.includes(jsonPath)) {
			return `<?php
	$consts = json_decode(file_get_contents('${jsonPath}'), true);
	foreach ($consts as $const => $value) {
		if (!defined($const)) {
			define($const, $value);
		}
	}
?>${contents}`;
		}
		return contents;
	});
	await updateFile(playground, jsonPath, (contents) =>
		JSON.stringify({
			...JSON.parse(contents || '{}'),
			...consts,
		})
	);

	await playground.setPhpIniEntry('auto_prepend_file', phpConstsFilePath);
	return phpConstsFilePath;
};
