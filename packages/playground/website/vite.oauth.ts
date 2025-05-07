import type { IncomingMessage, ServerResponse } from 'http';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

export const oAuthMiddleware = async (
	req: IncomingMessage,
	res: ServerResponse,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	next: Function
) => {
	if (!req.url?.startsWith('/oauth.php')) {
		next();
		return;
	}

	const query = new URL(req.url, 'http://example.com').searchParams;
	if (query.get('redirect') === '1') {
		const params: Record<string, string> = {
			client_id: CLIENT_ID!,
			scope: 'public_repo',
		};
		if (query.has('redirect_uri')) {
			params.redirect_uri = query.get('redirect_uri')!;
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
			res.writeHead(200, {
				'Content-Type': 'application/json',
			});
			res.end(JSON.stringify(response.data));
		} catch (error) {
			res.writeHead(400, {
				'Content-Type': 'application/json',
			});
			res.end(JSON.stringify({ error: (error as any)?.message }));
			console.log({ error });
		}
	} else {
		res.writeHead(400);
		res.end(JSON.stringify({ error: 'Invalid request' }));
	}
};
