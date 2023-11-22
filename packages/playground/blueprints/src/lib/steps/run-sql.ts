import { StepHandler } from '.';
import { rm } from './rm';

/**
 * @inheritDoc runSql
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 *		"step": "runSql",
 *		"sql": {
 *			"resource": "literal",
 *			"name": "schema.sql",
 *			"contents": "SELECT * FROM wp_posts"
 *		},
 * }
 * </code>
 */
export interface RunSqlStep<ResourceType> {
	/**
	 * The step identifier.
	 */
	step: 'runSql';
	/**
	 * The SQL to run.
	 */
	sql: ResourceType;
	/**
	 * Whether to stop on errors
	 */
	stopOnErrors?: boolean;
}

/**
 * Run an SQL file.
 */
export const runSql: StepHandler<RunSqlStep<File>> = async (
	playground,
	{ sql, stopOnErrors = true },
	progress?
) => {
	progress?.tracker.setCaption(`Executing SQL File`);

	const sqlFilename = `/tmp/${crypto.randomUUID()}.sql`;

	await playground.writeFile(
		sqlFilename,
		new Uint8Array(await sql.arrayBuffer())
	);

	const docroot = await playground.documentRoot;

	const runPhp = await playground.run({
		code: `<?php
		require_once ${JSON.stringify(docroot)} . '/wp-load.php';

		$handle = fopen(${JSON.stringify(sqlFilename)}, 'r');
		$buffer = '';

		global $wpdb;

		while ($bytes = fgets($handle)) {
			$buffer .= $bytes;

			if (!feof($handle) && substr($buffer, -1, 1) !== "\n") {
				continue;
			}

			if (substr($buffer, 0, 2) === '--') {
				$buffer = '';
				continue;
			}

			echo $buffer;

			$wpdb->query($buffer);
			$buffer = '';
		}
	`,
	});

	if (stopOnErrors && runPhp.errors) {
		throw new Error(runPhp.errors);
	}

	await rm(playground, { path: sqlFilename });

	return runPhp;
};
