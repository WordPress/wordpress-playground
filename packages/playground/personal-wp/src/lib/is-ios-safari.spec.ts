import { describe, it, expect } from 'vitest';
import { isIOS, isIOSSafari } from './is-ios-safari';

describe('isIOS', () => {
	it('returns true for iPhone user agent', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Mobile/15E148 Safari/604.1';
		expect(isIOS(ua, 'iPhone', 5)).toBe(true);
	});

	it('returns true for iPad user agent', () => {
		const ua =
			'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Mobile/15E148 Safari/604.1';
		expect(isIOS(ua, 'iPad', 5)).toBe(true);
	});

	it('returns true for iPadOS 13+ (MacIntel with touch)', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Safari/605.1.15';
		expect(isIOS(ua, 'MacIntel', 5)).toBe(true);
	});

	it('returns false for macOS desktop (no touch)', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Safari/605.1.15';
		expect(isIOS(ua, 'MacIntel', 0)).toBe(false);
	});

	it('returns false for Android', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) ' +
			'AppleWebKit/537.36 (KHTML, like Gecko) ' +
			'Chrome/120.0.0.0 Mobile Safari/537.36';
		expect(isIOS(ua, 'Linux armv8l', 5)).toBe(false);
	});

	it('returns false for Windows', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
			'AppleWebKit/537.36 (KHTML, like Gecko) ' +
			'Chrome/120.0.0.0 Safari/537.36';
		expect(isIOS(ua, 'Win32', 0)).toBe(false);
	});
});

describe('isIOSSafari', () => {
	it('returns true for Safari on iPhone', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Mobile/15E148 Safari/604.1';
		expect(isIOSSafari(ua, 'iPhone', 5)).toBe(true);
	});

	it('returns true for Safari on iPadOS 13+', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Safari/605.1.15';
		expect(isIOSSafari(ua, 'MacIntel', 5)).toBe(true);
	});

	it('returns false for Chrome on iOS (CriOS)', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
		expect(isIOSSafari(ua, 'iPhone', 5)).toBe(false);
	});

	it('returns false for Firefox on iOS (FxiOS)', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'FxiOS/120.0 Mobile/15E148 Safari/604.1';
		expect(isIOSSafari(ua, 'iPhone', 5)).toBe(false);
	});

	it('returns false for WKWebView (no Version/)', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Mobile/15E148';
		expect(isIOSSafari(ua, 'iPhone', 5)).toBe(false);
	});

	it('returns false for macOS Safari (no touch)', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
			'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
			'Version/17.0 Safari/605.1.15';
		expect(isIOSSafari(ua, 'MacIntel', 0)).toBe(false);
	});

	it('returns false for Android Chrome', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) ' +
			'AppleWebKit/537.36 (KHTML, like Gecko) ' +
			'Chrome/120.0.0.0 Mobile Safari/537.36';
		expect(isIOSSafari(ua, 'Linux armv8l', 5)).toBe(false);
	});
});
