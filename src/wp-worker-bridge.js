
let lastRequestId = 0;
class WPWorker {
	WORDPRESS_ROOT = '/preload/wordpress';
	constructor() {
		this.channel = new BroadcastChannel( 'wordpress-wasm' );
	}

	async request( request ) {
		const { response } = await this.postMessage( {
			type: 'request',
			request,
		} );
		return response;
	}

	async createFiles( tree ) {
		const { stdout } = await this.run( `<?php
            function createFileTree($tree, $prefix = '')
            {
                foreach ($tree as $key => $value) {
                    $path = $prefix . $key;
                    echo $path . "\n";
                    if (is_array($value)) {
                        // Directory
                        if (!is_dir($path)) {
                            mkdir($path);
                        }
                        createFileTree($value, rtrim($path, '/') . '/');
                    } else {
                        // File
                        file_put_contents($path, $value);
                    }
                }
            }

            $root_path = ${ JSON.stringify( this.WORDPRESS_ROOT ) };
            createFileTree(${ JSON.stringify( tree ) }, $root_path);
        ` );
		return stdout;
	}

	async writeFile( path, contents ) {
		const { stdout } = await this.run( `<?php
            function join_paths($p1, $p2) {
                return preg_replace('#/+#', '/', $p1 . '/' . $p2);
            }
            $root_path = ${ JSON.stringify( this.WORDPRESS_ROOT ) };
            $file_path = ${ JSON.stringify( path ) };
            $contents = ${ JSON.stringify( contents ) };
            file_put_contents( join_paths($root_path, $file_path), $contents );
        ` );
		return stdout;
	}
	async readFile( path ) {
		const { stdout } = await this.run( `<?php
            function join_paths($p1, $p2) {
                return preg_replace('#/+#', '/', $p1 . '/' . $p2);
            }
            $root_path = ${ JSON.stringify( this.WORDPRESS_ROOT ) };
            $file_path = ${ JSON.stringify( path ) };
            echo file_get_contents( join_paths($root_path, $file_path) );
        ` );
		return stdout;
	}
	async ls( path = '' ) {
		const { stdout } = await this.run( `<?php
            function join_paths($p1, $p2) {
                return preg_replace('#/+#', '/', $p1 . '/' . $p2);
            }

            $files = [];
            $root_path = ${ JSON.stringify( this.WORDPRESS_ROOT ) };
            $relative_dir_path = ${ JSON.stringify( path ) };
            $absolute_dir_path = join_paths( $root_path, $relative_dir_path );
            foreach(scandir($absolute_dir_path) as $file_name) {
                $file_name = trim($file_name, '/');
                if($file_name === '.' || $file_name === '..') {
                    continue;
                }
                $relative_file_path = join_paths($relative_dir_path, $file_name);
                $file = [
                    'name' => $file_name,
                    'path' => $relative_file_path,
                ];
                $absolute_file_path = join_paths($root_path, $relative_file_path);
                if(is_dir($absolute_file_path)){
                    $file['type'] = 'dir';
                    $file['children'] = [];
                } else {
                    $file['type'] = 'file';
                }
                $files[] = $file;
            }

            // sort by type=dir, name
            usort($files, function($a, $b) {
                if($a['type'] === 'dir' && $b['type'] !== 'dir') {
                    return -1;
                }
                if($a['type'] !== 'dir' && $b['type'] === 'dir') {
                    return 1;
                }
                return strcmp($a['name'], $b['name']);
            });

            echo json_encode($files);
            `,
		);
		return JSON.parse( stdout );
	}
	run( code ) {
		return this.postMessage( {
			type: 'run_php',
			code,
		} );
	}
	async ready() {
		// eslint-disable-next-line no-constant-condition
		while ( true ) {
			try {
				const result = await this.postMessage( {
					type: 'is_ready',
				}, 500 );
				if ( result ) {
					return true;
				}
			// eslint-disable-next-line no-empty
			} catch ( e ) { }
			await new Promise( ( resolve ) => setTimeout( resolve ), 1000 );
		}
	}
	postMessage( data, timeout = 5000 ) {
		return new Promise( ( resolve, reject ) => {
			const requestId = ++lastRequestId;
			const responseHandler = ( event ) => {
				if ( event.data.type === 'response' && event.data.requestId === requestId ) {
					this.channel.removeEventListener( 'message', responseHandler );
					clearTimeout( failOntimeout );
					resolve( event.data.result );
				}
			};
			const failOntimeout = setTimeout( () => {
				reject( 'Request timed out' );
				this.channel.removeEventListener( 'message', responseHandler );
			}, timeout );
			this.channel.addEventListener( 'message', responseHandler );

			this.channel.postMessage( {
				...data,
				requestId,
			} );
		} );
	}
}
export default new WPWorker();

