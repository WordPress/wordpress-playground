import { SyncMiddleware } from '.';
import { SQLJournalEntry } from '../sql';

export const pruneSQLQueriesMiddleware = (): SyncMiddleware => ({
	beforeSend: (envelope) => ({
		...envelope,
		sql: envelope.sql.filter(shouldSyncQuery),
	}),
	afterReceive: (envelope) => envelope,
});

/**
 * Determines whether a SQL query should be considered private
 * to the current site. Private queries are not synced with other
 * sites. For example:
 *
 * * SELECT queries
 * * Transients
 * * Session tokens
 *
 * ...and more.
 *
 * @param entry - The SQL Journal entry.
 * @returns Whether the query should be considered private.
 */
const shouldSyncQuery = (entry: SQLJournalEntry) => {
	if (entry.query_type === 'SELECT') {
		return false;
	}
	const queryType = entry.query_type;
	const tableName = entry.table_name?.toLowerCase();

	if (entry.subtype === 'replay-query') {
		const query = entry.query.trim();
		// Don't sync cron updates
		if (
			queryType === 'UPDATE' &&
			tableName === 'wp_options' &&
			query.endsWith("`option_name` = 'cron'")
		) {
			return false;
		}
	}
	if (entry.subtype === 'reconstruct-insert') {
		// Don't sync transients
		if (tableName === 'wp_options') {
			const optionName = entry.row.option_name + '';
			if (
				optionName.startsWith('_transient_') ||
				optionName.startsWith('_site_transient_')
			) {
				return false;
			}
		}
		// Don't sync session tokens
		if (tableName === 'wp_usermeta') {
			if (entry.row.meta_key === 'session_tokens') {
				return false;
			}
		}
	}
	return true;
};
