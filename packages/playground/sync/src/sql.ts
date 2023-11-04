/*
 * TODO:
 * ✅ !! SQLITE stubbornly sets the sequence value to MAX(id)+1
 * * Do not sync transients, site URL, etc.
 * * Add unit tests for cases like:
 *   * Failed SQL queries
 *   * Transactions without the final commit (request died prematurely)
 *   * Conflicting SQL queries
 *   * Conflicting FS operations
 *   * Nested transactions
 *   * Unique constraint violations
 *   * Queries without transactions
 *   * Commits and rollbacks in transactions
 */

/**
 * SQL syncing strategy:
 *
 * * When the local WordPress issues a query, we record it in a buffer
 *   and broadcast it to the remote peer.
 * * Whenever an autoincrement value is generated:
 *    1. We override the SQLite-assigned sequence value with the next
 *       relevant value from playground_sequence.
 *    2. We fetch the entire row from the database and transmit it as
 *       JSON to the remote peer.
 * * The remote peer receives the query and executes it.
 */

import {
	PHPResponse,
	PlaygroundClient,
	phpVar,
	phpVars,
} from '@wp-playground/client';
import patchedSqliteTranslator from './class-wp-sqlite-translator.php?raw';
/** @ts-ignore */
import logSqlQueries from './sync-mu-plugin.php?raw';

export async function installSqlSyncMuPlugin(
	playground: PlaygroundClient,
	idOffset: number
) {
	await playground.writeFile(
		'/wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php',
		patchedSqliteTranslator
	);
	await playground.writeFile(
		`/wordpress/wp-content/mu-plugins/sync-mu-plugin.php`,
		logSqlQueries
	);
	const initializationResult = await playground.run({
		code: `<?php
        require '/wordpress/wp-load.php';
        playground_sync_override_autoincrement_algorithm(${phpVar(idOffset)});
	    `,
	});
	assertEmptyOutput(initializationResult, 'Initialization failed.');
}

export async function recordSQLQueries(
	playground: PlaygroundClient,
	onCommit: (queries: SQLQueryMetadata[]) => void
) {
	let activeTransaction: SQLQueryMetadata[] | null = null;

	// When PHP request terminates, any uncommitted
	// queries in the active transaction are rolled back.
	playground.addEventListener('request.end', () => {
		activeTransaction = null;
	});
	playground.onMessage(async (messageString: string) => {
		const queryOp = JSON.parse(messageString) as
			| SQLQueryMetadata
			| SQLTransactionCommand;
		if (queryOp.type !== 'sql') {
			return;
		}
		if (queryOp.subtype === 'transaction') {
			if (!queryOp.success) {
				return;
			}
			switch (queryOp.command) {
				case 'START TRANSACTION':
					activeTransaction = [];
					break;
				case 'COMMIT':
					if (activeTransaction?.length) {
						onCommit(activeTransaction);
					}
					activeTransaction = null;
					break;
				case 'ROLLBACK':
					activeTransaction = null;
					break;
			}
			return;
		}

		if (
			queryOp.subtype === 'replay-query' ||
			queryOp.subtype === 'reconstruct-insert'
		) {
			if (!shouldSyncQuery(queryOp)) {
				return;
			}

			if (activeTransaction) {
				activeTransaction.push(queryOp);
			} else {
				onCommit([queryOp]);
			}
		}
	});
}

function shouldSyncQuery(meta: SQLQueryMetadata) {
	if (meta.query_type === 'SELECT') {
		return false;
	}
	const queryType = meta.query_type;
	const tableName = meta.table_name.toLowerCase();

	if (meta.subtype === 'replay-query') {
		const query = meta.query.trim();
		// Don't sync cron updates
		if (
			queryType === 'UPDATE' &&
			tableName === 'wp_options' &&
			query.endsWith("`option_name` = 'cron'")
		) {
			return false;
		}
	}
	if (meta.subtype === 'reconstruct-insert') {
		// Don't sync transients
		if (tableName === 'wp_options') {
			const optionName = meta.row.option_name + '';
			if (
				optionName.startsWith('_transient_') ||
				optionName.startsWith('_site_transient_')
			) {
				return false;
			}
		}
		// Don't sync session tokens
		if (tableName === 'wp_usermeta') {
			if (meta.row.meta_key === 'session_tokens') {
				return false;
			}
		}
	}
	return true;
}

export async function replaySQLQueries(
	playground: PlaygroundClient,
	queries: SQLQueryMetadata[]
) {
	const js = phpVars({ queries });
	const result = await playground.run({
		code: `<?php
		// Prevent reporting changes from queries we're just replaying
		define('REPLAYING_SQL', true);

		// Only load WordPress and replay the SQL queries now
		require '/wordpress/wp-load.php';
		playground_sync_replay_queries(${js.queries});
	`,
	});
	assertEmptyOutput(result, 'Replay error.');
}

function assertEmptyOutput(result: PHPResponse, errorMessage: string) {
	if (result.text.trim() || result.errors.trim()) {
		console.error({
			text: result.text,
			errors: result.errors,
		});
		throw new Error(`${errorMessage}. See the console for more details.`);
	}
}

export type SQLQueryMetadata =
	| {
			type: 'sql';
			subtype: 'replay-query';
			query: string;
			query_type: string;
			table_name: string;
			auto_increment_column: string;
			last_insert_id: number;
	  }
	| {
			type: 'sql';
			subtype: 'reconstruct-insert';
			query_type: 'INSERT';
			row: Record<string, string | number | null>;
			table_name: string;
			auto_increment_column: string;
			last_insert_id: number;
	  };

export type SQLTransactionCommand =
	| {
			type: 'sql';
			subtype: 'transaction';
			command: 'START TRANSACTION';
			success: boolean;
	  }
	| {
			type: 'sql';
			subtype: 'transaction';
			command: 'COMMIT';
			success: boolean;
	  }
	| {
			type: 'sql';
			subtype: 'transaction';
			command: 'ROLLBACK';
			success: boolean;
	  };
