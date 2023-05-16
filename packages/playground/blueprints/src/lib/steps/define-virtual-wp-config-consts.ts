import { StepHandler } from '.';

/**
 * The step object for defining constants in the VFS_CONFIG_FILE_PATH php file and loaded using the auto_prepend_file php.ini directive.
 */
export interface DefineVirtualWpConfigConstsStep {
	step: 'defineVirtualWpConfigConsts';
	/** The constants to define */
	consts: Record<string, unknown>;
}

const VFS_CONFIG_PATH = '/vfs-blueprints';
const VFS_CONFIG_FILE_NAME = 'wp-config-consts.php';
export const VFS_CONFIG_FILE_PATH = `${VFS_CONFIG_PATH}/${VFS_CONFIG_FILE_NAME}`;

/**
 * Function to build the contents of the config php file.
 *
 * @param consts An object containing constants to be defined.
 * @returns Returns the file content as a string.
 */
function buildConfigFileContents(consts: Record<string, unknown>) {
	let contents = `<?php `;
	for (const [key, value] of Object.entries(consts)) {
		contents += `if (!defined('${key}')) {
      define("${key}", ${JSON.stringify(value)});
    }`;
	}
	return contents;
}

/**
 * Function to define constants in the virtual VFS_CONFIG_FILE_PATH php file of a WordPress installation.
 * The file is then dynamically loaded using the auto_prepend_file php.ini directive.
 *
 * @param playground The playground client.
 * @param wpConfigConst An object containing the constants to be defined and the optional virtual file system configuration file path.
 * @returns A Promise that resolves when the operation is completed.
 * @see {@link https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file}
 */
export const defineVirtualWpConfigConsts: StepHandler<
	DefineVirtualWpConfigConstsStep
> = async (playground, { consts }) => {
	playground.mkdir(VFS_CONFIG_PATH);
	playground.writeFile(VFS_CONFIG_FILE_PATH, buildConfigFileContents(consts));
	playground.setPhpIniEntry('auto_prepend_file', VFS_CONFIG_FILE_PATH);
};
