import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import * as url from 'url';

import PHP from './node-php.js';
import { fileURLToPath } from 'node:url';

import PHPWrapper from '../shared/php-wrapper.mjs';
import WordPress from '../shared/wordpress.mjs';

const __dirname = url.fileURLToPath( new URL( '.', import.meta.url ) );

async function createClient() {
	const php = new PHPWrapper();
	await php.init( PHP, {
		locateFile() {
			return fileURLToPath( new URL( `./node-php.wasm`, import.meta.url ) );
		},
		onPreInit( FS, NODEFS ) {
			FS.mkdirTree( '/usr/local/etc' );
			FS.mount( NODEFS, { root: __dirname + '../shared/etc' }, '/usr/local/etc' );
			FS.mkdirTree( '/preload/wordpress' );
			FS.mount( NODEFS, { root: __dirname + 'wordpress' }, '/preload/wordpress' );
		},
	} );
	return new WordPress( php );
}

const app = express();
app.use( cookieParser() );
app.use( bodyParser.urlencoded( { extended: true } ) );
const port = 9876;

const clientPromise = createClient();
app.all( '*', async ( req, res ) => {
	const wp = await clientPromise;
	if ( ! wp.initialized ) {
		await wp.init(
		  url.format( {
				protocol: req.protocol,
				host: req.get( 'host' ),
				pathname: req.originalUrl,
		  } ),
		);
	}
	if ( req.path.endsWith( '.php' ) || req.path.endsWith( '/' ) ) {
		const parsedUrl = new URL( req.url, wp.ABSOLUTE_URL );
		const response = await wp.request( {
			// Fix the URLs not ending with .php
			path: parsedUrl.pathname,
			method: req.method,
			headers: req.headers,
			_GET: parsedUrl.search,
			_POST: req.body,
			_COOKIE: req.cookies,
		} );

		for ( const [ key, value ] of Object.entries( response.headers ) ) {
		  res.setHeader( key, value );
		}
		if ( 'location' in response.headers ) {
		  res.status( 302 );
		  res.end();
		} else {
		  res.send( response.body );
		}
	} else {
		res.sendFile( `${ __dirname }wordpress/${ req.path }` );
	}
} );

app.listen( port, async () => {
	console.log( `Example app listening on port ${ port }` );
} );
