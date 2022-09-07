import { startWordPress } from './index.mjs';
import { startExpressServer } from './express-server.mjs';
import yargs from 'yargs';

const argv = yargs( process.argv.slice( 2 ) )
	.command( 'server', 'Starts a WordPress server' )
	.options( {
		port: {
			type: 'number',
			default: 9854,
			describe: 'Port to listen on',
		},
		install: {
			type: 'boolean',
			default: false,
			describe: 'Should perform WordPress installation',
		},
		siteUrl: {
			type: 'string',
			default: 'http://localhost:9854',
			describe: 'WordPress site URL. If not provided, it will be noted on the first request.',
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

if ( argv.install && ! argv.siteUrl ) {
	throw new Error( 'You must provide a site URL when installing WordPress.' );
}

import path from 'path';
import { fileURLToPath } from 'node:url';

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

async function main() {
	console.log( 'Starting server on port ' + argv.port );
	const browser = await startWordPress( {
		siteUrl: argv.siteUrl,
		install: argv.install,
		initialUrl: argv.initialUrl,
		client: {
			preInit( FS, NODE_FS ) {
				mounts.forEach( ( { absoluteHostPath, absoluteWasmPath } ) => {
					FS.mkdirTree( absoluteWasmPath );
					FS.mount( NODE_FS, { root: absoluteHostPath }, absoluteWasmPath );
				} );
			},
		},
	} );
	const app = await startExpressServer( browser, argv.port, mounts );
	console.log( app );
}

main();
