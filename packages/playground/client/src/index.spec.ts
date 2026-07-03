import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { isChromiumBasedBrowser as detectChromiumBrowser } from './index';

let isChromiumBasedBrowser: typeof detectChromiumBrowser;

describe('isChromiumBasedBrowser', () => {
	beforeAll(async () => {
		vi.stubGlobal('location', {
			origin: 'https://playground.test',
		});
		({ isChromiumBasedBrowser } = await import('./index'));
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	it('detects Chromium browsers from user agent brands', () => {
		expect(
			isChromiumBasedBrowser(
				createNavigator({
					brands: [{ brand: 'Chromium' }],
					userAgent: '',
				})
			)
		).toBe(true);
		expect(
			isChromiumBasedBrowser(
				createNavigator({
					brands: [{ brand: 'Microsoft Edge' }],
					userAgent: '',
				})
			)
		).toBe(true);
	});

	it('falls back to Chromium user agent tokens', () => {
		expect(
			isChromiumBasedBrowser(
				createNavigator({
					userAgent:
						'Mozilla/5.0 AppleWebKit/537.36 Chrome/149.0 Safari/537.36',
				})
			)
		).toBe(true);
		expect(
			isChromiumBasedBrowser(
				createNavigator({
					userAgent:
						'Mozilla/5.0 AppleWebKit/537.36 Edg/149.0 Safari/537.36',
				})
			)
		).toBe(true);
	});

	it('does not detect Firefox or Safari as Chromium based', () => {
		expect(
			isChromiumBasedBrowser(
				createNavigator({
					userAgent: 'Mozilla/5.0 Gecko/20100101 Firefox/140.0',
				})
			)
		).toBe(false);
		expect(
			isChromiumBasedBrowser(
				createNavigator({
					userAgent:
						'Mozilla/5.0 AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
				})
			)
		).toBe(false);
	});
});

function createNavigator({
	brands,
	userAgent,
}: {
	brands?: Array<{ brand: string }>;
	userAgent: string;
}) {
	return {
		userAgentData: brands ? { brands } : undefined,
		userAgent,
	} as unknown as Navigator;
}
