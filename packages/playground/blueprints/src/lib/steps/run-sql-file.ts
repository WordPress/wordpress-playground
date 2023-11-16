import { StepHandler } from '.';

/**
 * @inheritDoc runSqlFile
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 	    "step": "runSqlFile",
 * 		"path": "/tmp/my-backup.sql"
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
 * @param path The filepath of the SQL file.
 */
export const runSqlFile: StepHandler<RunSqlFileStep> = async (
	playground,
	{ path },
	progress?
) => {
	progress?.tracker.setCaption(`Executing SQL File`);

	const runPhp = await playground.run({
		code: `<?php
		require_once ${JSON.stringify(playground.documentRoot)} . '/wp-load.php';

		$handle = fopen(${JSON.stringify(path)}, 'r');
		$buffer = '';

		global $wpdb;

		while ($bytes = fgets($handle)) {
			$buffer .= $bytes;

			if (substr($buffer, -1, 1) !== "\n") {
				continue;
			}

			if (substr($buffer, 0, 2) === '--') {
				$buffer = '';
				continue;
			}

			$wpdb->query($buffer);
			$buffer = '';
		}
	`,
	});

	return runPhp;
};
