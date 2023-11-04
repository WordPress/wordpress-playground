import { mapSQLMeta } from './utils';

export const marshallSiteURLMiddleware = (
	localSiteUrl: string,
	placeholderUrl = 'https://playground.wordpress.net'
) => {
	return {
		beforeSend: siteURLMapper(localSiteUrl, placeholderUrl),
		afterReceive: siteURLMapper(placeholderUrl, localSiteUrl),
	};
};

function siteURLMapper(from: string, to: string) {
	// Remove trailing slashes for consistency
	from = from.replace(/\/$/, '');
	to = to.replace(/\/$/, '');

	const urlRegexp = new RegExp(
		`(^|[^0-9a-zA-Z])(?:${escapeRegex(from)})($|[^0-9a-zA-Z])`,
		'g'
	);
	const urlReplacement = `$1${to}$2`;

	return mapSQLMeta(function (meta) {
		if (meta.subtype === 'replay-query') {
			return {
				...meta,
				query: meta.query.replace(from, to),
			};
		} else if (meta.subtype === 'reconstruct-insert') {
			const row = { ...meta.row };
			for (const key in row) {
				if (typeof row[key] === 'string') {
					row[key] = (row[key] as string).replace(
						urlRegexp,
						urlReplacement
					);
				}
			}
			return {
				...meta,
				row,
			};
		}
		return meta;
	});
}

function escapeRegex(string: string) {
	return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
