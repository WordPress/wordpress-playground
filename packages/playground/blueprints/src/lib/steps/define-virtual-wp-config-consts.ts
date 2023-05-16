import { StepHandler } from '.';
import {
	VFS_CONFIG_FILE_BASENAME,
	VFS_CONFIG_FILE_PATH,
	updateFile,
} from './common';

/**
 * The step object for defining constants in the VFS_CONFIG_FILE_PATH php file and loaded using the auto_prepend_file php.ini directive.
 */
export interface DefineVirtualWpConfigConstsStep {
	step: 'defineVirtualWpConfigConsts';
	/** The constants to define */
	consts: Record<string, unknown>;
}

/**
 * Function to define constants in the virtual VFS_CONFIG_FILE_PATH php file of a WordPress installation.
 * The file should be dynamically loaded using the auto_prepend_file php.ini directive after this step.
 *
 * @param playground The playground client.
 * @param wpConfigConst An object containing the constants to be defined and the optional virtual file system configuration file path.
 * @returns Returns the virtual file system configuration file path.
 * @see {@link https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file}
 */
export const defineVirtualWpConfigConsts: StepHandler<
	DefineVirtualWpConfigConstsStep
> = async (playground, { consts }) => {
	playground.mkdir(VFS_CONFIG_FILE_BASENAME);
	const jsonPath = `${VFS_CONFIG_FILE_BASENAME}/playground-consts.json`;
	await updateFile(playground, jsonPath, (contents) =>
		JSON.stringify({
			...JSON.parse(contents || '{}'),
			...consts,
		})
	);
	await updateFile(playground, VFS_CONFIG_FILE_PATH, (contents) => {
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
	return VFS_CONFIG_FILE_PATH;
};
