import { describe, expect, it } from 'vitest';
import { splitLogHighlights } from './log-highlights';

describe('splitLogHighlights', () => {
	it('highlights standalone Error and Fatal markers', () => {
		expect(splitLogHighlights('PHP Fatal: boom')).toEqual([
			{ text: 'PHP ', highlight: false },
			{ text: 'Fatal:', highlight: true },
			{ text: ' boom', highlight: false },
		]);
		expect(splitLogHighlights('Error: failed')).toEqual([
			{ text: 'Error:', highlight: true },
			{ text: ' failed', highlight: false },
		]);
	});

	it('does not highlight markers embedded in words or class names', () => {
		expect(splitLogHighlights('ParseError: nope terror: nope')).toEqual([
			{ text: 'ParseError: nope terror: nope', highlight: false },
		]);
	});

	it('does not highlight lowercase words that resemble severity markers', () => {
		expect(splitLogHighlights('error: nope fatal: nope')).toEqual([
			{ text: 'error: nope fatal: nope', highlight: false },
		]);
	});

	it('keeps punctuation before a marker in the plain segment', () => {
		expect(splitLogHighlights('(Error: failed)')).toEqual([
			{ text: '(', highlight: false },
			{ text: 'Error:', highlight: true },
			{ text: ' failed)', highlight: false },
		]);
	});

	it('keeps log markup as plain text', () => {
		expect(splitLogHighlights('<img src=x> Error: failed')).toEqual([
			{ text: '<img src=x> ', highlight: false },
			{ text: 'Error:', highlight: true },
			{ text: ' failed', highlight: false },
		]);
	});
});
