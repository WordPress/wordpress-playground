import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import * as url from 'url';
import { URL } from 'url';

const __dirname = url.fileURLToPath( new URL( '.', import.meta.url ) );

import { createWordPressClient } from 'adamziel-wordpress-wasm-test';
createWordPressClient().then( ( wp ) =>
	startServer( wp, parseInt( process.argv[ 2 ] ) ),
);

function startServer( wp, port ) {
	const app = express();
	app.use( cookieParser() );
	app.use( bodyParser.urlencoded( { extended: true } ) );

	app.all( '*', async ( req, res ) => {
		// Capture the container URL
		if ( ! wp.initialized ) {
			if ( req.query?.domain ) {
				const container_url = new URL( req.query.domain ).toString();
				console.log( 'DOMAIN: ' );
				console.log( container_url );
				await wp.init( container_url );
				console.log( 'Initialized!' );
				// Debug SQLite PDO that doesn't seem to be working
				console.log(
					await wp.php.run( `<?php
          var_dump(file_exists("/preload/wordpress/wp-content/database/.ht.sqlite"));
          $p = new PDO("sqlite:/preload/wordpress/wp-content/database/.ht.sqlite");
          try {
            $query = $p->query("SELECT * FROM wp_options");
            print_r($query->fetchAll(PDO::FETCH_ASSOC));
          } catch(Exception $e) {
            echo $e->getMessage();
          }
        ` ),
				);
			} else {
				res.setHeader( 'content-type', 'text/html' );
				res.send(
					`<!DOCTYPE html><html><head><script>fetch('/set-endpoint?domain=' + encodeURIComponent(window.location.href)).then(() => { window.location.href = '/index.php'; });</script></head></html>`,
				);
				return;
			}
		}
		if ( req.path.endsWith( '.php' ) || req.path.endsWith( '/' ) ) {
			const parsedUrl = new URL( req.url, wp.ABSOLUTE_URL );
			const pathToUse = parsedUrl.pathname.replace( '/preload/wordpress', '' );
			console.log( 'pathname', parsedUrl );
			console.log( 'pathname', pathToUse );
			const response = await wp.request( {
				// Fix the URLs not ending with .php
				path: pathToUse,
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
			res.sendFile(
				`${ __dirname }node_modules/adamziel-wordpress-wasm-test/wordpress/${ req.path }`,
			);
		}
	} );

	app.listen( port, async () => {
		console.log( `WordPress server is listening on port ${ port }` );
	} );
}
