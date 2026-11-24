// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
	GITHUB_OAUTH_MESSAGE_TYPE,
	GITHUB_OAUTH_STATE_PREFIX,
	buildGitHubOAuthUrl,
	createGitHubOAuthState,
	isExpectedGitHubOAuthMessage,
} from './oauth-popup';

describe('buildGitHubOAuthUrl', () => {
	it('routes OAuth through the website callback endpoint', () => {
		const url = buildGitHubOAuthUrl(
			`${GITHUB_OAUTH_STATE_PREFIX}123`,
			'https://playground.test/website-server/?url=/wp-admin/'
		);

		expect(url).toBe(
			'https://playground.test/website-server/oauth.php?redirect=1&state=playground-popup-123'
		);
	});
});

describe('createGitHubOAuthState', () => {
	it('creates a popup-specific state value', () => {
		expect(createGitHubOAuthState()).toMatch(/^playground-popup-/);
	});
});

describe('isExpectedGitHubOAuthMessage', () => {
	it('accepts token messages from the tracked popup', () => {
		const popup = {} as Window;
		const event = new MessageEvent('message', {
			origin: window.location.origin,
			source: popup,
			data: {
				type: GITHUB_OAUTH_MESSAGE_TYPE,
				state: 'playground-popup-test',
				token: 'gho_test',
			},
		});

		expect(
			isExpectedGitHubOAuthMessage(
				event,
				popup,
				'playground-popup-test'
			)
		).toBe(true);
	});

	it('rejects matching data from the WordPress iframe', () => {
		const popup = {} as Window;
		const wordpressIframe = {} as Window;

		const event = new MessageEvent('message', {
			origin: window.location.origin,
			source: wordpressIframe,
			data: {
				type: GITHUB_OAUTH_MESSAGE_TYPE,
				state: 'playground-popup-test',
				token: 'gho_test',
			},
		});

		expect(
			isExpectedGitHubOAuthMessage(
				event,
				popup,
				'playground-popup-test'
			)
		).toBe(false);
	});
});
