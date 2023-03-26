import rateLimit from 'express-rate-limit';
import { IncomingMessage, ServerResponse } from 'http';

interface ViteRateLimitOptions {
	shouldCountRequest?: (request: IncomingMessage) => boolean;
	windowMs: number;
	max: number;
}
export default function viteRateLimit({
	shouldCountRequest = () => true,
	windowMs,
	max,
}: ViteRateLimitOptions) {
	return {
		name: 'vite-rate-limiter',
		configureServer(server: any) {
			server.middlewares.use(
				rateLimit({
					windowMs,
					max,
					standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
					legacyHeaders: false, // Disable the `X-RateLimit-*` headers
					keyGenerator: (request: IncomingMessage) => {
						if (shouldCountRequest(request)) {
							return 'localhost';
						} else {
							return Math.random() + '';
						}
					},
					handler: (
						request: IncomingMessage,
						response: ServerResponse,
						next,
						options
					) => {
						if (shouldCountRequest(request)) {
							response.writeHead(options.statusCode);
							response.end(options.message);
						} else {
							next();
						}
					},
				})
			);
		},
	};
}
