const URL_WITH_SCHEME_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/g;
const SENSITIVE_QUERY_PARAM_NAMES = new Set([
	'access-token',
	'access_token',
	'accesstoken',
	'api-key',
	'api_key',
	'apikey',
	'aws-access-key-id',
	'aws_access_key_id',
	'awsaccesskeyid',
	'auth-token',
	'auth_token',
	'authtoken',
	'auth',
	'client-secret',
	'client_secret',
	'clientsecret',
	'consumer-key',
	'consumer_key',
	'consumerkey',
	'credential',
	'id-token',
	'id_token',
	'idtoken',
	'key',
	'oauth-token',
	'oauth_token',
	'oauthtoken',
	'pass',
	'password',
	'private-token',
	'private_token',
	'privatetoken',
	'secret',
	'sig',
	'signature',
	'token',
	'x-amz-credential',
	'x-amz-security-token',
	'x-amz-signature',
]);
const SENSITIVE_QUERY_PARAM_PARTS = new Set([
	'auth',
	'credential',
	'key',
	'pass',
	'password',
	'secret',
	'sig',
	'signature',
	'token',
]);

/**
 * Redacts credentials from all HTTP(S) URLs found in a text fragment.
 *
 * Nested URL-valued query params and URL paths are redacted recursively. Text
 * that does not look like an HTTP(S) URL is left unchanged.
 */
export function redactSensitiveText(text: string): string {
	return text.replace(URL_WITH_SCHEME_PATTERN, (url) =>
		redactSensitiveUrl(url)
	);
}

/**
 * Redacts credentials from a single URL while preserving useful diagnostics.
 *
 * User info and known sensitive query parameters are replaced with `REDACTED`;
 * non-sensitive query params and trailing punctuation are preserved. Malformed
 * URLs are returned unchanged because this helper is used only for diagnostics
 * and must not make error reporting fail.
 */
export function redactSensitiveUrl(url: string): string {
	const { url: urlWithoutTrailingPunctuation, trailingPunctuation } =
		splitTrailingPunctuation(url);
	try {
		const parsed = new URL(urlWithoutTrailingPunctuation);
		if (parsed.username) {
			parsed.username = 'REDACTED';
		}
		if (parsed.password) {
			parsed.password = 'REDACTED';
		}

		const decodedPathname = safelyDecodeURIComponent(parsed.pathname);
		const redactedPathname = redactSensitiveText(decodedPathname);
		if (redactedPathname !== decodedPathname) {
			parsed.pathname = redactedPathname;
		}

		redactSensitiveParams(parsed.searchParams);

		const redactedHash = redactSensitiveHash(parsed.hash);
		if (redactedHash !== parsed.hash) {
			parsed.hash = redactedHash;
		}

		return parsed.toString() + trailingPunctuation;
	} catch {
		return url;
	}
}

/**
 * Indicates whether a URL carries credentials or sensitive query data.
 *
 * This is intentionally separate from redaction output so callers can make
 * persistence decisions without depending on URL serialization details.
 */
export function hasSensitiveUrlData(url: string): boolean {
	const { url: urlWithoutTrailingPunctuation } =
		splitTrailingPunctuation(url);
	try {
		const parsed = new URL(urlWithoutTrailingPunctuation);
		if (parsed.username || parsed.password) {
			return true;
		}

		const decodedPathname = safelyDecodeURIComponent(parsed.pathname);
		if (containsSensitiveUrl(decodedPathname)) {
			return true;
		}
		if (hasSensitiveHashData(parsed.hash)) {
			return true;
		}

		if (paramsHaveSensitiveData(parsed.searchParams)) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

function redactSensitiveHash(hash: string): string {
	if (!hash) {
		return hash;
	}

	const hashBody = hash.replace(/^#/, '');
	const decodedHashBody = safelyDecodeURIComponent(hashBody);
	const redactedHashBody = redactSensitiveText(decodedHashBody);
	const redactedParamHashBody = redactSensitiveParamText(decodedHashBody);

	if (redactedParamHashBody !== decodedHashBody) {
		return `#${redactedParamHashBody}`;
	}
	if (redactedHashBody !== decodedHashBody) {
		return `#${redactedHashBody}`;
	}
	return hash;
}

function redactSensitiveParamText(text: string): string {
	const paramText = text.startsWith('?') ? text.slice(1) : text;
	if (!/[=&]/.test(paramText)) {
		return text;
	}

	const params = new URLSearchParams(paramText);
	const changed = redactSensitiveParams(params);

	if (!changed) {
		return text;
	}
	const serialized = params.toString().replace(/\+/g, '%20');
	return text.startsWith('?') ? `?${serialized}` : serialized;
}

function hasSensitiveHashData(hash: string): boolean {
	if (!hash) {
		return false;
	}

	const hashBody = hash.replace(/^#/, '');
	const decodedHashBody = safelyDecodeURIComponent(hashBody);
	if (containsSensitiveUrl(decodedHashBody)) {
		return true;
	}

	const paramText = decodedHashBody.startsWith('?')
		? decodedHashBody.slice(1)
		: decodedHashBody;
	if (!/[=&]/.test(paramText)) {
		return false;
	}

	return paramsHaveSensitiveData(new URLSearchParams(paramText));
}

function redactSensitiveParams(params: URLSearchParams): boolean {
	let changed = false;
	for (const [key, value] of params) {
		if (isSensitiveQueryParamName(key)) {
			params.set(key, 'REDACTED');
			changed = true;
			continue;
		}
		const redactedValue = redactSensitiveText(value);
		if (redactedValue !== value) {
			params.set(key, redactedValue);
			changed = true;
		}
	}
	return changed;
}

function paramsHaveSensitiveData(params: URLSearchParams): boolean {
	for (const [key, value] of params) {
		if (isSensitiveQueryParamName(key) || containsSensitiveUrl(value)) {
			return true;
		}
	}
	return false;
}

function isSensitiveQueryParamName(name: string): boolean {
	const normalizedName = name.toLowerCase();
	if (SENSITIVE_QUERY_PARAM_NAMES.has(normalizedName)) {
		return true;
	}

	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.split(/[-_.:[\]]+/)
		.some((part) => SENSITIVE_QUERY_PARAM_PARTS.has(part));
}

function containsSensitiveUrl(text: string): boolean {
	for (const match of text.matchAll(URL_WITH_SCHEME_PATTERN)) {
		if (hasSensitiveUrlData(match[0])) {
			return true;
		}
	}
	return false;
}

function splitTrailingPunctuation(url: string) {
	const match = url.match(/[),.;!?]+$/);
	if (!match) {
		return { url, trailingPunctuation: '' };
	}
	return {
		url: url.slice(0, -match[0].length),
		trailingPunctuation: match[0],
	};
}

function safelyDecodeURIComponent(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
