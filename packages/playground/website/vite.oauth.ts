import axios from 'axios';
import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '@php-wasm/logger';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

export const oAuthMiddleware = async (
	req: IncomingMessage,
	res: ServerResponse,
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
			const response = await axios.post(
				'https://github.com/login/oauth/access_token',
				{
					client_id: CLIENT_ID,
					client_secret: CLIENT_SECRET,
					code: query.get('code'),
				},
				{
					headers: {
						Accept: 'application/json',
					},
				}
			);
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
			logger.log({ error });
		}
	} else {
		res.writeHead(400);
		res.end(JSON.stringify({ error: 'Invalid request' }));
	}
};
