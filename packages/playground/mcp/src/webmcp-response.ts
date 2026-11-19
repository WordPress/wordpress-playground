/** Response limits apply to serialized browser tool results, including continuation metadata. */
const RESPONSE_LIMIT = 1500;

export function withCursor(
	content: Record<string, unknown>,
	nextCursor?: string
) {
	return nextCursor ? { ...content, nextCursor } : content;
}

export function parseCursor(cursor: unknown = '0:0') {
	const match = typeof cursor === 'string' && /^(\d+):(\d+)$/.exec(cursor);
	if (!match) {
		return undefined;
	}
	const index = Number(match[1]);
	const offset = Number(match[2]);
	if (!Number.isSafeInteger(index) || !Number.isSafeInteger(offset)) {
		return undefined;
	}
	return { index, offset };
}

export function listPage(
	items: readonly unknown[],
	field: string,
	cursor: unknown,
	page = withCursor
) {
	const position = parseCursor(cursor);
	if (!position || position.index > items.length) {
		return { error: 'Invalid cursor. Restart the listing.' };
	}
	const { index, offset } = position;
	if (!fits(page({ [field]: [] }))) {
		return { error: 'The response metadata exceeds the size limit.' };
	}
	const entries = [];
	for (let i = index; i < items.length; i++) {
		const entry = items[i];
		const next = i + 1 < items.length ? `${i + 1}:0` : undefined;
		entries.push(entry);
		if (!offset && fits(page({ [field]: entries }, next))) {
			continue;
		}
		entries.pop();
		if (entries.length) {
			return page({ [field]: entries }, `${i}:0`);
		}
		return fragment(JSON.stringify(entry), offset, (part, end, more) =>
			page(
				{ fragment: part, lastFragment: !more },
				more ? `${i}:${end}` : next
			)
		);
	}
	return offset
		? { error: 'Invalid cursor. Restart discovery.' }
		: page({ [field]: entries });
}

export function filePage(contents: string, cursor: unknown) {
	const position = parseCursor(cursor);
	if (!position || position.index !== 0) {
		return { error: 'Invalid cursor. Restart the file read.' };
	}
	// The last range can fit without allocating space for a continuation cursor.
	if (
		position.offset <= contents.length &&
		contents.length - position.offset <= RESPONSE_LIMIT
	) {
		const last = { contents: contents.slice(position.offset) };
		if (fits(last)) return last;
	}
	return fragment(contents, position.offset, (part, end, more) =>
		withCursor({ contents: part }, more ? `0:${end}` : undefined)
	);
}

/** Give one-shot operations a bounded preview without asking the agent to run them again. */
export function boundedResponse(result: unknown) {
	const serialized = JSON.stringify(result);
	if (serialized.length <= RESPONSE_LIMIT) return result;
	const record = result as Record<string, unknown>;
	const error =
		typeof record['error'] === 'string' ? record['error'] : undefined;
	if (error !== undefined) {
		return fragment(error, 0, (part) => ({ error: part, truncated: true }));
	}
	const status = {
		...(typeof record['httpStatusCode'] === 'number'
			? { httpStatusCode: record['httpStatusCode'] }
			: {}),
		...(typeof record['exitCode'] === 'number'
			? { exitCode: record['exitCode'] }
			: {}),
	};
	return fragment(serialized, 0, (preview) => ({
		...status,
		preview,
		truncated: true,
	}));
}

export function fits(value: unknown) {
	return JSON.stringify(value).length <= RESPONSE_LIMIT;
}

export function fragment<T>(
	text: string,
	offset: number,
	render: (part: string, end: number, more: boolean) => T
) {
	if (offset >= text.length) {
		return { error: 'Invalid cursor. Restart the read.' };
	}
	let low = offset;
	let high = Math.min(offset + RESPONSE_LIMIT, text.length);
	while (low < high) {
		const end = Math.ceil((low + high) / 2);
		if (fits(render(text.slice(offset, end), end, end < text.length))) {
			low = end;
		} else {
			high = end - 1;
		}
	}
	// Keep a surrogate pair together so each returned piece is valid Unicode text.
	if (
		low < text.length &&
		low > offset &&
		/[\uD800-\uDBFF]/.test(text[low - 1]) &&
		/[\uDC00-\uDFFF]/.test(text[low])
	) {
		low--;
	}
	if (low === offset) {
		return { error: 'The response metadata exceeds the size limit.' };
	}
	return render(text.slice(offset, low), low, low < text.length);
}
