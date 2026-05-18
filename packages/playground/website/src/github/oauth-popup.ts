export const GITHUB_OAUTH_MESSAGE_TYPE = 'playground-github-oauth-token';
export const GITHUB_OAUTH_STATE_PREFIX = 'playground-popup-';
const GITHUB_OAUTH_POPUP_TIMEOUT_MS = 5 * 60 * 1000;

export interface GitHubOAuthMessage {
	type: typeof GITHUB_OAUTH_MESSAGE_TYPE;
	state: string;
	token?: string;
	error?: string;
}

/**
 * Opens GitHub OAuth in a popup and resolves with the token sent by the
 * same-origin callback page.
 */
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

/**
 * Creates a popup-specific state value so the callback can be tied to the
 * auth request that opened it.
 */
export function createGitHubOAuthState() {
	if (globalThis.crypto?.randomUUID) {
		return `${GITHUB_OAUTH_STATE_PREFIX}${globalThis.crypto.randomUUID()}`;
	}
	return `${GITHUB_OAUTH_STATE_PREFIX}${Date.now()}-${Math.random()
		.toString(36)
		.slice(2)}`;
}

/**
 * Builds the local OAuth redirect endpoint URL for the popup window.
 */
export function buildGitHubOAuthUrl(
	state: string,
	currentUrl = window.location.href
) {
	const oauthUrl = new URL('oauth.php', currentUrl);
	oauthUrl.searchParams.set('redirect', '1');
	oauthUrl.searchParams.set('state', state);
	return oauthUrl.toString();
}

/**
 * Validates that an OAuth message came from the tracked popup, not from the
 * same-origin WordPress iframe or another window.
 */
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

/**
 * Waits for the popup callback to post either a token or an OAuth error.
 */
function waitForGitHubOAuthMessage(
	popup: Window,
	state: string,
	oauthUrl: string
) {
	return new Promise<string>((resolve, reject) => {
		const closedCheck = window.setInterval(() => {
			if (popup.closed) {
				cleanup();
				reject(new Error('GitHub OAuth popup was closed.'));
			}
		}, 500);
		const flowTimeout = window.setTimeout(() => {
			cleanup();
			popup.close();
			reject(new Error('GitHub OAuth popup timed out.'));
		}, GITHUB_OAUTH_POPUP_TIMEOUT_MS);

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
			window.clearInterval(closedCheck);
			window.clearTimeout(flowTimeout);
			window.removeEventListener('message', handleMessage);
		}

		window.addEventListener('message', handleMessage);
		popup.location.href = oauthUrl;
		popup.focus();
	});
}
