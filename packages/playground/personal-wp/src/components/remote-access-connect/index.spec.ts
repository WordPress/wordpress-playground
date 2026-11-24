import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	formatAccessCode,
	normalizeAccessCode,
} from '@wp-playground/remote-access';
import { isRemoteAccessConnectRoute } from './index';

describe('RemoteAccessConnect route helpers', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('recognizes /connect and nested connect paths', () => {
		vi.stubGlobal('window', { location: { pathname: '/connect' } });
		expect(isRemoteAccessConnectRoute()).toBe(true);

		vi.stubGlobal('window', {
			location: { pathname: '/connect/my-apps/' },
		});
		expect(isRemoteAccessConnectRoute()).toBe(true);

		vi.stubGlobal('window', { location: { pathname: '/scope:default/' } });
		expect(isRemoteAccessConnectRoute()).toBe(false);
	});

	it('normalizes six digit codes', () => {
		expect(normalizeAccessCode('123456')).toBe('123-456');
		expect(normalizeAccessCode('123-456')).toBe('123-456');
		expect(normalizeAccessCode(' 12 34 56 ')).toBe('123-456');
		expect(normalizeAccessCode('12345')).toBeNull();
		expect(normalizeAccessCode('1234567')).toBeNull();
	});

	it('formats partial code input without accepting more than six digits', () => {
		expect(formatAccessCode('12')).toBe('12');
		expect(formatAccessCode('1234')).toBe('123-4');
		expect(formatAccessCode('123456789')).toBe('123-456');
	});
});
