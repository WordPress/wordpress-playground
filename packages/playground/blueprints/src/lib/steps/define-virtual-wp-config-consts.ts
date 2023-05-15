import { StepHandler } from '.';

/**
 * The step object for defining constants in the vfsConfigFilePath php file and loaded using the auto_prepend_file php.ini directive.
 */
export interface DefineVirtualWpConfigConstsStep {
	step: 'defineVirtualWpConfigConsts';
	/** The constants to define */
	consts: Record<string, unknown>;
	vfsConfigFilePath?: string;
}

const VFS_CONFIG_FILE_PATH = '/tmp/wp-config-consts.php';

/**
 * Function to build the contents of the config php file.
 *
 * @param {Record<string, unknown>} consts - An object containing constants to be defined.
 * @returns {string} - Returns the file content as a string.
 */
function buildConfigFileContents(consts: Record<string, unknown>) {
	let contents = `<?php `;
	for (const [key, value] of Object.entries(consts)) {
		contents += `if (!defined('${key}')) {
      define('${key}', ${JSON.stringify(value)});
    }`;
	}
	return contents;
}

/**
 * Function to define constants in the virtual vfsConfigFilePath php file of a WordPress installation.
 * The file is then dinamically loaded using the auto_prepend_file php.ini directive.
 *
 * @param {Object} playground - The playground client.
 * @param {DefineVirtualWpConfigConstsStep} wpConfigConst - An object containing the constants to be defined and the optional virtual file system configuration file path.
 * @returns {Promise<void>} - A Promise that resolves when the operation is completed.
 * @see {@link https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file}
 */
export const defineVirtualWpConfigConsts: StepHandler<
	DefineVirtualWpConfigConstsStep
> = async (playground, { consts, vfsConfigFilePath }) => {
	const configFilePath = vfsConfigFilePath || VFS_CONFIG_FILE_PATH;
	playground.writeFile(configFilePath, buildConfigFileContents(consts));
	playground.setPhpIniEntry('auto_prepend_file', configFilePath);
};
