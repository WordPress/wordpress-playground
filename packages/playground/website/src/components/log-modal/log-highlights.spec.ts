import { describe, expect, it } from 'vitest';
import { splitSearchHighlights } from './log-highlights';

describe('splitSearchHighlights', () => {
	it('returns the whole text unhighlighted for an empty term', () => {
		expect(splitSearchHighlights('PHP Notice: hello', '')).toEqual([
			{ text: 'PHP Notice: hello', highlight: false },
		]);
	});

	it('highlights every case-insensitive occurrence', () => {
		expect(splitSearchHighlights('Error: fatal error', 'error')).toEqual([
			{ text: 'Error', highlight: true },
			{ text: ': fatal ', highlight: false },
			{ text: 'error', highlight: true },
		]);
	});

	it('handles adjacent matches without dropping text', () => {
		expect(splitSearchHighlights('abab', 'ab')).toEqual([
			{ text: 'ab', highlight: true },
			{ text: 'ab', highlight: true },
		]);
	});

	it('treats regex metacharacters as plain text', () => {
		expect(splitSearchHighlights('a.*b then ab', 'a.*b')).toEqual([
			{ text: 'a.*b', highlight: true },
			{ text: ' then ab', highlight: false },
		]);
	});

	it('returns no segments for empty text with a term', () => {
		expect(splitSearchHighlights('', 'error')).toEqual([]);
	});
});
