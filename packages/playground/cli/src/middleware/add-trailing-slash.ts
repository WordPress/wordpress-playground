import { Request, Response, NextFunction } from 'express';

/**
 * Adds redirection adding a trailing slash, when a request matches a given path.
 * @param path - The path to add a trailing slash to. E.g. '/wp-admin'
 * @returns  - Returns a middleware function that may redirect adding a trailing slash to the given path. E.g. '/wp-admin/'
 */
export function addTrailingSlash(path: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		const urlParts = req.url.split('?');
		const url = urlParts[0];
		const queryString = req.url.substr(url.length);
		if (url === path) {
			res.redirect(301, `${path}/${queryString}`);
		} else {
			next();
		}
	};
}
