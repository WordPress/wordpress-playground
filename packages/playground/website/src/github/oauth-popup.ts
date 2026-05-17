export const GITHUB_OAUTH_MESSAGE_TYPE =
	'playground-github-oauth-token';
export const GITHUB_OAUTH_STATE_PREFIX = 'playground-popup-';

export interface GitHubOAuthMessage {
	type: typeof GITHUB_OAUTH_MESSAGE_TYPE;
	state: string;
	token?: string;
	error?: string;
}

export function startGitHubOAuthFlow(): Promise<string> {
	const state = createGitHubOAuthState();
	const oauthUrl = buildGitHubOAuthUrl(state);
	const popup = window.open(
		'about:blank',
		'playground-github-oauth',
		'popup,width=640,height=720'
	);

	if (!popup) {
		return Promise.reject(new Error('Unable to open GitHub OAuth popup.'));
	}

	return waitForGitHubOAuthMessage(popup, state, oauthUrl);
}

export function createGitHubOAuthState() {
	if (globalThis.crypto?.randomUUID) {
		return `${GITHUB_OAUTH_STATE_PREFIX}${globalThis.crypto.randomUUID()}`;
	}
	return `${GITHUB_OAUTH_STATE_PREFIX}${Date.now()}-${Math.random()
		.toString(36)
		.slice(2)}`;
}

export function buildGitHubOAuthUrl(
	state: string,
	currentUrl = window.location.href
) {
	const oauthUrl = new URL('oauth.php', currentUrl);
	oauthUrl.searchParams.set('redirect', '1');
	oauthUrl.searchParams.set('state', state);
	return oauthUrl.toString();
}

export function isExpectedGitHubOAuthMessage(
	event: MessageEvent,
	popup: Window,
	state: string,
	origin = window.location.origin
): event is MessageEvent<GitHubOAuthMessage> {
	if (event.origin !== origin || event.source !== popup) {
		return false;
	}

	const data = event.data as Partial<GitHubOAuthMessage>;
	return (
		data?.type === GITHUB_OAUTH_MESSAGE_TYPE &&
		data.state === state &&
		(typeof data.token === 'string' || typeof data.error === 'string')
	);
}

function waitForGitHubOAuthMessage(
	popup: Window,
	state: string,
	oauthUrl: string
) {
	return new Promise<string>((resolve, reject) => {
		const timeout = window.setInterval(() => {
			if (popup.closed) {
				cleanup();
				reject(new Error('GitHub OAuth popup was closed.'));
			}
		}, 500);

		const handleMessage = (event: MessageEvent) => {
			if (!isExpectedGitHubOAuthMessage(event, popup, state)) {
				return;
			}

			cleanup();
			popup.close();

			if (event.data.error) {
				reject(new Error(event.data.error));
			} else {
				resolve(event.data.token!);
			}
		};

		function cleanup() {
			window.clearInterval(timeout);
			window.removeEventListener('message', handleMessage);
		}

		window.addEventListener('message', handleMessage);
		popup.location.href = oauthUrl;
		popup.focus();
	});
}
