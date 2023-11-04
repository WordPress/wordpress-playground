import { SQLJournalEntry } from '../sql';
import { TransportEnvelope } from '../transports';

export function mapSQLJournal(
	mapper: (entry: SQLJournalEntry) => SQLJournalEntry
) {
	return (envelopes: TransportEnvelope[]) =>
		envelopes.map((message) => {
			if (message.scope === 'sql') {
				return {
					...message,
					contents: mapper(message.contents),
				};
			}
			return message;
		});
}
