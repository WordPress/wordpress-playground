import {
	PHPResponse,
	PlaygroundClient,
	phpVar,
	phpVars,
} from '@wp-playground/client';
import patchedSqliteTranslator from './class-wp-sqlite-translator.php?raw';
/** @ts-ignore */
import logSqlQueries from './sync-mu-plugin.php?raw';

export async function installSqlSyncMuPlugin(playground: PlaygroundClient) {
	await playground.writeFile(
		'/wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php',
		patchedSqliteTranslator
	);
	await playground.writeFile(
		`/wordpress/wp-content/mu-plugins/sync-mu-plugin.php`,
		logSqlQueries
	);
}

export async function overrideAutoincrementSequences(
	playground: PlaygroundClient,
	baseOffset: number,
	knownIds: Record<string, number> = {}
) {
	const initializationResult = await playground.run({
		code: `<?php
        require '/wordpress/wp-load.php';
        playground_sync_override_autoincrement_algorithm(
			${phpVar(baseOffset)},
			${phpVar(knownIds)}
		);
	    `,
	});
	assertEmptyOutput(initializationResult, 'Initialization failed.');

	// Get the current autoincrement ID value for all tables
	const response = await playground.run({
		code: `<?php
        require '/wordpress/wp-load.php';
		$data = $GLOBALS['@pdo']
			->query('SELECT * FROM playground_sequence')
			->fetchAll(PDO::FETCH_KEY_PAIR);
		echo json_encode($data);
		`,
	});
	return response.json;
}

export async function recordSQLQueries(
	playground: PlaygroundClient,
	onCommit: (queries: SQLQueryMetadata) => void
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
						activeTransaction.forEach(onCommit);
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
			if (activeTransaction) {
				activeTransaction.push(queryOp);
			} else {
				onCommit(queryOp);
			}
		}
	});
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

export type SQLReplayQuery = {
	type: 'sql';
	subtype: 'replay-query';
	query: string;
	query_type: string;
	table_name: string;
	auto_increment_column: string;
	last_insert_id: number;
};
export type SQLReconstructInsert = {
	type: 'sql';
	subtype: 'reconstruct-insert';
	query_type: 'INSERT';
	row: Record<string, string | number | null>;
	table_name: string;
	auto_increment_column: string;
	last_insert_id: number;
};

export type SQLQueryMetadata = SQLReplayQuery | SQLReconstructInsert;

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
