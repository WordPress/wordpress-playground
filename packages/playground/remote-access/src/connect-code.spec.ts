import { describe, expect, it } from 'vitest';
import {
	buildRemoteAccessRelayEndpointUrl,
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

	it('builds direct relay.php endpoint URLs', () => {
		expect(
			buildRemoteAccessRelayEndpointUrl('https://example.com', 'session')
		).toBe('https://example.com/relay.php?action=session');
		expect(
			buildRemoteAccessRelayEndpointUrl('https://example.com', 'signal', {
				sessionId: 'session-1',
				to: 'guest',
				since: 12,
				gid: 'guest 1',
			})
		).toBe(
			'https://example.com/relay.php?action=signal&sessionId=session-1&to=guest&since=12&gid=guest+1'
		);
		expect(
			buildRemoteAccessRelayEndpointUrl(
				'https://example.com/base',
				'session'
			)
		).toBe('https://example.com/base/relay.php?action=session');
		expect(
			buildRemoteAccessRelayEndpointUrl(
				'https://example.com/base/',
				'session'
			)
		).toBe('https://example.com/base/relay.php?action=session');
	});
});
