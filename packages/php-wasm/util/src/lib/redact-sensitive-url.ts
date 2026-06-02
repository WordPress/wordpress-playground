const URL_WITH_SCHEME_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/g;
const SENSITIVE_QUERY_PARAM_PATTERN =
	/token|key|secret|password|auth|signature/i;

export function redactSensitiveText(text: string): string {
	return text.replace(URL_WITH_SCHEME_PATTERN, (url) =>
		redactSensitiveUrl(url)
	);
}

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

		for (const [key, value] of parsed.searchParams) {
			if (SENSITIVE_QUERY_PARAM_PATTERN.test(key)) {
				parsed.searchParams.set(key, 'REDACTED');
				continue;
			}
			const redactedValue = redactSensitiveText(value);
			if (redactedValue !== value) {
				parsed.searchParams.set(key, redactedValue);
			}
		}

		return parsed.toString() + trailingPunctuation;
	} catch {
		return url;
	}
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
