import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getAuthenticatedGitHubClient,
	resetAuthenticatedGitHubClient,
} from './client';
import { setOAuthToken } from './state';

const createClientMock = vi.hoisted(() =>
	vi.fn((token: string) => ({ token }))
);

vi.mock('@wp-playground/storage', () => ({
	createClient: createClientMock,
}));

describe('getAuthenticatedGitHubClient', () => {
	beforeEach(() => {
		createClientMock.mockClear();
		resetAuthenticatedGitHubClient();
		setOAuthToken(undefined);
	});

	it('reuses the client while the OAuth token is unchanged', () => {
		setOAuthToken('first-token');

		const first = getAuthenticatedGitHubClient();
		const second = getAuthenticatedGitHubClient();

		expect(second).toBe(first);
		expect(createClientMock).toHaveBeenCalledTimes(1);
		expect(createClientMock).toHaveBeenCalledWith('first-token');
	});

	it('throws instead of creating a client without an OAuth token', () => {
		expect(() => getAuthenticatedGitHubClient()).toThrow(
			'GitHub authentication is required.'
		);
		expect(createClientMock).not.toHaveBeenCalled();
	});

	it('rebuilds the client after the OAuth token changes', () => {
		setOAuthToken('first-token');
		const first = getAuthenticatedGitHubClient();

		setOAuthToken('second-token');
		const second = getAuthenticatedGitHubClient();

		expect(second).not.toBe(first);
		expect(createClientMock).toHaveBeenCalledTimes(2);
		expect(createClientMock).toHaveBeenLastCalledWith('second-token');
	});

	it('rebuilds the client after a reset', () => {
		setOAuthToken('token');
		const first = getAuthenticatedGitHubClient();

		resetAuthenticatedGitHubClient();
		const second = getAuthenticatedGitHubClient();

		expect(second).not.toBe(first);
		expect(createClientMock).toHaveBeenCalledTimes(2);
	});
});
