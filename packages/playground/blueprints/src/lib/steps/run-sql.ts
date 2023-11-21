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
}

/**
 * Run an SQL file.
 */
export const runSql: StepHandler<RunSqlStep<File>> = async (
	playground,
	{ sql },
	progress?
) => {
	progress?.tracker.setCaption(`Executing SQL File`);

	await playground.writeFile(
		'/tmp/___schema-backup___.sql',
		new Uint8Array(await sql.arrayBuffer())
	);

	const docroot = await playground.documentRoot;

	const runPhp = await playground.run({
		code: `<?php
		require_once ${JSON.stringify(docroot)} . '/wp-load.php';

		$handle = fopen('/tmp/___schema-backup___.sql', 'r');
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

			$wpdb->query($buffer);
			$buffer = '';
		}
	`});

	await rm(playground, { path: '/tmp/___schema-backup___.sql' });

	return runPhp;
};
