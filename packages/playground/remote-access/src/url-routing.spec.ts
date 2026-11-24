import { describe, expect, it } from 'vitest';
import {
	buildConnectUrlFromScopedIframeUrl,
	buildRemoteAccessScopedIframeUrl,
	getRemoteAccessPathFromConnectUrl,
	getRemoteAccessSessionId,
	stripRemoteAccessSessionId,
} from './url-routing';

describe('remote access URL routing helpers', () => {
	it('reads and strips remote access session ids from absolute and relative URLs', () => {
		expect(
			getRemoteAccessSessionId(
				'https://example.com/connect?share=session-1'
			)
		).toBe('session-1');
		expect(getRemoteAccessSessionId('/connect?share=session-2')).toBe(
			'session-2'
		);
		expect(
			stripRemoteAccessSessionId(
				'https://example.com/connect/my-apps/?share=session-1&tab=all'
			)
		).toBe('/connect/my-apps/?tab=all');
	});

	it('maps connect URLs to the remote WordPress path', () => {
		expect(
			getRemoteAccessPathFromConnectUrl(
				'https://example.com/connect/wp-admin/?share=session-1&page=tools'
			)
		).toBe('/wp-admin/?page=tools');
		expect(getRemoteAccessPathFromConnectUrl('/connect')).toBe('/');
		expect(getRemoteAccessPathFromConnectUrl('/connect//')).toBe('/');
		expect(getRemoteAccessPathFromConnectUrl('/connect//my-apps/')).toBe(
			'/my-apps/'
		);
		expect(getRemoteAccessPathFromConnectUrl('/my-apps/')).toBe('/');
	});

	it('builds scoped iframe URLs for remote access sessions', () => {
		expect(
			buildRemoteAccessScopedIframeUrl(
				'/wp-admin/?page=tools',
				'session-1'
			)
		).toBe(
			'/scope:default/wp-admin/?page=tools&remote-access-view=session-1'
		);
		expect(buildRemoteAccessScopedIframeUrl('//', 'session-1')).toBe(
			'/scope:default/?remote-access-view=session-1'
		);
		expect(
			buildRemoteAccessScopedIframeUrl('//my-apps/', 'session-1')
		).toBe('/scope:default/my-apps/?remote-access-view=session-1');
	});

	it('maps scoped iframe URLs back to connect URLs', () => {
		expect(
			buildConnectUrlFromScopedIframeUrl(
				'https://example.com/scope:default/wp-admin/?page=tools&remote-access-view=session-1',
				'https://example.com/connect/'
			)
		).toBe('https://example.com/connect/wp-admin/?page=tools');
		expect(
			buildConnectUrlFromScopedIframeUrl(
				'/scope:other/wp-admin/',
				'https://example.com/connect/'
			)
		).toBeNull();
	});
});
