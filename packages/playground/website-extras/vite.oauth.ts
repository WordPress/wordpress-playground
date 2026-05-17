import type { IncomingMessage, ServerResponse } from 'http';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GITHUB_OAUTH_MESSAGE_TYPE = 'playground-github-oauth-token';
const GITHUB_OAUTH_STATE_PREFIX = 'playground-popup-';

export const oAuthMiddleware = async (
	req: IncomingMessage,
	res: ServerResponse,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	next: Function
) => {
	if (!isOAuthRequest(req.url)) {
		next();
		return;
	}

	const query = new URL(req.url ?? '/', 'http://example.com').searchParams;
	if (query.get('redirect') === '1') {
		const params: Record<string, string> = {
			client_id: CLIENT_ID!,
			scope: 'repo',
			redirect_uri: getOAuthCallbackUrl(req),
		};
		if (query.has('state')) {
			params.state = query.get('state')!;
		}
		const redirectQS = new URLSearchParams(params).toString();
		res.writeHead(302, {
			location: `https://github.com/login/oauth/authorize?${redirectQS}`,
		});
		res.end();
	} else if (query.has('code')) {
		try {
			const fetchResponse = await fetch(
				'https://github.com/login/oauth/access_token',
				{
					method: 'POST',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						client_id: CLIENT_ID,
						client_secret: CLIENT_SECRET,
						code: query.get('code'),
					}),
				}
			);

			const responseData = await fetchResponse.json();

			if (!fetchResponse.ok) {
				// Attempt to get a specific error message from GitHub's response
				const errorMessage =
					responseData?.error_description ||
					responseData?.error ||
					`Request failed with status ${fetchResponse.status}`;
				throw new Error(errorMessage);
			}

			// Mimic the axios response structure for the existing code below
			const response = { data: responseData };
			if (response.data.error) {
				throw new Error(response.data.error_description);
			}
			if (isPopupOAuthState(query.get('state'))) {
				res.writeHead(200, {
					'Content-Type': 'text/html; charset=utf-8',
				});
				res.end(
					renderOAuthPopupResponse({
						state: query.get('state')!,
						token: response.data.access_token,
					})
				);
			} else {
				res.writeHead(200, {
					'Content-Type': 'application/json',
				});
				res.end(JSON.stringify(response.data));
			}
		} catch (error) {
			const message = (error as Error)?.message;
			if (isPopupOAuthState(query.get('state'))) {
				res.writeHead(400, {
					'Content-Type': 'text/html; charset=utf-8',
				});
				res.end(
					renderOAuthPopupResponse({
						state: query.get('state')!,
						error: message,
					})
				);
			} else {
				res.writeHead(400, {
					'Content-Type': 'application/json',
				});
				res.end(JSON.stringify({ error: message }));
			}
			console.log({ error });
		}
	} else {
		res.writeHead(400);
		res.end(JSON.stringify({ error: 'Invalid request' }));
	}
};

function isOAuthRequest(url: string | undefined): boolean {
	if (!url) {
		return false;
	}
	const { pathname } = new URL(url, 'http://example.com');
	return pathname.endsWith('/oauth.php');
}

function getOAuthCallbackUrl(req: IncomingMessage) {
	const requestUrl = new URL(req.url!, `http://${req.headers.host}`);
	requestUrl.search = '';
	const forwardedProto = req.headers['x-forwarded-proto'];
	requestUrl.protocol =
		(typeof forwardedProto === 'string' ? forwardedProto : 'http') + ':';
	return requestUrl.toString();
}

function isPopupOAuthState(state: string | null): state is string {
	return !!state && state.startsWith(GITHUB_OAUTH_STATE_PREFIX);
}

function renderOAuthPopupResponse({
	state,
	token,
	error,
}: {
	state: string;
	token?: string;
	error?: string;
}) {
	const message = JSON.stringify({
		type: GITHUB_OAUTH_MESSAGE_TYPE,
		state,
		token,
		error,
	}).replace(/</g, '\\u003c');
	return `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>GitHub authorization complete</title>
	</head>
	<body>
		<script>
			if (window.opener) {
				window.opener.postMessage(${message}, window.location.origin);
				window.close();
			}
		</script>
		GitHub authorization complete. You can close this window.
	</body>
</html>`;
}
