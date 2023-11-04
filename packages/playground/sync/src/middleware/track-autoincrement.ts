import { SyncMiddleware } from '.';
import { asSQLMapper } from './utils';

export const trackAutoincrementMiddleware = (
	onAutoincrementChange: (table: string, value: number) => void
): SyncMiddleware => ({
	beforeSend: asSQLMapper((query) => {
		if (query.subtype === 'reconstruct-insert') {
			onAutoincrementChange(query.table_name, query.last_insert_id);
		}
		return query;
	}),
	afterReceive: (message) => message,
});
