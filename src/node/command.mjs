import { createWordPressClient, initDatabaseFromBase64File } from './bootstrap.mjs';
import { startExpressServer } from './express-server.mjs';
import yargs from 'yargs';

import path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath( new URL( '.', import.meta.url ) );

import WPBrowser from '../shared/wp-browser.mjs';

export default async function command( argv ) {
	console.log( 'Starting server on port ' + argv.port );

	initDatabaseFromBase64File( path.join( __dirname, '/base64-encoded-database' ) );

	const mounts = argv.mount.map( ( mount ) => {
		try {
			const [ relativeHostPath, relativeWasmPath ] = mount.split( ':' );
			const absoluteHostPath = path.isAbsolute( relativeHostPath ) ? relativeHostPath : path.resolve( process.cwd(), relativeHostPath );
			const absoluteWasmPath = path.isAbsolute( relativeWasmPath ) ? relativeWasmPath : path.join( '/preload/wordpress', relativeWasmPath );
			return { absoluteHostPath, absoluteWasmPath, relativeHostPath, relativeWasmPath };
		} catch ( e ) {
			console.error( `Failed to mount ${ mount }` );
			process.exit( 0 );
		}
	} );
	const wp = await createWordPressClient( {
		preInit( FS, NODE_FS ) {
			for ( const { absoluteHostPath, absoluteWasmPath } of mounts ) {
				FS.mkdirTree( absoluteWasmPath );
				FS.mount( NODE_FS, { root: absoluteHostPath }, absoluteWasmPath );
			}
		},
	} );

	const browser = new WPBrowser( wp );
	return await startExpressServer( browser, argv.port, {
		mounts,
		initialUrl: argv.initialUrl,
	} );
}

const nodePath = path.resolve( process.argv[ 1 ] );
const modulePath = path.resolve( fileURLToPath( import.meta.url ) );
const isRunningDirectlyViaCLI = nodePath === modulePath;
if ( isRunningDirectlyViaCLI ) {
	const argv = yargs( process.argv.slice( 2 ) )
		.command( 'server', 'Starts a WordPress server' )
		.options( {
			port: {
				type: 'number',
				default: 9854,
				describe: 'Port to listen on',
			},
			initialUrl: {
				type: 'string',
				default: '/wp-admin/index.php',
				describe: 'The first URL to navigate to.',
			},
			mount: {
				type: 'array',
				default: [],
				describe: 'Paths to mount in the WASM runtime filesystem. Format: <host-path>:<wasm-path>. Based on the current working directory on host, and WordPress root directory in the WASM runtime.',
			},
		} )
		.help()
		.alias( 'help', 'h' )
		.argv;
	command( argv );
}
