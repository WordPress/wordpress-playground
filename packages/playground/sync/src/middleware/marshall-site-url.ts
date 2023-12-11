import { TransportEnvelope } from '../transports';

export const marshallSiteURLMiddleware = (
	localSiteUrl: string,
	placeholderUrl = 'https://playground.wordpress.net'
) => {
	return {
		beforeSend: siteURLMapper(localSiteUrl, placeholderUrl),
		afterReceive: siteURLMapper(placeholderUrl, localSiteUrl),
	};
};

/**
 * Maps the WordPress site URL from one value to another in SQL
 * query journal.
 *
 * @param fromURL - The original site URL to be replaced.
 * @param toURL - The new site URL to replace the original.
 * @returns Mapper function.
 */
function siteURLMapper(fromURL: string, toURL: string) {
	// Remove trailing slashes for consistency
	fromURL = fromURL.replace(/\/$/, '');
	toURL = toURL.replace(/\/$/, '');

	const urlRegexp = new RegExp(
		`(^|[^0-9a-zA-Z])(?:${escapeRegex(fromURL)})($|[^0-9a-zA-Z])`,
		'g'
	);
	const urlReplacement = `$1${toURL}$2`;

	return (envelope: TransportEnvelope) => ({
		...envelope,
		sql: envelope.sql.map((entry) => {
			if (entry.subtype === 'replay-query') {
				return {
					...entry,
					query: entry.query.replace(fromURL, toURL),
				};
			} else if (entry.subtype === 'reconstruct-insert') {
				const row = { ...entry.row };
				for (const key in row) {
					if (typeof row[key] === 'string') {
						row[key] = (row[key] as string).replace(
							urlRegexp,
							urlReplacement
						);
					}
				}
				return {
					...entry,
					row,
				};
			}
			return entry;
		}),
	});
}

function escapeRegex(string: string) {
	return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
