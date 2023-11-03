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

import { PlaygroundClient, phpVar, phpVars } from '@wp-playground/client';
import patchedSqliteTranslator from './class-wp-sqlite-translator.php?raw';
/** @ts-ignore */
import logSqlQueries from './sync-mu-plugin.php?raw';

// @TODO: Offset strategy. If we just discard this after each session and then
//        pick a new one, we'll quickly run into conflicts. Let's figure out
//        what is needed here. Do we have to synchronize this with the remote peer?
//        Remember it for later? How do we restore the values from the local playground_sequence
//        table? etc.
export const idOffset = Math.round(Math.random() * 1_000_000);

export async function recordSQLQueries(
	playground: PlaygroundClient,
	onFlush: any,
	debounceDelay = 3000
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
	if (
		initializationResult.text.trim() ||
		initializationResult.errors.trim()
	) {
		console.log(
			'Initialization failed ',
			initializationResult.text,
			initializationResult.errors
		);
		throw new Error();
	}

	let committedQueries: SQLQueryMetadata[] = [];
	let activeTransaction: SQLQueryMetadata[] | null = null;

	// When PHP request terminates, any uncommitted
	// queries in the active transaction are rolled back.
	playground.addEventListener('request.end', () => {
		activeTransaction = null;
	});
	playground.onMessage(async (messageString: string) => {
		const message = JSON.parse(messageString) as
			| SQLQueryMetadata
			| SQLTransactionCommand;
		if (message.type !== 'sql') {
			return;
		}
		if (message.subtype === 'transaction') {
			if (!message.success) {
				return;
			}
			switch (message.command) {
				case 'START TRANSACTION':
					activeTransaction = [];
					break;
				case 'COMMIT':
					if (activeTransaction?.length) {
						committedQueries = [
							...committedQueries,
							...activeTransaction,
						];
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
			message.subtype === 'replay-query' ||
			message.subtype === 'reconstruct-insert'
		) {
			if (!shouldSyncQuery(message)) {
				return;
			}

			if (activeTransaction) {
				activeTransaction.push(message);
			} else {
				committedQueries.push(message);
			}
		}

		debouncedFlush();
	});

	let flushTimeout: number | null = null;
	function debouncedFlush() {
		if (null !== flushTimeout) {
			clearTimeout(flushTimeout);
		}
		flushTimeout = setTimeout(() => {
			flushTimeout = null;
			const dataToBroadcast = committedQueries;
			committedQueries = [];
			onFlush(dataToBroadcast);
		}, debounceDelay) as any;
	}
}

function shouldSyncQuery(query: SQLQueryMetadata) {
	if (query.query_type === 'SELECT') {
		return false;
	}
	if (query.subtype === 'replay-query') {
		// Don't sync cron updates
		if (
			query.query_type === 'UPDATE' &&
			query.table_name.toLowerCase() === 'wp_options' &&
			query.query.trim().endsWith("`option_name` = 'cron'")
		) {
			return false;
		}
	}
	if (query.subtype === 'reconstruct-insert') {
		// Don't sync transients
		const isTransient =
			query.table_name.toLowerCase() === 'wp_options' &&
			typeof query.row.option_name === 'string' &&
			(query.row.option_name.startsWith('_transient_') ||
				query.row.option_name.startsWith('_site_transient_'));
		if (isTransient) {
			return false;
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
	if (result.text.trim() || result.errors.trim()) {
		console.log(`Replay error `, result.text, result.errors);
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
			row: Record<string, unknown>;
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
