import { SyncMiddleware } from '.';
import { asSQLFlatMapper } from './utils';

export const pruneSQLQueriesMiddleware = (): SyncMiddleware => ({
	beforeSend: pruneSQLQueries(),
	afterReceive: (query) => query,
});

function pruneSQLQueries() {
	return asSQLFlatMapper((meta) => {
		if (meta.query_type === 'SELECT') {
			return [];
		}
		const queryType = meta.query_type;
		const tableName = meta.table_name?.toLowerCase();

		if (meta.subtype === 'replay-query') {
			const query = meta.query.trim();
			// Don't sync cron updates
			if (
				queryType === 'UPDATE' &&
				tableName === 'wp_options' &&
				query.endsWith("`option_name` = 'cron'")
			) {
				return [];
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
					return [];
				}
			}
			// Don't sync session tokens
			if (tableName === 'wp_usermeta') {
				if (meta.row.meta_key === 'session_tokens') {
					return [];
				}
			}
		}
		return [meta];
	});
}
