import { SyncMiddleware } from '.';
import { mapSQLJournal } from './utils';

export const trackAutoincrementMiddleware = (
	onAutoincrementChange: (table: string, value: number) => void
): SyncMiddleware => ({
	beforeSend: mapSQLJournal((entry) => {
		if (entry.subtype === 'reconstruct-insert') {
			onAutoincrementChange(entry.table_name, entry.last_insert_id);
		}
		return entry;
	}),
	afterReceive: (envelopes) => envelopes,
});
