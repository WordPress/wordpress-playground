import { StepHandler } from '.';

/**
 * @inheritDoc runSqlQuery
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 	    "step": "runSqlQuery",
 * 		"path": "wordpress.org/plugins"
 * }
 * </code>
 */
export interface RunSqlQueryStep {
	/**
	 * The step identifier.
	 */
	step: 'runSqlQuery';
	/**
	 * The SQL query to run.
	 */
	query: string | string[];
}

/**
 * Run one or more SQL queries.
 *
 * @param playground The playground client.
 * @param query The query/queries to run.
 */
export const runSqlQuery: StepHandler<RunSqlQueryStep> = async (
	playground,
	{ query },
	progress?
) => {
	if (!Array.isArray(query)) {
		query = [query];
	}

	progress?.tracker.setCaption(`Executing SQL Queries`);

	const code =
		`<?php
	require_once '/wordpress/wp-load.php';
	global $wpdb;\n` +
		query.map((q) => `$wpdb->query(${JSON.stringify(q)});`).join('\n');

	return await playground.run({ code });
};
