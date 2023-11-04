import { SQLQueryMetadata } from "../sql";
import { TransportMessage } from "../transports";

export function asSQLMapper(mapper: (message: SQLQueryMetadata) => SQLQueryMetadata) {
	return (messages: TransportMessage[]) =>
		messages.map((message) => {
			if (message.scope === 'sql') {
				return {
					...message,
					details: message.details.map(mapper),
				};
			}
			return message;
		});
}
