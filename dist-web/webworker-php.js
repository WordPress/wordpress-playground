const PHP = ( function() {
	const _scriptDir =
    typeof document !== 'undefined' && document.currentScript
    	? document.currentScript.src
    	: undefined;
	const noop = function()	{};

	return function( PHP ) {
		PHP = PHP || {};

		const Module = typeof PHP !== 'undefined' ? PHP : {};
		let readyPromiseResolve, readyPromiseReject;
		Module.ready = new Promise( function( resolve, reject ) {
			readyPromiseResolve = resolve;
			readyPromiseReject = reject;
		} );
		Module.preInit = function() {};
		let moduleOverrides = {};
		let key;
		for ( key in Module ) {
			if ( Module.hasOwnProperty( key ) ) {
				moduleOverrides[ key ] = Module[ key ];
			}
		}
		let arguments_ = [];
		let thisProgram = './this.program';
		let quit_ = function( status, toThrow ) {
			throw toThrow;
		};
		const ENVIRONMENT_IS_WEB = false;
		const ENVIRONMENT_IS_WORKER = true;
		const ENVIRONMENT_IS_NODE = false;
		let scriptDirectory = '';
		function locateFile( path ) {
			if ( Module.locateFile ) {
				return Module.locateFile( path, scriptDirectory );
			}
			return scriptDirectory + path;
		}
		let read_, readBinary;
		if ( ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER ) {
			if ( ENVIRONMENT_IS_WORKER ) {
				scriptDirectory = self.location.href;
			} else if ( document.currentScript ) {
				scriptDirectory = document.currentScript.src;
			}
			if ( _scriptDir ) {
				scriptDirectory = _scriptDir;
			}
			if ( scriptDirectory.indexOf( 'blob:' ) !== 0 ) {
				scriptDirectory = scriptDirectory.substr(
					0,
					scriptDirectory.lastIndexOf( '/' ) + 1,
				);
			} else {
				scriptDirectory = '';
			}
			{
				read_ = function shell_read( url ) {
					const xhr = new XMLHttpRequest();
					xhr.open( 'GET', url, false );
					xhr.send( null );
					return xhr.responseText;
				};
				if ( ENVIRONMENT_IS_WORKER ) {
					readBinary = function readBinary( url ) {
						const xhr = new XMLHttpRequest();
						xhr.open( 'GET', url, false );
						xhr.responseType = 'arraybuffer';
						xhr.send( null );
						return new Uint8Array( xhr.response );
					};
				}
			}
		}
		const out = Module.print || console.log.bind( console );
		const err = Module.printErr || console.warn.bind( console );
		for ( key in moduleOverrides ) {
			if ( moduleOverrides.hasOwnProperty( key ) ) {
				Module[ key ] = moduleOverrides[ key ];
			}
		}
		moduleOverrides = null;
		if ( Module.arguments ) {
			arguments_ = Module.arguments;
		}
		if ( Module.thisProgram ) {
			thisProgram = Module.thisProgram;
		}
		if ( Module.quit ) {
			quit_ = Module.quit;
		}
		function dynamicAlloc( size ) {
			const ret = HEAP32[ DYNAMICTOP_PTR >> 2 ];
			const end = ( ret + size + 15 ) & -16;
			HEAP32[ DYNAMICTOP_PTR >> 2 ] = end;
			return ret;
		}
		let wasmBinary;
		if ( Module.wasmBinary ) {
			wasmBinary = Module.wasmBinary;
		}
		let noExitRuntime;
		if ( Module.noExitRuntime ) {
			noExitRuntime = Module.noExitRuntime;
		}
		if ( typeof WebAssembly !== 'object' ) {
			err( 'no native wasm support detected' );
		}
		let wasmMemory;
		const wasmTable = new WebAssembly.Table( {
			initial: 6743,
			maximum: 6743,
			element: 'anyfunc',
		} );
		let ABORT = false;
		let EXITSTATUS = 0;
		function assert( condition, text ) {
			if ( ! condition ) {
				abort( 'Assertion failed: ' + text );
			}
		}
		function getMemory( size ) {
			if ( ! runtimeInitialized ) {
				return dynamicAlloc( size );
			}
			return _malloc( size );
		}
		const UTF8Decoder =
      typeof TextDecoder !== 'undefined' ? new TextDecoder( 'utf8' ) : undefined;
		function UTF8ArrayToString( heap, idx, maxBytesToRead ) {
			const endIdx = idx + maxBytesToRead;
			let endPtr = idx;
			while ( heap[ endPtr ] && ! ( endPtr >= endIdx ) ) {
				++endPtr;
			}
			if ( endPtr - idx > 16 && heap.subarray && UTF8Decoder ) {
				return UTF8Decoder.decode( heap.subarray( idx, endPtr ) );
			}
			let str = '';
			while ( idx < endPtr ) {
				let u0 = heap[ idx++ ];
				if ( ! ( u0 & 128 ) ) {
					str += String.fromCharCode( u0 );
					continue;
				}
				const u1 = heap[ idx++ ] & 63;
				if ( ( u0 & 224 ) == 192 ) {
					str += String.fromCharCode( ( ( u0 & 31 ) << 6 ) | u1 );
					continue;
				}
				const u2 = heap[ idx++ ] & 63;
				if ( ( u0 & 240 ) == 224 ) {
					u0 = ( ( u0 & 15 ) << 12 ) | ( u1 << 6 ) | u2;
				} else {
					u0 = ( ( u0 & 7 ) << 18 ) | ( u1 << 12 ) | ( u2 << 6 ) | ( heap[ idx++ ] & 63 );
				}
				if ( u0 < 65536 ) {
					str += String.fromCharCode( u0 );
				} else {
					const ch = u0 - 65536;
					str += String.fromCharCode( 55296 | ( ch >> 10 ), 56320 | ( ch & 1023 ) );
				}
			}
			return str;
		}
		function UTF8ToString( ptr, maxBytesToRead ) {
			return ptr ? UTF8ArrayToString( HEAPU8, ptr, maxBytesToRead ) : '';
		}
		function stringToUTF8Array( str, heap, outIdx, maxBytesToWrite ) {
			if ( ! ( maxBytesToWrite > 0 ) ) {
				return 0;
			}
			const startIdx = outIdx;
			const endIdx = outIdx + maxBytesToWrite - 1;
			for ( let i = 0; i < str.length; ++i ) {
				let u = str.charCodeAt( i );
				if ( u >= 55296 && u <= 57343 ) {
					const u1 = str.charCodeAt( ++i );
					u = ( 65536 + ( ( u & 1023 ) << 10 ) ) | ( u1 & 1023 );
				}
				if ( u <= 127 ) {
					if ( outIdx >= endIdx ) {
						break;
					}
					heap[ outIdx++ ] = u;
				} else if ( u <= 2047 ) {
					if ( outIdx + 1 >= endIdx ) {
						break;
					}
					heap[ outIdx++ ] = 192 | ( u >> 6 );
					heap[ outIdx++ ] = 128 | ( u & 63 );
				} else if ( u <= 65535 ) {
					if ( outIdx + 2 >= endIdx ) {
						break;
					}
					heap[ outIdx++ ] = 224 | ( u >> 12 );
					heap[ outIdx++ ] = 128 | ( ( u >> 6 ) & 63 );
					heap[ outIdx++ ] = 128 | ( u & 63 );
				} else {
					if ( outIdx + 3 >= endIdx ) {
						break;
					}
					heap[ outIdx++ ] = 240 | ( u >> 18 );
					heap[ outIdx++ ] = 128 | ( ( u >> 12 ) & 63 );
					heap[ outIdx++ ] = 128 | ( ( u >> 6 ) & 63 );
					heap[ outIdx++ ] = 128 | ( u & 63 );
				}
			}
			heap[ outIdx ] = 0;
			return outIdx - startIdx;
		}
		function stringToUTF8( str, outPtr, maxBytesToWrite ) {
			return stringToUTF8Array( str, HEAPU8, outPtr, maxBytesToWrite );
		}
		function lengthBytesUTF8( str ) {
			let len = 0;
			for ( let i = 0; i < str.length; ++i ) {
				let u = str.charCodeAt( i );
				if ( u >= 55296 && u <= 57343 ) {
					u = ( 65536 + ( ( u & 1023 ) << 10 ) ) | ( str.charCodeAt( ++i ) & 1023 );
				}
				if ( u <= 127 ) {
					++len;
				} else if ( u <= 2047 ) {
					len += 2;
				} else if ( u <= 65535 ) {
					len += 3;
				} else {
					len += 4;
				}
			}
			return len;
		}
		const WASM_PAGE_SIZE = 65536;
		let buffer,
			HEAP8,
			HEAPU8,
			HEAP16,
			HEAPU16,
			HEAP32,
			HEAPU32,
			HEAPF32,
			HEAPF64;
		function updateGlobalBufferAndViews( buf ) {
			buffer = buf;
			Module.HEAP8 = HEAP8 = new Int8Array( buf );
			Module.HEAP16 = HEAP16 = new Int16Array( buf );
			Module.HEAP32 = HEAP32 = new Int32Array( buf );
			Module.HEAPU8 = HEAPU8 = new Uint8Array( buf );
			Module.HEAPU16 = HEAPU16 = new Uint16Array( buf );
			Module.HEAPU32 = HEAPU32 = new Uint32Array( buf );
			Module.HEAPF32 = HEAPF32 = new Float32Array( buf );
			Module.HEAPF64 = HEAPF64 = new Float64Array( buf );
		}
		var DYNAMIC_BASE = 7803952,
			DYNAMICTOP_PTR = 2560880;
		let INITIAL_INITIAL_MEMORY = Module.INITIAL_MEMORY || 1073741824;
		if ( Module.wasmMemory ) {
			wasmMemory = Module.wasmMemory;
		} else {
			wasmMemory = new WebAssembly.Memory( {
				initial: INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
			} );
		}
		if ( wasmMemory ) {
			buffer = wasmMemory.buffer;
		}
		updateGlobalBufferAndViews( buffer );
		HEAP32[ DYNAMICTOP_PTR >> 2 ] = DYNAMIC_BASE;
		const __ATINIT__ = [];
		var runtimeInitialized = false;
		var Math_abs = Math.abs;
		var Math_ceil = Math.ceil;
		var Math_floor = Math.floor;
		var Math_min = Math.min;
		let runDependencies = 0;
		let runDependencyWatcher = null;
		let dependenciesFulfilled = null;
		function getUniqueRunDependency( id ) {
			return id;
		}
		function addRunDependency( id ) {
			runDependencies++;
			if ( Module.monitorRunDependencies ) {
				Module.monitorRunDependencies( runDependencies );
			}
		}
		function removeRunDependency( id ) {
			runDependencies--;
			if ( Module.monitorRunDependencies ) {
				Module.monitorRunDependencies( runDependencies );
			}
			if ( runDependencies == 0 ) {
				if ( runDependencyWatcher !== null ) {
					clearInterval( runDependencyWatcher );
					runDependencyWatcher = null;
				}
				if ( dependenciesFulfilled ) {
					const callback = dependenciesFulfilled;
					dependenciesFulfilled = null;
					callback();
				}
			}
		}
		Module.preloadedImages = {};
		Module.preloadedAudios = {};
		function abort( what ) {
			if ( Module.onAbort ) {
				Module.onAbort( what );
			}
			what += '';
			out( what );
			err( what );
			ABORT = true;
			EXITSTATUS = 1;
			what = 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';
			throw new WebAssembly.RuntimeError( what );
		}
		function hasPrefix( str, prefix ) {
			return String.prototype.startsWith
				? str.startsWith( prefix )
				: str.indexOf( prefix ) === 0;
		}
		const dataURIPrefix = 'data:application/octet-stream;base64,';
		function isDataURI( filename ) {
			return hasPrefix( filename, dataURIPrefix );
		}
		let wasmBinaryFile = 'webworker-php.wasm';
		if ( ! isDataURI( wasmBinaryFile ) ) {
			wasmBinaryFile = locateFile( wasmBinaryFile );
		}
		function getBinary() {
			try {
				if ( wasmBinary ) {
					return new Uint8Array( wasmBinary );
				}
				if ( readBinary ) {
					return readBinary( wasmBinaryFile );
				}
				throw 'both async and sync fetching of the wasm failed';
			} catch ( err ) {
				abort( err );
			}
		}
		function getBinaryPromise() {
			if (
				! wasmBinary &&
        ( ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER ) &&
        typeof fetch === 'function'
			) {
				return fetch( wasmBinaryFile, { credentials: 'same-origin' } )
					.then( function( response ) {
						if ( ! response.ok ) {
							throw (
								"failed to load wasm binary file at '" + wasmBinaryFile + "'"
							);
						}
						return response.arrayBuffer();
					} )
					.catch( function() {
						return getBinary();
					} );
			}
			return new Promise( function( resolve, reject ) {
				resolve( getBinary() );
			} );
		}
		function createWasm() {
			const info = {
				env: asmLibraryArg,
				global: { NaN, Infinity },
				'global.Math': Math,
				asm2wasm: {
					'f64-rem'() {},
				},
			};
			function receiveInstance( instance, module ) {
				const exports = instance.exports;
				Module.asm = exports;
				removeRunDependency( 'wasm-instantiate' );
			}
			addRunDependency( 'wasm-instantiate' );
			function receiveInstantiatedSource( output ) {
				console.log("streaming instantiated", output);
				receiveInstance( output.instance );
			}
			function instantiateArrayBuffer( receiver ) {
				return getBinaryPromise()
					.then( function( binary ) {
						return WebAssembly.instantiate( binary, info );
					} )
					.then( receiver, function( reason ) {
						err( 'failed to asynchronously prepare wasm: ' + reason );
						abort( reason );
					} );
			}
			function instantiateAsync() {
				if (
					! wasmBinary &&
          typeof WebAssembly.instantiateStreaming === 'function' &&
          ! isDataURI( wasmBinaryFile ) &&
          typeof fetch === 'function'
				) {
fetch( wasmBinaryFile, { credentials: 'same-origin' } ).then( function(
	response,
) {
	console.log("instantiated streaming");
	console.log(response, info)
	const result = WebAssembly.instantiateStreaming( response, info );
	// return result.then( receiveInstantiatedSource, function( reason ) {
	// 	err( 'wasm streaming compile failed: ' + reason );
	// 	err( 'falling back to ArrayBuffer instantiation' );
	// 	return instantiateArrayBuffer( receiveInstantiatedSource );
	// } );
} );
				} else {
					return instantiateArrayBuffer( receiveInstantiatedSource );
				}
			}
			if ( Module.instantiateWasm ) {
				try {
					const exports = Module.instantiateWasm( info, receiveInstance );
					return exports;
				} catch ( e ) {
					err( 'Module.instantiateWasm callback failed with error: ' + e );
					return false;
				}
			}
			instantiateAsync();
			return {};
		}
		Module.asm = createWasm;
		let tempDouble;
		let tempI64;
		__ATINIT__.push( {
			func() {
				___emscripten_environ_constructor();
			},
		} );
		function demangle( func ) {
			return func;
		}
		function demangleAll( text ) {
			const regex = /\b__Z[\w\d_]+/g;
			return text.replace( regex, function( x ) {
				const y = demangle( x );
				return x === y ? x : y + ' [' + x + ']';
			} );
		}
		function jsStackTrace() {
			let err = new Error();
			if ( ! err.stack ) {
				try {
					throw new Error();
				} catch ( e ) {
					err = e;
				}
				if ( ! err.stack ) {
					return '(no stack trace available)';
				}
			}
			return err.stack.toString();
		}
		function stackTrace() {
			let js = jsStackTrace();
			if ( Module.extraStackTrace ) {
				js += '\n' + Module.extraStackTrace();
			}
			return demangleAll( js );
		}
		let _emscripten_get_now;
		_emscripten_get_now = function() {
			return performance.now();
		};
		function setErrNo( value ) {
			HEAP32[ ___errno_location() >> 2 ] = value;
			return value;
		}
		var PATH = {
			splitPath( filename ) {
				const splitPathRe =
          /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
				return splitPathRe.exec( filename ).slice( 1 );
			},
			normalizeArray( parts, allowAboveRoot ) {
				let up = 0;
				for ( let i = parts.length - 1; i >= 0; i-- ) {
					const last = parts[ i ];
					if ( last === '.' ) {
						parts.splice( i, 1 );
					} else if ( last === '..' ) {
						parts.splice( i, 1 );
						up++;
					} else if ( up ) {
						parts.splice( i, 1 );
						up--;
					}
				}
				if ( allowAboveRoot ) {
					for ( ; up; up-- ) {
						parts.unshift( '..' );
					}
				}
				return parts;
			},
			normalize( path ) {
				const isAbsolute = path.charAt( 0 ) === '/',
					trailingSlash = path.substr( -1 ) === '/';
				path = PATH.normalizeArray(
					path.split( '/' ).filter( function( p ) {
						return !! p;
					} ),
					! isAbsolute,
				).join( '/' );
				if ( ! path && ! isAbsolute ) {
					path = '.';
				}
				if ( path && trailingSlash ) {
					path += '/';
				}
				return ( isAbsolute ? '/' : '' ) + path;
			},
			dirname( path ) {
				let result = PATH.splitPath( path ),
					root = result[ 0 ],
					dir = result[ 1 ];
				if ( ! root && ! dir ) {
					return '.';
				}
				if ( dir ) {
					dir = dir.substr( 0, dir.length - 1 );
				}
				return root + dir;
			},
			basename( path ) {
				if ( path === '/' ) {
					return '/';
				}
				const lastSlash = path.lastIndexOf( '/' );
				if ( lastSlash === -1 ) {
					return path;
				}
				return path.substr( lastSlash + 1 );
			},
			extname( path ) {
				return PATH.splitPath( path )[ 3 ];
			},
			join() {
				const paths = Array.prototype.slice.call( arguments, 0 );
				return PATH.normalize( paths.join( '/' ) );
			},
			join2( l, r ) {
				return PATH.normalize( l + '/' + r );
			},
		};
		var PATH_FS = {
			resolve() {
				let resolvedPath = '',
					resolvedAbsolute = false;
				for ( let i = arguments.length - 1; i >= -1 && ! resolvedAbsolute; i-- ) {
					const path = i >= 0 ? arguments[ i ] : FS.cwd();
					if ( typeof path !== 'string' ) {
						throw new TypeError( 'Arguments to path.resolve must be strings' );
					} else if ( ! path ) {
						return '';
					}
					resolvedPath = path + '/' + resolvedPath;
					resolvedAbsolute = path.charAt( 0 ) === '/';
				}
				resolvedPath = PATH.normalizeArray(
					resolvedPath.split( '/' ).filter( function( p ) {
						return !! p;
					} ),
					! resolvedAbsolute,
				).join( '/' );
				return ( resolvedAbsolute ? '/' : '' ) + resolvedPath || '.';
			},
			relative( from, to ) {
				from = PATH_FS.resolve( from ).substr( 1 );
				to = PATH_FS.resolve( to ).substr( 1 );
				function trim( arr ) {
					let start = 0;
					for ( ; start < arr.length; start++ ) {
						if ( arr[ start ] !== '' ) {
							break;
						}
					}
					let end = arr.length - 1;
					for ( ; end >= 0; end-- ) {
						if ( arr[ end ] !== '' ) {
							break;
						}
					}
					if ( start > end ) {
						return [];
					}
					return arr.slice( start, end - start + 1 );
				}
				const fromParts = trim( from.split( '/' ) );
				const toParts = trim( to.split( '/' ) );
				const length = Math.min( fromParts.length, toParts.length );
				let samePartsLength = length;
				for ( var i = 0; i < length; i++ ) {
					if ( fromParts[ i ] !== toParts[ i ] ) {
						samePartsLength = i;
						break;
					}
				}
				let outputParts = [];
				for ( var i = samePartsLength; i < fromParts.length; i++ ) {
					outputParts.push( '..' );
				}
				outputParts = outputParts.concat( toParts.slice( samePartsLength ) );
				return outputParts.join( '/' );
			},
		};
		var TTY = {
			ttys: [],
			init() {},
			shutdown() {},
			register( dev, ops ) {
				TTY.ttys[ dev ] = { input: [], output: [], ops };
				FS.registerDevice( dev, TTY.stream_ops );
			},
			stream_ops: {
				open( stream ) {
					const tty = TTY.ttys[ stream.node.rdev ];
					if ( ! tty ) {
						throw new FS.ErrnoError( 43 );
					}
					stream.tty = tty;
					stream.seekable = false;
				},
				close( stream ) {
					stream.tty.ops.flush( stream.tty );
				},
				flush( stream ) {
					stream.tty.ops.flush( stream.tty );
				},
				read( stream, buffer, offset, length, pos ) {
					if ( ! stream.tty || ! stream.tty.ops.get_char ) {
						throw new FS.ErrnoError( 60 );
					}
					let bytesRead = 0;
					for ( let i = 0; i < length; i++ ) {
						var result;
						try {
							result = stream.tty.ops.get_char( stream.tty );
						} catch ( e ) {
							throw new FS.ErrnoError( 29 );
						}
						if ( result === undefined && bytesRead === 0 ) {
							throw new FS.ErrnoError( 6 );
						}
						if ( result === null || result === undefined ) {
							break;
						}
						bytesRead++;
						buffer[ offset + i ] = result;
					}
					if ( bytesRead ) {
						stream.node.timestamp = Date.now();
					}
					return bytesRead;
				},
				write( stream, buffer, offset, length, pos ) {
					if ( ! stream.tty || ! stream.tty.ops.put_char ) {
						throw new FS.ErrnoError( 60 );
					}
					try {
						for ( var i = 0; i < length; i++ ) {
							stream.tty.ops.put_char( stream.tty, buffer[ offset + i ] );
						}
					} catch ( e ) {
						throw new FS.ErrnoError( 29 );
					}
					if ( length ) {
						stream.node.timestamp = Date.now();
					}
					return i;
				},
			},
			default_tty_ops: {
				get_char( tty ) {
					if ( ! tty.input.length ) {
						let result = null;
						if (
							typeof window !== 'undefined' &&
              typeof window.prompt === 'function'
						) {
							result = window.prompt( 'Input: ' );
							if ( result !== null ) {
								result += '\n';
							}
						} else if ( typeof readline === 'function' ) {
							result = readline();
							if ( result !== null ) {
								result += '\n';
							}
						}
						if ( ! result ) {
							return null;
						}
						tty.input = intArrayFromString( result, true );
					}
					return tty.input.shift();
				},
				put_char( tty, val ) {
					if ( val === null || val === 10 ) {
						out( UTF8ArrayToString( tty.output, 0 ) );
						tty.output = [];
					} else if ( val != 0 ) {
						tty.output.push( val );
					}
				},
				flush( tty ) {
					if ( tty.output && tty.output.length > 0 ) {
						out( UTF8ArrayToString( tty.output, 0 ) );
						tty.output = [];
					}
				},
			},
			default_tty1_ops: {
				put_char( tty, val ) {
					if ( val === null || val === 10 ) {
						err( UTF8ArrayToString( tty.output, 0 ) );
						tty.output = [];
					} else if ( val != 0 ) {
						tty.output.push( val );
					}
				},
				flush( tty ) {
					if ( tty.output && tty.output.length > 0 ) {
						err( UTF8ArrayToString( tty.output, 0 ) );
						tty.output = [];
					}
				},
			},
		};
		var MEMFS = {
			ops_table: null,
			mount( mount ) {
				return MEMFS.createNode( null, '/', 16384 | 511, 0 );
			},
			createNode( parent, name, mode, dev ) {
				if ( FS.isBlkdev( mode ) || FS.isFIFO( mode ) ) {
					throw new FS.ErrnoError( 63 );
				}
				if ( ! MEMFS.ops_table ) {
					MEMFS.ops_table = {
						dir: {
							node: {
								getattr: MEMFS.node_ops.getattr,
								setattr: MEMFS.node_ops.setattr,
								lookup: MEMFS.node_ops.lookup,
								mknod: MEMFS.node_ops.mknod,
								rename: MEMFS.node_ops.rename,
								unlink: MEMFS.node_ops.unlink,
								rmdir: MEMFS.node_ops.rmdir,
								readdir: MEMFS.node_ops.readdir,
								symlink: MEMFS.node_ops.symlink,
							},
							stream: { llseek: MEMFS.stream_ops.llseek },
						},
						file: {
							node: {
								getattr: MEMFS.node_ops.getattr,
								setattr: MEMFS.node_ops.setattr,
							},
							stream: {
								llseek: MEMFS.stream_ops.llseek,
								read: MEMFS.stream_ops.read,
								write: MEMFS.stream_ops.write,
								allocate: MEMFS.stream_ops.allocate,
								mmap: MEMFS.stream_ops.mmap,
								msync: MEMFS.stream_ops.msync,
							},
						},
						link: {
							node: {
								getattr: MEMFS.node_ops.getattr,
								setattr: MEMFS.node_ops.setattr,
								readlink: MEMFS.node_ops.readlink,
							},
							stream: {},
						},
						chrdev: {
							node: {
								getattr: MEMFS.node_ops.getattr,
								setattr: MEMFS.node_ops.setattr,
							},
							stream: FS.chrdev_stream_ops,
						},
					};
				}
				const node = FS.createNode( parent, name, mode, dev );
				if ( FS.isDir( node.mode ) ) {
					node.node_ops = MEMFS.ops_table.dir.node;
					node.stream_ops = MEMFS.ops_table.dir.stream;
					node.contents = {};
				} else if ( FS.isFile( node.mode ) ) {
					node.node_ops = MEMFS.ops_table.file.node;
					node.stream_ops = MEMFS.ops_table.file.stream;
					node.usedBytes = 0;
					node.contents = null;
				} else if ( FS.isLink( node.mode ) ) {
					node.node_ops = MEMFS.ops_table.link.node;
					node.stream_ops = MEMFS.ops_table.link.stream;
				} else if ( FS.isChrdev( node.mode ) ) {
					node.node_ops = MEMFS.ops_table.chrdev.node;
					node.stream_ops = MEMFS.ops_table.chrdev.stream;
				}
				node.timestamp = Date.now();
				if ( parent ) {
					parent.contents[ name ] = node;
				}
				return node;
			},
			getFileDataAsRegularArray( node ) {
				if ( node.contents && node.contents.subarray ) {
					const arr = [];
					for ( let i = 0; i < node.usedBytes; ++i ) {
						arr.push( node.contents[ i ] );
					}
					return arr;
				}
				return node.contents;
			},
			getFileDataAsTypedArray( node ) {
				if ( ! node.contents ) {
					return new Uint8Array( 0 );
				}
				if ( node.contents.subarray ) {
					return node.contents.subarray( 0, node.usedBytes );
				}
				return new Uint8Array( node.contents );
			},
			expandFileStorage( node, newCapacity ) {
				const prevCapacity = node.contents ? node.contents.length : 0;
				if ( prevCapacity >= newCapacity ) {
					return;
				}
				const CAPACITY_DOUBLING_MAX = 1024 * 1024;
				newCapacity = Math.max(
					newCapacity,
					( prevCapacity *
            ( prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125 ) ) >>>
            0,
				);
				if ( prevCapacity != 0 ) {
					newCapacity = Math.max( newCapacity, 256 );
				}
				const oldContents = node.contents;
				node.contents = new Uint8Array( newCapacity );
				if ( node.usedBytes > 0 ) {
					node.contents.set( oldContents.subarray( 0, node.usedBytes ), 0 );
				}
			},
			resizeFileStorage( node, newSize ) {
				if ( node.usedBytes == newSize ) {
					return;
				}
				if ( newSize == 0 ) {
					node.contents = null;
					node.usedBytes = 0;
					return;
				}
				if ( ! node.contents || node.contents.subarray ) {
					const oldContents = node.contents;
					node.contents = new Uint8Array( newSize );
					if ( oldContents ) {
						node.contents.set(
							oldContents.subarray( 0, Math.min( newSize, node.usedBytes ) ),
						);
					}
					node.usedBytes = newSize;
					return;
				}
				if ( ! node.contents ) {
					node.contents = [];
				}
				if ( node.contents.length > newSize ) {
					node.contents.length = newSize;
				} else {
					while ( node.contents.length < newSize ) {
						node.contents.push( 0 );
					}
				}
				node.usedBytes = newSize;
			},
			node_ops: {
				getattr( node ) {
					const attr = {};
					attr.dev = FS.isChrdev( node.mode ) ? node.id : 1;
					attr.ino = node.id;
					attr.mode = node.mode;
					attr.nlink = 1;
					attr.uid = 0;
					attr.gid = 0;
					attr.rdev = node.rdev;
					if ( FS.isDir( node.mode ) ) {
						attr.size = 4096;
					} else if ( FS.isFile( node.mode ) ) {
						attr.size = node.usedBytes;
					} else if ( FS.isLink( node.mode ) ) {
						attr.size = node.link.length;
					} else {
						attr.size = 0;
					}
					attr.atime = new Date( node.timestamp );
					attr.mtime = new Date( node.timestamp );
					attr.ctime = new Date( node.timestamp );
					attr.blksize = 4096;
					attr.blocks = Math.ceil( attr.size / attr.blksize );
					return attr;
				},
				setattr( node, attr ) {
					if ( attr.mode !== undefined ) {
						node.mode = attr.mode;
					}
					if ( attr.timestamp !== undefined ) {
						node.timestamp = attr.timestamp;
					}
					if ( attr.size !== undefined ) {
						MEMFS.resizeFileStorage( node, attr.size );
					}
				},
				lookup( parent, name ) {
					throw FS.genericErrors[ 44 ];
				},
				mknod( parent, name, mode, dev ) {
					return MEMFS.createNode( parent, name, mode, dev );
				},
				rename( old_node, new_dir, new_name ) {
					if ( FS.isDir( old_node.mode ) ) {
						let new_node;
						try {
							new_node = FS.lookupNode( new_dir, new_name );
						} catch ( e ) {}
						if ( new_node ) {
							for ( const i in new_node.contents ) {
								throw new FS.ErrnoError( 55 );
							}
						}
					}
					delete old_node.parent.contents[ old_node.name ];
					old_node.name = new_name;
					new_dir.contents[ new_name ] = old_node;
					old_node.parent = new_dir;
				},
				unlink( parent, name ) {
					delete parent.contents[ name ];
				},
				rmdir( parent, name ) {
					const node = FS.lookupNode( parent, name );
					for ( const i in node.contents ) {
						throw new FS.ErrnoError( 55 );
					}
					delete parent.contents[ name ];
				},
				readdir( node ) {
					const entries = [ '.', '..' ];
					for ( const key in node.contents ) {
						if ( ! node.contents.hasOwnProperty( key ) ) {
							continue;
						}
						entries.push( key );
					}
					return entries;
				},
				symlink( parent, newname, oldpath ) {
					const node = MEMFS.createNode( parent, newname, 511 | 40960, 0 );
					node.link = oldpath;
					return node;
				},
				readlink( node ) {
					if ( ! FS.isLink( node.mode ) ) {
						throw new FS.ErrnoError( 28 );
					}
					return node.link;
				},
			},
			stream_ops: {
				read( stream, buffer, offset, length, position ) {
					const contents = stream.node.contents;
					if ( position >= stream.node.usedBytes ) {
						return 0;
					}
					const size = Math.min( stream.node.usedBytes - position, length );
					if ( size > 8 && contents.subarray ) {
						buffer.set( contents.subarray( position, position + size ), offset );
					} else {
						for ( let i = 0; i < size; i++ ) {
							buffer[ offset + i ] = contents[ position + i ];
						}
					}
					return size;
				},
				write( stream, buffer, offset, length, position, canOwn ) {
					if ( buffer.buffer === HEAP8.buffer ) {
						canOwn = false;
					}
					if ( ! length ) {
						return 0;
					}
					const node = stream.node;
					node.timestamp = Date.now();
					if ( buffer.subarray && ( ! node.contents || node.contents.subarray ) ) {
						if ( canOwn ) {
							node.contents = buffer.subarray( offset, offset + length );
							node.usedBytes = length;
							return length;
						} else if ( node.usedBytes === 0 && position === 0 ) {
							node.contents = buffer.slice( offset, offset + length );
							node.usedBytes = length;
							return length;
						} else if ( position + length <= node.usedBytes ) {
							node.contents.set(
								buffer.subarray( offset, offset + length ),
								position,
							);
							return length;
						}
					}
					MEMFS.expandFileStorage( node, position + length );
					if ( node.contents.subarray && buffer.subarray ) {
						node.contents.set(
							buffer.subarray( offset, offset + length ),
							position,
						);
					} else {
						for ( let i = 0; i < length; i++ ) {
							node.contents[ position + i ] = buffer[ offset + i ];
						}
					}
					node.usedBytes = Math.max( node.usedBytes, position + length );
					return length;
				},
				llseek( stream, offset, whence ) {
					let position = offset;
					if ( whence === 1 ) {
						position += stream.position;
					} else if ( whence === 2 ) {
						if ( FS.isFile( stream.node.mode ) ) {
							position += stream.node.usedBytes;
						}
					}
					if ( position < 0 ) {
						throw new FS.ErrnoError( 28 );
					}
					return position;
				},
				allocate( stream, offset, length ) {
					MEMFS.expandFileStorage( stream.node, offset + length );
					stream.node.usedBytes = Math.max(
						stream.node.usedBytes,
						offset + length,
					);
				},
				mmap( stream, address, length, position, prot, flags ) {
					assert( address === 0 );
					if ( ! FS.isFile( stream.node.mode ) ) {
						throw new FS.ErrnoError( 43 );
					}
					let ptr;
					let allocated;
					let contents = stream.node.contents;
					if ( ! ( flags & 2 ) && contents.buffer === buffer ) {
						allocated = false;
						ptr = contents.byteOffset;
					} else {
						if ( position > 0 || position + length < contents.length ) {
							if ( contents.subarray ) {
								contents = contents.subarray( position, position + length );
							} else {
								contents = Array.prototype.slice.call(
									contents,
									position,
									position + length,
								);
							}
						}
						allocated = true;
						ptr = _malloc( length );
						if ( ! ptr ) {
							throw new FS.ErrnoError( 48 );
						}
						HEAP8.set( contents, ptr );
					}
					return { ptr, allocated };
				},
				msync( stream, buffer, offset, length, mmapFlags ) {
					if ( ! FS.isFile( stream.node.mode ) ) {
						throw new FS.ErrnoError( 43 );
					}
					if ( mmapFlags & 2 ) {
						return 0;
					}
					const bytesWritten = MEMFS.stream_ops.write(
						stream,
						buffer,
						0,
						length,
						offset,
						false,
					);
					return 0;
				},
			},
		};
		var FS = {
			root: null,
			mounts: [],
			devices: {},
			streams: [],
			nextInode: 1,
			nameTable: null,
			currentPath: '/',
			initialized: false,
			ignorePermissions: true,
			trackingDelegate: {},
			tracking: { openFlags: { READ: 1, WRITE: 2 } },
			ErrnoError: null,
			genericErrors: {},
			filesystems: null,
			syncFSRequests: 0,
			handleFSError( e ) {
				if ( ! ( e instanceof FS.ErrnoError ) ) {
					throw e + ' : ' + stackTrace();
				}
				return setErrNo( e.errno );
			},
			lookupPath( path, opts ) {
				path = PATH_FS.resolve( FS.cwd(), path );
				opts = opts || {};
				if ( ! path ) {
					return { path: '', node: null };
				}
				const defaults = { follow_mount: true, recurse_count: 0 };
				for ( const key in defaults ) {
					if ( opts[ key ] === undefined ) {
						opts[ key ] = defaults[ key ];
					}
				}
				if ( opts.recurse_count > 8 ) {
					throw new FS.ErrnoError( 32 );
				}
				const parts = PATH.normalizeArray(
					path.split( '/' ).filter( function( p ) {
						return !! p;
					} ),
					false,
				);
				let current = FS.root;
				let current_path = '/';
				for ( let i = 0; i < parts.length; i++ ) {
					const islast = i === parts.length - 1;
					if ( islast && opts.parent ) {
						break;
					}
					current = FS.lookupNode( current, parts[ i ] );
					current_path = PATH.join2( current_path, parts[ i ] );
					if ( FS.isMountpoint( current ) ) {
						if ( ! islast || ( islast && opts.follow_mount ) ) {
							current = current.mounted.root;
						}
					}
					if ( ! islast || opts.follow ) {
						let count = 0;
						while ( FS.isLink( current.mode ) ) {
							const link = FS.readlink( current_path );
							current_path = PATH_FS.resolve( PATH.dirname( current_path ), link );
							const lookup = FS.lookupPath( current_path, {
								recurse_count: opts.recurse_count,
							} );
							current = lookup.node;
							if ( count++ > 40 ) {
								throw new FS.ErrnoError( 32 );
							}
						}
					}
				}
				return { path: current_path, node: current };
			},
			getPath( node ) {
				let path;
				while ( true ) {
					if ( FS.isRoot( node ) ) {
						const mount = node.mount.mountpoint;
						if ( ! path ) {
							return mount;
						}
						return mount[ mount.length - 1 ] !== '/'
							? mount + '/' + path
							: mount + path;
					}
					path = path ? node.name + '/' + path : node.name;
					node = node.parent;
				}
			},
			hashName( parentid, name ) {
				let hash = 0;
				for ( let i = 0; i < name.length; i++ ) {
					hash = ( ( hash << 5 ) - hash + name.charCodeAt( i ) ) | 0;
				}
				return ( ( parentid + hash ) >>> 0 ) % FS.nameTable.length;
			},
			hashAddNode( node ) {
				const hash = FS.hashName( node.parent.id, node.name );
				node.name_next = FS.nameTable[ hash ];
				FS.nameTable[ hash ] = node;
			},
			hashRemoveNode( node ) {
				const hash = FS.hashName( node.parent.id, node.name );
				if ( FS.nameTable[ hash ] === node ) {
					FS.nameTable[ hash ] = node.name_next;
				} else {
					let current = FS.nameTable[ hash ];
					while ( current ) {
						if ( current.name_next === node ) {
							current.name_next = node.name_next;
							break;
						}
						current = current.name_next;
					}
				}
			},
			lookupNode( parent, name ) {
				const errCode = FS.mayLookup( parent );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode, parent );
				}
				const hash = FS.hashName( parent.id, name );
				for ( let node = FS.nameTable[ hash ]; node; node = node.name_next ) {
					const nodeName = node.name;
					if ( node.parent.id === parent.id && nodeName === name ) {
						return node;
					}
				}
				return FS.lookup( parent, name );
			},
			createNode( parent, name, mode, rdev ) {
				const node = new FS.FSNode( parent, name, mode, rdev );
				FS.hashAddNode( node );
				return node;
			},
			destroyNode( node ) {
				FS.hashRemoveNode( node );
			},
			isRoot( node ) {
				return node === node.parent;
			},
			isMountpoint( node ) {
				return !! node.mounted;
			},
			isFile( mode ) {
				return ( mode & 61440 ) === 32768;
			},
			isDir( mode ) {
				return ( mode & 61440 ) === 16384;
			},
			isLink( mode ) {
				return ( mode & 61440 ) === 40960;
			},
			isChrdev( mode ) {
				return ( mode & 61440 ) === 8192;
			},
			isBlkdev( mode ) {
				return ( mode & 61440 ) === 24576;
			},
			isFIFO( mode ) {
				return ( mode & 61440 ) === 4096;
			},
			isSocket( mode ) {
				return ( mode & 49152 ) === 49152;
			},
			flagModes: {
				r: 0,
				rs: 1052672,
				'r+': 2,
				w: 577,
				wx: 705,
				xw: 705,
				'w+': 578,
				'wx+': 706,
				'xw+': 706,
				a: 1089,
				ax: 1217,
				xa: 1217,
				'a+': 1090,
				'ax+': 1218,
				'xa+': 1218,
			},
			modeStringToFlags( str ) {
				const flags = FS.flagModes[ str ];
				if ( typeof flags === 'undefined' ) {
					throw new Error( 'Unknown file open mode: ' + str );
				}
				return flags;
			},
			flagsToPermissionString( flag ) {
				let perms = [ 'r', 'w', 'rw' ][ flag & 3 ];
				if ( flag & 512 ) {
					perms += 'w';
				}
				return perms;
			},
			nodePermissions( node, perms ) {
				if ( FS.ignorePermissions ) {
					return 0;
				}
				if ( perms.indexOf( 'r' ) !== -1 && ! ( node.mode & 292 ) ) {
					return 2;
				} else if ( perms.indexOf( 'w' ) !== -1 && ! ( node.mode & 146 ) ) {
					return 2;
				} else if ( perms.indexOf( 'x' ) !== -1 && ! ( node.mode & 73 ) ) {
					return 2;
				}
				return 0;
			},
			mayLookup( dir ) {
				const errCode = FS.nodePermissions( dir, 'x' );
				if ( errCode ) {
					return errCode;
				}
				if ( ! dir.node_ops.lookup ) {
					return 2;
				}
				return 0;
			},
			mayCreate( dir, name ) {
				try {
					const node = FS.lookupNode( dir, name );
					return 20;
				} catch ( e ) {}
				return FS.nodePermissions( dir, 'wx' );
			},
			mayDelete( dir, name, isdir ) {
				let node;
				try {
					node = FS.lookupNode( dir, name );
				} catch ( e ) {
					return e.errno;
				}
				const errCode = FS.nodePermissions( dir, 'wx' );
				if ( errCode ) {
					return errCode;
				}
				if ( isdir ) {
					if ( ! FS.isDir( node.mode ) ) {
						return 54;
					}
					if ( FS.isRoot( node ) || FS.getPath( node ) === FS.cwd() ) {
						return 10;
					}
				} else if ( FS.isDir( node.mode ) ) {
					return 31;
				}
				return 0;
			},
			mayOpen( node, flags ) {
				if ( ! node ) {
					return 44;
				}
				if ( FS.isLink( node.mode ) ) {
					return 32;
				} else if ( FS.isDir( node.mode ) ) {
					if ( FS.flagsToPermissionString( flags ) !== 'r' || flags & 512 ) {
						return 31;
					}
				}
				return FS.nodePermissions( node, FS.flagsToPermissionString( flags ) );
			},
			MAX_OPEN_FDS: 4096,
			nextfd( fd_start, fd_end ) {
				fd_start = fd_start || 0;
				fd_end = fd_end || FS.MAX_OPEN_FDS;
				for ( let fd = fd_start; fd <= fd_end; fd++ ) {
					if ( ! FS.streams[ fd ] ) {
						return fd;
					}
				}
				throw new FS.ErrnoError( 33 );
			},
			getStream( fd ) {
				return FS.streams[ fd ];
			},
			createStream( stream, fd_start, fd_end ) {
				if ( ! FS.FSStream ) {
					FS.FSStream = function() {};
					FS.FSStream.prototype = {
						object: {
							get() {
								return this.node;
							},
							set( val ) {
								this.node = val;
							},
						},
						isRead: {
							get() {
								return ( this.flags & 2097155 ) !== 1;
							},
						},
						isWrite: {
							get() {
								return ( this.flags & 2097155 ) !== 0;
							},
						},
						isAppend: {
							get() {
								return this.flags & 1024;
							},
						},
					};
				}
				const newStream = new FS.FSStream();
				for ( const p in stream ) {
					newStream[ p ] = stream[ p ];
				}
				stream = newStream;
				const fd = FS.nextfd( fd_start, fd_end );
				stream.fd = fd;
				FS.streams[ fd ] = stream;
				return stream;
			},
			closeStream( fd ) {
				FS.streams[ fd ] = null;
			},
			chrdev_stream_ops: {
				open( stream ) {
					const device = FS.getDevice( stream.node.rdev );
					stream.stream_ops = device.stream_ops;
					if ( stream.stream_ops.open ) {
						stream.stream_ops.open( stream );
					}
				},
				llseek() {
					throw new FS.ErrnoError( 70 );
				},
			},
			major( dev ) {
				return dev >> 8;
			},
			minor( dev ) {
				return dev & 255;
			},
			makedev( ma, mi ) {
				return ( ma << 8 ) | mi;
			},
			registerDevice( dev, ops ) {
				FS.devices[ dev ] = { stream_ops: ops };
			},
			getDevice( dev ) {
				return FS.devices[ dev ];
			},
			getMounts( mount ) {
				const mounts = [];
				const check = [ mount ];
				while ( check.length ) {
					const m = check.pop();
					mounts.push( m );
					check.push.apply( check, m.mounts );
				}
				return mounts;
			},
			syncfs( populate, callback ) {
				if ( typeof populate === 'function' ) {
					callback = populate;
					populate = false;
				}
				FS.syncFSRequests++;
				if ( FS.syncFSRequests > 1 ) {
					err(
						'warning: ' +
              FS.syncFSRequests +
              ' FS.syncfs operations in flight at once, probably just doing extra work',
					);
				}
				const mounts = FS.getMounts( FS.root.mount );
				let completed = 0;
				function doCallback( errCode ) {
					FS.syncFSRequests--;
					return callback( errCode );
				}
				function done( errCode ) {
					if ( errCode ) {
						if ( ! done.errored ) {
							done.errored = true;
							return doCallback( errCode );
						}
						return;
					}
					if ( ++completed >= mounts.length ) {
						doCallback( null );
					}
				}
				mounts.forEach( function( mount ) {
					if ( ! mount.type.syncfs ) {
						return done( null );
					}
					mount.type.syncfs( mount, populate, done );
				} );
			},
			mount( type, opts, mountpoint ) {
				const root = mountpoint === '/';
				const pseudo = ! mountpoint;
				let node;
				if ( root && FS.root ) {
					throw new FS.ErrnoError( 10 );
				} else if ( ! root && ! pseudo ) {
					const lookup = FS.lookupPath( mountpoint, { follow_mount: false } );
					mountpoint = lookup.path;
					node = lookup.node;
					if ( FS.isMountpoint( node ) ) {
						throw new FS.ErrnoError( 10 );
					}
					if ( ! FS.isDir( node.mode ) ) {
						throw new FS.ErrnoError( 54 );
					}
				}
				const mount = { type, opts, mountpoint, mounts: [] };
				const mountRoot = type.mount( mount );
				mountRoot.mount = mount;
				mount.root = mountRoot;
				if ( root ) {
					FS.root = mountRoot;
				} else if ( node ) {
					node.mounted = mount;
					if ( node.mount ) {
						node.mount.mounts.push( mount );
					}
				}
				return mountRoot;
			},
			unmount( mountpoint ) {
				const lookup = FS.lookupPath( mountpoint, { follow_mount: false } );
				if ( ! FS.isMountpoint( lookup.node ) ) {
					throw new FS.ErrnoError( 28 );
				}
				const node = lookup.node;
				const mount = node.mounted;
				const mounts = FS.getMounts( mount );
				Object.keys( FS.nameTable ).forEach( function( hash ) {
					let current = FS.nameTable[ hash ];
					while ( current ) {
						const next = current.name_next;
						if ( mounts.indexOf( current.mount ) !== -1 ) {
							FS.destroyNode( current );
						}
						current = next;
					}
				} );
				node.mounted = null;
				const idx = node.mount.mounts.indexOf( mount );
				node.mount.mounts.splice( idx, 1 );
			},
			lookup( parent, name ) {
				return parent.node_ops.lookup( parent, name );
			},
			mknod( path, mode, dev ) {
				const lookup = FS.lookupPath( path, { parent: true } );
				const parent = lookup.node;
				const name = PATH.basename( path );
				if ( ! name || name === '.' || name === '..' ) {
					throw new FS.ErrnoError( 28 );
				}
				const errCode = FS.mayCreate( parent, name );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				if ( ! parent.node_ops.mknod ) {
					throw new FS.ErrnoError( 63 );
				}
				return parent.node_ops.mknod( parent, name, mode, dev );
			},
			create( path, mode ) {
				mode = mode !== undefined ? mode : 438;
				mode &= 4095;
				mode |= 32768;
				return FS.mknod( path, mode, 0 );
			},
			mkdir( path, mode ) {
				mode = mode !== undefined ? mode : 511;
				mode &= 511 | 512;
				mode |= 16384;
				return FS.mknod( path, mode, 0 );
			},
			mkdirTree( path, mode ) {
				const dirs = path.split( '/' );
				let d = '';
				for ( let i = 0; i < dirs.length; ++i ) {
					if ( ! dirs[ i ] ) {
						continue;
					}
					d += '/' + dirs[ i ];
					try {
						FS.mkdir( d, mode );
					} catch ( e ) {
						if ( e.errno != 20 ) {
							throw e;
						}
					}
				}
			},
			mkdev( path, mode, dev ) {
				if ( typeof dev === 'undefined' ) {
					dev = mode;
					mode = 438;
				}
				mode |= 8192;
				return FS.mknod( path, mode, dev );
			},
			symlink( oldpath, newpath ) {
				if ( ! PATH_FS.resolve( oldpath ) ) {
					throw new FS.ErrnoError( 44 );
				}
				const lookup = FS.lookupPath( newpath, { parent: true } );
				const parent = lookup.node;
				if ( ! parent ) {
					throw new FS.ErrnoError( 44 );
				}
				const newname = PATH.basename( newpath );
				const errCode = FS.mayCreate( parent, newname );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				if ( ! parent.node_ops.symlink ) {
					throw new FS.ErrnoError( 63 );
				}
				return parent.node_ops.symlink( parent, newname, oldpath );
			},
			rename( old_path, new_path ) {
				const old_dirname = PATH.dirname( old_path );
				const new_dirname = PATH.dirname( new_path );
				const old_name = PATH.basename( old_path );
				const new_name = PATH.basename( new_path );
				let lookup, old_dir, new_dir;
				try {
					lookup = FS.lookupPath( old_path, { parent: true } );
					old_dir = lookup.node;
					lookup = FS.lookupPath( new_path, { parent: true } );
					new_dir = lookup.node;
				} catch ( e ) {
					throw new FS.ErrnoError( 10 );
				}
				if ( ! old_dir || ! new_dir ) {
					throw new FS.ErrnoError( 44 );
				}
				if ( old_dir.mount !== new_dir.mount ) {
					throw new FS.ErrnoError( 75 );
				}
				const old_node = FS.lookupNode( old_dir, old_name );
				let relative = PATH_FS.relative( old_path, new_dirname );
				if ( relative.charAt( 0 ) !== '.' ) {
					throw new FS.ErrnoError( 28 );
				}
				relative = PATH_FS.relative( new_path, old_dirname );
				if ( relative.charAt( 0 ) !== '.' ) {
					throw new FS.ErrnoError( 55 );
				}
				let new_node;
				try {
					new_node = FS.lookupNode( new_dir, new_name );
				} catch ( e ) {}
				if ( old_node === new_node ) {
					return;
				}
				const isdir = FS.isDir( old_node.mode );
				let errCode = FS.mayDelete( old_dir, old_name, isdir );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				errCode = new_node
					? FS.mayDelete( new_dir, new_name, isdir )
					: FS.mayCreate( new_dir, new_name );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				if ( ! old_dir.node_ops.rename ) {
					throw new FS.ErrnoError( 63 );
				}
				if (
					FS.isMountpoint( old_node ) ||
          ( new_node && FS.isMountpoint( new_node ) )
				) {
					throw new FS.ErrnoError( 10 );
				}
				if ( new_dir !== old_dir ) {
					errCode = FS.nodePermissions( old_dir, 'w' );
					if ( errCode ) {
						throw new FS.ErrnoError( errCode );
					}
				}
				try {
					if ( FS.trackingDelegate.willMovePath ) {
						FS.trackingDelegate.willMovePath( old_path, new_path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['willMovePath']('" +
              old_path +
              "', '" +
              new_path +
              "') threw an exception: " +
              e.message,
					);
				}
				FS.hashRemoveNode( old_node );
				try {
					old_dir.node_ops.rename( old_node, new_dir, new_name );
				} catch ( e ) {
					throw e;
				} finally {
					FS.hashAddNode( old_node );
				}
				try {
					if ( FS.trackingDelegate.onMovePath ) {
						FS.trackingDelegate.onMovePath( old_path, new_path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['onMovePath']('" +
              old_path +
              "', '" +
              new_path +
              "') threw an exception: " +
              e.message,
					);
				}
			},
			rmdir( path ) {
				const lookup = FS.lookupPath( path, { parent: true } );
				const parent = lookup.node;
				const name = PATH.basename( path );
				const node = FS.lookupNode( parent, name );
				const errCode = FS.mayDelete( parent, name, true );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				if ( ! parent.node_ops.rmdir ) {
					throw new FS.ErrnoError( 63 );
				}
				if ( FS.isMountpoint( node ) ) {
					throw new FS.ErrnoError( 10 );
				}
				try {
					if ( FS.trackingDelegate.willDeletePath ) {
						FS.trackingDelegate.willDeletePath( path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['willDeletePath']('" +
              path +
              "') threw an exception: " +
              e.message,
					);
				}
				parent.node_ops.rmdir( parent, name );
				FS.destroyNode( node );
				try {
					if ( FS.trackingDelegate.onDeletePath ) {
						FS.trackingDelegate.onDeletePath( path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['onDeletePath']('" +
              path +
              "') threw an exception: " +
              e.message,
					);
				}
			},
			readdir( path ) {
				const lookup = FS.lookupPath( path, { follow: true } );
				const node = lookup.node;
				if ( ! node.node_ops.readdir ) {
					throw new FS.ErrnoError( 54 );
				}
				return node.node_ops.readdir( node );
			},
			unlink( path ) {
				const lookup = FS.lookupPath( path, { parent: true } );
				const parent = lookup.node;
				const name = PATH.basename( path );
				const node = FS.lookupNode( parent, name );
				const errCode = FS.mayDelete( parent, name, false );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				if ( ! parent.node_ops.unlink ) {
					throw new FS.ErrnoError( 63 );
				}
				if ( FS.isMountpoint( node ) ) {
					throw new FS.ErrnoError( 10 );
				}
				try {
					if ( FS.trackingDelegate.willDeletePath ) {
						FS.trackingDelegate.willDeletePath( path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['willDeletePath']('" +
              path +
              "') threw an exception: " +
              e.message,
					);
				}
				parent.node_ops.unlink( parent, name );
				FS.destroyNode( node );
				try {
					if ( FS.trackingDelegate.onDeletePath ) {
						FS.trackingDelegate.onDeletePath( path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['onDeletePath']('" +
              path +
              "') threw an exception: " +
              e.message,
					);
				}
			},
			readlink( path ) {
				const lookup = FS.lookupPath( path );
				const link = lookup.node;
				if ( ! link ) {
					throw new FS.ErrnoError( 44 );
				}
				if ( ! link.node_ops.readlink ) {
					throw new FS.ErrnoError( 28 );
				}
				return PATH_FS.resolve(
					FS.getPath( link.parent ),
					link.node_ops.readlink( link ),
				);
			},
			stat( path, dontFollow ) {
				const lookup = FS.lookupPath( path, { follow: ! dontFollow } );
				const node = lookup.node;
				if ( ! node ) {
					throw new FS.ErrnoError( 44 );
				}
				if ( ! node.node_ops.getattr ) {
					throw new FS.ErrnoError( 63 );
				}
				return node.node_ops.getattr( node );
			},
			lstat( path ) {
				return FS.stat( path, true );
			},
			chmod( path, mode, dontFollow ) {
				let node;
				if ( typeof path === 'string' ) {
					const lookup = FS.lookupPath( path, { follow: ! dontFollow } );
					node = lookup.node;
				} else {
					node = path;
				}
				if ( ! node.node_ops.setattr ) {
					throw new FS.ErrnoError( 63 );
				}
				node.node_ops.setattr( node, {
					mode: ( mode & 4095 ) | ( node.mode & ~4095 ),
					timestamp: Date.now(),
				} );
			},
			lchmod( path, mode ) {
				FS.chmod( path, mode, true );
			},
			fchmod( fd, mode ) {
				const stream = FS.getStream( fd );
				if ( ! stream ) {
					throw new FS.ErrnoError( 8 );
				}
				FS.chmod( stream.node, mode );
			},
			chown( path, uid, gid, dontFollow ) {
				let node;
				if ( typeof path === 'string' ) {
					const lookup = FS.lookupPath( path, { follow: ! dontFollow } );
					node = lookup.node;
				} else {
					node = path;
				}
				if ( ! node.node_ops.setattr ) {
					throw new FS.ErrnoError( 63 );
				}
				node.node_ops.setattr( node, { timestamp: Date.now() } );
			},
			lchown( path, uid, gid ) {
				FS.chown( path, uid, gid, true );
			},
			fchown( fd, uid, gid ) {
				const stream = FS.getStream( fd );
				if ( ! stream ) {
					throw new FS.ErrnoError( 8 );
				}
				FS.chown( stream.node, uid, gid );
			},
			truncate( path, len ) {
				if ( len < 0 ) {
					throw new FS.ErrnoError( 28 );
				}
				let node;
				if ( typeof path === 'string' ) {
					const lookup = FS.lookupPath( path, { follow: true } );
					node = lookup.node;
				} else {
					node = path;
				}
				if ( ! node.node_ops.setattr ) {
					throw new FS.ErrnoError( 63 );
				}
				if ( FS.isDir( node.mode ) ) {
					throw new FS.ErrnoError( 31 );
				}
				if ( ! FS.isFile( node.mode ) ) {
					throw new FS.ErrnoError( 28 );
				}
				const errCode = FS.nodePermissions( node, 'w' );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				node.node_ops.setattr( node, { size: len, timestamp: Date.now() } );
			},
			ftruncate( fd, len ) {
				const stream = FS.getStream( fd );
				if ( ! stream ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( ( stream.flags & 2097155 ) === 0 ) {
					throw new FS.ErrnoError( 28 );
				}
				FS.truncate( stream.node, len );
			},
			utime( path, atime, mtime ) {
				const lookup = FS.lookupPath( path, { follow: true } );
				const node = lookup.node;
				node.node_ops.setattr( node, { timestamp: Math.max( atime, mtime ) } );
			},
			open( path, flags, mode, fd_start, fd_end ) {
				if ( path === '' ) {
					throw new FS.ErrnoError( 44 );
				}
				flags = typeof flags === 'string' ? FS.modeStringToFlags( flags ) : flags;
				mode = typeof mode === 'undefined' ? 438 : mode;
				if ( flags & 64 ) {
					mode = ( mode & 4095 ) | 32768;
				} else {
					mode = 0;
				}
				let node;
				if ( typeof path === 'object' ) {
					node = path;
				} else {
					path = PATH.normalize( path );
					try {
						const lookup = FS.lookupPath( path, { follow: ! ( flags & 131072 ) } );
						node = lookup.node;
					} catch ( e ) {}
				}
				let created = false;
				if ( flags & 64 ) {
					if ( node ) {
						if ( flags & 128 ) {
							throw new FS.ErrnoError( 20 );
						}
					} else {
						node = FS.mknod( path, mode, 0 );
						created = true;
					}
				}
				if ( ! node ) {
					throw new FS.ErrnoError( 44 );
				}
				if ( FS.isChrdev( node.mode ) ) {
					flags &= ~512;
				}
				if ( flags & 65536 && ! FS.isDir( node.mode ) ) {
					throw new FS.ErrnoError( 54 );
				}
				if ( ! created ) {
					const errCode = FS.mayOpen( node, flags );
					if ( errCode ) {
						throw new FS.ErrnoError( errCode );
					}
				}
				if ( flags & 512 ) {
					FS.truncate( node, 0 );
				}
				flags &= ~( 128 | 512 | 131072 );
				const stream = FS.createStream(
					{
						node,
						path: FS.getPath( node ),
						flags,
						seekable: true,
						position: 0,
						stream_ops: node.stream_ops,
						ungotten: [],
						error: false,
					},
					fd_start,
					fd_end,
				);
				if ( stream.stream_ops.open ) {
					stream.stream_ops.open( stream );
				}
				if ( Module.logReadFiles && ! ( flags & 1 ) ) {
					if ( ! FS.readFiles ) {
						FS.readFiles = {};
					}
					if ( ! ( path in FS.readFiles ) ) {
						FS.readFiles[ path ] = 1;
						err( 'FS.trackingDelegate error on read file: ' + path );
					}
				}
				try {
					if ( FS.trackingDelegate.onOpenFile ) {
						let trackingFlags = 0;
						if ( ( flags & 2097155 ) !== 1 ) {
							trackingFlags |= FS.tracking.openFlags.READ;
						}
						if ( ( flags & 2097155 ) !== 0 ) {
							trackingFlags |= FS.tracking.openFlags.WRITE;
						}
						FS.trackingDelegate.onOpenFile( path, trackingFlags );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['onOpenFile']('" +
              path +
              "', flags) threw an exception: " +
              e.message,
					);
				}
				return stream;
			},
			close( stream ) {
				if ( FS.isClosed( stream ) ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( stream.getdents ) {
					stream.getdents = null;
				}
				try {
					if ( stream.stream_ops.close ) {
						stream.stream_ops.close( stream );
					}
				} catch ( e ) {
					throw e;
				} finally {
					FS.closeStream( stream.fd );
				}
				stream.fd = null;
			},
			isClosed( stream ) {
				return stream.fd === null;
			},
			llseek( stream, offset, whence ) {
				if ( FS.isClosed( stream ) ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( ! stream.seekable || ! stream.stream_ops.llseek ) {
					throw new FS.ErrnoError( 70 );
				}
				if ( whence != 0 && whence != 1 && whence != 2 ) {
					throw new FS.ErrnoError( 28 );
				}
				stream.position = stream.stream_ops.llseek( stream, offset, whence );
				stream.ungotten = [];
				return stream.position;
			},
			read( stream, buffer, offset, length, position ) {
				if ( length < 0 || position < 0 ) {
					throw new FS.ErrnoError( 28 );
				}
				if ( FS.isClosed( stream ) ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( ( stream.flags & 2097155 ) === 1 ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( FS.isDir( stream.node.mode ) ) {
					throw new FS.ErrnoError( 31 );
				}
				if ( ! stream.stream_ops.read ) {
					throw new FS.ErrnoError( 28 );
				}
				const seeking = typeof position !== 'undefined';
				if ( ! seeking ) {
					position = stream.position;
				} else if ( ! stream.seekable ) {
					throw new FS.ErrnoError( 70 );
				}
				const bytesRead = stream.stream_ops.read(
					stream,
					buffer,
					offset,
					length,
					position,
				);
				if ( ! seeking ) {
					stream.position += bytesRead;
				}
				return bytesRead;
			},
			write( stream, buffer, offset, length, position, canOwn ) {
				if ( length < 0 || position < 0 ) {
					throw new FS.ErrnoError( 28 );
				}
				if ( FS.isClosed( stream ) ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( ( stream.flags & 2097155 ) === 0 ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( FS.isDir( stream.node.mode ) ) {
					throw new FS.ErrnoError( 31 );
				}
				if ( ! stream.stream_ops.write ) {
					throw new FS.ErrnoError( 28 );
				}
				if ( stream.seekable && stream.flags & 1024 ) {
					FS.llseek( stream, 0, 2 );
				}
				const seeking = typeof position !== 'undefined';
				if ( ! seeking ) {
					position = stream.position;
				} else if ( ! stream.seekable ) {
					throw new FS.ErrnoError( 70 );
				}
				const bytesWritten = stream.stream_ops.write(
					stream,
					buffer,
					offset,
					length,
					position,
					canOwn,
				);
				if ( ! seeking ) {
					stream.position += bytesWritten;
				}
				try {
					if ( stream.path && FS.trackingDelegate.onWriteToFile ) {
						FS.trackingDelegate.onWriteToFile( stream.path );
					}
				} catch ( e ) {
					err(
						"FS.trackingDelegate['onWriteToFile']('" +
              stream.path +
              "') threw an exception: " +
              e.message,
					);
				}
				return bytesWritten;
			},
			allocate( stream, offset, length ) {
				if ( FS.isClosed( stream ) ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( offset < 0 || length <= 0 ) {
					throw new FS.ErrnoError( 28 );
				}
				if ( ( stream.flags & 2097155 ) === 0 ) {
					throw new FS.ErrnoError( 8 );
				}
				if ( ! FS.isFile( stream.node.mode ) && ! FS.isDir( stream.node.mode ) ) {
					throw new FS.ErrnoError( 43 );
				}
				if ( ! stream.stream_ops.allocate ) {
					throw new FS.ErrnoError( 138 );
				}
				stream.stream_ops.allocate( stream, offset, length );
			},
			mmap( stream, address, length, position, prot, flags ) {
				if (
					( prot & 2 ) !== 0 &&
          ( flags & 2 ) === 0 &&
          ( stream.flags & 2097155 ) !== 2
				) {
					throw new FS.ErrnoError( 2 );
				}
				if ( ( stream.flags & 2097155 ) === 1 ) {
					throw new FS.ErrnoError( 2 );
				}
				if ( ! stream.stream_ops.mmap ) {
					throw new FS.ErrnoError( 43 );
				}
				return stream.stream_ops.mmap(
					stream,
					address,
					length,
					position,
					prot,
					flags,
				);
			},
			msync( stream, buffer, offset, length, mmapFlags ) {
				if ( ! stream || ! stream.stream_ops.msync ) {
					return 0;
				}
				return stream.stream_ops.msync(
					stream,
					buffer,
					offset,
					length,
					mmapFlags,
				);
			},
			munmap( stream ) {
				return 0;
			},
			ioctl( stream, cmd, arg ) {
				if ( ! stream.stream_ops.ioctl ) {
					throw new FS.ErrnoError( 59 );
				}
				return stream.stream_ops.ioctl( stream, cmd, arg );
			},
			readFile( path, opts ) {
				opts = opts || {};
				opts.flags = opts.flags || 'r';
				opts.encoding = opts.encoding || 'binary';
				if ( opts.encoding !== 'utf8' && opts.encoding !== 'binary' ) {
					throw new Error( 'Invalid encoding type "' + opts.encoding + '"' );
				}
				let ret;
				const stream = FS.open( path, opts.flags );
				const stat = FS.stat( path );
				const length = stat.size;
				const buf = new Uint8Array( length );
				FS.read( stream, buf, 0, length, 0 );
				if ( opts.encoding === 'utf8' ) {
					ret = UTF8ArrayToString( buf, 0 );
				} else if ( opts.encoding === 'binary' ) {
					ret = buf;
				}
				FS.close( stream );
				return ret;
			},
			writeFile( path, data, opts ) {
				opts = opts || {};
				opts.flags = opts.flags || 'w';
				const stream = FS.open( path, opts.flags, opts.mode );
				if ( typeof data === 'string' ) {
					const buf = new Uint8Array( lengthBytesUTF8( data ) + 1 );
					const actualNumBytes = stringToUTF8Array( data, buf, 0, buf.length );
					FS.write( stream, buf, 0, actualNumBytes, undefined, opts.canOwn );
				} else if ( ArrayBuffer.isView( data ) ) {
					FS.write( stream, data, 0, data.byteLength, undefined, opts.canOwn );
				} else {
					throw new Error( 'Unsupported data type' );
				}
				FS.close( stream );
			},
			cwd() {
				return FS.currentPath;
			},
			chdir( path ) {
				const lookup = FS.lookupPath( path, { follow: true } );
				if ( lookup.node === null ) {
					throw new FS.ErrnoError( 44 );
				}
				if ( ! FS.isDir( lookup.node.mode ) ) {
					throw new FS.ErrnoError( 54 );
				}
				const errCode = FS.nodePermissions( lookup.node, 'x' );
				if ( errCode ) {
					throw new FS.ErrnoError( errCode );
				}
				FS.currentPath = lookup.path;
			},
			createDefaultDirectories() {
				FS.mkdir( '/tmp' );
				FS.mkdir( '/home' );
				FS.mkdir( '/home/web_user' );
			},
			createDefaultDevices() {
				FS.mkdir( '/dev' );
				FS.registerDevice( FS.makedev( 1, 3 ), {
					read() {
						return 0;
					},
					write( stream, buffer, offset, length, pos ) {
						return length;
					},
				} );
				FS.mkdev( '/dev/null', FS.makedev( 1, 3 ) );
				TTY.register( FS.makedev( 5, 0 ), TTY.default_tty_ops );
				TTY.register( FS.makedev( 6, 0 ), TTY.default_tty1_ops );
				FS.mkdev( '/dev/tty', FS.makedev( 5, 0 ) );
				FS.mkdev( '/dev/tty1', FS.makedev( 6, 0 ) );
				let random_device;
				if (
					typeof crypto === 'object' &&
          typeof crypto.getRandomValues === 'function'
				) {
					const randomBuffer = new Uint8Array( 1 );
					random_device = function() {
						crypto.getRandomValues( randomBuffer );
						return randomBuffer[ 0 ];
					};
				} else {
				}
				if ( ! random_device ) {
					random_device = function() {
						abort( 'random_device' );
					};
				}
				FS.createDevice( '/dev', 'random', random_device );
				FS.createDevice( '/dev', 'urandom', random_device );
				FS.mkdir( '/dev/shm' );
				FS.mkdir( '/dev/shm/tmp' );
			},
			createSpecialDirectories() {
				FS.mkdir( '/proc' );
				FS.mkdir( '/proc/self' );
				FS.mkdir( '/proc/self/fd' );
				FS.mount(
					{
						mount() {
							const node = FS.createNode( '/proc/self', 'fd', 16384 | 511, 73 );
							node.node_ops = {
								lookup( parent, name ) {
									const fd = +name;
									const stream = FS.getStream( fd );
									if ( ! stream ) {
										throw new FS.ErrnoError( 8 );
									}
									const ret = {
										parent: null,
										mount: { mountpoint: 'fake' },
										node_ops: {
											readlink() {
												return stream.path;
											},
										},
									};
									ret.parent = ret;
									return ret;
								},
							};
							return node;
						},
					},
					{},
					'/proc/self/fd',
				);
			},
			createStandardStreams() {
				if ( Module.stdin ) {
					FS.createDevice( '/dev', 'stdin', Module.stdin );
				} else {
					FS.symlink( '/dev/tty', '/dev/stdin' );
				}
				if ( Module.stdout ) {
					FS.createDevice( '/dev', 'stdout', null, Module.stdout );
				} else {
					FS.symlink( '/dev/tty', '/dev/stdout' );
				}
				if ( Module.stderr ) {
					FS.createDevice( '/dev', 'stderr', null, Module.stderr );
				} else {
					FS.symlink( '/dev/tty1', '/dev/stderr' );
				}
				const stdin = FS.open( '/dev/stdin', 'r' );
				const stdout = FS.open( '/dev/stdout', 'w' );
				const stderr = FS.open( '/dev/stderr', 'w' );
			},
			ensureErrnoError() {
				if ( FS.ErrnoError ) {
					return;
				}
				FS.ErrnoError = function ErrnoError( errno, node ) {
					this.node = node;
					this.setErrno = function( errno ) {
						this.errno = errno;
					};
					this.setErrno( errno );
					this.message = 'FS error';
				};
				FS.ErrnoError.prototype = new Error();
				FS.ErrnoError.prototype.constructor = FS.ErrnoError;
				[ 44 ].forEach( function( code ) {
					FS.genericErrors[ code ] = new FS.ErrnoError( code );
					FS.genericErrors[ code ].stack = '<generic error, no stack>';
				} );
			},
			staticInit() {
				FS.ensureErrnoError();
				FS.nameTable = new Array( 4096 );
				FS.mount( MEMFS, {}, '/' );
				FS.createDefaultDirectories();
				FS.createDefaultDevices();
				FS.createSpecialDirectories();
				FS.filesystems = { MEMFS };
			},
			init( input, output, error ) {
				FS.init.initialized = true;
				FS.ensureErrnoError();
				Module.stdin = input || Module.stdin;
				Module.stdout = output || Module.stdout;
				Module.stderr = error || Module.stderr;
				FS.createStandardStreams();
			},
			quit() {
				FS.init.initialized = false;
				const fflush = Module._fflush;
				if ( fflush ) {
					fflush( 0 );
				}
				for ( let i = 0; i < FS.streams.length; i++ ) {
					const stream = FS.streams[ i ];
					if ( ! stream ) {
						continue;
					}
					FS.close( stream );
				}
			},
			getMode( canRead, canWrite ) {
				let mode = 0;
				if ( canRead ) {
					mode |= 292 | 73;
				}
				if ( canWrite ) {
					mode |= 146;
				}
				return mode;
			},
			joinPath( parts, forceRelative ) {
				let path = PATH.join.apply( null, parts );
				if ( forceRelative && path[ 0 ] == '/' ) {
					path = path.substr( 1 );
				}
				return path;
			},
			absolutePath( relative, base ) {
				return PATH_FS.resolve( base, relative );
			},
			standardizePath( path ) {
				return PATH.normalize( path );
			},
			findObject( path, dontResolveLastLink ) {
				const ret = FS.analyzePath( path, dontResolveLastLink );
				if ( ret.exists ) {
					return ret.object;
				}
				setErrNo( ret.error );
				return null;
			},
			analyzePath( path, dontResolveLastLink ) {
				try {
					var lookup = FS.lookupPath( path, { follow: ! dontResolveLastLink } );
					path = lookup.path;
				} catch ( e ) {}
				const ret = {
					isRoot: false,
					exists: false,
					error: 0,
					name: null,
					path: null,
					object: null,
					parentExists: false,
					parentPath: null,
					parentObject: null,
				};
				try {
					var lookup = FS.lookupPath( path, { parent: true } );
					ret.parentExists = true;
					ret.parentPath = lookup.path;
					ret.parentObject = lookup.node;
					ret.name = PATH.basename( path );
					lookup = FS.lookupPath( path, { follow: ! dontResolveLastLink } );
					ret.exists = true;
					ret.path = lookup.path;
					ret.object = lookup.node;
					ret.name = lookup.node.name;
					ret.isRoot = lookup.path === '/';
				} catch ( e ) {
					ret.error = e.errno;
				}
				return ret;
			},
			createFolder( parent, name, canRead, canWrite ) {
				const path = PATH.join2(
					typeof parent === 'string' ? parent : FS.getPath( parent ),
					name,
				);
				const mode = FS.getMode( canRead, canWrite );
				return FS.mkdir( path, mode );
			},
			createPath( parent, path, canRead, canWrite ) {
				parent = typeof parent === 'string' ? parent : FS.getPath( parent );
				const parts = path.split( '/' ).reverse();
				while ( parts.length ) {
					const part = parts.pop();
					if ( ! part ) {
						continue;
					}
					var current = PATH.join2( parent, part );
					try {
						FS.mkdir( current );
					} catch ( e ) {}
					parent = current;
				}
				return current;
			},
			createFile( parent, name, properties, canRead, canWrite ) {
				const path = PATH.join2(
					typeof parent === 'string' ? parent : FS.getPath( parent ),
					name,
				);
				const mode = FS.getMode( canRead, canWrite );
				return FS.create( path, mode );
			},
			createDataFile( parent, name, data, canRead, canWrite, canOwn ) {
				const path = name
					? PATH.join2(
						typeof parent === 'string' ? parent : FS.getPath( parent ),
						name,
					)
					: parent;
				const mode = FS.getMode( canRead, canWrite );
				const node = FS.create( path, mode );
				if ( data ) {
					if ( typeof data === 'string' ) {
						const arr = new Array( data.length );
						for ( let i = 0, len = data.length; i < len; ++i ) {
							arr[ i ] = data.charCodeAt( i );
						}
						data = arr;
					}
					FS.chmod( node, mode | 146 );
					const stream = FS.open( node, 'w' );
					FS.write( stream, data, 0, data.length, 0, canOwn );
					FS.close( stream );
					FS.chmod( node, mode );
				}
				return node;
			},
			createDevice( parent, name, input, output ) {
				const path = PATH.join2(
					typeof parent === 'string' ? parent : FS.getPath( parent ),
					name,
				);
				const mode = FS.getMode( !! input, !! output );
				if ( ! FS.createDevice.major ) {
					FS.createDevice.major = 64;
				}
				const dev = FS.makedev( FS.createDevice.major++, 0 );
				FS.registerDevice( dev, {
					open( stream ) {
						stream.seekable = false;
					},
					close( stream ) {
						if ( output && output.buffer && output.buffer.length ) {
							output( 10 );
						}
					},
					read( stream, buffer, offset, length, pos ) {
						let bytesRead = 0;
						for ( let i = 0; i < length; i++ ) {
							var result;
							try {
								result = input();
							} catch ( e ) {
								throw new FS.ErrnoError( 29 );
							}
							if ( result === undefined && bytesRead === 0 ) {
								throw new FS.ErrnoError( 6 );
							}
							if ( result === null || result === undefined ) {
								break;
							}
							bytesRead++;
							buffer[ offset + i ] = result;
						}
						if ( bytesRead ) {
							stream.node.timestamp = Date.now();
						}
						return bytesRead;
					},
					write( stream, buffer, offset, length, pos ) {
						for ( var i = 0; i < length; i++ ) {
							try {
								output( buffer[ offset + i ] );
							} catch ( e ) {
								throw new FS.ErrnoError( 29 );
							}
						}
						if ( length ) {
							stream.node.timestamp = Date.now();
						}
						return i;
					},
				} );
				return FS.mkdev( path, mode, dev );
			},
			createLink( parent, name, target, canRead, canWrite ) {
				const path = PATH.join2(
					typeof parent === 'string' ? parent : FS.getPath( parent ),
					name,
				);
				return FS.symlink( target, path );
			},
			forceLoadFile( obj ) {
				if ( obj.isDevice || obj.isFolder || obj.link || obj.contents ) {
					return true;
				}
				let success = true;
				if ( typeof XMLHttpRequest !== 'undefined' ) {
					throw new Error(
						'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.',
					);
				} else if ( read_ ) {
					try {
						obj.contents = intArrayFromString( read_( obj.url ), true );
						obj.usedBytes = obj.contents.length;
					} catch ( e ) {
						success = false;
					}
				} else {
					throw new Error( 'Cannot load without read() or XMLHttpRequest.' );
				}
				if ( ! success ) {
					setErrNo( 29 );
				}
				return success;
			},
			createLazyFile( parent, name, url, canRead, canWrite ) {
				function LazyUint8Array() {
					this.lengthKnown = false;
					this.chunks = [];
				}
				LazyUint8Array.prototype.get = function LazyUint8Array_get( idx ) {
					if ( idx > this.length - 1 || idx < 0 ) {
						return undefined;
					}
					const chunkOffset = idx % this.chunkSize;
					const chunkNum = ( idx / this.chunkSize ) | 0;
					return this.getter( chunkNum )[ chunkOffset ];
				};
				LazyUint8Array.prototype.setDataGetter =
          function LazyUint8Array_setDataGetter( getter ) {
          	this.getter = getter;
          };
				LazyUint8Array.prototype.cacheLength =
          function LazyUint8Array_cacheLength() {
          	const xhr = new XMLHttpRequest();
          	xhr.open( 'HEAD', url, false );
          	xhr.send( null );
          	if (
          		! ( ( xhr.status >= 200 && xhr.status < 300 ) || xhr.status === 304 )
          	) {
          		throw new Error(
          			"Couldn't load " + url + '. Status: ' + xhr.status,
          		);
          	}
          	let datalength = Number( xhr.getResponseHeader( 'Content-length' ) );
          	let header;
          	const hasByteServing =
              ( header = xhr.getResponseHeader( 'Accept-Ranges' ) ) &&
              header === 'bytes';
          	const usesGzip =
              ( header = xhr.getResponseHeader( 'Content-Encoding' ) ) &&
              header === 'gzip';
          	let chunkSize = 1024 * 1024;
          	if ( ! hasByteServing ) {
          		chunkSize = datalength;
          	}
          	const doXHR = function( from, to ) {
          		if ( from > to ) {
          			throw new Error(
          				'invalid range (' +
                    from +
                    ', ' +
                    to +
                    ') or no bytes requested!',
          			);
          		}
          		if ( to > datalength - 1 ) {
          			throw new Error(
          				'only ' + datalength + ' bytes available! programmer error!',
          			);
          		}
          		const xhr = new XMLHttpRequest();
          		xhr.open( 'GET', url, false );
          		if ( datalength !== chunkSize ) {
          			xhr.setRequestHeader( 'Range', 'bytes=' + from + '-' + to );
          		}
          		if ( typeof Uint8Array !== 'undefined' ) {
          			xhr.responseType = 'arraybuffer';
          		}
          		if ( xhr.overrideMimeType ) {
          			xhr.overrideMimeType( 'text/plain; charset=x-user-defined' );
          		}
          		xhr.send( null );
          		if (
          			! ( ( xhr.status >= 200 && xhr.status < 300 ) || xhr.status === 304 )
          		) {
          			throw new Error(
          				"Couldn't load " + url + '. Status: ' + xhr.status,
          			);
          		}
          		if ( xhr.response !== undefined ) {
          			return new Uint8Array( xhr.response || [] );
          		}
          		return intArrayFromString( xhr.responseText || '', true );
          	};
          	const lazyArray = this;
          	lazyArray.setDataGetter( function( chunkNum ) {
          		const start = chunkNum * chunkSize;
          		let end = ( chunkNum + 1 ) * chunkSize - 1;
          		end = Math.min( end, datalength - 1 );
          		if ( typeof lazyArray.chunks[ chunkNum ] === 'undefined' ) {
          			lazyArray.chunks[ chunkNum ] = doXHR( start, end );
          		}
          		if ( typeof lazyArray.chunks[ chunkNum ] === 'undefined' ) {
          			throw new Error( 'doXHR failed!' );
          		}
          		return lazyArray.chunks[ chunkNum ];
          	} );
          	if ( usesGzip || ! datalength ) {
          		chunkSize = datalength = 1;
          		datalength = this.getter( 0 ).length;
          		chunkSize = datalength;
          		out(
          			'LazyFiles on gzip forces download of the whole file when length is accessed',
          		);
          	}
          	this._length = datalength;
          	this._chunkSize = chunkSize;
          	this.lengthKnown = true;
          };
				if ( typeof XMLHttpRequest !== 'undefined' ) {
					if ( ! ENVIRONMENT_IS_WORKER ) {
						throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
					}
					const lazyArray = new LazyUint8Array();
					Object.defineProperties( lazyArray, {
						length: {
							get() {
								if ( ! this.lengthKnown ) {
									this.cacheLength();
								}
								return this._length;
							},
						},
						chunkSize: {
							get() {
								if ( ! this.lengthKnown ) {
									this.cacheLength();
								}
								return this._chunkSize;
							},
						},
					} );
					var properties = { isDevice: false, contents: lazyArray };
				} else {
					var properties = { isDevice: false, url };
				}
				const node = FS.createFile( parent, name, properties, canRead, canWrite );
				if ( properties.contents ) {
					node.contents = properties.contents;
				} else if ( properties.url ) {
					node.contents = null;
					node.url = properties.url;
				}
				Object.defineProperties( node, {
					usedBytes: {
						get() {
							return this.contents.length;
						},
					},
				} );
				const stream_ops = {};
				const keys = Object.keys( node.stream_ops );
				keys.forEach( function( key ) {
					const fn = node.stream_ops[ key ];
					stream_ops[ key ] = function forceLoadLazyFile() {
						if ( ! FS.forceLoadFile( node ) ) {
							throw new FS.ErrnoError( 29 );
						}
						return fn.apply( null, arguments );
					};
				} );
				stream_ops.read = function stream_ops_read(
					stream,
					buffer,
					offset,
					length,
					position,
				) {
					if ( ! FS.forceLoadFile( node ) ) {
						throw new FS.ErrnoError( 29 );
					}
					const contents = stream.node.contents;
					if ( position >= contents.length ) {
						return 0;
					}
					const size = Math.min( contents.length - position, length );
					if ( contents.slice ) {
						for ( var i = 0; i < size; i++ ) {
							buffer[ offset + i ] = contents[ position + i ];
						}
					} else {
						for ( var i = 0; i < size; i++ ) {
							buffer[ offset + i ] = contents.get( position + i );
						}
					}
					return size;
				};
				node.stream_ops = stream_ops;
				return node;
			},
			createPreloadedFile(
				parent,
				name,
				url,
				canRead,
				canWrite,
				onload,
				onerror,
				dontCreateFile,
				canOwn,
				preFinish,
			) {
				Browser.init();
				const fullname = name
					? PATH_FS.resolve( PATH.join2( parent, name ) )
					: parent;
				const dep = getUniqueRunDependency( 'cp ' + fullname );
				function processData( byteArray ) {
					function finish( byteArray ) {
						if ( preFinish ) {
							preFinish();
						}
						if ( ! dontCreateFile ) {
							FS.createDataFile(
								parent,
								name,
								byteArray,
								canRead,
								canWrite,
								canOwn,
							);
						}
						if ( onload ) {
							onload();
						}
						removeRunDependency( dep );
					}
					let handled = false;
					Module.preloadPlugins.forEach( function( plugin ) {
						if ( handled ) {
							return;
						}
						if ( plugin.canHandle( fullname ) ) {
							plugin.handle( byteArray, fullname, finish, function() {
								if ( onerror ) {
									onerror();
								}
								removeRunDependency( dep );
							} );
							handled = true;
						}
					} );
					if ( ! handled ) {
						finish( byteArray );
					}
				}
				addRunDependency( dep );
				if ( typeof url === 'string' ) {
					Browser.asyncLoad(
						url,
						function( byteArray ) {
							processData( byteArray );
						},
						onerror,
					);
				} else {
					processData( url );
				}
			},
			indexedDB() {
				return (
					window.indexedDB ||
          window.mozIndexedDB ||
          window.webkitIndexedDB ||
          window.msIndexedDB
				);
			},
			DB_NAME() {
				return 'EM_FS_' + window.location.pathname;
			},
			DB_VERSION: 20,
			DB_STORE_NAME: 'FILE_DATA',
			saveFilesToDB( paths, onload, onerror ) {
				onload = onload || function() {};
				onerror = onerror || function() {};
				const indexedDB = FS.indexedDB();
				try {
					var openRequest = indexedDB.open( FS.DB_NAME(), FS.DB_VERSION );
				} catch ( e ) {
					return onerror( e );
				}
				openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
					out( 'creating db' );
					const db = openRequest.result;
					db.createObjectStore( FS.DB_STORE_NAME );
				};
				openRequest.onsuccess = function openRequest_onsuccess() {
					const db = openRequest.result;
					const transaction = db.transaction( [ FS.DB_STORE_NAME ], 'readwrite' );
					const files = transaction.objectStore( FS.DB_STORE_NAME );
					let ok = 0,
						fail = 0,
						total = paths.length;
					function finish() {
						if ( fail == 0 ) {
							onload();
						} else {
							onerror();
						}
					}
					paths.forEach( function( path ) {
						const putRequest = files.put(
							FS.analyzePath( path ).object.contents,
							path,
						);
						putRequest.onsuccess = function putRequest_onsuccess() {
							ok++;
							if ( ok + fail == total ) {
								finish();
							}
						};
						putRequest.onerror = function putRequest_onerror() {
							fail++;
							if ( ok + fail == total ) {
								finish();
							}
						};
					} );
					transaction.onerror = onerror;
				};
				openRequest.onerror = onerror;
			},
			loadFilesFromDB( paths, onload, onerror ) {
				onload = onload || function() {};
				onerror = onerror || function() {};
				const indexedDB = FS.indexedDB();
				try {
					var openRequest = indexedDB.open( FS.DB_NAME(), FS.DB_VERSION );
				} catch ( e ) {
					return onerror( e );
				}
				openRequest.onupgradeneeded = onerror;
				openRequest.onsuccess = function openRequest_onsuccess() {
					const db = openRequest.result;
					try {
						var transaction = db.transaction( [ FS.DB_STORE_NAME ], 'readonly' );
					} catch ( e ) {
						onerror( e );
						return;
					}
					const files = transaction.objectStore( FS.DB_STORE_NAME );
					let ok = 0,
						fail = 0,
						total = paths.length;
					function finish() {
						if ( fail == 0 ) {
							onload();
						} else {
							onerror();
						}
					}
					paths.forEach( function( path ) {
						const getRequest = files.get( path );
						getRequest.onsuccess = function getRequest_onsuccess() {
							if ( FS.analyzePath( path ).exists ) {
								FS.unlink( path );
							}
							FS.createDataFile(
								PATH.dirname( path ),
								PATH.basename( path ),
								getRequest.result,
								true,
								true,
								true,
							);
							ok++;
							if ( ok + fail == total ) {
								finish();
							}
						};
						getRequest.onerror = function getRequest_onerror() {
							fail++;
							if ( ok + fail == total ) {
								finish();
							}
						};
					} );
					transaction.onerror = onerror;
				};
				openRequest.onerror = onerror;
			},
		};
		var SYSCALLS = {
			mappings: {},
			DEFAULT_POLLMASK: 5,
			umask: 511,
			calculateAt( dirfd, path ) {
				if ( path[ 0 ] !== '/' ) {
					let dir;
					if ( dirfd === -100 ) {
						dir = FS.cwd();
					} else {
						const dirstream = FS.getStream( dirfd );
						if ( ! dirstream ) {
							throw new FS.ErrnoError( 8 );
						}
						dir = dirstream.path;
					}
					path = PATH.join2( dir, path );
				}
				return path;
			},
			doStat( func, path, buf ) {
				try {
					var stat = func( path );
				} catch ( e ) {
					if (
						e &&
            e.node &&
            PATH.normalize( path ) !== PATH.normalize( FS.getPath( e.node ) )
					) {
						return -54;
					}
					throw e;
				}
				HEAP32[ buf >> 2 ] = stat.dev;
				HEAP32[ ( buf + 4 ) >> 2 ] = 0;
				HEAP32[ ( buf + 8 ) >> 2 ] = stat.ino;
				HEAP32[ ( buf + 12 ) >> 2 ] = stat.mode;
				HEAP32[ ( buf + 16 ) >> 2 ] = stat.nlink;
				HEAP32[ ( buf + 20 ) >> 2 ] = stat.uid;
				HEAP32[ ( buf + 24 ) >> 2 ] = stat.gid;
				HEAP32[ ( buf + 28 ) >> 2 ] = stat.rdev;
				HEAP32[ ( buf + 32 ) >> 2 ] = 0;
				( tempI64 = [
					stat.size >>> 0,
					( ( tempDouble = stat.size ),
					+Math_abs( tempDouble ) >= 1
						? tempDouble > 0
							? ( Math_min( +Math_floor( tempDouble / 4294967296 ), 4294967295 ) |
                  0 ) >>>
                0
							: ~~+Math_ceil(
								( tempDouble - +( ~~tempDouble >>> 0 ) ) / 4294967296,
							) >>> 0
						: 0 ),
				] ),
				( HEAP32[ ( buf + 40 ) >> 2 ] = tempI64[ 0 ] ),
				( HEAP32[ ( buf + 44 ) >> 2 ] = tempI64[ 1 ] );
				HEAP32[ ( buf + 48 ) >> 2 ] = 4096;
				HEAP32[ ( buf + 52 ) >> 2 ] = stat.blocks;
				HEAP32[ ( buf + 56 ) >> 2 ] = ( stat.atime.getTime() / 1e3 ) | 0;
				HEAP32[ ( buf + 60 ) >> 2 ] = 0;
				HEAP32[ ( buf + 64 ) >> 2 ] = ( stat.mtime.getTime() / 1e3 ) | 0;
				HEAP32[ ( buf + 68 ) >> 2 ] = 0;
				HEAP32[ ( buf + 72 ) >> 2 ] = ( stat.ctime.getTime() / 1e3 ) | 0;
				HEAP32[ ( buf + 76 ) >> 2 ] = 0;
				( tempI64 = [
					stat.ino >>> 0,
					( ( tempDouble = stat.ino ),
					+Math_abs( tempDouble ) >= 1
						? tempDouble > 0
							? ( Math_min( +Math_floor( tempDouble / 4294967296 ), 4294967295 ) |
                  0 ) >>>
                0
							: ~~+Math_ceil(
								( tempDouble - +( ~~tempDouble >>> 0 ) ) / 4294967296,
							) >>> 0
						: 0 ),
				] ),
				( HEAP32[ ( buf + 80 ) >> 2 ] = tempI64[ 0 ] ),
				( HEAP32[ ( buf + 84 ) >> 2 ] = tempI64[ 1 ] );
				return 0;
			},
			doMsync( addr, stream, len, flags, offset ) {
				const buffer = HEAPU8.slice( addr, addr + len );
				FS.msync( stream, buffer, offset, len, flags );
			},
			doMkdir( path, mode ) {
				path = PATH.normalize( path );
				if ( path[ path.length - 1 ] === '/' ) {
					path = path.substr( 0, path.length - 1 );
				}
				FS.mkdir( path, mode, 0 );
				return 0;
			},
			doMknod( path, mode, dev ) {
				switch ( mode & 61440 ) {
					case 32768:
					case 8192:
					case 24576:
					case 4096:
					case 49152:
						break;
					default:
						return -28;
				}
				FS.mknod( path, mode, dev );
				return 0;
			},
			doReadlink( path, buf, bufsize ) {
				if ( bufsize <= 0 ) {
					return -28;
				}
				const ret = FS.readlink( path );
				const len = Math.min( bufsize, lengthBytesUTF8( ret ) );
				const endChar = HEAP8[ buf + len ];
				stringToUTF8( ret, buf, bufsize + 1 );
				HEAP8[ buf + len ] = endChar;
				return len;
			},
			doAccess( path, amode ) {
				if ( amode & ~7 ) {
					return -28;
				}
				let node;
				const lookup = FS.lookupPath( path, { follow: true } );
				node = lookup.node;
				if ( ! node ) {
					return -44;
				}
				let perms = '';
				if ( amode & 4 ) {
					perms += 'r';
				}
				if ( amode & 2 ) {
					perms += 'w';
				}
				if ( amode & 1 ) {
					perms += 'x';
				}
				if ( perms && FS.nodePermissions( node, perms ) ) {
					return -2;
				}
				return 0;
			},
			doDup( path, flags, suggestFD ) {
				const suggest = FS.getStream( suggestFD );
				if ( suggest ) {
					FS.close( suggest );
				}
				return FS.open( path, flags, 0, suggestFD, suggestFD ).fd;
			},
			doReadv( stream, iov, iovcnt, offset ) {
				let ret = 0;
				for ( let i = 0; i < iovcnt; i++ ) {
					const ptr = HEAP32[ ( iov + i * 8 ) >> 2 ];
					const len = HEAP32[ ( iov + ( i * 8 + 4 ) ) >> 2 ];
					const curr = FS.read( stream, HEAP8, ptr, len, offset );
					if ( curr < 0 ) {
						return -1;
					}
					ret += curr;
					if ( curr < len ) {
						break;
					}
				}
				return ret;
			},
			doWritev( stream, iov, iovcnt, offset ) {
				let ret = 0;
				for ( let i = 0; i < iovcnt; i++ ) {
					const ptr = HEAP32[ ( iov + i * 8 ) >> 2 ];
					const len = HEAP32[ ( iov + ( i * 8 + 4 ) ) >> 2 ];
					const curr = FS.write( stream, HEAP8, ptr, len, offset );
					if ( curr < 0 ) {
						return -1;
					}
					ret += curr;
				}
				return ret;
			},
			varargs: undefined,
			get() {
				SYSCALLS.varargs += 4;
				const ret = HEAP32[ ( SYSCALLS.varargs - 4 ) >> 2 ];
				return ret;
			},
			getStr( ptr ) {
				const ret = UTF8ToString( ptr );
				return ret;
			},
			getStreamFromFD( fd ) {
				const stream = FS.getStream( fd );
				if ( ! stream ) {
					throw new FS.ErrnoError( 8 );
				}
				return stream;
			},
			get64( low, high ) {
				return low;
			},
		};
		const ERRNO_CODES = {
			EPERM: 63,
			ENOENT: 44,
			ESRCH: 71,
			EINTR: 27,
			EIO: 29,
			ENXIO: 60,
			E2BIG: 1,
			ENOEXEC: 45,
			EBADF: 8,
			ECHILD: 12,
			EAGAIN: 6,
			EWOULDBLOCK: 6,
			ENOMEM: 48,
			EACCES: 2,
			EFAULT: 21,
			ENOTBLK: 105,
			EBUSY: 10,
			EEXIST: 20,
			EXDEV: 75,
			ENODEV: 43,
			ENOTDIR: 54,
			EISDIR: 31,
			EINVAL: 28,
			ENFILE: 41,
			EMFILE: 33,
			ENOTTY: 59,
			ETXTBSY: 74,
			EFBIG: 22,
			ENOSPC: 51,
			ESPIPE: 70,
			EROFS: 69,
			EMLINK: 34,
			EPIPE: 64,
			EDOM: 18,
			ERANGE: 68,
			ENOMSG: 49,
			EIDRM: 24,
			ECHRNG: 106,
			EL2NSYNC: 156,
			EL3HLT: 107,
			EL3RST: 108,
			ELNRNG: 109,
			EUNATCH: 110,
			ENOCSI: 111,
			EL2HLT: 112,
			EDEADLK: 16,
			ENOLCK: 46,
			EBADE: 113,
			EBADR: 114,
			EXFULL: 115,
			ENOANO: 104,
			EBADRQC: 103,
			EBADSLT: 102,
			EDEADLOCK: 16,
			EBFONT: 101,
			ENOSTR: 100,
			ENODATA: 116,
			ETIME: 117,
			ENOSR: 118,
			ENONET: 119,
			ENOPKG: 120,
			EREMOTE: 121,
			ENOLINK: 47,
			EADV: 122,
			ESRMNT: 123,
			ECOMM: 124,
			EPROTO: 65,
			EMULTIHOP: 36,
			EDOTDOT: 125,
			EBADMSG: 9,
			ENOTUNIQ: 126,
			EBADFD: 127,
			EREMCHG: 128,
			ELIBACC: 129,
			ELIBBAD: 130,
			ELIBSCN: 131,
			ELIBMAX: 132,
			ELIBEXEC: 133,
			ENOSYS: 52,
			ENOTEMPTY: 55,
			ENAMETOOLONG: 37,
			ELOOP: 32,
			EOPNOTSUPP: 138,
			EPFNOSUPPORT: 139,
			ECONNRESET: 15,
			ENOBUFS: 42,
			EAFNOSUPPORT: 5,
			EPROTOTYPE: 67,
			ENOTSOCK: 57,
			ENOPROTOOPT: 50,
			ESHUTDOWN: 140,
			ECONNREFUSED: 14,
			EADDRINUSE: 3,
			ECONNABORTED: 13,
			ENETUNREACH: 40,
			ENETDOWN: 38,
			ETIMEDOUT: 73,
			EHOSTDOWN: 142,
			EHOSTUNREACH: 23,
			EINPROGRESS: 26,
			EALREADY: 7,
			EDESTADDRREQ: 17,
			EMSGSIZE: 35,
			EPROTONOSUPPORT: 66,
			ESOCKTNOSUPPORT: 137,
			EADDRNOTAVAIL: 4,
			ENETRESET: 39,
			EISCONN: 30,
			ENOTCONN: 53,
			ETOOMANYREFS: 141,
			EUSERS: 136,
			EDQUOT: 19,
			ESTALE: 72,
			ENOTSUP: 138,
			ENOMEDIUM: 148,
			EILSEQ: 25,
			EOVERFLOW: 61,
			ECANCELED: 11,
			ENOTRECOVERABLE: 56,
			EOWNERDEAD: 62,
			ESTRPIPE: 135,
		};
		var SOCKFS = {
			mount( mount ) {
				Module.websocket =
          Module.websocket && 'object' === typeof Module.websocket
          	? Module.websocket
          	: {};
				Module.websocket._callbacks = {};
				Module.websocket.on = function( event, callback ) {
					if ( 'function' === typeof callback ) {
						this._callbacks[ event ] = callback;
					}
					return this;
				};
				Module.websocket.emit = function( event, param ) {
					if ( 'function' === typeof this._callbacks[ event ] ) {
						this._callbacks[ event ].call( this, param );
					}
				};
				return FS.createNode( null, '/', 16384 | 511, 0 );
			},
			createSocket( family, type, protocol ) {
				const streaming = type == 1;
				if ( protocol ) {
					assert( streaming == ( protocol == 6 ) );
				}
				const sock = {
					family,
					type,
					protocol,
					server: null,
					error: null,
					peers: {},
					pending: [],
					recv_queue: [],
					sock_ops: SOCKFS.websocket_sock_ops,
				};
				const name = SOCKFS.nextname();
				const node = FS.createNode( SOCKFS.root, name, 49152, 0 );
				node.sock = sock;
				const stream = FS.createStream( {
					path: name,
					node,
					flags: FS.modeStringToFlags( 'r+' ),
					seekable: false,
					stream_ops: SOCKFS.stream_ops,
				} );
				sock.stream = stream;
				return sock;
			},
			getSocket( fd ) {
				const stream = FS.getStream( fd );
				if ( ! stream || ! FS.isSocket( stream.node.mode ) ) {
					return null;
				}
				return stream.node.sock;
			},
			stream_ops: {
				poll( stream ) {
					const sock = stream.node.sock;
					return sock.sock_ops.poll( sock );
				},
				ioctl( stream, request, varargs ) {
					const sock = stream.node.sock;
					return sock.sock_ops.ioctl( sock, request, varargs );
				},
				read( stream, buffer, offset, length, position ) {
					const sock = stream.node.sock;
					const msg = sock.sock_ops.recvmsg( sock, length );
					if ( ! msg ) {
						return 0;
					}
					buffer.set( msg.buffer, offset );
					return msg.buffer.length;
				},
				write( stream, buffer, offset, length, position ) {
					const sock = stream.node.sock;
					return sock.sock_ops.sendmsg( sock, buffer, offset, length );
				},
				close( stream ) {
					const sock = stream.node.sock;
					sock.sock_ops.close( sock );
				},
			},
			nextname() {
				if ( ! SOCKFS.nextname.current ) {
					SOCKFS.nextname.current = 0;
				}
				return 'socket[' + SOCKFS.nextname.current++ + ']';
			},
			websocket_sock_ops: {
				createPeer( sock, addr, port ) {
					let ws;
					if ( typeof addr === 'object' ) {
						ws = addr;
						addr = null;
						port = null;
					}
					if ( ws ) {
						if ( ws._socket ) {
							addr = ws._socket.remoteAddress;
							port = ws._socket.remotePort;
						} else {
							const result = /ws[s]?:\/\/([^:]+):(\d+)/.exec( ws.url );
							if ( ! result ) {
								throw new Error(
									'WebSocket URL must be in the format ws(s)://address:port',
								);
							}
							addr = result[ 1 ];
							port = parseInt( result[ 2 ], 10 );
						}
					} else {
						try {
							const runtimeConfig =
                Module.websocket && 'object' === typeof Module.websocket;
							let url = 'ws:#'.replace( '#', '//' );
							if ( runtimeConfig ) {
								if ( 'string' === typeof Module.websocket.url ) {
									url = Module.websocket.url;
								}
							}
							if ( url === 'ws://' || url === 'wss://' ) {
								const parts = addr.split( '/' );
								url =
                  url + parts[ 0 ] + ':' + port + '/' + parts.slice( 1 ).join( '/' );
							}
							let subProtocols = 'binary';
							if ( runtimeConfig ) {
								if ( 'string' === typeof Module.websocket.subprotocol ) {
									subProtocols = Module.websocket.subprotocol;
								}
							}
							let opts;
							if ( subProtocols !== 'null' ) {
								subProtocols = subProtocols
									.replace( /^ +| +$/g, '' )
									.split( / *, */ );
								opts = ENVIRONMENT_IS_NODE
									? { protocol: subProtocols.toString() }
									: subProtocols;
							}
							if ( runtimeConfig && null === Module.websocket.subprotocol ) {
								subProtocols = 'null';
								opts = undefined;
							}
							let WebSocketConstructor;
							{
								WebSocketConstructor = WebSocket;
							}
							ws = new WebSocketConstructor( url, opts );
							ws.binaryType = 'arraybuffer';
						} catch ( e ) {
							throw new FS.ErrnoError( ERRNO_CODES.EHOSTUNREACH );
						}
					}
					const peer = { addr, port, socket: ws, dgram_send_queue: [] };
					SOCKFS.websocket_sock_ops.addPeer( sock, peer );
					SOCKFS.websocket_sock_ops.handlePeerEvents( sock, peer );
					if ( sock.type === 2 && typeof sock.sport !== 'undefined' ) {
						peer.dgram_send_queue.push(
							new Uint8Array( [
								255,
								255,
								255,
								255,
								'p'.charCodeAt( 0 ),
								'o'.charCodeAt( 0 ),
								'r'.charCodeAt( 0 ),
								't'.charCodeAt( 0 ),
								( sock.sport & 65280 ) >> 8,
								sock.sport & 255,
							] ),
						);
					}
					return peer;
				},
				getPeer( sock, addr, port ) {
					return sock.peers[ addr + ':' + port ];
				},
				addPeer( sock, peer ) {
					sock.peers[ peer.addr + ':' + peer.port ] = peer;
				},
				removePeer( sock, peer ) {
					delete sock.peers[ peer.addr + ':' + peer.port ];
				},
				handlePeerEvents( sock, peer ) {
					let first = true;
					const handleOpen = function() {
						Module.websocket.emit( 'open', sock.stream.fd );
						try {
							let queued = peer.dgram_send_queue.shift();
							while ( queued ) {
								peer.socket.send( queued );
								queued = peer.dgram_send_queue.shift();
							}
						} catch ( e ) {
							peer.socket.close();
						}
					};
					function handleMessage( data ) {
						if ( typeof data === 'string' ) {
							const encoder = new TextEncoder();
							data = encoder.encode( data );
						} else {
							assert( data.byteLength !== undefined );
							if ( data.byteLength == 0 ) {
								return;
							}
							data = new Uint8Array( data );
						}
						const wasfirst = first;
						first = false;
						if (
							wasfirst &&
              data.length === 10 &&
              data[ 0 ] === 255 &&
              data[ 1 ] === 255 &&
              data[ 2 ] === 255 &&
              data[ 3 ] === 255 &&
              data[ 4 ] === 'p'.charCodeAt( 0 ) &&
              data[ 5 ] === 'o'.charCodeAt( 0 ) &&
              data[ 6 ] === 'r'.charCodeAt( 0 ) &&
              data[ 7 ] === 't'.charCodeAt( 0 )
						) {
							const newport = ( data[ 8 ] << 8 ) | data[ 9 ];
							SOCKFS.websocket_sock_ops.removePeer( sock, peer );
							peer.port = newport;
							SOCKFS.websocket_sock_ops.addPeer( sock, peer );
							return;
						}
						sock.recv_queue.push( { addr: peer.addr, port: peer.port, data } );
						Module.websocket.emit( 'message', sock.stream.fd );
					}
					if ( ENVIRONMENT_IS_NODE ) {
						peer.socket.on( 'open', handleOpen );
						peer.socket.on( 'message', function( data, flags ) {
							if ( ! flags.binary ) {
								return;
							}
							handleMessage( new Uint8Array( data ).buffer );
						} );
						peer.socket.on( 'close', function() {
							Module.websocket.emit( 'close', sock.stream.fd );
						} );
						peer.socket.on( 'error', function( error ) {
							sock.error = ERRNO_CODES.ECONNREFUSED;
							Module.websocket.emit( 'error', [
								sock.stream.fd,
								sock.error,
								'ECONNREFUSED: Connection refused',
							] );
						} );
					} else {
						peer.socket.onopen = handleOpen;
						peer.socket.onclose = function() {
							Module.websocket.emit( 'close', sock.stream.fd );
						};
						peer.socket.onmessage = function peer_socket_onmessage( event ) {
							handleMessage( event.data );
						};
						peer.socket.onerror = function( error ) {
							sock.error = ERRNO_CODES.ECONNREFUSED;
							Module.websocket.emit( 'error', [
								sock.stream.fd,
								sock.error,
								'ECONNREFUSED: Connection refused',
							] );
						};
					}
				},
				poll( sock ) {
					if ( sock.type === 1 && sock.server ) {
						return sock.pending.length ? 64 | 1 : 0;
					}
					let mask = 0;
					const dest =
            sock.type === 1
            	? SOCKFS.websocket_sock_ops.getPeer( sock, sock.daddr, sock.dport )
            	: null;
					if (
						sock.recv_queue.length ||
            ! dest ||
            ( dest && dest.socket.readyState === dest.socket.CLOSING ) ||
            ( dest && dest.socket.readyState === dest.socket.CLOSED )
					) {
						mask |= 64 | 1;
					}
					if ( ! dest || ( dest && dest.socket.readyState === dest.socket.OPEN ) ) {
						mask |= 4;
					}
					if (
						( dest && dest.socket.readyState === dest.socket.CLOSING ) ||
            ( dest && dest.socket.readyState === dest.socket.CLOSED )
					) {
						mask |= 16;
					}
					return mask;
				},
				ioctl( sock, request, arg ) {
					switch ( request ) {
						case 21531:
							var bytes = 0;
							if ( sock.recv_queue.length ) {
								bytes = sock.recv_queue[ 0 ].data.length;
							}
							HEAP32[ arg >> 2 ] = bytes;
							return 0;
						default:
							return ERRNO_CODES.EINVAL;
					}
				},
				close( sock ) {
					if ( sock.server ) {
						try {
							sock.server.close();
						} catch ( e ) {}
						sock.server = null;
					}
					const peers = Object.keys( sock.peers );
					for ( let i = 0; i < peers.length; i++ ) {
						const peer = sock.peers[ peers[ i ] ];
						try {
							peer.socket.close();
						} catch ( e ) {}
						SOCKFS.websocket_sock_ops.removePeer( sock, peer );
					}
					return 0;
				},
				bind( sock, addr, port ) {
					if (
						typeof sock.saddr !== 'undefined' ||
            typeof sock.sport !== 'undefined'
					) {
						throw new FS.ErrnoError( ERRNO_CODES.EINVAL );
					}
					sock.saddr = addr;
					sock.sport = port;
					if ( sock.type === 2 ) {
						if ( sock.server ) {
							sock.server.close();
							sock.server = null;
						}
						try {
							sock.sock_ops.listen( sock, 0 );
						} catch ( e ) {
							if ( ! ( e instanceof FS.ErrnoError ) ) {
								throw e;
							}
							if ( e.errno !== ERRNO_CODES.EOPNOTSUPP ) {
								throw e;
							}
						}
					}
				},
				connect( sock, addr, port ) {
					if ( sock.server ) {
						throw new FS.ErrnoError( ERRNO_CODES.EOPNOTSUPP );
					}
					if (
						typeof sock.daddr !== 'undefined' &&
            typeof sock.dport !== 'undefined'
					) {
						const dest = SOCKFS.websocket_sock_ops.getPeer(
							sock,
							sock.daddr,
							sock.dport,
						);
						if ( dest ) {
							if ( dest.socket.readyState === dest.socket.CONNECTING ) {
								throw new FS.ErrnoError( ERRNO_CODES.EALREADY );
							} else {
								throw new FS.ErrnoError( ERRNO_CODES.EISCONN );
							}
						}
					}
					const peer = SOCKFS.websocket_sock_ops.createPeer( sock, addr, port );
					sock.daddr = peer.addr;
					sock.dport = peer.port;
					throw new FS.ErrnoError( ERRNO_CODES.EINPROGRESS );
				},
				listen( sock, backlog ) {
					if ( ! ENVIRONMENT_IS_NODE ) {
						throw new FS.ErrnoError( ERRNO_CODES.EOPNOTSUPP );
					}
				},
				accept( listensock ) {
					if ( ! listensock.server ) {
						throw new FS.ErrnoError( ERRNO_CODES.EINVAL );
					}
					const newsock = listensock.pending.shift();
					newsock.stream.flags = listensock.stream.flags;
					return newsock;
				},
				getname( sock, peer ) {
					let addr, port;
					if ( peer ) {
						if ( sock.daddr === undefined || sock.dport === undefined ) {
							throw new FS.ErrnoError( ERRNO_CODES.ENOTCONN );
						}
						addr = sock.daddr;
						port = sock.dport;
					} else {
						addr = sock.saddr || 0;
						port = sock.sport || 0;
					}
					return { addr, port };
				},
				sendmsg( sock, buffer, offset, length, addr, port ) {
					if ( sock.type === 2 ) {
						if ( addr === undefined || port === undefined ) {
							addr = sock.daddr;
							port = sock.dport;
						}
						if ( addr === undefined || port === undefined ) {
							throw new FS.ErrnoError( ERRNO_CODES.EDESTADDRREQ );
						}
					} else {
						addr = sock.daddr;
						port = sock.dport;
					}
					let dest = SOCKFS.websocket_sock_ops.getPeer( sock, addr, port );
					if ( sock.type === 1 ) {
						if (
							! dest ||
              dest.socket.readyState === dest.socket.CLOSING ||
              dest.socket.readyState === dest.socket.CLOSED
						) {
							throw new FS.ErrnoError( ERRNO_CODES.ENOTCONN );
						} else if ( dest.socket.readyState === dest.socket.CONNECTING ) {
							throw new FS.ErrnoError( ERRNO_CODES.EAGAIN );
						}
					}
					if ( ArrayBuffer.isView( buffer ) ) {
						offset += buffer.byteOffset;
						buffer = buffer.buffer;
					}
					let data;
					data = buffer.slice( offset, offset + length );
					if ( sock.type === 2 ) {
						if ( ! dest || dest.socket.readyState !== dest.socket.OPEN ) {
							if (
								! dest ||
                dest.socket.readyState === dest.socket.CLOSING ||
                dest.socket.readyState === dest.socket.CLOSED
							) {
								dest = SOCKFS.websocket_sock_ops.createPeer( sock, addr, port );
							}
							dest.dgram_send_queue.push( data );
							return length;
						}
					}
					try {
						dest.socket.send( data );
						return length;
					} catch ( e ) {
						throw new FS.ErrnoError( ERRNO_CODES.EINVAL );
					}
				},
				recvmsg( sock, length ) {
					if ( sock.type === 1 && sock.server ) {
						throw new FS.ErrnoError( ERRNO_CODES.ENOTCONN );
					}
					const queued = sock.recv_queue.shift();
					if ( ! queued ) {
						if ( sock.type === 1 ) {
							const dest = SOCKFS.websocket_sock_ops.getPeer(
								sock,
								sock.daddr,
								sock.dport,
							);
							if ( ! dest ) {
								throw new FS.ErrnoError( ERRNO_CODES.ENOTCONN );
							} else if (
								dest.socket.readyState === dest.socket.CLOSING ||
                dest.socket.readyState === dest.socket.CLOSED
							) {
								return null;
							} else {
								throw new FS.ErrnoError( ERRNO_CODES.EAGAIN );
							}
						} else {
							throw new FS.ErrnoError( ERRNO_CODES.EAGAIN );
						}
					}
					const queuedLength = queued.data.byteLength || queued.data.length;
					const queuedOffset = queued.data.byteOffset || 0;
					const queuedBuffer = queued.data.buffer || queued.data;
					const bytesRead = Math.min( length, queuedLength );
					const res = {
						buffer: new Uint8Array( queuedBuffer, queuedOffset, bytesRead ),
						addr: queued.addr,
						port: queued.port,
					};
					if ( sock.type === 1 && bytesRead < queuedLength ) {
						const bytesRemaining = queuedLength - bytesRead;
						queued.data = new Uint8Array(
							queuedBuffer,
							queuedOffset + bytesRead,
							bytesRemaining,
						);
						sock.recv_queue.unshift( queued );
					}
					return res;
				},
			},
		};
		function __inet_pton4_raw( str ) {
			const b = str.split( '.' );
			for ( let i = 0; i < 4; i++ ) {
				const tmp = Number( b[ i ] );
				if ( isNaN( tmp ) ) {
					return null;
				}
				b[ i ] = tmp;
			}
			return ( b[ 0 ] | ( b[ 1 ] << 8 ) | ( b[ 2 ] << 16 ) | ( b[ 3 ] << 24 ) ) >>> 0;
		}
		function jstoi_q( str ) {
			return parseInt( str );
		}
		function __inet_pton6_raw( str ) {
			let words;
			let w, offset, z;
			const valid6regx =
        /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
			const parts = [];
			if ( ! valid6regx.test( str ) ) {
				return null;
			}
			if ( str === '::' ) {
				return [ 0, 0, 0, 0, 0, 0, 0, 0 ];
			}
			if ( str.indexOf( '::' ) === 0 ) {
				str = str.replace( '::', 'Z:' );
			} else {
				str = str.replace( '::', ':Z:' );
			}
			if ( str.indexOf( '.' ) > 0 ) {
				str = str.replace( new RegExp( '[.]', 'g' ), ':' );
				words = str.split( ':' );
				words[ words.length - 4 ] =
          jstoi_q( words[ words.length - 4 ] ) +
          jstoi_q( words[ words.length - 3 ] ) * 256;
				words[ words.length - 3 ] =
          jstoi_q( words[ words.length - 2 ] ) +
          jstoi_q( words[ words.length - 1 ] ) * 256;
				words = words.slice( 0, words.length - 2 );
			} else {
				words = str.split( ':' );
			}
			offset = 0;
			z = 0;
			for ( w = 0; w < words.length; w++ ) {
				if ( typeof words[ w ] === 'string' ) {
					if ( words[ w ] === 'Z' ) {
						for ( z = 0; z < 8 - words.length + 1; z++ ) {
							parts[ w + z ] = 0;
						}
						offset = z - 1;
					} else {
						parts[ w + offset ] = _htons( parseInt( words[ w ], 16 ) );
					}
				} else {
					parts[ w + offset ] = words[ w ];
				}
			}
			return [
				( parts[ 1 ] << 16 ) | parts[ 0 ],
				( parts[ 3 ] << 16 ) | parts[ 2 ],
				( parts[ 5 ] << 16 ) | parts[ 4 ],
				( parts[ 7 ] << 16 ) | parts[ 6 ],
			];
		}
		var DNS = {
			address_map: { id: 1, addrs: {}, names: {} },
			lookup_name( name ) {
				let res = __inet_pton4_raw( name );
				if ( res !== null ) {
					return name;
				}
				res = __inet_pton6_raw( name );
				if ( res !== null ) {
					return name;
				}
				let addr;
				if ( DNS.address_map.addrs[ name ] ) {
					addr = DNS.address_map.addrs[ name ];
				} else {
					const id = DNS.address_map.id++;
					assert( id < 65535, 'exceeded max address mappings of 65535' );
					addr = '172.29.' + ( id & 255 ) + '.' + ( id & 65280 );
					DNS.address_map.names[ addr ] = name;
					DNS.address_map.addrs[ name ] = addr;
				}
				return addr;
			},
			lookup_addr( addr ) {
				if ( DNS.address_map.names[ addr ] ) {
					return DNS.address_map.names[ addr ];
				}
				return null;
			},
		};
		var PIPEFS = {
			BUCKET_BUFFER_SIZE: 8192,
			mount( mount ) {
				return FS.createNode( null, '/', 16384 | 511, 0 );
			},
			createPipe() {
				const pipe = { buckets: [] };
				pipe.buckets.push( {
					buffer: new Uint8Array( PIPEFS.BUCKET_BUFFER_SIZE ),
					offset: 0,
					roffset: 0,
				} );
				const rName = PIPEFS.nextname();
				const wName = PIPEFS.nextname();
				const rNode = FS.createNode( PIPEFS.root, rName, 4096, 0 );
				const wNode = FS.createNode( PIPEFS.root, wName, 4096, 0 );
				rNode.pipe = pipe;
				wNode.pipe = pipe;
				const readableStream = FS.createStream( {
					path: rName,
					node: rNode,
					flags: FS.modeStringToFlags( 'r' ),
					seekable: false,
					stream_ops: PIPEFS.stream_ops,
				} );
				rNode.stream = readableStream;
				const writableStream = FS.createStream( {
					path: wName,
					node: wNode,
					flags: FS.modeStringToFlags( 'w' ),
					seekable: false,
					stream_ops: PIPEFS.stream_ops,
				} );
				wNode.stream = writableStream;
				return {
					readable_fd: readableStream.fd,
					writable_fd: writableStream.fd,
				};
			},
			stream_ops: {
				poll( stream ) {
					const pipe = stream.node.pipe;
					if ( ( stream.flags & 2097155 ) === 1 ) {
						return 256 | 4;
					}
					if ( pipe.buckets.length > 0 ) {
						for ( let i = 0; i < pipe.buckets.length; i++ ) {
							const bucket = pipe.buckets[ i ];
							if ( bucket.offset - bucket.roffset > 0 ) {
								return 64 | 1;
							}
						}
					}
					return 0;
				},
				ioctl( stream, request, varargs ) {
					return ERRNO_CODES.EINVAL;
				},
				fsync( stream ) {
					return ERRNO_CODES.EINVAL;
				},
				read( stream, buffer, offset, length, position ) {
					const pipe = stream.node.pipe;
					let currentLength = 0;
					for ( var i = 0; i < pipe.buckets.length; i++ ) {
						const bucket = pipe.buckets[ i ];
						currentLength += bucket.offset - bucket.roffset;
					}
					assert( buffer instanceof ArrayBuffer || ArrayBuffer.isView( buffer ) );
					let data = buffer.subarray( offset, offset + length );
					if ( length <= 0 ) {
						return 0;
					}
					if ( currentLength == 0 ) {
						throw new FS.ErrnoError( ERRNO_CODES.EAGAIN );
					}
					let toRead = Math.min( currentLength, length );
					const totalRead = toRead;
					let toRemove = 0;
					for ( var i = 0; i < pipe.buckets.length; i++ ) {
						const currBucket = pipe.buckets[ i ];
						const bucketSize = currBucket.offset - currBucket.roffset;
						if ( toRead <= bucketSize ) {
							var tmpSlice = currBucket.buffer.subarray(
								currBucket.roffset,
								currBucket.offset,
							);
							if ( toRead < bucketSize ) {
								tmpSlice = tmpSlice.subarray( 0, toRead );
								currBucket.roffset += toRead;
							} else {
								toRemove++;
							}
							data.set( tmpSlice );
							break;
						} else {
							var tmpSlice = currBucket.buffer.subarray(
								currBucket.roffset,
								currBucket.offset,
							);
							data.set( tmpSlice );
							data = data.subarray( tmpSlice.byteLength );
							toRead -= tmpSlice.byteLength;
							toRemove++;
						}
					}
					if ( toRemove && toRemove == pipe.buckets.length ) {
						toRemove--;
						pipe.buckets[ toRemove ].offset = 0;
						pipe.buckets[ toRemove ].roffset = 0;
					}
					pipe.buckets.splice( 0, toRemove );
					return totalRead;
				},
				write( stream, buffer, offset, length, position ) {
					const pipe = stream.node.pipe;
					assert( buffer instanceof ArrayBuffer || ArrayBuffer.isView( buffer ) );
					let data = buffer.subarray( offset, offset + length );
					const dataLen = data.byteLength;
					if ( dataLen <= 0 ) {
						return 0;
					}
					let currBucket = null;
					if ( pipe.buckets.length == 0 ) {
						currBucket = {
							buffer: new Uint8Array( PIPEFS.BUCKET_BUFFER_SIZE ),
							offset: 0,
							roffset: 0,
						};
						pipe.buckets.push( currBucket );
					} else {
						currBucket = pipe.buckets[ pipe.buckets.length - 1 ];
					}
					assert( currBucket.offset <= PIPEFS.BUCKET_BUFFER_SIZE );
					const freeBytesInCurrBuffer =
            PIPEFS.BUCKET_BUFFER_SIZE - currBucket.offset;
					if ( freeBytesInCurrBuffer >= dataLen ) {
						currBucket.buffer.set( data, currBucket.offset );
						currBucket.offset += dataLen;
						return dataLen;
					} else if ( freeBytesInCurrBuffer > 0 ) {
						currBucket.buffer.set(
							data.subarray( 0, freeBytesInCurrBuffer ),
							currBucket.offset,
						);
						currBucket.offset += freeBytesInCurrBuffer;
						data = data.subarray( freeBytesInCurrBuffer, data.byteLength );
					}
					const numBuckets = ( data.byteLength / PIPEFS.BUCKET_BUFFER_SIZE ) | 0;
					const remElements = data.byteLength % PIPEFS.BUCKET_BUFFER_SIZE;
					for ( let i = 0; i < numBuckets; i++ ) {
						var newBucket = {
							buffer: new Uint8Array( PIPEFS.BUCKET_BUFFER_SIZE ),
							offset: PIPEFS.BUCKET_BUFFER_SIZE,
							roffset: 0,
						};
						pipe.buckets.push( newBucket );
						newBucket.buffer.set( data.subarray( 0, PIPEFS.BUCKET_BUFFER_SIZE ) );
						data = data.subarray( PIPEFS.BUCKET_BUFFER_SIZE, data.byteLength );
					}
					if ( remElements > 0 ) {
						var newBucket = {
							buffer: new Uint8Array( PIPEFS.BUCKET_BUFFER_SIZE ),
							offset: data.byteLength,
							roffset: 0,
						};
						pipe.buckets.push( newBucket );
						newBucket.buffer.set( data );
					}
					return dataLen;
				},
				close( stream ) {
					const pipe = stream.node.pipe;
					pipe.buckets = null;
				},
			},
			nextname() {
				if ( ! PIPEFS.nextname.current ) {
					PIPEFS.nextname.current = 0;
				}
				return 'pipe[' + PIPEFS.nextname.current++ + ']';
			},
		};
		function _usleep( useconds ) {
			const start = _emscripten_get_now();
			while ( _emscripten_get_now() - start < useconds / 1e3 ) {}
		}
		Module._usleep = _usleep;
		const FSNode = function( parent, name, mode, rdev ) {
			if ( ! parent ) {
				parent = this;
			}
			this.parent = parent;
			this.mount = parent.mount;
			this.mounted = null;
			this.id = FS.nextInode++;
			this.name = name;
			this.mode = mode;
			this.node_ops = {};
			this.stream_ops = {};
			this.rdev = rdev;
		};
		const readMode = 292 | 73;
		const writeMode = 146;
		Object.defineProperties( FSNode.prototype, {
			read: {
				get() {
					return ( this.mode & readMode ) === readMode;
				},
				set( val ) {
					val ? ( this.mode |= readMode ) : ( this.mode &= ~readMode );
				},
			},
			write: {
				get() {
					return ( this.mode & writeMode ) === writeMode;
				},
				set( val ) {
					val ? ( this.mode |= writeMode ) : ( this.mode &= ~writeMode );
				},
			},
			isFolder: {
				get() {
					return FS.isDir( this.mode );
				},
			},
			isDevice: {
				get() {
					return FS.isChrdev( this.mode );
				},
			},
		} );
		FS.FSNode = FSNode;
		FS.staticInit();
		Module.FS_createFolder = FS.createFolder;
		Module.FS_createPath = FS.createPath;
		Module.FS_createDataFile = FS.createDataFile;
		Module.FS_createPreloadedFile = FS.createPreloadedFile;
		Module.FS_createLazyFile = FS.createLazyFile;
		Module.FS_createLink = FS.createLink;
		Module.FS_createDevice = FS.createDevice;
		Module.FS_unlink = FS.unlink;
		function intArrayFromString( stringy, dontAddNull, length ) {
			const len = length > 0 ? length : lengthBytesUTF8( stringy ) + 1;
			const u8array = new Array( len );
			const numBytesWritten = stringToUTF8Array(
				stringy,
				u8array,
				0,
				u8array.length,
			);
			if ( dontAddNull ) {
				u8array.length = numBytesWritten;
			}
			return u8array;
		}
		const asmGlobalArg = {};
		var asmLibraryArg = {
			I: noop,
			vb: noop,
			ub: noop,
			tb: noop,
			sb: noop,
			r: noop,
			rb: noop,
			qb: noop,
			pb: noop,
			ob: noop,
			oa: noop,
			nb: noop,
			mb: noop,
			lb: noop,
			kb: noop,
			jb: noop,
			na: noop,
			ib: noop,
			hb: noop,
			gb: noop,
			u: noop,
			y: noop,
			D: noop,
			ma: noop,
			fb: noop,
			eb: noop,
			la: noop,
			db: noop,
			cb: noop,
			q: noop,
			bb: noop,
			ab: noop,
			$a: noop,
			_a: noop,
			Za: noop,
			Ya: noop,
			Xa: noop,
			Wa: noop,
			Va: noop,
			Y: noop,
			ka: noop,
			Ua: noop,
			Ta: noop,
			Sa: noop,
			Ra: noop,
			Qa: noop,
			Pa: noop,
			Oa: noop,
			Na: noop,
			H: noop,
			ja: noop,
			Ma: noop,
			xb: noop,
			La: noop,
			ia: noop,
			G: noop,
			__memory_base: 1024,
			__table_base: 0,
			ha: noop,
			Ka: noop,
			Ja: noop,
			Ia: noop,
			Ha: noop,
			A: noop,
			t: noop,
			F: noop,
			w: noop,
			C: noop,
			Fa: noop,
			B: noop,
			Ea: noop,
			Da: noop,
			Ca: noop,
			E: noop,
			ga: noop,
			Ba: noop,
			fa: noop,
			za: noop,
			ya: noop,
			n: noop,
			ea: noop,
			da: noop,
			ca: noop,
			xa: noop,
			wa: noop,
			va: noop,
			ba: noop,
			Fb: noop,
			l: noop,
			N: noop,
			ua: noop,
			wb: noop,
			X: noop,
			Eb: noop,
			W: noop,
			aa: noop,
			ta: noop,
			M: noop,
			b: noop,
			$: noop,
			V: noop,
			L: noop,
			U: noop,
			m: noop,
			Db: noop,
			Cb: noop,
			Bb: noop,
			z: noop,
			T: noop,
			sa: noop,
			K: noop,
			k: noop,
			S: noop,
			s: noop,
			J: noop,
			Ab: noop,
			zb: noop,
			R: noop,
			_: noop,
			yb: noop,
			Q: noop,
			e: noop,
			Z: noop,
			ra: noop,
			qa: noop,
			P: noop,
			pa: noop,
			h: noop,
			a: noop,
			O: noop,
			f: noop,
			j: noop,
			g: noop,
			x: noop,
			Ga: noop,
			Aa: noop,
			Gb: noop,
			i: noop,
			d: noop,
			o: noop,
			v: noop,
			p: noop,
			memory: wasmMemory,
			c: noop,
			table: wasmTable,
		};
		// Here's where WASM is being loaded – do not remove this line!
		Module.asm( asmGlobalArg, asmLibraryArg, buffer );

		Module.ccall = () => {};
		Module.getMemory = getMemory;
		Module.UTF8ToString = UTF8ToString;
		Module.lengthBytesUTF8 = lengthBytesUTF8;
		Module.addRunDependency = addRunDependency;
		Module.removeRunDependency = removeRunDependency;
		Module.FS_createFolder = FS.createFolder;
		Module.FS_createPath = FS.createPath;
		Module.FS_createDataFile = FS.createDataFile;
		Module.FS_createPreloadedFile = FS.createPreloadedFile;
		Module.FS_createLazyFile = FS.createLazyFile;
		Module.FS_createLink = FS.createLink;
		Module.FS_createDevice = FS.createDevice;
		Module.FS_unlink = FS.unlink;
		Module.FS = FS;
		let calledRun;
		dependenciesFulfilled = function runCaller() {
			if ( ! calledRun ) {
				dependenciesFulfilled = runCaller;
			}
		};
		Module.run = function(){};
		return PHP.ready;
	};
}() );
if ( typeof exports === 'object' && typeof module === 'object' ) {
	module.exports = PHP;
} else if ( typeof define === 'function' && define.amd ) {
	define( [], function() {
		return PHP;
	} );
} else if ( typeof exports === 'object' ) {
	exports.PHP = PHP;
}
