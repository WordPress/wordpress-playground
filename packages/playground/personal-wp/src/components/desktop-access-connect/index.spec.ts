import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	formatCode,
	isDesktopAccessConnectRoute,
	normalizeCode,
} from './index';

describe('DesktopAccessConnect route helpers', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('recognizes /connect and nested connect paths', () => {
		vi.stubGlobal('window', { location: { pathname: '/connect' } });
		expect(isDesktopAccessConnectRoute()).toBe(true);

		vi.stubGlobal('window', {
			location: { pathname: '/connect/my-apps/' },
		});
		expect(isDesktopAccessConnectRoute()).toBe(true);

		vi.stubGlobal('window', { location: { pathname: '/scope:default/' } });
		expect(isDesktopAccessConnectRoute()).toBe(false);
	});

	it('normalizes six digit codes', () => {
		expect(normalizeCode('123456')).toBe('123-456');
		expect(normalizeCode('123-456')).toBe('123-456');
		expect(normalizeCode(' 12 34 56 ')).toBe('123-456');
		expect(normalizeCode('12345')).toBeNull();
		expect(normalizeCode('1234567')).toBeNull();
	});

	it('formats partial code input without accepting more than six digits', () => {
		expect(formatCode('12')).toBe('12');
		expect(formatCode('1234')).toBe('123-4');
		expect(formatCode('123456789')).toBe('123-456');
	});
});
