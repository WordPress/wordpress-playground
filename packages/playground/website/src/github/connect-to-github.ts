import { startGitHubOAuthFlow } from './oauth-popup';
import { oAuthState, setOAuthToken } from './state';

interface ConnectToGitHubOptions {
	setError: (error?: string) => void;
	onSuccess?: () => void | Promise<void>;
}

/**
 * Runs the shared GitHub OAuth popup flow and updates auth state.
 */
export async function connectToGitHub({
	setError,
	onSuccess,
}: ConnectToGitHubOptions) {
	setError(undefined);
	oAuthState.value = {
		...oAuthState.value,
		isAuthorizing: true,
	};

	try {
		setOAuthToken(await startGitHubOAuthFlow());
		await onSuccess?.();
	} catch (error) {
		setError(getOAuthErrorMessage(error));
	} finally {
		oAuthState.value = {
			...oAuthState.value,
			isAuthorizing: false,
		};
	}
}

/**
 * Converts thrown OAuth values into a user-facing error string.
 */
function getOAuthErrorMessage(error: unknown) {
	return error instanceof Error && error.message
		? error.message
		: 'GitHub authorization failed.';
}
