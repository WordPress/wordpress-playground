import type { RequestHandler } from 'express';

export function wordPressFrameMiddleware(
	getWebRoot: () => string,
	hostnames: string[]
): RequestHandler;
