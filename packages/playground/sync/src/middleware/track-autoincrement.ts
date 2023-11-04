import { SyncMiddleware } from '.';
import { mapSQLMeta } from './utils';

export const trackAutoincrementMiddleware = (
	onAutoincrementChange: (table: string, value: number) => void
): SyncMiddleware => ({
	beforeSend: mapSQLMeta((meta) => {
		if (meta.subtype === 'reconstruct-insert') {
			onAutoincrementChange(meta.table_name, meta.last_insert_id);
		}
		return meta;
	}),
	afterReceive: (message) => message,
});
