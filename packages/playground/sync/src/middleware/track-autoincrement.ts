import { SyncMiddleware } from '.';

export const trackAutoincrementMiddleware = (
	onAutoincrementChange: (table: string, value: number) => void
): SyncMiddleware => ({
	beforeSend: (envelope) => ({
		...envelope,
		sql: envelope.sql.map((entry) => {
			if (entry.subtype === 'reconstruct-insert') {
				onAutoincrementChange(entry.table_name, entry.last_insert_id);
			}
			return entry;
		}),
	}),
	afterReceive: (envelopes) => envelopes,
});
