import { afterEach, describe, expect, it, vi } from 'vitest';

// UI guards are not enough: callbacks and local token restoration have their own
// entry paths. Neither may introduce credentials on an untrusted site origin.
describe('prototype credential boundary', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('does not restore, accept, or request a token on a site origin', async () => {
		vi.resetModules();
		vi.stubEnv('NODE_ENV', 'development');
		const storage = {
			getItem: vi.fn(() => 'stored-token'),
			setItem: vi.fn(),
		};
		const open = vi.fn();
		vi.stubGlobal('window', {
			location: new URL('http://site-aaaa.playground.localhost:9400/'),
			open,
		});
		vi.stubGlobal('localStorage', storage);
		const { oAuthState, setOAuthToken } = await import('./state');
		const { startGitHubOAuthFlow } = await import('./oauth-popup');
		expect(oAuthState.value.token).toBe('');
		expect(() => setOAuthToken('callback-token')).toThrow(
			'sign-in is disabled'
		);
		await expect(startGitHubOAuthFlow()).rejects.toThrow(
			'sign-in is disabled'
		);
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();
		expect(oAuthState.value.token).toBe('');
	});

	it('keeps normal development token restoration and updates', async () => {
		vi.resetModules();
		vi.stubEnv('NODE_ENV', 'development');
		const storage = {
			getItem: vi.fn(() => 'stored-token'),
			setItem: vi.fn(),
		};
		vi.stubGlobal('window', {
			location: new URL('http://localhost:5400/'),
		});
		vi.stubGlobal('localStorage', storage);
		const { oAuthState, setOAuthToken } = await import('./state');
		expect(oAuthState.value.token).toBe('stored-token');
		setOAuthToken('new-token');
		expect(oAuthState.value.token).toBe('new-token');
		expect(storage.setItem).toHaveBeenCalledWith(
			'github-token',
			'new-token'
		);
	});
});
