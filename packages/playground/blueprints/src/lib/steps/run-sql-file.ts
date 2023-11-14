import { StepHandler } from '.';

/**
 * @inheritDoc runSqlFile
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 	    "step": "runSqlFile",
 * 		"path": "wordpress.org/plugins"
 * }
 * </code>
 */
export interface RunSqlFileStep {
	/**
	 * The step identifier.
	 */
	step: 'runSqlFile';
	/**
	 * The plugin zip file to install.
	 */
	path: string;
}

/**
 * Installs a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param pluginZipFile The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export const runSqlFile: StepHandler<RunSqlFileStep> = async (
	playground,
	{ path },
	progress?
) => {
	progress?.tracker.setCaption(`Executing SQL`);

	const runPhp = await playground.run({code:`<?php
	require_once '/wordpress/wp-load.php';
	require_once '/wordpress//wp-content/plugins/Collector/Collector_Restore.php';
	collector_restore_backup(${JSON.stringify(path)});
	`});

	return runPhp;
};
