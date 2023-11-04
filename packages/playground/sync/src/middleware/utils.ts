import { SQLQueryMetadata } from '../sql';
import { TransportMessage } from '../transports';

export function mapSQLMeta(
	mapper: (message: SQLQueryMetadata) => SQLQueryMetadata
) {
	return (messages: TransportMessage[]) =>
		messages.map((message) => {
			if (message.scope === 'sql') {
				return {
					...message,
					details: mapper(message.details),
				};
			}
			return message;
		});
}
