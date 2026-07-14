// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { oAuthState } from '../state';
import GitHubOAuthGuard from '.';

const originalOAuthState = { ...oAuthState.value };

describe('GitHubOAuthGuard', () => {
	beforeEach(() => {
		oAuthState.value = {
			isAuthorizing: false,
			token: '',
		};
	});

	afterEach(() => {
		oAuthState.value = originalOAuthState;
	});

	it('describes importing by default', () => {
		const markup = renderToStaticMarkup(<GitHubOAuthGuard />);

		expect(markup).toContain(
			'Importing plugins, themes, and wp-content directories directly from your public GitHub repositories.'
		);
	});

	it('accepts copy for the active GitHub flow', () => {
		const markup = renderToStaticMarkup(
			<GitHubOAuthGuard intro="Export the active Playground to GitHub." />
		);

		expect(markup).toContain('Export the active Playground to GitHub.');
		expect(markup).not.toContain('Importing plugins');
	});
});
