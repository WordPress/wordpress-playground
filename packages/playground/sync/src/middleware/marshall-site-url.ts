import { asSQLMapper } from './utils';

export const marshallSiteURLMiddleware = (
	localSiteUrl: string,
	placeholderUrl = 'https://playground.wordpress.net'
) => {
	return {
		beforeSend: replaceURL(localSiteUrl, placeholderUrl),
		afterReceive: replaceURL(placeholderUrl, localSiteUrl),
	};
};

function replaceURL(from: string, to: string) {
	// Remove trailing slashes for consistency
	from = from.replace(/\/$/, '');
	to = to.replace(/\/$/, '');

	return replaceString(
		new RegExp(
			`(^|[^0-9a-zA-Z])(?:${escapeRegex(from)})($|[^0-9a-zA-Z])`,
			'g'
		),
		`$1${to}$2`
	);
}

function replaceString(from: string | RegExp, to: string) {
	return asSQLMapper(function (meta) {
		if (meta.subtype === 'replay-query') {
			return {
				...meta,
				query: meta.query.replace(from, to),
			};
		} else if (meta.subtype === 'reconstruct-insert') {
			const row = { ...meta.row };
			for (const key in row) {
				if (typeof row[key] === 'string') {
					row[key] = (row[key] as string).replace(from, to);
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
