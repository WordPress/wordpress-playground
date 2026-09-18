import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createGitAuthHeaders,
	startGitHubOAuth,
	consumeGitHubOAuthReturnUrl,
} from './git-auth-helpers';
import { oAuthState } from './state';

describe('createGitAuthHeaders', () => {
	beforeEach(() => {
		oAuthState.value = { token: '', isAuthorizing: false };
	});

	describe('with GitHub token present', () => {
		beforeEach(() => {
			oAuthState.value = {
				token: 'gho_TestToken123',
				isAuthorizing: false,
			};
		});

		it('includes Authorization header for github.com URLs', () => {
			const getHeaders = createGitAuthHeaders();
			const headers = getHeaders('https://github.com/user/repo');

			expect(headers).toHaveProperty('Authorization');
			expect(headers.Authorization).toMatch(/^Basic /);
			expect(headers).toHaveProperty(
				'X-Cors-Proxy-Allowed-Request-Headers',
				'Authorization'
			);
		});

		it('includes Authorization header for api.github.com URLs', () => {
			const getHeaders = createGitAuthHeaders();
			const headers = getHeaders('https://api.github.com/repos');

			expect(headers).toHaveProperty('Authorization');
		});

		it('does NOT include Authorization header for non-GitHub URLs', () => {
			const getHeaders = createGitAuthHeaders();

			expect(getHeaders('https://gitlab.com/user/repo')).toEqual({});
			expect(getHeaders('https://bitbucket.org/user/repo')).toEqual({});
		});

		it('does NOT include Authorization header for malicious URLs (security)', () => {
			const getHeaders = createGitAuthHeaders();

			// github.com in path
			expect(getHeaders('https://evil.com/github.com/fake')).toEqual({});

			// github.com in query parameter
			expect(getHeaders('https://evil.com?redirect=github.com')).toEqual(
				{}
			);

			// look-alike domains
			expect(getHeaders('https://github.com.evil.com')).toEqual({});
			expect(getHeaders('https://mygithub.com')).toEqual({});
			expect(getHeaders('https://fakegithub.com')).toEqual({});
		});
	});

	describe('without GitHub token', () => {
		beforeEach(() => {
			oAuthState.value = { token: '', isAuthorizing: false };
		});

		it('returns empty headers even for GitHub URLs', () => {
			const getHeaders = createGitAuthHeaders();

			expect(getHeaders('https://github.com/user/repo')).toEqual({});
		});
	});

	describe('token encoding', () => {
		it('encodes token correctly as Basic auth', () => {
			oAuthState.value = { token: 'test-token', isAuthorizing: false };
			const getHeaders = createGitAuthHeaders();
			const headers = getHeaders('https://github.com/user/repo');

			const decoded = atob(headers.Authorization.replace('Basic ', ''));
			expect(decoded).toBe('test-token:');
		});

		it('handles tokens with non-ASCII characters (UTF-8)', () => {
			// This would fail with plain btoa(): "characters outside of the Latin1 range"
			oAuthState.value = {
				token: 'test-token-ąñ-emoji-🔑',
				isAuthorizing: false,
			};
			const getHeaders = createGitAuthHeaders();
			const headers = getHeaders('https://github.com/user/repo');

			expect(headers).toHaveProperty('Authorization');
			expect(headers.Authorization).toMatch(/^Basic /);

			// Verify the encoding is valid base64
			const base64Part = headers.Authorization.replace('Basic ', '');
			expect(() => atob(base64Part)).not.toThrow();
		});
	});
});

describe('GitHub OAuth return URL', () => {
	const storedValues = new Map<string, string>();

	beforeEach(() => {
		storedValues.clear();
		vi.stubGlobal('window', {
			location: {
				href: 'https://my.wordpress.net/?blueprint-url=https%3A%2F%2Fexample.com%2Fsite.json',
				origin: 'https://my.wordpress.net',
			},
		});
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => storedValues.get(key) ?? null,
			setItem: (key: string, value: string) => storedValues.set(key, value),
			removeItem: (key: string) => storedValues.delete(key),
		});
		vi.stubGlobal('crypto', {
			getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it('keeps the callback fixed while restoring the original URL for the matching state', () => {
		const oauthUrl = new URL(startGitHubOAuth());
		expect(oauthUrl.origin + oauthUrl.pathname).toBe(
			'https://my.wordpress.net/oauth.php'
		);
		const state = oauthUrl.searchParams.get('state');
		expect(state).toMatch(/^[a-f0-9]{32}$/);
		expect(oauthUrl.searchParams.has('redirect_uri')).toBe(false);
		expect(consumeGitHubOAuthReturnUrl('wrong-state')).toBeNull();
		expect(consumeGitHubOAuthReturnUrl(state)).toBe(
			'https://my.wordpress.net/?blueprint-url=https%3A%2F%2Fexample.com%2Fsite.json'
		);
		expect(consumeGitHubOAuthReturnUrl(state)).toBeNull();
	});
});
