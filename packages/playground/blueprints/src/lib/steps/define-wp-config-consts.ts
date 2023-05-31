import { StepHandler } from '.';
import { updateFile } from './common';

export const VFS_TMP_DIRECTORY = '/vfs-blueprints';

/**
 * The step object for defining constants in the wp-config.php file of a WordPress installation.
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
 * Sets site URL of the WordPress installation.
 *
 * @param playground The playground client.
 * @param wpConfigConst An object containing the constants to be defined and the optional virtual file system configuration file path.
 * @returns Returns the virtual file system configuration file path.
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
