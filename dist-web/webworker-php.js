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
		__ATINIT__.push( {
			func() {
				___emscripten_environ_constructor();
			},
		} );
		let _emscripten_get_now;
		_emscripten_get_now = function() {
			return performance.now();
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
		function _usleep( useconds ) {
			const start = _emscripten_get_now();
			while ( _emscripten_get_now() - start < useconds / 1e3 ) {}
		}
		Module._usleep = _usleep;
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
