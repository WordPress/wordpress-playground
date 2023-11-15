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
	 * The SQL file to run.
	 */
	path: string;
}

/**
 * Run an SQL file.
 *
 * @param playground The playground client.
 * @param path The path to the SQL file.
 */
export const runSqlFile: StepHandler<RunSqlFileStep> = async (
	playground,
	{ path },
	progress?
) => {
	progress?.tracker.setCaption(`Executing SQL`);

	const runPhp = await playground.run({
		code: `<?php
		require_once '/wordpress/wp-load.php';
		require_once '/wordpress//wp-content/plugins/Collector/Collector_Restore.php';
		collector_restore_backup(${JSON.stringify(path)});
	`,
	});

	return runPhp;
};
