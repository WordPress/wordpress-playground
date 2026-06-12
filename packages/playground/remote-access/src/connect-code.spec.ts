import { describe, expect, it } from 'vitest';
import {
	buildRemoteAccessUrl,
	formatAccessCode,
	normalizeAccessCode,
} from './connect-code';

describe('remote access connect code helpers', () => {
	it('normalizes six-digit access codes', () => {
		expect(normalizeAccessCode('123456')).toBe('123-456');
		expect(normalizeAccessCode('123-456')).toBe('123-456');
		expect(normalizeAccessCode(' 12 34 56 ')).toBe('123-456');
		expect(normalizeAccessCode('12345')).toBeNull();
		expect(normalizeAccessCode('1234567')).toBeNull();
	});

	it('formats partial access code input', () => {
		expect(formatAccessCode('12')).toBe('12');
		expect(formatAccessCode('1234')).toBe('123-4');
		expect(formatAccessCode('123456789')).toBe('123-456');
	});

	it('builds share URLs from absolute and relative URLs', () => {
		expect(
			buildRemoteAccessUrl(
				'https://example.com/connect/my-apps/?tab=all',
				'session-1'
			)
		).toBe('/connect/my-apps/?tab=all&share=session-1');
		expect(buildRemoteAccessUrl('/connect', 'session-2')).toBe(
			'/connect?share=session-2'
		);
		expect(
			buildRemoteAccessUrl(
				'/connect/?tab=all&share=old-session',
				'session-3'
			)
		).toBe('/connect/?tab=all&share=session-3');
	});
});
