import fs from 'fs';
import PHP from './node-php.js';
import path from 'path';

import PHPWrapper from '../shared/php-wrapper.mjs';
import WordPress from '../shared/wordpress.mjs';

import { fileURLToPath } from 'node:url';
// eslint-disable-next-line no-global-assign
__dirname = __dirname || fileURLToPath( new URL( '.', import.meta.url ) );

export async function createWordPressClient( options = {} ) {
	options = {
		preInit() { },
		phpWasmPath: `./node-php.wasm`,
		etcPath: path.join( __dirname, 'etc' ),
		wpPath: path.join( __dirname, 'wordpress' ),
		...options,
	};
	const php = new PHPWrapper();
	await php.init( PHP, {
		locateFile() {
			return path.join( __dirname, options.phpWasmPath );
		},
		onPreInit( FS, NODEFS ) {
			FS.mkdirTree( '/usr/local/etc' );
			FS.mount( NODEFS, { root: options.etcPath }, '/usr/local/etc' );
			FS.mkdirTree( '/preload/wordpress' );
			FS.mount( NODEFS, { root: options.wpPath }, '/preload/wordpress' );
			options.preInit( FS, NODEFS );
		},
	} );
	return new WordPress( php );
}

export async function install( browser, siteUrl, options = {} ) {
	options = {
		siteTitle: 'WordPress',
		username: 'admin',
		password: 'password',
		email: 'admin@localhost.com',
		...options,
	};

	await browser.request( {
		path: '/wp-admin/install.php',
	} );

	return await browser.request( {
		path: '/wp-admin/install.php',
		method: 'POST',
		headers: {
			siteUrl,
			'content-type': 'application/x-www-form-urlencoded',
		},
		_GET: '?step=2',
		_POST: {
			weblog_title: options.siteTitle,
			user_name: options.username,
			admin_password: options.password,
			admin_password2: options.password,
			admin_email: options.email,
			Submit: 'Install WordPress',
			language: '',
		},
	} );
}

export async function login( browser, username = 'admin', password = 'password' ) {
	await browser.request( {
		path: '/wp-login.php',
	} );
	await browser.request( {
		path: '/wp-login.php',
		method: 'POST',
		_POST: {
			log: username,
			pwd: password,
			rememberme: 'forever',
		},
	} );
}

/**
 * The node.js package could ship with a binary .sqlite file, but Stackblitz somehow
 * breaks that file. This is a workaround – we ship a base64-encoded .sqlite
 * file and decode it here.
 *
 * @param {string} base64FilePath
 * @param {string} wpPath
 */
export function initDatabaseFromBase64File( base64FilePath, wpPath = __dirname + '/wordpress' ) {
	const wpdbFilePath = path.join( wpPath, '/wp-content/database/.ht.sqlite' );
	try {
		fs.unlinkSync( wpdbFilePath );
	} catch ( e ) {}
	base64DecodeFile( base64FilePath, wpdbFilePath );
}

function base64DecodeFile( inputFile, outputFile ) {
	const base64 = fs.readFileSync( inputFile, 'utf8' );
	const data = Buffer.from( base64, 'base64' );
	fs.writeFileSync( outputFile, data );
}

export async function encodeSqliteDbFile( wp, outfile = 'db.sqlite' ) {
	const file = await wp.php.run( `<?php
	echo base64_encode(file_get_contents('/preload/wordpress/wp-content/database/.ht.sqlite'));
	` );
	fs.writeFileSync( outfile, file.stdout );
}
