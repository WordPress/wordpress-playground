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
 *      },
 *      "virtualize": true
 * }
 * </code>
 */
export interface DefineWpConfigConstsStep {
	step: 'defineWpConfigConsts';
	/** The constants to define */
	consts: Record<string, unknown>;
	/**
	 * Enables the virtualization of wp-config.php and playground-consts.json files, leaving the local system files untouched.
	 * The variables defined in the /vfs-blueprints/playground-consts.json file are loaded via the auto_prepend_file directive in the php.ini file.
	 * @default false
	 * @see https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file
	 */
	virtualize?: boolean;
}

/**
 * Defines the wp-config.php constants
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts, virtualize = false }) => {
	const documentRoot = await playground.documentRoot;
	const basePath = virtualize ? VFS_TMP_DIRECTORY : documentRoot;
	const jsonPath = `${basePath}/playground-consts.json`;
	const configFilePath = `${basePath}/wp-config.php`;
	if (virtualize) {
		playground.mkdir(VFS_TMP_DIRECTORY);
		playground.setPhpIniEntry('auto_prepend_file', configFilePath);
	}
	await updateFile(playground, jsonPath, (contents) =>
		JSON.stringify({
			...JSON.parse(contents || '{}'),
			...consts,
		})
	);
	await updateFile(playground, configFilePath, (contents) => {
		if (!contents.includes('playground-consts.json')) {
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
	return configFilePath;
};
