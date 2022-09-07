import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

import path from 'path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const __dirname = fileURLToPath( new URL( '.', import.meta.url ) );

export async function startExpressServer( browser, port, options = {} ) {
	options = {
		mounts: {},
		initialUrl: '/wp-login.php',
		...options,
	};

	const app = express();
	app.use( cookieParser() );
	app.use( bodyParser.urlencoded( { extended: true } ) );
	app.all( '*', async ( req, res ) => {
		if ( ! browser.wp.initialized ) {
			if ( req.query?.domain ) {
				await browser.wp.init( new URL( req.query.domain ).toString() );
				res.status( 302 );
				res.setHeader( 'location', options.initialUrl );
				res.end();
			} else {
				res.setHeader( 'content-type', 'text/html' );
				res.send(
					`<!DOCTYPE html><html><head><script>window.location.href = '/?domain=' + encodeURIComponent(window.location.href);</script></head></html>`,
				);
				res.end();
			}
			return;
		}

		if ( req.path.endsWith( '.php' ) || req.path.endsWith( '/' ) ) {
			const parsedUrl = new URL( req.url, browser.wp.ABSOLUTE_URL );
			const pathToUse = parsedUrl.pathname.replace( '/preload/wordpress', '' );
			console.log( { pathToUse } );
			const wpResponse = await browser.request( {
				path: pathToUse,
				method: req.method,
				headers: req.headers,
				_GET: parsedUrl.search,
				_POST: req.body,
			} );
			for ( const [ key, values ] of Object.entries( wpResponse.headers ) ) {
				res.setHeader( key, values );
			}
			if ( 'location' in wpResponse.headers ) {
				res.status( 302 );
				res.end();
			} else {
				res.send( wpResponse.body );
			}
		} else {
			// First, check if the requested file exists in the mounts.
			for ( let { absoluteHostPath, relativeWasmPath } of options.mounts ) {
				if ( relativeWasmPath.startsWith( './' ) ) {
					relativeWasmPath = relativeWasmPath.slice( 1 );
				}
				if ( ! relativeWasmPath.startsWith( '/' ) ) {
					relativeWasmPath = '/' + relativeWasmPath;
				}
				if ( ! relativeWasmPath.endsWith( '/' ) ) {
					relativeWasmPath = relativeWasmPath + '/';
				}
				if ( req.path.startsWith( relativeWasmPath ) ) {
					const filePath = path.join( absoluteHostPath, req.path.replace( relativeWasmPath, '' ) );
					if ( existsSync( filePath ) ) {
						res.sendFile( filePath );
						return;
					}
				}
			}
			// If the file doesn't exist in the mounts, serve it from the filesystem.
			res.sendFile(
				path.join( __dirname, 'wordpress', req.path ),
			);
		}
	} );

	app.listen( port, async () => {
		console.log( `WordPress server is listening on port ${ port }` );
	} );
	return app;
}
