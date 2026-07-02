import type { StepHandler } from '.';
import { rm } from './rm';
import { phpVars, randomFilename } from '@php-wasm/util';
/** @ts-ignore */
import streamClassContent from './WP_MySQL_Naive_Query_Stream.php?raw';

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
 *			"contents": "DELETE FROM wp_posts"
 *		}
 * }
 * </code>
 */
export interface RunSqlStep<ResourceType> {
	/**
	 * The step identifier.
	 */
	step: 'runSql';
	/**
	 * The SQL to run. Each non-empty line must contain a valid SQL query.
	 */
	sql: ResourceType;
	/**
	 * Whether to rewrite URLs in the SQL query text before execution.
	 *
	 * @default "rewrite"
	 */
	urlsMode?: 'rewrite' | 'preserve';
	/**
	 * Explicit URL replacements to apply to the SQL query text before execution.
	 */
	urlsMap?: Record<string, string>;
}

/**
 * Run one or more SQL queries.
 *
 * This step uses WP_MySQL_Naive_Query_Stream to parse and execute SQL queries using
 * streaming semantics. It supports multiline queries, comments, and queries
 * separated by semicolons. Each query is executed using `$wpdb`. This step assumes
 * a presence of the `sqlite-database-integration` plugin that ships the required
 * query tokenizer classes.
 */
export const runSql: StepHandler<RunSqlStep<File>> = async (
	playground,
	{ sql, urlsMode = 'rewrite', urlsMap = {} },
	progress?
) => {
	progress?.tracker.setCaption(`Executing SQL Queries`);

	const sqlFilename = `/tmp/${randomFilename()}.sql`;
	const streamClassFilename = `/tmp/${randomFilename()}.php`;

	await playground.writeFile(
		sqlFilename,
		new Uint8Array(await sql.arrayBuffer())
	);

	await playground.writeFile(
		streamClassFilename,
		new TextEncoder().encode(streamClassContent)
	);

	const docroot = await playground.documentRoot;
	const urlReplacements =
		urlsMode === 'rewrite' ? JSON.stringify(urlsMap) : '{}';

	const js = phpVars({
		docroot,
		sqlFilename,
		streamClassFilename,
		urlReplacements,
	});

	const runPhp = await playground.run({
		code: `<?php
		define('WP_SQLITE_AST_DRIVER', true);
		require_once ${js.docroot} . '/wp-load.php';

		// Load WP_MySQL_Naive_Query_Stream from the bundled file
		require_once ${js.streamClassFilename};

		global $wpdb;

		do_action('run_sql_step');

		$url_replacements = json_decode(${js.urlReplacements}, true);
		if (!is_array($url_replacements)) {
			throw new Exception('Invalid SQL URL replacements.');
		}

		if (!function_exists('playground_rewrite_sql_urls')) {
			function playground_rewrite_sql_urls($query, $url_replacements) {
				// This is a raw SQL-dump rewrite hook. It handles explicit URL literals
				// but does not try to infer source URLs or repair serialized PHP values.
				foreach ($url_replacements as $from => $to) {
					if (is_string($from) && is_string($to) && $from !== '') {
						$query = str_replace($from, $to, $query);
					}
				}
				return $query;
			}
		}

		$stream = new WP_MySQL_Naive_Query_Stream();

		// Open the SQL file for streaming
		$handle = fopen(${js.sqlFilename}, 'r');
		if (!$handle) {
			throw new Exception('Failed to open SQL file');
		}

		// Read and process the file in 8KB chunks
		$chunk_size = 8192;
		while (!feof($handle)) {
			$chunk = fread($handle, $chunk_size);
			if ($chunk === false) {
				break;
			}

			$stream->append_sql($chunk);

			// Process any complete queries in the stream
			while ($stream->next_query()) {
				$query = $stream->get_query();
				$query = playground_rewrite_sql_urls($query, $url_replacements);
				$wpdb->query($query);
			}
		}

		fclose($handle);

		// Mark input as complete and process any remaining queries
		$stream->mark_input_complete();
		while ($stream->next_query()) {
			$query = $stream->get_query();
			$query = playground_rewrite_sql_urls($query, $url_replacements);
			$wpdb->query($query);
		}
	`,
	});

	await rm(playground, { path: sqlFilename });
	await rm(playground, { path: streamClassFilename });

	return runPhp;
};
