const PHP = ( function() {
	const _scriptDir =
    typeof document !== 'undefined' && document.currentScript
    	? document.currentScript.src
    	: undefined;

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
		let read_, readAsync, readBinary, setWindowTitle;
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
		function getNativeTypeSize( type ) {
			switch ( type ) {
				case 'i1':
				case 'i8':
					return 1;
				case 'i16':
					return 2;
				case 'i32':
					return 4;
				case 'i64':
					return 8;
				case 'float':
					return 4;
				case 'double':
					return 8;
				default: {
					if ( type[ type.length - 1 ] === '*' ) {
						return 4;
					} else if ( type[ 0 ] === 'i' ) {
						const bits = Number( type.substr( 1 ) );
						assert(
							bits % 8 === 0,
							'getNativeTypeSize invalid bits ' + bits + ', type ' + type,
						);
						return bits / 8;
					}
					return 0;
				}
			}
		}
		const asm2wasmImports = {
			'f64-rem'( x, y ) {
				return x % y;
			},
			debugger() {},
		};
		let tempRet0 = 0;
		const setTempRet0 = function( value ) {
			tempRet0 = value;
		};
		const getTempRet0 = function() {
			return tempRet0;
		};
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
		function setValue( ptr, value, type, noSafe ) {
			type = type || 'i8';
			if ( type.charAt( type.length - 1 ) === '*' ) {
				type = 'i32';
			}
			switch ( type ) {
				case 'i1':
					HEAP8[ ptr >> 0 ] = value;
					break;
				case 'i8':
					HEAP8[ ptr >> 0 ] = value;
					break;
				case 'i16':
					HEAP16[ ptr >> 1 ] = value;
					break;
				case 'i32':
					HEAP32[ ptr >> 2 ] = value;
					break;
				case 'i64':
					( tempI64 = [
						value >>> 0,
						( ( tempDouble = value ),
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
					( HEAP32[ ptr >> 2 ] = tempI64[ 0 ] ),
					( HEAP32[ ( ptr + 4 ) >> 2 ] = tempI64[ 1 ] );
					break;
				case 'float':
					HEAPF32[ ptr >> 2 ] = value;
					break;
				case 'double':
					HEAPF64[ ptr >> 3 ] = value;
					break;
				default:
					abort( 'invalid type for setValue: ' + type );
			}
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
		const ALLOC_STACK = 1;
		const ALLOC_NONE = 3;
		function allocate( slab, types, allocator, ptr ) {
			let zeroinit, size;
			if ( typeof slab === 'number' ) {
				zeroinit = true;
				size = slab;
			} else {
				zeroinit = false;
				size = slab.length;
			}
			const singleType = typeof types === 'string' ? types : null;
			let ret;
			if ( allocator == ALLOC_NONE ) {
				ret = ptr;
			} else {
				ret = [ _malloc, stackAlloc, dynamicAlloc ][ allocator ](
					Math.max( size, singleType ? 1 : types.length ),
				);
			}
			if ( zeroinit ) {
				let stop;
				ptr = ret;
				assert( ( ret & 3 ) == 0 );
				stop = ret + ( size & ~3 );
				for ( ; ptr < stop; ptr += 4 ) {
					HEAP32[ ptr >> 2 ] = 0;
				}
				stop = ret + size;
				while ( ptr < stop ) {
					HEAP8[ ptr++ >> 0 ] = 0;
				}
				return ret;
			}
			if ( singleType === 'i8' ) {
				if ( slab.subarray || slab.slice ) {
					HEAPU8.set( slab, ret );
				} else {
					HEAPU8.set( new Uint8Array( slab ), ret );
				}
				return ret;
			}
			let i = 0,
				type,
				typeSize,
				previousType;
			while ( i < size ) {
				const curr = slab[ i ];
				type = singleType || types[ i ];
				if ( type === 0 ) {
					i++;
					continue;
				}
				if ( type == 'i64' ) {
					type = 'i32';
				}
				setValue( ret + i, curr, type );
				if ( previousType !== type ) {
					typeSize = getNativeTypeSize( type );
					previousType = type;
				}
				i += typeSize;
			}
			return ret;
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
		function allocateUTF8( str ) {
			const size = lengthBytesUTF8( str ) + 1;
			const ret = _malloc( size );
			if ( ret ) {
				stringToUTF8Array( str, HEAP8, ret, size );
			}
			return ret;
		}
		function writeArrayToMemory( array, buffer ) {
			HEAP8.set( array, buffer );
		}
		function writeAsciiToMemory( str, buffer, dontAddNull ) {
			for ( let i = 0; i < str.length; ++i ) {
				HEAP8[ buffer++ >> 0 ] = str.charCodeAt( i );
			}
			if ( ! dontAddNull ) {
				HEAP8[ buffer >> 0 ] = 0;
			}
		}
		const WASM_PAGE_SIZE = 65536;
		function alignUp( x, multiple ) {
			if ( x % multiple > 0 ) {
				x += multiple - ( x % multiple );
			}
			return x;
		}
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
		let runtimeExited = false;
		function exitRuntime() {
			runtimeExited = true;
		}
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
				wasi_snapshot_preview1: asmLibraryArg,
				global: { NaN, Infinity },
				'global.Math': Math,
				asm2wasm: asm2wasmImports,
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
		function ___assert_fail( condition, filename, line, func ) {
			abort(
				'Assertion failed: ' +
          UTF8ToString( condition ) +
          ', at: ' +
          [
          	filename ? UTF8ToString( filename ) : 'unknown filename',
          	line,
          	func ? UTF8ToString( func ) : 'unknown function',
          ],
			);
		}
		const ENV = {};
		function __getExecutableName() {
			return thisProgram || './this.program';
		}
		function ___buildEnvironment( environ ) {
			const MAX_ENV_VALUES = 64;
			const TOTAL_ENV_SIZE = 1024;
			let poolPtr;
			let envPtr;
			if ( ! ___buildEnvironment.called ) {
				___buildEnvironment.called = true;
				ENV.USER = 'web_user';
				ENV.LOGNAME = 'web_user';
				ENV.PATH = '/';
				ENV.PWD = '/';
				ENV.HOME = '/home/web_user';
				ENV.LANG =
          (
          	( typeof navigator === 'object' &&
              navigator.languages &&
              navigator.languages[ 0 ] ) ||
            'C'
          ).replace( '-', '_' ) + '.UTF-8';
				ENV._ = __getExecutableName();
				poolPtr = getMemory( TOTAL_ENV_SIZE );
				envPtr = getMemory( MAX_ENV_VALUES * 4 );
				HEAP32[ envPtr >> 2 ] = poolPtr;
				HEAP32[ environ >> 2 ] = envPtr;
			} else {
				envPtr = HEAP32[ environ >> 2 ];
				poolPtr = HEAP32[ envPtr >> 2 ];
			}
			const strings = [];
			let totalSize = 0;
			for ( const key in ENV ) {
				if ( typeof ENV[ key ] === 'string' ) {
					var line = key + '=' + ENV[ key ];
					strings.push( line );
					totalSize += line.length;
				}
			}
			if ( totalSize > TOTAL_ENV_SIZE ) {
				throw new Error( 'Environment size exceeded TOTAL_ENV_SIZE!' );
			}
			const ptrSize = 4;
			for ( let i = 0; i < strings.length; i++ ) {
				var line = strings[ i ];
				writeAsciiToMemory( line, poolPtr );
				HEAP32[ ( envPtr + i * ptrSize ) >> 2 ] = poolPtr;
				poolPtr += line.length + 1;
			}
			HEAP32[ ( envPtr + strings.length * ptrSize ) >> 2 ] = 0;
		}
		let _emscripten_get_now;
		_emscripten_get_now = function() {
			return performance.now();
		};
		const _emscripten_get_now_is_monotonic = true;
		function setErrNo( value ) {
			HEAP32[ ___errno_location() >> 2 ] = value;
			return value;
		}
		function _clock_gettime( clk_id, tp ) {
			let now;
			if ( clk_id === 0 ) {
				now = Date.now();
			} else if (
				( clk_id === 1 || clk_id === 4 ) &&
        _emscripten_get_now_is_monotonic
			) {
				now = _emscripten_get_now();
			} else {
				setErrNo( 28 );
				return -1;
			}
			HEAP32[ tp >> 2 ] = ( now / 1e3 ) | 0;
			HEAP32[ ( tp + 4 ) >> 2 ] = ( ( now % 1e3 ) * 1e3 * 1e3 ) | 0;
			return 0;
		}
		function ___clock_gettime( a0, a1 ) {
			return _clock_gettime( a0, a1 );
		}
		function ___map_file( pathname, size ) {
			setErrNo( 63 );
			return -1;
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
		function ___sys_unlink( path ) {
			try {
				path = SYSCALLS.getStr( path );
				FS.unlink( path );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall10( a0 ) {
			return ___sys_unlink( a0 );
		}
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
		function __inet_ntop4_raw( addr ) {
			return (
				( addr & 255 ) +
        '.' +
        ( ( addr >> 8 ) & 255 ) +
        '.' +
        ( ( addr >> 16 ) & 255 ) +
        '.' +
        ( ( addr >> 24 ) & 255 )
			);
		}
		function __inet_ntop6_raw( ints ) {
			let str = '';
			let word = 0;
			let longest = 0;
			let lastzero = 0;
			let zstart = 0;
			let len = 0;
			let i = 0;
			const parts = [
				ints[ 0 ] & 65535,
				ints[ 0 ] >> 16,
				ints[ 1 ] & 65535,
				ints[ 1 ] >> 16,
				ints[ 2 ] & 65535,
				ints[ 2 ] >> 16,
				ints[ 3 ] & 65535,
				ints[ 3 ] >> 16,
			];
			let hasipv4 = true;
			let v4part = '';
			for ( i = 0; i < 5; i++ ) {
				if ( parts[ i ] !== 0 ) {
					hasipv4 = false;
					break;
				}
			}
			if ( hasipv4 ) {
				v4part = __inet_ntop4_raw( parts[ 6 ] | ( parts[ 7 ] << 16 ) );
				if ( parts[ 5 ] === -1 ) {
					str = '::ffff:';
					str += v4part;
					return str;
				}
				if ( parts[ 5 ] === 0 ) {
					str = '::';
					if ( v4part === '0.0.0.0' ) {
						v4part = '';
					}
					if ( v4part === '0.0.0.1' ) {
						v4part = '1';
					}
					str += v4part;
					return str;
				}
			}
			for ( word = 0; word < 8; word++ ) {
				if ( parts[ word ] === 0 ) {
					if ( word - lastzero > 1 ) {
						len = 0;
					}
					lastzero = word;
					len++;
				}
				if ( len > longest ) {
					longest = len;
					zstart = word - longest + 1;
				}
			}
			for ( word = 0; word < 8; word++ ) {
				if ( longest > 1 ) {
					if ( parts[ word ] === 0 && word >= zstart && word < zstart + longest ) {
						if ( word === zstart ) {
							str += ':';
							if ( zstart === 0 ) {
								str += ':';
							}
						}
						continue;
					}
				}
				str += Number( _ntohs( parts[ word ] & 65535 ) ).toString( 16 );
				str += word < 7 ? ':' : '';
			}
			return str;
		}
		function __read_sockaddr( sa, salen ) {
			const family = HEAP16[ sa >> 1 ];
			const port = _ntohs( HEAPU16[ ( sa + 2 ) >> 1 ] );
			let addr;
			switch ( family ) {
				case 2:
					if ( salen !== 16 ) {
						return { errno: 28 };
					}
					addr = HEAP32[ ( sa + 4 ) >> 2 ];
					addr = __inet_ntop4_raw( addr );
					break;
				case 10:
					if ( salen !== 28 ) {
						return { errno: 28 };
					}
					addr = [
						HEAP32[ ( sa + 8 ) >> 2 ],
						HEAP32[ ( sa + 12 ) >> 2 ],
						HEAP32[ ( sa + 16 ) >> 2 ],
						HEAP32[ ( sa + 20 ) >> 2 ],
					];
					addr = __inet_ntop6_raw( addr );
					break;
				default:
					return { errno: 5 };
			}
			return { family, addr, port };
		}
		function __write_sockaddr( sa, family, addr, port ) {
			switch ( family ) {
				case 2:
					addr = __inet_pton4_raw( addr );
					HEAP16[ sa >> 1 ] = family;
					HEAP32[ ( sa + 4 ) >> 2 ] = addr;
					HEAP16[ ( sa + 2 ) >> 1 ] = _htons( port );
					break;
				case 10:
					addr = __inet_pton6_raw( addr );
					HEAP32[ sa >> 2 ] = family;
					HEAP32[ ( sa + 8 ) >> 2 ] = addr[ 0 ];
					HEAP32[ ( sa + 12 ) >> 2 ] = addr[ 1 ];
					HEAP32[ ( sa + 16 ) >> 2 ] = addr[ 2 ];
					HEAP32[ ( sa + 20 ) >> 2 ] = addr[ 3 ];
					HEAP16[ ( sa + 2 ) >> 1 ] = _htons( port );
					HEAP32[ ( sa + 4 ) >> 2 ] = 0;
					HEAP32[ ( sa + 24 ) >> 2 ] = 0;
					break;
				default:
					return { errno: 5 };
			}
			return {};
		}
		function ___sys_socketcall( call, socketvararg ) {
			try {
				SYSCALLS.varargs = socketvararg;
				const getSocketFromFD = function() {
					const socket = SOCKFS.getSocket( SYSCALLS.get() );
					if ( ! socket ) {
						throw new FS.ErrnoError( 8 );
					}
					return socket;
				};
				const getSocketAddress = function( allowNull ) {
					const addrp = SYSCALLS.get(),
						addrlen = SYSCALLS.get();
					if ( allowNull && addrp === 0 ) {
						return null;
					}
					const info = __read_sockaddr( addrp, addrlen );
					if ( info.errno ) {
						throw new FS.ErrnoError( info.errno );
					}
					info.addr = DNS.lookup_addr( info.addr ) || info.addr;
					return info;
				};
				switch ( call ) {
					case 1: {
						const domain = SYSCALLS.get(),
							type = SYSCALLS.get(),
							protocol = SYSCALLS.get();
						var sock = SOCKFS.createSocket( domain, type, protocol );
						return sock.stream.fd;
					}
					case 2: {
						var sock = getSocketFromFD(),
							info = getSocketAddress();
						sock.sock_ops.bind( sock, info.addr, info.port );
						return 0;
					}
					case 3: {
						var sock = getSocketFromFD(),
							info = getSocketAddress();
						sock.sock_ops.connect( sock, info.addr, info.port );
						return 0;
					}
					case 4: {
						var sock = getSocketFromFD(),
							backlog = SYSCALLS.get();
						sock.sock_ops.listen( sock, backlog );
						return 0;
					}
					case 5: {
						var sock = getSocketFromFD(),
							addr = SYSCALLS.get(),
							addrlen = SYSCALLS.get();
						const newsock = sock.sock_ops.accept( sock );
						if ( addr ) {
							var res = __write_sockaddr(
								addr,
								newsock.family,
								DNS.lookup_name( newsock.daddr ),
								newsock.dport,
							);
						}
						return newsock.stream.fd;
					}
					case 6: {
						var sock = getSocketFromFD(),
							addr = SYSCALLS.get(),
							addrlen = SYSCALLS.get();
						var res = __write_sockaddr(
							addr,
							sock.family,
							DNS.lookup_name( sock.saddr || '0.0.0.0' ),
							sock.sport,
						);
						return 0;
					}
					case 7: {
						var sock = getSocketFromFD(),
							addr = SYSCALLS.get(),
							addrlen = SYSCALLS.get();
						if ( ! sock.daddr ) {
							return -53;
						}
						var res = __write_sockaddr(
							addr,
							sock.family,
							DNS.lookup_name( sock.daddr ),
							sock.dport,
						);
						return 0;
					}
					case 11: {
						var sock = getSocketFromFD(),
							message = SYSCALLS.get(),
							length = SYSCALLS.get(),
							flags = SYSCALLS.get(),
							dest = getSocketAddress( true );
						if ( ! dest ) {
							return FS.write( sock.stream, HEAP8, message, length );
						}
						return sock.sock_ops.sendmsg(
							sock,
							HEAP8,
							message,
							length,
							dest.addr,
							dest.port,
						);
					}
					case 12: {
						var sock = getSocketFromFD(),
							buf = SYSCALLS.get(),
							len = SYSCALLS.get(),
							flags = SYSCALLS.get(),
							addr = SYSCALLS.get(),
							addrlen = SYSCALLS.get();
						var msg = sock.sock_ops.recvmsg( sock, len );
						if ( ! msg ) {
							return 0;
						}
						if ( addr ) {
							var res = __write_sockaddr(
								addr,
								sock.family,
								DNS.lookup_name( msg.addr ),
								msg.port,
							);
						}
						HEAPU8.set( msg.buffer, buf );
						return msg.buffer.byteLength;
					}
					case 14: {
						return -50;
					}
					case 15: {
						var sock = getSocketFromFD(),
							level = SYSCALLS.get(),
							optname = SYSCALLS.get(),
							optval = SYSCALLS.get(),
							optlen = SYSCALLS.get();
						if ( level === 1 ) {
							if ( optname === 4 ) {
								HEAP32[ optval >> 2 ] = sock.error;
								HEAP32[ optlen >> 2 ] = 4;
								sock.error = null;
								return 0;
							}
						}
						return -50;
					}
					case 16: {
						var sock = getSocketFromFD(),
							message = SYSCALLS.get(),
							flags = SYSCALLS.get();
						var iov = HEAP32[ ( message + 8 ) >> 2 ];
						var num = HEAP32[ ( message + 12 ) >> 2 ];
						var addr, port;
						var name = HEAP32[ message >> 2 ];
						const namelen = HEAP32[ ( message + 4 ) >> 2 ];
						if ( name ) {
							var info = __read_sockaddr( name, namelen );
							if ( info.errno ) {
								return -info.errno;
							}
							port = info.port;
							addr = DNS.lookup_addr( info.addr ) || info.addr;
						}
						var total = 0;
						for ( var i = 0; i < num; i++ ) {
							total += HEAP32[ ( iov + ( 8 * i + 4 ) ) >> 2 ];
						}
						const view = new Uint8Array( total );
						let offset = 0;
						for ( var i = 0; i < num; i++ ) {
							var iovbase = HEAP32[ ( iov + ( 8 * i + 0 ) ) >> 2 ];
							var iovlen = HEAP32[ ( iov + ( 8 * i + 4 ) ) >> 2 ];
							for ( let j = 0; j < iovlen; j++ ) {
								view[ offset++ ] = HEAP8[ ( iovbase + j ) >> 0 ];
							}
						}
						return sock.sock_ops.sendmsg( sock, view, 0, total, addr, port );
					}
					case 17: {
						var sock = getSocketFromFD(),
							message = SYSCALLS.get(),
							flags = SYSCALLS.get();
						var iov = HEAP32[ ( message + 8 ) >> 2 ];
						var num = HEAP32[ ( message + 12 ) >> 2 ];
						var total = 0;
						for ( var i = 0; i < num; i++ ) {
							total += HEAP32[ ( iov + ( 8 * i + 4 ) ) >> 2 ];
						}
						var msg = sock.sock_ops.recvmsg( sock, total );
						if ( ! msg ) {
							return 0;
						}
						var name = HEAP32[ message >> 2 ];
						if ( name ) {
							var res = __write_sockaddr(
								name,
								sock.family,
								DNS.lookup_name( msg.addr ),
								msg.port,
							);
						}
						let bytesRead = 0;
						let bytesRemaining = msg.buffer.byteLength;
						for ( var i = 0; bytesRemaining > 0 && i < num; i++ ) {
							var iovbase = HEAP32[ ( iov + ( 8 * i + 0 ) ) >> 2 ];
							var iovlen = HEAP32[ ( iov + ( 8 * i + 4 ) ) >> 2 ];
							if ( ! iovlen ) {
								continue;
							}
							var length = Math.min( iovlen, bytesRemaining );
							var buf = msg.buffer.subarray( bytesRead, bytesRead + length );
							HEAPU8.set( buf, iovbase + bytesRead );
							bytesRead += length;
							bytesRemaining -= length;
						}
						return bytesRead;
					}
					default: {
						return -52;
					}
				}
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall102( a0, a1 ) {
			return ___sys_socketcall( a0, a1 );
		}
		function ___sys_wait4( pid, wstart, options, rusage ) {
			try {
				abort( 'cannot wait on child processes' );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall114( a0, a1, a2, a3 ) {
			return ___sys_wait4( a0, a1, a2, a3 );
		}
		function ___sys_chdir( path ) {
			try {
				path = SYSCALLS.getStr( path );
				FS.chdir( path );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall12( a0 ) {
			return ___sys_chdir( a0 );
		}
		function ___sys_uname( buf ) {
			try {
				if ( ! buf ) {
					return -21;
				}
				const layout = {
					__size__: 390,
					sysname: 0,
					nodename: 65,
					release: 130,
					version: 195,
					machine: 260,
					domainname: 325,
				};
				const copyString = function( element, value ) {
					const offset = layout[ element ];
					writeAsciiToMemory( value, buf + offset );
				};
				copyString( 'sysname', 'Emscripten' );
				copyString( 'nodename', 'emscripten' );
				copyString( 'release', '1.0' );
				copyString( 'version', '#1' );
				copyString( 'machine', 'x86-JS' );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall122( a0 ) {
			return ___sys_uname( a0 );
		}
		function ___sys__newselect( nfds, readfds, writefds, exceptfds, timeout ) {
			try {
				let total = 0;
				const srcReadLow = readfds ? HEAP32[ readfds >> 2 ] : 0,
					srcReadHigh = readfds ? HEAP32[ ( readfds + 4 ) >> 2 ] : 0;
				const srcWriteLow = writefds ? HEAP32[ writefds >> 2 ] : 0,
					srcWriteHigh = writefds ? HEAP32[ ( writefds + 4 ) >> 2 ] : 0;
				const srcExceptLow = exceptfds ? HEAP32[ exceptfds >> 2 ] : 0,
					srcExceptHigh = exceptfds ? HEAP32[ ( exceptfds + 4 ) >> 2 ] : 0;
				let dstReadLow = 0,
					dstReadHigh = 0;
				let dstWriteLow = 0,
					dstWriteHigh = 0;
				let dstExceptLow = 0,
					dstExceptHigh = 0;
				const allLow =
          ( readfds ? HEAP32[ readfds >> 2 ] : 0 ) |
          ( writefds ? HEAP32[ writefds >> 2 ] : 0 ) |
          ( exceptfds ? HEAP32[ exceptfds >> 2 ] : 0 );
				const allHigh =
          ( readfds ? HEAP32[ ( readfds + 4 ) >> 2 ] : 0 ) |
          ( writefds ? HEAP32[ ( writefds + 4 ) >> 2 ] : 0 ) |
          ( exceptfds ? HEAP32[ ( exceptfds + 4 ) >> 2 ] : 0 );
				const check = function( fd, low, high, val ) {
					return fd < 32 ? low & val : high & val;
				};
				for ( let fd = 0; fd < nfds; fd++ ) {
					const mask = 1 << fd % 32;
					if ( ! check( fd, allLow, allHigh, mask ) ) {
						continue;
					}
					const stream = FS.getStream( fd );
					if ( ! stream ) {
						throw new FS.ErrnoError( 8 );
					}
					let flags = SYSCALLS.DEFAULT_POLLMASK;
					if ( stream.stream_ops.poll ) {
						flags = stream.stream_ops.poll( stream );
					}
					if ( flags & 1 && check( fd, srcReadLow, srcReadHigh, mask ) ) {
						fd < 32
							? ( dstReadLow = dstReadLow | mask )
							: ( dstReadHigh = dstReadHigh | mask );
						total++;
					}
					if ( flags & 4 && check( fd, srcWriteLow, srcWriteHigh, mask ) ) {
						fd < 32
							? ( dstWriteLow = dstWriteLow | mask )
							: ( dstWriteHigh = dstWriteHigh | mask );
						total++;
					}
					if ( flags & 2 && check( fd, srcExceptLow, srcExceptHigh, mask ) ) {
						fd < 32
							? ( dstExceptLow = dstExceptLow | mask )
							: ( dstExceptHigh = dstExceptHigh | mask );
						total++;
					}
				}
				if ( readfds ) {
					HEAP32[ readfds >> 2 ] = dstReadLow;
					HEAP32[ ( readfds + 4 ) >> 2 ] = dstReadHigh;
				}
				if ( writefds ) {
					HEAP32[ writefds >> 2 ] = dstWriteLow;
					HEAP32[ ( writefds + 4 ) >> 2 ] = dstWriteHigh;
				}
				if ( exceptfds ) {
					HEAP32[ exceptfds >> 2 ] = dstExceptLow;
					HEAP32[ ( exceptfds + 4 ) >> 2 ] = dstExceptHigh;
				}
				return total;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall142( a0, a1, a2, a3, a4 ) {
			return ___sys__newselect( a0, a1, a2, a3, a4 );
		}
		function ___sys_chmod( path, mode ) {
			try {
				path = SYSCALLS.getStr( path );
				FS.chmod( path, mode );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall15( a0, a1 ) {
			return ___sys_chmod( a0, a1 );
		}
		function ___sys_mremap( old_addr, old_size, new_size, flags ) {
			return -48;
		}
		function ___syscall163( a0, a1, a2, a3, a4 ) {
			return ___sys_mremap( a0, a1, a2, a3, a4 );
		}
		function ___sys_poll( fds, nfds, timeout ) {
			try {
				let nonzero = 0;
				for ( let i = 0; i < nfds; i++ ) {
					const pollfd = fds + 8 * i;
					const fd = HEAP32[ pollfd >> 2 ];
					const events = HEAP16[ ( pollfd + 4 ) >> 1 ];
					let mask = 32;
					const stream = FS.getStream( fd );
					if ( stream ) {
						mask = SYSCALLS.DEFAULT_POLLMASK;
						if ( stream.stream_ops.poll ) {
							mask = stream.stream_ops.poll( stream );
						}
					}
					mask &= events | 8 | 16;
					if ( mask ) {
						nonzero++;
					}
					HEAP16[ ( pollfd + 6 ) >> 1 ] = mask;
				}
				return nonzero;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall168( a0, a1, a2 ) {
			return ___sys_poll( a0, a1, a2 );
		}
		function ___sys_getcwd( buf, size ) {
			try {
				if ( size === 0 ) {
					return -28;
				}
				const cwd = FS.cwd();
				const cwdLengthInBytes = lengthBytesUTF8( cwd );
				if ( size < cwdLengthInBytes + 1 ) {
					return -68;
				}
				stringToUTF8( cwd, buf, size );
				return buf;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall183( a0, a1 ) {
			return ___sys_getcwd( a0, a1 );
		}
		function syscallMmap2( addr, len, prot, flags, fd, off ) {
			off <<= 12;
			let ptr;
			let allocated = false;
			if ( ( flags & 16 ) !== 0 && addr % 16384 !== 0 ) {
				return -28;
			}
			if ( ( flags & 32 ) !== 0 ) {
				ptr = _memalign( 16384, len );
				if ( ! ptr ) {
					return -48;
				}
				_memset( ptr, 0, len );
				allocated = true;
			} else {
				const info = FS.getStream( fd );
				if ( ! info ) {
					return -8;
				}
				const res = FS.mmap( info, addr, len, off, prot, flags );
				ptr = res.ptr;
				allocated = res.allocated;
			}
			SYSCALLS.mappings[ ptr ] = {
				malloc: ptr,
				len,
				allocated,
				fd,
				prot,
				flags,
				offset: off,
			};
			return ptr;
		}
		function ___sys_mmap2( addr, len, prot, flags, fd, off ) {
			try {
				return syscallMmap2( addr, len, prot, flags, fd, off );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall192( a0, a1, a2, a3, a4, a5 ) {
			return ___sys_mmap2( a0, a1, a2, a3, a4, a5 );
		}
		function ___sys_ftruncate64( fd, zero, low, high ) {
			try {
				const length = SYSCALLS.get64( low, high );
				FS.ftruncate( fd, length );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall194( a0, a1, a2, a3 ) {
			return ___sys_ftruncate64( a0, a1, a2, a3 );
		}
		function ___sys_stat64( path, buf ) {
			try {
				path = SYSCALLS.getStr( path );
				return SYSCALLS.doStat( FS.stat, path, buf );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall195( a0, a1 ) {
			return ___sys_stat64( a0, a1 );
		}
		function ___sys_lstat64( path, buf ) {
			try {
				path = SYSCALLS.getStr( path );
				return SYSCALLS.doStat( FS.lstat, path, buf );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall196( a0, a1 ) {
			return ___sys_lstat64( a0, a1 );
		}
		function ___sys_fstat64( fd, buf ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				return SYSCALLS.doStat( FS.stat, stream.path, buf );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall197( a0, a1 ) {
			return ___sys_fstat64( a0, a1 );
		}
		function ___sys_lchown32( path, owner, group ) {
			try {
				path = SYSCALLS.getStr( path );
				FS.chown( path, owner, group );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall198( a0, a1, a2 ) {
			return ___sys_lchown32( a0, a1, a2 );
		}
		function ___sys_getegid32() {
			return 0;
		}
		function ___sys_getuid32() {
			return ___sys_getegid32();
		}
		function ___syscall199() {
			return ___sys_getuid32();
		}
		function ___sys_getpid() {
			return 42;
		}
		function ___syscall20() {
			return ___sys_getpid();
		}
		function ___sys_getgid32() {
			return ___sys_getegid32();
		}
		function ___syscall200() {
			return ___sys_getgid32();
		}
		function ___sys_geteuid32() {
			return ___sys_getegid32();
		}
		function ___syscall201() {
			return ___sys_geteuid32();
		}
		function ___sys_getgroups32( size, list ) {
			if ( size < 1 ) {
				return -28;
			}
			HEAP32[ list >> 2 ] = 0;
			return 1;
		}
		function ___syscall205( a0, a1 ) {
			return ___sys_getgroups32( a0, a1 );
		}
		function ___sys_fchown32( fd, owner, group ) {
			try {
				FS.fchown( fd, owner, group );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall207( a0, a1, a2 ) {
			return ___sys_fchown32( a0, a1, a2 );
		}
		function ___sys_chown32( path, owner, group ) {
			try {
				path = SYSCALLS.getStr( path );
				FS.chown( path, owner, group );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall212( a0, a1, a2 ) {
			return ___sys_chown32( a0, a1, a2 );
		}
		function ___sys_madvise1( addr, length, advice ) {
			return 0;
		}
		function ___syscall219( a0, a1, a2 ) {
			return ___sys_madvise1( a0, a1, a2 );
		}
		function ___sys_getdents64( fd, dirp, count ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				if ( ! stream.getdents ) {
					stream.getdents = FS.readdir( stream.path );
				}
				const struct_size = 280;
				let pos = 0;
				const off = FS.llseek( stream, 0, 1 );
				let idx = Math.floor( off / struct_size );
				while ( idx < stream.getdents.length && pos + struct_size <= count ) {
					var id;
					var type;
					const name = stream.getdents[ idx ];
					if ( name[ 0 ] === '.' ) {
						id = 1;
						type = 4;
					} else {
						const child = FS.lookupNode( stream.node, name );
						id = child.id;
						type = FS.isChrdev( child.mode )
							? 2
							: FS.isDir( child.mode )
								? 4
								: FS.isLink( child.mode )
									? 10
									: 8;
					}
					( tempI64 = [
						id >>> 0,
						( ( tempDouble = id ),
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
					( HEAP32[ ( dirp + pos ) >> 2 ] = tempI64[ 0 ] ),
					( HEAP32[ ( dirp + pos + 4 ) >> 2 ] = tempI64[ 1 ] );
					( tempI64 = [
						( ( idx + 1 ) * struct_size ) >>> 0,
						( ( tempDouble = ( idx + 1 ) * struct_size ),
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
					( HEAP32[ ( dirp + pos + 8 ) >> 2 ] = tempI64[ 0 ] ),
					( HEAP32[ ( dirp + pos + 12 ) >> 2 ] = tempI64[ 1 ] );
					HEAP16[ ( dirp + pos + 16 ) >> 1 ] = 280;
					HEAP8[ ( dirp + pos + 18 ) >> 0 ] = type;
					stringToUTF8( name, dirp + pos + 19, 256 );
					pos += struct_size;
					idx += 1;
				}
				FS.llseek( stream, idx * struct_size, 0 );
				return pos;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall220( a0, a1, a2 ) {
			return ___sys_getdents64( a0, a1, a2 );
		}
		function ___sys_fcntl64( fd, cmd, varargs ) {
			SYSCALLS.varargs = varargs;
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				switch ( cmd ) {
					case 0: {
						var arg = SYSCALLS.get();
						if ( arg < 0 ) {
							return -28;
						}
						let newStream;
						newStream = FS.open( stream.path, stream.flags, 0, arg );
						return newStream.fd;
					}
					case 1:
					case 2:
						return 0;
					case 3:
						return stream.flags;
					case 4: {
						var arg = SYSCALLS.get();
						stream.flags |= arg;
						return 0;
					}
					case 12: {
						var arg = SYSCALLS.get();
						const offset = 0;
						HEAP16[ ( arg + offset ) >> 1 ] = 2;
						return 0;
					}
					case 13:
					case 14:
						return 0;
					case 16:
					case 8:
						return -28;
					case 9:
						setErrNo( 28 );
						return -1;
					default: {
						return -28;
					}
				}
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall221( a0, a1, a2 ) {
			return ___sys_fcntl64( a0, a1, a2 );
		}
		function ___sys_statfs64( path, size, buf ) {
			try {
				path = SYSCALLS.getStr( path );
				HEAP32[ ( buf + 4 ) >> 2 ] = 4096;
				HEAP32[ ( buf + 40 ) >> 2 ] = 4096;
				HEAP32[ ( buf + 8 ) >> 2 ] = 1e6;
				HEAP32[ ( buf + 12 ) >> 2 ] = 5e5;
				HEAP32[ ( buf + 16 ) >> 2 ] = 5e5;
				HEAP32[ ( buf + 20 ) >> 2 ] = FS.nextInode;
				HEAP32[ ( buf + 24 ) >> 2 ] = 1e6;
				HEAP32[ ( buf + 28 ) >> 2 ] = 42;
				HEAP32[ ( buf + 44 ) >> 2 ] = 2;
				HEAP32[ ( buf + 36 ) >> 2 ] = 255;
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall268( a0, a1, a2 ) {
			return ___sys_statfs64( a0, a1, a2 );
		}
		function ___sys_read( fd, buf, count ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				return FS.read( stream, HEAP8, buf, count );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall3( a0, a1, a2 ) {
			return ___sys_read( a0, a1, a2 );
		}
		function ___sys_access( path, amode ) {
			try {
				path = SYSCALLS.getStr( path );
				return SYSCALLS.doAccess( path, amode );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall33( a0, a1 ) {
			return ___sys_access( a0, a1 );
		}
		function ___sys_nice( inc ) {
			return -63;
		}
		function ___syscall34( a0 ) {
			return ___sys_nice( a0 );
		}
		function ___sys_rename( old_path, new_path ) {
			try {
				old_path = SYSCALLS.getStr( old_path );
				new_path = SYSCALLS.getStr( new_path );
				FS.rename( old_path, new_path );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall38( a0, a1 ) {
			return ___sys_rename( a0, a1 );
		}
		function ___sys_mkdir( path, mode ) {
			try {
				path = SYSCALLS.getStr( path );
				return SYSCALLS.doMkdir( path, mode );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall39( a0, a1 ) {
			return ___sys_mkdir( a0, a1 );
		}
		function ___sys_rmdir( path ) {
			try {
				path = SYSCALLS.getStr( path );
				FS.rmdir( path );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall40( a0 ) {
			return ___sys_rmdir( a0 );
		}
		function ___sys_dup( fd ) {
			try {
				const old = SYSCALLS.getStreamFromFD( fd );
				return FS.open( old.path, old.flags, 0 ).fd;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall41( a0 ) {
			return ___sys_dup( a0 );
		}
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
		function ___sys_pipe( fdPtr ) {
			try {
				if ( fdPtr == 0 ) {
					throw new FS.ErrnoError( 21 );
				}
				const res = PIPEFS.createPipe();
				HEAP32[ fdPtr >> 2 ] = res.readable_fd;
				HEAP32[ ( fdPtr + 4 ) >> 2 ] = res.writable_fd;
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall42( a0 ) {
			return ___sys_pipe( a0 );
		}
		function ___sys_open( path, flags, varargs ) {
			SYSCALLS.varargs = varargs;
			try {
				const pathname = SYSCALLS.getStr( path );
				const mode = SYSCALLS.get();
				const stream = FS.open( pathname, flags, mode );
				return stream.fd;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall5( a0, a1, a2 ) {
			return ___sys_open( a0, a1, a2 );
		}
		function ___sys_ioctl( fd, op, varargs ) {
			SYSCALLS.varargs = varargs;
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				switch ( op ) {
					case 21509:
					case 21505: {
						if ( ! stream.tty ) {
							return -59;
						}
						return 0;
					}
					case 21510:
					case 21511:
					case 21512:
					case 21506:
					case 21507:
					case 21508: {
						if ( ! stream.tty ) {
							return -59;
						}
						return 0;
					}
					case 21519: {
						if ( ! stream.tty ) {
							return -59;
						}
						var argp = SYSCALLS.get();
						HEAP32[ argp >> 2 ] = 0;
						return 0;
					}
					case 21520: {
						if ( ! stream.tty ) {
							return -59;
						}
						return -28;
					}
					case 21531: {
						var argp = SYSCALLS.get();
						return FS.ioctl( stream, op, argp );
					}
					case 21523: {
						if ( ! stream.tty ) {
							return -59;
						}
						return 0;
					}
					case 21524: {
						if ( ! stream.tty ) {
							return -59;
						}
						return 0;
					}
					default:
						abort( 'bad ioctl syscall ' + op );
				}
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall54( a0, a1, a2 ) {
			return ___sys_ioctl( a0, a1, a2 );
		}
		function ___sys_umask( mask ) {
			try {
				const old = SYSCALLS.umask;
				SYSCALLS.umask = mask;
				return old;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall60( a0 ) {
			return ___sys_umask( a0 );
		}
		function ___sys_dup2( oldfd, suggestFD ) {
			try {
				const old = SYSCALLS.getStreamFromFD( oldfd );
				if ( old.fd === suggestFD ) {
					return suggestFD;
				}
				return SYSCALLS.doDup( old.path, old.flags, suggestFD );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall63( a0, a1 ) {
			return ___sys_dup2( a0, a1 );
		}
		function ___sys_getrusage( who, usage ) {
			try {
				_memset( usage, 0, 136 );
				HEAP32[ usage >> 2 ] = 1;
				HEAP32[ ( usage + 4 ) >> 2 ] = 2;
				HEAP32[ ( usage + 8 ) >> 2 ] = 3;
				HEAP32[ ( usage + 12 ) >> 2 ] = 4;
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall77( a0, a1 ) {
			return ___sys_getrusage( a0, a1 );
		}
		function ___sys_symlink( target, linkpath ) {
			try {
				target = SYSCALLS.getStr( target );
				linkpath = SYSCALLS.getStr( linkpath );
				FS.symlink( target, linkpath );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall83( a0, a1 ) {
			return ___sys_symlink( a0, a1 );
		}
		function ___sys_readlink( path, buf, bufsize ) {
			try {
				path = SYSCALLS.getStr( path );
				return SYSCALLS.doReadlink( path, buf, bufsize );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall85( a0, a1, a2 ) {
			return ___sys_readlink( a0, a1, a2 );
		}
		function ___sys_link( oldpath, newpath ) {
			return -34;
		}
		function ___syscall9( a0, a1 ) {
			return ___sys_link( a0, a1 );
		}
		function syscallMunmap( addr, len ) {
			if ( ( addr | 0 ) === -1 || len === 0 ) {
				return -28;
			}
			const info = SYSCALLS.mappings[ addr ];
			if ( ! info ) {
				return 0;
			}
			if ( len === info.len ) {
				const stream = FS.getStream( info.fd );
				if ( info.prot & 2 ) {
					SYSCALLS.doMsync( addr, stream, len, info.flags, info.offset );
				}
				FS.munmap( stream );
				SYSCALLS.mappings[ addr ] = null;
				if ( info.allocated ) {
					_free( info.malloc );
				}
			}
			return 0;
		}
		function ___sys_munmap( addr, len ) {
			try {
				return syscallMunmap( addr, len );
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall91( a0, a1 ) {
			return ___sys_munmap( a0, a1 );
		}
		function ___sys_fchmod( fd, mode ) {
			try {
				FS.fchmod( fd, mode );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return -e.errno;
			}
		}
		function ___syscall94( a0, a1 ) {
			return ___sys_fchmod( a0, a1 );
		}
		function _fd_close( fd ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				FS.close( stream );
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return e.errno;
			}
		}
		function ___wasi_fd_close( a0 ) {
			return _fd_close( a0 );
		}
		function _fd_fdstat_get( fd, pbuf ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				const type = stream.tty
					? 2
					: FS.isDir( stream.mode )
						? 3
						: FS.isLink( stream.mode )
							? 7
							: 4;
				HEAP8[ pbuf >> 0 ] = type;
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return e.errno;
			}
		}
		function ___wasi_fd_fdstat_get( a0, a1 ) {
			return _fd_fdstat_get( a0, a1 );
		}
		function _fd_read( fd, iov, iovcnt, pnum ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				const num = SYSCALLS.doReadv( stream, iov, iovcnt );
				HEAP32[ pnum >> 2 ] = num;
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return e.errno;
			}
		}
		function ___wasi_fd_read( a0, a1, a2, a3 ) {
			return _fd_read( a0, a1, a2, a3 );
		}
		function _fd_seek( fd, offset_low, offset_high, whence, newOffset ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				const HIGH_OFFSET = 4294967296;
				const offset = offset_high * HIGH_OFFSET + ( offset_low >>> 0 );
				const DOUBLE_LIMIT = 9007199254740992;
				if ( offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT ) {
					return -61;
				}
				FS.llseek( stream, offset, whence );
				( tempI64 = [
					stream.position >>> 0,
					( ( tempDouble = stream.position ),
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
				( HEAP32[ newOffset >> 2 ] = tempI64[ 0 ] ),
				( HEAP32[ ( newOffset + 4 ) >> 2 ] = tempI64[ 1 ] );
				if ( stream.getdents && offset === 0 && whence === 0 ) {
					stream.getdents = null;
				}
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return e.errno;
			}
		}
		function ___wasi_fd_seek( a0, a1, a2, a3, a4 ) {
			return _fd_seek( a0, a1, a2, a3, a4 );
		}
		function _fd_sync( fd ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				if ( stream.stream_ops && stream.stream_ops.fsync ) {
					return -stream.stream_ops.fsync( stream );
				}
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return e.errno;
			}
		}
		function ___wasi_fd_sync( a0 ) {
			return _fd_sync( a0 );
		}
		function _fd_write( fd, iov, iovcnt, pnum ) {
			try {
				const stream = SYSCALLS.getStreamFromFD( fd );
				const num = SYSCALLS.doWritev( stream, iov, iovcnt );
				HEAP32[ pnum >> 2 ] = num;
				return 0;
			} catch ( e ) {
				if ( typeof FS === 'undefined' || ! ( e instanceof FS.ErrnoError ) ) {
					abort( e );
				}
				return e.errno;
			}
		}
		function ___wasi_fd_write( a0, a1, a2, a3 ) {
			return _fd_write( a0, a1, a2, a3 );
		}
		function _exit( status ) {
			exit( status );
		}
		function __exit( a0 ) {
			return _exit( a0 );
		}
		function _abort() {
			abort();
		}
		function _tzset() {
			if ( _tzset.called ) {
				return;
			}
			_tzset.called = true;
			HEAP32[ __get_timezone() >> 2 ] = new Date().getTimezoneOffset() * 60;
			const currentYear = new Date().getFullYear();
			const winter = new Date( currentYear, 0, 1 );
			const summer = new Date( currentYear, 6, 1 );
			HEAP32[ __get_daylight() >> 2 ] = Number(
				winter.getTimezoneOffset() != summer.getTimezoneOffset(),
			);
			function extractZone( date ) {
				const match = date.toTimeString().match( /\(([A-Za-z ]+)\)$/ );
				return match ? match[ 1 ] : 'GMT';
			}
			const winterName = extractZone( winter );
			const summerName = extractZone( summer );
			const winterNamePtr = allocateUTF8( winterName );
			const summerNamePtr = allocateUTF8( summerName );
			if ( summer.getTimezoneOffset() < winter.getTimezoneOffset() ) {
				HEAP32[ __get_tzname() >> 2 ] = winterNamePtr;
				HEAP32[ ( __get_tzname() + 4 ) >> 2 ] = summerNamePtr;
			} else {
				HEAP32[ __get_tzname() >> 2 ] = summerNamePtr;
				HEAP32[ ( __get_tzname() + 4 ) >> 2 ] = winterNamePtr;
			}
		}
		function _mktime( tmPtr ) {
			_tzset();
			const date = new Date(
				HEAP32[ ( tmPtr + 20 ) >> 2 ] + 1900,
				HEAP32[ ( tmPtr + 16 ) >> 2 ],
				HEAP32[ ( tmPtr + 12 ) >> 2 ],
				HEAP32[ ( tmPtr + 8 ) >> 2 ],
				HEAP32[ ( tmPtr + 4 ) >> 2 ],
				HEAP32[ tmPtr >> 2 ],
				0,
			);
			const dst = HEAP32[ ( tmPtr + 32 ) >> 2 ];
			const guessedOffset = date.getTimezoneOffset();
			const start = new Date( date.getFullYear(), 0, 1 );
			const summerOffset = new Date(
				date.getFullYear(),
				6,
				1,
			).getTimezoneOffset();
			const winterOffset = start.getTimezoneOffset();
			const dstOffset = Math.min( winterOffset, summerOffset );
			if ( dst < 0 ) {
				HEAP32[ ( tmPtr + 32 ) >> 2 ] = Number(
					summerOffset != winterOffset && dstOffset == guessedOffset,
				);
			} else if ( dst > 0 != ( dstOffset == guessedOffset ) ) {
				const nonDstOffset = Math.max( winterOffset, summerOffset );
				const trueOffset = dst > 0 ? dstOffset : nonDstOffset;
				date.setTime( date.getTime() + ( trueOffset - guessedOffset ) * 6e4 );
			}
			HEAP32[ ( tmPtr + 24 ) >> 2 ] = date.getDay();
			const yday =
        ( ( date.getTime() - start.getTime() ) / ( 1e3 * 60 * 60 * 24 ) ) | 0;
			HEAP32[ ( tmPtr + 28 ) >> 2 ] = yday;
			return ( date.getTime() / 1e3 ) | 0;
		}
		function _asctime_r( tmPtr, buf ) {
			const date = {
				tm_sec: HEAP32[ tmPtr >> 2 ],
				tm_min: HEAP32[ ( tmPtr + 4 ) >> 2 ],
				tm_hour: HEAP32[ ( tmPtr + 8 ) >> 2 ],
				tm_mday: HEAP32[ ( tmPtr + 12 ) >> 2 ],
				tm_mon: HEAP32[ ( tmPtr + 16 ) >> 2 ],
				tm_year: HEAP32[ ( tmPtr + 20 ) >> 2 ],
				tm_wday: HEAP32[ ( tmPtr + 24 ) >> 2 ],
			};
			const days = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];
			const months = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec',
			];
			const s =
        days[ date.tm_wday ] +
        ' ' +
        months[ date.tm_mon ] +
        ( date.tm_mday < 10 ? '  ' : ' ' ) +
        date.tm_mday +
        ( date.tm_hour < 10 ? ' 0' : ' ' ) +
        date.tm_hour +
        ( date.tm_min < 10 ? ':0' : ':' ) +
        date.tm_min +
        ( date.tm_sec < 10 ? ':0' : ':' ) +
        date.tm_sec +
        ' ' +
        ( 1900 + date.tm_year ) +
        '\n';
			stringToUTF8( s, buf, 26 );
			return buf;
		}
		function _chroot( path ) {
			setErrNo( 2 );
			return -1;
		}
		function _difftime( time1, time0 ) {
			return time1 - time0;
		}
		function _dlclose( handle ) {
			abort(
				"To use dlopen, you need to use Emscripten's linking support, see https://github.com/emscripten-core/emscripten/wiki/Linking",
			);
		}
		function _dlerror() {
			abort(
				"To use dlopen, you need to use Emscripten's linking support, see https://github.com/emscripten-core/emscripten/wiki/Linking",
			);
		}
		function _dlopen( filename, flag ) {
			abort(
				"To use dlopen, you need to use Emscripten's linking support, see https://github.com/emscripten-core/emscripten/wiki/Linking",
			);
		}
		function _dlsym( handle, symbol ) {
			abort(
				"To use dlopen, you need to use Emscripten's linking support, see https://github.com/emscripten-core/emscripten/wiki/Linking",
			);
		}
		function _emscripten_get_heap_size() {
			return HEAPU8.length;
		}
		function emscripten_realloc_buffer( size ) {
			try {
				wasmMemory.grow( ( size - buffer.byteLength + 65535 ) >>> 16 );
				updateGlobalBufferAndViews( wasmMemory.buffer );
				return 1;
			} catch ( e ) {}
		}
		function _emscripten_resize_heap( requestedSize ) {
			requestedSize = requestedSize >>> 0;
			const oldSize = _emscripten_get_heap_size();
			const PAGE_MULTIPLE = 65536;
			const maxHeapSize = 2147483648 - PAGE_MULTIPLE;
			if ( requestedSize > maxHeapSize ) {
				return false;
			}
			const minHeapSize = 16777216;
			for ( let cutDown = 1; cutDown <= 4; cutDown *= 2 ) {
				let overGrownHeapSize = oldSize * ( 1 + 0.2 / cutDown );
				overGrownHeapSize = Math.min(
					overGrownHeapSize,
					requestedSize + 100663296,
				);
				const newSize = Math.min(
					maxHeapSize,
					alignUp(
						Math.max( minHeapSize, requestedSize, overGrownHeapSize ),
						PAGE_MULTIPLE,
					),
				);
				const replacement = emscripten_realloc_buffer( newSize );
				if ( replacement ) {
					return true;
				}
			}
			return false;
		}
		function _execl( path, arg0, varArgs ) {
			setErrNo( 45 );
			return -1;
		}
		function _execle( a0, a1, a2 ) {
			return _execl( a0, a1, a2 );
		}
		function _execvp( a0, a1, a2 ) {
			return _execl( a0, a1, a2 );
		}
		function _flock( fd, operation ) {
			return 0;
		}
		function _fork() {
			setErrNo( 6 );
			return -1;
		}
		const GAI_ERRNO_MESSAGES = {};
		function _gai_strerror( val ) {
			const buflen = 256;
			if ( ! _gai_strerror.buffer ) {
				_gai_strerror.buffer = _malloc( buflen );
				GAI_ERRNO_MESSAGES[ '0' ] = 'Success';
				GAI_ERRNO_MESSAGES[ '' + -1 ] = "Invalid value for 'ai_flags' field";
				GAI_ERRNO_MESSAGES[ '' + -2 ] = 'NAME or SERVICE is unknown';
				GAI_ERRNO_MESSAGES[ '' + -3 ] = 'Temporary failure in name resolution';
				GAI_ERRNO_MESSAGES[ '' + -4 ] = 'Non-recoverable failure in name res';
				GAI_ERRNO_MESSAGES[ '' + -6 ] = "'ai_family' not supported";
				GAI_ERRNO_MESSAGES[ '' + -7 ] = "'ai_socktype' not supported";
				GAI_ERRNO_MESSAGES[ '' + -8 ] = "SERVICE not supported for 'ai_socktype'";
				GAI_ERRNO_MESSAGES[ '' + -10 ] = 'Memory allocation failure';
				GAI_ERRNO_MESSAGES[ '' + -11 ] = "System error returned in 'errno'";
				GAI_ERRNO_MESSAGES[ '' + -12 ] = 'Argument buffer overflow';
			}
			let msg = 'Unknown error';
			if ( val in GAI_ERRNO_MESSAGES ) {
				if ( GAI_ERRNO_MESSAGES[ val ].length > buflen - 1 ) {
					msg = 'Message too long';
				} else {
					msg = GAI_ERRNO_MESSAGES[ val ];
				}
			}
			writeAsciiToMemory( msg, _gai_strerror.buffer );
			return _gai_strerror.buffer;
		}
		function _getaddrinfo( node, service, hint, out ) {
			let addr = 0;
			let port = 0;
			let flags = 0;
			let family = 0;
			let type = 0;
			let proto = 0;
			let ai;
			function allocaddrinfo( family, type, proto, canon, addr, port ) {
				let sa, salen, ai;
				let res;
				salen = family === 10 ? 28 : 16;
				addr = family === 10 ? __inet_ntop6_raw( addr ) : __inet_ntop4_raw( addr );
				sa = _malloc( salen );
				res = __write_sockaddr( sa, family, addr, port );
				assert( ! res.errno );
				ai = _malloc( 32 );
				HEAP32[ ( ai + 4 ) >> 2 ] = family;
				HEAP32[ ( ai + 8 ) >> 2 ] = type;
				HEAP32[ ( ai + 12 ) >> 2 ] = proto;
				HEAP32[ ( ai + 24 ) >> 2 ] = canon;
				HEAP32[ ( ai + 20 ) >> 2 ] = sa;
				if ( family === 10 ) {
					HEAP32[ ( ai + 16 ) >> 2 ] = 28;
				} else {
					HEAP32[ ( ai + 16 ) >> 2 ] = 16;
				}
				HEAP32[ ( ai + 28 ) >> 2 ] = 0;
				return ai;
			}
			if ( hint ) {
				flags = HEAP32[ hint >> 2 ];
				family = HEAP32[ ( hint + 4 ) >> 2 ];
				type = HEAP32[ ( hint + 8 ) >> 2 ];
				proto = HEAP32[ ( hint + 12 ) >> 2 ];
			}
			if ( type && ! proto ) {
				proto = type === 2 ? 17 : 6;
			}
			if ( ! type && proto ) {
				type = proto === 17 ? 2 : 1;
			}
			if ( proto === 0 ) {
				proto = 6;
			}
			if ( type === 0 ) {
				type = 1;
			}
			if ( ! node && ! service ) {
				return -2;
			}
			if ( flags & ~( 1 | 2 | 4 | 1024 | 8 | 16 | 32 ) ) {
				return -1;
			}
			if ( hint !== 0 && HEAP32[ hint >> 2 ] & 2 && ! node ) {
				return -1;
			}
			if ( flags & 32 ) {
				return -2;
			}
			if ( type !== 0 && type !== 1 && type !== 2 ) {
				return -7;
			}
			if ( family !== 0 && family !== 2 && family !== 10 ) {
				return -6;
			}
			if ( service ) {
				service = UTF8ToString( service );
				port = parseInt( service, 10 );
				if ( isNaN( port ) ) {
					if ( flags & 1024 ) {
						return -2;
					}
					return -8;
				}
			}
			if ( ! node ) {
				if ( family === 0 ) {
					family = 2;
				}
				if ( ( flags & 1 ) === 0 ) {
					if ( family === 2 ) {
						addr = _htonl( 2130706433 );
					} else {
						addr = [ 0, 0, 0, 1 ];
					}
				}
				ai = allocaddrinfo( family, type, proto, null, addr, port );
				HEAP32[ out >> 2 ] = ai;
				return 0;
			}
			node = UTF8ToString( node );
			addr = __inet_pton4_raw( node );
			if ( addr !== null ) {
				if ( family === 0 || family === 2 ) {
					family = 2;
				} else if ( family === 10 && flags & 8 ) {
					addr = [ 0, 0, _htonl( 65535 ), addr ];
					family = 10;
				} else {
					return -2;
				}
			} else {
				addr = __inet_pton6_raw( node );
				if ( addr !== null ) {
					if ( family === 0 || family === 10 ) {
						family = 10;
					} else {
						return -2;
					}
				}
			}
			if ( addr != null ) {
				ai = allocaddrinfo( family, type, proto, node, addr, port );
				HEAP32[ out >> 2 ] = ai;
				return 0;
			}
			if ( flags & 4 ) {
				return -2;
			}
			node = DNS.lookup_name( node );
			addr = __inet_pton4_raw( node );
			if ( family === 0 ) {
				family = 2;
			} else if ( family === 10 ) {
				addr = [ 0, 0, _htonl( 65535 ), addr ];
			}
			ai = allocaddrinfo( family, type, proto, null, addr, port );
			HEAP32[ out >> 2 ] = ai;
			return 0;
		}
		function _getdtablesize() {
			err( 'missing function: getdtablesize' );
			abort( -1 );
		}
		function _getenv( name ) {
			if ( name === 0 ) {
				return 0;
			}
			name = UTF8ToString( name );
			if ( ! ENV.hasOwnProperty( name ) ) {
				return 0;
			}
			if ( _getenv.ret ) {
				_free( _getenv.ret );
			}
			_getenv.ret = allocateUTF8( ENV[ name ] );
			return _getenv.ret;
		}
		function _getgrnam() {
			throw 'getgrnam: TODO';
		}
		function _gethostbyname( name ) {
			name = UTF8ToString( name );
			const ret = _malloc( 20 );
			const nameBuf = _malloc( name.length + 1 );
			stringToUTF8( name, nameBuf, name.length + 1 );
			HEAP32[ ret >> 2 ] = nameBuf;
			const aliasesBuf = _malloc( 4 );
			HEAP32[ aliasesBuf >> 2 ] = 0;
			HEAP32[ ( ret + 4 ) >> 2 ] = aliasesBuf;
			const afinet = 2;
			HEAP32[ ( ret + 8 ) >> 2 ] = afinet;
			HEAP32[ ( ret + 12 ) >> 2 ] = 4;
			const addrListBuf = _malloc( 12 );
			HEAP32[ addrListBuf >> 2 ] = addrListBuf + 8;
			HEAP32[ ( addrListBuf + 4 ) >> 2 ] = 0;
			HEAP32[ ( addrListBuf + 8 ) >> 2 ] = __inet_pton4_raw( DNS.lookup_name( name ) );
			HEAP32[ ( ret + 16 ) >> 2 ] = addrListBuf;
			return ret;
		}
		function _gethostbyaddr( addr, addrlen, type ) {
			if ( type !== 2 ) {
				setErrNo( 5 );
				return null;
			}
			addr = HEAP32[ addr >> 2 ];
			let host = __inet_ntop4_raw( addr );
			const lookup = DNS.lookup_addr( host );
			if ( lookup ) {
				host = lookup;
			}
			const hostp = allocate( intArrayFromString( host ), 'i8', ALLOC_STACK );
			return _gethostbyname( hostp );
		}
		function _gethostbyname_r( name, ret, buf, buflen, out, err ) {
			const data = _gethostbyname( name );
			_memcpy( ret, data, 20 );
			_free( data );
			HEAP32[ err >> 2 ] = 0;
			HEAP32[ out >> 2 ] = ret;
			return 0;
		}
		function _getloadavg( loadavg, nelem ) {
			const limit = Math.min( nelem, 3 );
			const doubleSize = 8;
			for ( let i = 0; i < limit; i++ ) {
				HEAPF64[ ( loadavg + i * doubleSize ) >> 3 ] = 0.1;
			}
			return limit;
		}
		const Protocols = { list: [], map: {} };
		function _setprotoent( stayopen ) {
			function allocprotoent( name, proto, aliases ) {
				const nameBuf = _malloc( name.length + 1 );
				writeAsciiToMemory( name, nameBuf );
				let j = 0;
				const length = aliases.length;
				const aliasListBuf = _malloc( ( length + 1 ) * 4 );
				for ( let i = 0; i < length; i++, j += 4 ) {
					const alias = aliases[ i ];
					const aliasBuf = _malloc( alias.length + 1 );
					writeAsciiToMemory( alias, aliasBuf );
					HEAP32[ ( aliasListBuf + j ) >> 2 ] = aliasBuf;
				}
				HEAP32[ ( aliasListBuf + j ) >> 2 ] = 0;
				const pe = _malloc( 12 );
				HEAP32[ pe >> 2 ] = nameBuf;
				HEAP32[ ( pe + 4 ) >> 2 ] = aliasListBuf;
				HEAP32[ ( pe + 8 ) >> 2 ] = proto;
				return pe;
			}
			const list = Protocols.list;
			const map = Protocols.map;
			if ( list.length === 0 ) {
				let entry = allocprotoent( 'tcp', 6, [ 'TCP' ] );
				list.push( entry );
				map.tcp = map[ '6' ] = entry;
				entry = allocprotoent( 'udp', 17, [ 'UDP' ] );
				list.push( entry );
				map.udp = map[ '17' ] = entry;
			}
			_setprotoent.index = 0;
		}
		function _getprotobyname( name ) {
			name = UTF8ToString( name );
			_setprotoent( true );
			const result = Protocols.map[ name ];
			return result;
		}
		function _getprotobynumber( number ) {
			_setprotoent( true );
			const result = Protocols.map[ number ];
			return result;
		}
		function _getpwnam() {
			throw 'getpwnam: TODO';
		}
		function _getpwuid() {
			throw 'getpwuid: TODO';
		}
		function _gettimeofday( ptr ) {
			const now = Date.now();
			HEAP32[ ptr >> 2 ] = ( now / 1e3 ) | 0;
			HEAP32[ ( ptr + 4 ) >> 2 ] = ( ( now % 1e3 ) * 1e3 ) | 0;
			return 0;
		}
		const ___tm_timezone = ( stringToUTF8( 'GMT', 2560960, 4 ), 2560960 );
		function _gmtime_r( time, tmPtr ) {
			const date = new Date( HEAP32[ time >> 2 ] * 1e3 );
			HEAP32[ tmPtr >> 2 ] = date.getUTCSeconds();
			HEAP32[ ( tmPtr + 4 ) >> 2 ] = date.getUTCMinutes();
			HEAP32[ ( tmPtr + 8 ) >> 2 ] = date.getUTCHours();
			HEAP32[ ( tmPtr + 12 ) >> 2 ] = date.getUTCDate();
			HEAP32[ ( tmPtr + 16 ) >> 2 ] = date.getUTCMonth();
			HEAP32[ ( tmPtr + 20 ) >> 2 ] = date.getUTCFullYear() - 1900;
			HEAP32[ ( tmPtr + 24 ) >> 2 ] = date.getUTCDay();
			HEAP32[ ( tmPtr + 36 ) >> 2 ] = 0;
			HEAP32[ ( tmPtr + 32 ) >> 2 ] = 0;
			const start = Date.UTC( date.getUTCFullYear(), 0, 1, 0, 0, 0, 0 );
			const yday = ( ( date.getTime() - start ) / ( 1e3 * 60 * 60 * 24 ) ) | 0;
			HEAP32[ ( tmPtr + 28 ) >> 2 ] = yday;
			HEAP32[ ( tmPtr + 40 ) >> 2 ] = ___tm_timezone;
			return tmPtr;
		}
		function _kill( pid, sig ) {
			setErrNo( ERRNO_CODES.EPERM );
			return -1;
		}
		function _llvm_bswap_i64( l, h ) {
			const retl = _llvm_bswap_i32( h ) >>> 0;
			const reth = _llvm_bswap_i32( l ) >>> 0;
			return ( setTempRet0( reth ), retl ) | 0;
		}
		function _llvm_log10_f32( x ) {
			return Math.log( x ) / Math.LN10;
		}
		function _llvm_log10_f64( a0 ) {
			return _llvm_log10_f32( a0 );
		}
		function _llvm_log2_f32( x ) {
			return Math.log( x ) / Math.LN2;
		}
		function _llvm_log2_f64( a0 ) {
			return _llvm_log2_f32( a0 );
		}
		function _llvm_stackrestore( p ) {
			const self = _llvm_stacksave;
			const ret = self.LLVM_SAVEDSTACKS[ p ];
			self.LLVM_SAVEDSTACKS.splice( p, 1 );
			stackRestore( ret );
		}
		function _llvm_stacksave() {
			const self = _llvm_stacksave;
			if ( ! self.LLVM_SAVEDSTACKS ) {
				self.LLVM_SAVEDSTACKS = [];
			}
			self.LLVM_SAVEDSTACKS.push( stackSave() );
			return self.LLVM_SAVEDSTACKS.length - 1;
		}
		function _llvm_trap() {
			abort( 'trap!' );
		}
		function _localtime_r( time, tmPtr ) {
			_tzset();
			const date = new Date( HEAP32[ time >> 2 ] * 1e3 );
			HEAP32[ tmPtr >> 2 ] = date.getSeconds();
			HEAP32[ ( tmPtr + 4 ) >> 2 ] = date.getMinutes();
			HEAP32[ ( tmPtr + 8 ) >> 2 ] = date.getHours();
			HEAP32[ ( tmPtr + 12 ) >> 2 ] = date.getDate();
			HEAP32[ ( tmPtr + 16 ) >> 2 ] = date.getMonth();
			HEAP32[ ( tmPtr + 20 ) >> 2 ] = date.getFullYear() - 1900;
			HEAP32[ ( tmPtr + 24 ) >> 2 ] = date.getDay();
			const start = new Date( date.getFullYear(), 0, 1 );
			const yday =
        ( ( date.getTime() - start.getTime() ) / ( 1e3 * 60 * 60 * 24 ) ) | 0;
			HEAP32[ ( tmPtr + 28 ) >> 2 ] = yday;
			HEAP32[ ( tmPtr + 36 ) >> 2 ] = -( date.getTimezoneOffset() * 60 );
			const summerOffset = new Date(
				date.getFullYear(),
				6,
				1,
			).getTimezoneOffset();
			const winterOffset = start.getTimezoneOffset();
			const dst =
        ( summerOffset != winterOffset &&
          date.getTimezoneOffset() == Math.min( winterOffset, summerOffset ) ) | 0;
			HEAP32[ ( tmPtr + 32 ) >> 2 ] = dst;
			const zonePtr = HEAP32[ ( __get_tzname() + ( dst ? 4 : 0 ) ) >> 2 ];
			HEAP32[ ( tmPtr + 40 ) >> 2 ] = zonePtr;
			return tmPtr;
		}
		function _longjmp( env, value ) {
			_setThrew( env, value || 1 );
			throw 'longjmp';
		}
		function _emscripten_memcpy_big( dest, src, num ) {
			HEAPU8.copyWithin( dest, src, src + num );
		}
		function _usleep( useconds ) {
			const start = _emscripten_get_now();
			while ( _emscripten_get_now() - start < useconds / 1e3 ) {}
		}
		Module._usleep = _usleep;
		function _nanosleep( rqtp, rmtp ) {
			if ( rqtp === 0 ) {
				setErrNo( 28 );
				return -1;
			}
			const seconds = HEAP32[ rqtp >> 2 ];
			const nanoseconds = HEAP32[ ( rqtp + 4 ) >> 2 ];
			if ( nanoseconds < 0 || nanoseconds > 999999999 || seconds < 0 ) {
				setErrNo( 28 );
				return -1;
			}
			if ( rmtp !== 0 ) {
				HEAP32[ rmtp >> 2 ] = 0;
				HEAP32[ ( rmtp + 4 ) >> 2 ] = 0;
			}
			return _usleep( seconds * 1e6 + nanoseconds / 1e3 );
		}
		function _popen() {
			err( 'missing function: popen' );
			abort( -1 );
		}
		function _pthread_create() {
			return 6;
		}
		function _pthread_join() {}
		function _pthread_mutexattr_destroy() {}
		function _pthread_mutexattr_init() {}
		function _pthread_mutexattr_settype() {}
		function _pthread_setcancelstate() {
			return 0;
		}
		function _putenv( string ) {
			if ( string === 0 ) {
				setErrNo( 28 );
				return -1;
			}
			string = UTF8ToString( string );
			const splitPoint = string.indexOf( '=' );
			if ( string === '' || string.indexOf( '=' ) === -1 ) {
				setErrNo( 28 );
				return -1;
			}
			const name = string.slice( 0, splitPoint );
			const value = string.slice( splitPoint + 1 );
			if ( ! ( name in ENV ) || ENV[ name ] !== value ) {
				ENV[ name ] = value;
				___buildEnvironment( __get_environ() );
			}
			return 0;
		}
		function _setTempRet0( $i ) {
			setTempRet0( $i | 0 );
		}
		function _setitimer() {
			throw 'setitimer() is not implemented yet';
		}
		function _sigaction( signum, act, oldact ) {
			return 0;
		}
		function _sigaddset( set, signum ) {
			HEAP32[ set >> 2 ] = HEAP32[ set >> 2 ] | ( 1 << ( signum - 1 ) );
			return 0;
		}
		function _sigdelset( set, signum ) {
			HEAP32[ set >> 2 ] = HEAP32[ set >> 2 ] & ~( 1 << ( signum - 1 ) );
			return 0;
		}
		function _sigemptyset( set ) {
			HEAP32[ set >> 2 ] = 0;
			return 0;
		}
		function _sigfillset( set ) {
			HEAP32[ set >> 2 ] = -1 >>> 0;
			return 0;
		}
		let __sigalrm_handler = 0;
		function _signal( sig, func ) {
			if ( sig == 14 ) {
				__sigalrm_handler = func;
			} else {
			}
			return 0;
		}
		function _sigprocmask() {
			return 0;
		}
		function __isLeapYear( year ) {
			return year % 4 === 0 && ( year % 100 !== 0 || year % 400 === 0 );
		}
		function __arraySum( array, index ) {
			let sum = 0;
			for ( let i = 0; i <= index; sum += array[ i++ ] ) {}
			return sum;
		}
		const __MONTH_DAYS_LEAP = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
		const __MONTH_DAYS_REGULAR = [
			31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
		];
		function __addDays( date, days ) {
			const newDate = new Date( date.getTime() );
			while ( days > 0 ) {
				const leap = __isLeapYear( newDate.getFullYear() );
				const currentMonth = newDate.getMonth();
				const daysInCurrentMonth = (
					leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR
				)[ currentMonth ];
				if ( days > daysInCurrentMonth - newDate.getDate() ) {
					days -= daysInCurrentMonth - newDate.getDate() + 1;
					newDate.setDate( 1 );
					if ( currentMonth < 11 ) {
						newDate.setMonth( currentMonth + 1 );
					} else {
						newDate.setMonth( 0 );
						newDate.setFullYear( newDate.getFullYear() + 1 );
					}
				} else {
					newDate.setDate( newDate.getDate() + days );
					return newDate;
				}
			}
			return newDate;
		}
		function _strftime( s, maxsize, format, tm ) {
			const tm_zone = HEAP32[ ( tm + 40 ) >> 2 ];
			const date = {
				tm_sec: HEAP32[ tm >> 2 ],
				tm_min: HEAP32[ ( tm + 4 ) >> 2 ],
				tm_hour: HEAP32[ ( tm + 8 ) >> 2 ],
				tm_mday: HEAP32[ ( tm + 12 ) >> 2 ],
				tm_mon: HEAP32[ ( tm + 16 ) >> 2 ],
				tm_year: HEAP32[ ( tm + 20 ) >> 2 ],
				tm_wday: HEAP32[ ( tm + 24 ) >> 2 ],
				tm_yday: HEAP32[ ( tm + 28 ) >> 2 ],
				tm_isdst: HEAP32[ ( tm + 32 ) >> 2 ],
				tm_gmtoff: HEAP32[ ( tm + 36 ) >> 2 ],
				tm_zone: tm_zone ? UTF8ToString( tm_zone ) : '',
			};
			let pattern = UTF8ToString( format );
			const EXPANSION_RULES_1 = {
				'%c': '%a %b %d %H:%M:%S %Y',
				'%D': '%m/%d/%y',
				'%F': '%Y-%m-%d',
				'%h': '%b',
				'%r': '%I:%M:%S %p',
				'%R': '%H:%M',
				'%T': '%H:%M:%S',
				'%x': '%m/%d/%y',
				'%X': '%H:%M:%S',
				'%Ec': '%c',
				'%EC': '%C',
				'%Ex': '%m/%d/%y',
				'%EX': '%H:%M:%S',
				'%Ey': '%y',
				'%EY': '%Y',
				'%Od': '%d',
				'%Oe': '%e',
				'%OH': '%H',
				'%OI': '%I',
				'%Om': '%m',
				'%OM': '%M',
				'%OS': '%S',
				'%Ou': '%u',
				'%OU': '%U',
				'%OV': '%V',
				'%Ow': '%w',
				'%OW': '%W',
				'%Oy': '%y',
			};
			for ( var rule in EXPANSION_RULES_1 ) {
				pattern = pattern.replace(
					new RegExp( rule, 'g' ),
					EXPANSION_RULES_1[ rule ],
				);
			}
			const WEEKDAYS = [
				'Sunday',
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday',
			];
			const MONTHS = [
				'January',
				'February',
				'March',
				'April',
				'May',
				'June',
				'July',
				'August',
				'September',
				'October',
				'November',
				'December',
			];
			function leadingSomething( value, digits, character ) {
				let str = typeof value === 'number' ? value.toString() : value || '';
				while ( str.length < digits ) {
					str = character[ 0 ] + str;
				}
				return str;
			}
			function leadingNulls( value, digits ) {
				return leadingSomething( value, digits, '0' );
			}
			function compareByDay( date1, date2 ) {
				function sgn( value ) {
					return value < 0 ? -1 : value > 0 ? 1 : 0;
				}
				let compare;
				if ( ( compare = sgn( date1.getFullYear() - date2.getFullYear() ) ) === 0 ) {
					if ( ( compare = sgn( date1.getMonth() - date2.getMonth() ) ) === 0 ) {
						compare = sgn( date1.getDate() - date2.getDate() );
					}
				}
				return compare;
			}
			function getFirstWeekStartDate( janFourth ) {
				switch ( janFourth.getDay() ) {
					case 0:
						return new Date( janFourth.getFullYear() - 1, 11, 29 );
					case 1:
						return janFourth;
					case 2:
						return new Date( janFourth.getFullYear(), 0, 3 );
					case 3:
						return new Date( janFourth.getFullYear(), 0, 2 );
					case 4:
						return new Date( janFourth.getFullYear(), 0, 1 );
					case 5:
						return new Date( janFourth.getFullYear() - 1, 11, 31 );
					case 6:
						return new Date( janFourth.getFullYear() - 1, 11, 30 );
				}
			}
			function getWeekBasedYear( date ) {
				const thisDate = __addDays(
					new Date( date.tm_year + 1900, 0, 1 ),
					date.tm_yday,
				);
				const janFourthThisYear = new Date( thisDate.getFullYear(), 0, 4 );
				const janFourthNextYear = new Date( thisDate.getFullYear() + 1, 0, 4 );
				const firstWeekStartThisYear = getFirstWeekStartDate( janFourthThisYear );
				const firstWeekStartNextYear = getFirstWeekStartDate( janFourthNextYear );
				if ( compareByDay( firstWeekStartThisYear, thisDate ) <= 0 ) {
					if ( compareByDay( firstWeekStartNextYear, thisDate ) <= 0 ) {
						return thisDate.getFullYear() + 1;
					}
					return thisDate.getFullYear();
				}
				return thisDate.getFullYear() - 1;
			}
			const EXPANSION_RULES_2 = {
				'%a'( date ) {
					return WEEKDAYS[ date.tm_wday ].substring( 0, 3 );
				},
				'%A'( date ) {
					return WEEKDAYS[ date.tm_wday ];
				},
				'%b'( date ) {
					return MONTHS[ date.tm_mon ].substring( 0, 3 );
				},
				'%B'( date ) {
					return MONTHS[ date.tm_mon ];
				},
				'%C'( date ) {
					const year = date.tm_year + 1900;
					return leadingNulls( ( year / 100 ) | 0, 2 );
				},
				'%d'( date ) {
					return leadingNulls( date.tm_mday, 2 );
				},
				'%e'( date ) {
					return leadingSomething( date.tm_mday, 2, ' ' );
				},
				'%g'( date ) {
					return getWeekBasedYear( date ).toString().substring( 2 );
				},
				'%G'( date ) {
					return getWeekBasedYear( date );
				},
				'%H'( date ) {
					return leadingNulls( date.tm_hour, 2 );
				},
				'%I'( date ) {
					let twelveHour = date.tm_hour;
					if ( twelveHour == 0 ) {
						twelveHour = 12;
					} else if ( twelveHour > 12 ) {
						twelveHour -= 12;
					}
					return leadingNulls( twelveHour, 2 );
				},
				'%j'( date ) {
					return leadingNulls(
						date.tm_mday +
              __arraySum(
              	__isLeapYear( date.tm_year + 1900 )
              		? __MONTH_DAYS_LEAP
              		: __MONTH_DAYS_REGULAR,
              	date.tm_mon - 1,
              ),
						3,
					);
				},
				'%m'( date ) {
					return leadingNulls( date.tm_mon + 1, 2 );
				},
				'%M'( date ) {
					return leadingNulls( date.tm_min, 2 );
				},
				'%n'() {
					return '\n';
				},
				'%p'( date ) {
					if ( date.tm_hour >= 0 && date.tm_hour < 12 ) {
						return 'AM';
					}
					return 'PM';
				},
				'%S'( date ) {
					return leadingNulls( date.tm_sec, 2 );
				},
				'%t'() {
					return '\t';
				},
				'%u'( date ) {
					return date.tm_wday || 7;
				},
				'%U'( date ) {
					const janFirst = new Date( date.tm_year + 1900, 0, 1 );
					const firstSunday =
            janFirst.getDay() === 0
            	? janFirst
            	: __addDays( janFirst, 7 - janFirst.getDay() );
					const endDate = new Date(
						date.tm_year + 1900,
						date.tm_mon,
						date.tm_mday,
					);
					if ( compareByDay( firstSunday, endDate ) < 0 ) {
						const februaryFirstUntilEndMonth =
              __arraySum(
              	__isLeapYear( endDate.getFullYear() )
              		? __MONTH_DAYS_LEAP
              		: __MONTH_DAYS_REGULAR,
              	endDate.getMonth() - 1,
              ) - 31;
						const firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
						const days =
              firstSundayUntilEndJanuary +
              februaryFirstUntilEndMonth +
              endDate.getDate();
						return leadingNulls( Math.ceil( days / 7 ), 2 );
					}
					return compareByDay( firstSunday, janFirst ) === 0 ? '01' : '00';
				},
				'%V'( date ) {
					const janFourthThisYear = new Date( date.tm_year + 1900, 0, 4 );
					const janFourthNextYear = new Date( date.tm_year + 1901, 0, 4 );
					const firstWeekStartThisYear =
            getFirstWeekStartDate( janFourthThisYear );
					const firstWeekStartNextYear =
            getFirstWeekStartDate( janFourthNextYear );
					const endDate = __addDays(
						new Date( date.tm_year + 1900, 0, 1 ),
						date.tm_yday,
					);
					if ( compareByDay( endDate, firstWeekStartThisYear ) < 0 ) {
						return '53';
					}
					if ( compareByDay( firstWeekStartNextYear, endDate ) <= 0 ) {
						return '01';
					}
					let daysDifference;
					if ( firstWeekStartThisYear.getFullYear() < date.tm_year + 1900 ) {
						daysDifference =
              date.tm_yday + 32 - firstWeekStartThisYear.getDate();
					} else {
						daysDifference =
              date.tm_yday + 1 - firstWeekStartThisYear.getDate();
					}
					return leadingNulls( Math.ceil( daysDifference / 7 ), 2 );
				},
				'%w'( date ) {
					return date.tm_wday;
				},
				'%W'( date ) {
					const janFirst = new Date( date.tm_year, 0, 1 );
					const firstMonday =
            janFirst.getDay() === 1
            	? janFirst
            	: __addDays(
            		janFirst,
            		janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1,
            	);
					const endDate = new Date(
						date.tm_year + 1900,
						date.tm_mon,
						date.tm_mday,
					);
					if ( compareByDay( firstMonday, endDate ) < 0 ) {
						const februaryFirstUntilEndMonth =
              __arraySum(
              	__isLeapYear( endDate.getFullYear() )
              		? __MONTH_DAYS_LEAP
              		: __MONTH_DAYS_REGULAR,
              	endDate.getMonth() - 1,
              ) - 31;
						const firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
						const days =
              firstMondayUntilEndJanuary +
              februaryFirstUntilEndMonth +
              endDate.getDate();
						return leadingNulls( Math.ceil( days / 7 ), 2 );
					}
					return compareByDay( firstMonday, janFirst ) === 0 ? '01' : '00';
				},
				'%y'( date ) {
					return ( date.tm_year + 1900 ).toString().substring( 2 );
				},
				'%Y'( date ) {
					return date.tm_year + 1900;
				},
				'%z'( date ) {
					let off = date.tm_gmtoff;
					const ahead = off >= 0;
					off = Math.abs( off ) / 60;
					off = ( off / 60 ) * 100 + ( off % 60 );
					return ( ahead ? '+' : '-' ) + String( '0000' + off ).slice( -4 );
				},
				'%Z'( date ) {
					return date.tm_zone;
				},
				'%%'() {
					return '%';
				},
			};
			for ( var rule in EXPANSION_RULES_2 ) {
				if ( pattern.indexOf( rule ) >= 0 ) {
					pattern = pattern.replace(
						new RegExp( rule, 'g' ),
						EXPANSION_RULES_2[ rule ]( date ),
					);
				}
			}
			const bytes = intArrayFromString( pattern, false );
			if ( bytes.length > maxsize ) {
				return 0;
			}
			writeArrayToMemory( bytes, s );
			return bytes.length - 1;
		}
		function _strptime( buf, format, tm ) {
			let pattern = UTF8ToString( format );
			const SPECIAL_CHARS = '\\!@#$^&*()+=-[]/{}|:<>?,.';
			for ( var i = 0, ii = SPECIAL_CHARS.length; i < ii; ++i ) {
				pattern = pattern.replace(
					new RegExp( '\\' + SPECIAL_CHARS[ i ], 'g' ),
					'\\' + SPECIAL_CHARS[ i ],
				);
			}
			const EQUIVALENT_MATCHERS = {
				'%A': '%a',
				'%B': '%b',
				'%c': '%a %b %d %H:%M:%S %Y',
				'%D': '%m\\/%d\\/%y',
				'%e': '%d',
				'%F': '%Y-%m-%d',
				'%h': '%b',
				'%R': '%H\\:%M',
				'%r': '%I\\:%M\\:%S\\s%p',
				'%T': '%H\\:%M\\:%S',
				'%x': '%m\\/%d\\/(?:%y|%Y)',
				'%X': '%H\\:%M\\:%S',
			};
			for ( const matcher in EQUIVALENT_MATCHERS ) {
				pattern = pattern.replace( matcher, EQUIVALENT_MATCHERS[ matcher ] );
			}
			const DATE_PATTERNS = {
				'%a': '(?:Sun(?:day)?)|(?:Mon(?:day)?)|(?:Tue(?:sday)?)|(?:Wed(?:nesday)?)|(?:Thu(?:rsday)?)|(?:Fri(?:day)?)|(?:Sat(?:urday)?)',
				'%b': '(?:Jan(?:uary)?)|(?:Feb(?:ruary)?)|(?:Mar(?:ch)?)|(?:Apr(?:il)?)|May|(?:Jun(?:e)?)|(?:Jul(?:y)?)|(?:Aug(?:ust)?)|(?:Sep(?:tember)?)|(?:Oct(?:ober)?)|(?:Nov(?:ember)?)|(?:Dec(?:ember)?)',
				'%C': '\\d\\d',
				'%d': '0[1-9]|[1-9](?!\\d)|1\\d|2\\d|30|31',
				'%H': '\\d(?!\\d)|[0,1]\\d|20|21|22|23',
				'%I': '\\d(?!\\d)|0\\d|10|11|12',
				'%j': '00[1-9]|0?[1-9](?!\\d)|0?[1-9]\\d(?!\\d)|[1,2]\\d\\d|3[0-6]\\d',
				'%m': '0[1-9]|[1-9](?!\\d)|10|11|12',
				'%M': '0\\d|\\d(?!\\d)|[1-5]\\d',
				'%n': '\\s',
				'%p': 'AM|am|PM|pm|A\\.M\\.|a\\.m\\.|P\\.M\\.|p\\.m\\.',
				'%S': '0\\d|\\d(?!\\d)|[1-5]\\d|60',
				'%U': '0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53',
				'%W': '0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53',
				'%w': '[0-6]',
				'%y': '\\d\\d',
				'%Y': '\\d\\d\\d\\d',
				'%%': '%',
				'%t': '\\s',
			};
			const MONTH_NUMBERS = {
				JAN: 0,
				FEB: 1,
				MAR: 2,
				APR: 3,
				MAY: 4,
				JUN: 5,
				JUL: 6,
				AUG: 7,
				SEP: 8,
				OCT: 9,
				NOV: 10,
				DEC: 11,
			};
			const DAY_NUMBERS_SUN_FIRST = {
				SUN: 0,
				MON: 1,
				TUE: 2,
				WED: 3,
				THU: 4,
				FRI: 5,
				SAT: 6,
			};
			const DAY_NUMBERS_MON_FIRST = {
				MON: 0,
				TUE: 1,
				WED: 2,
				THU: 3,
				FRI: 4,
				SAT: 5,
				SUN: 6,
			};
			for ( const datePattern in DATE_PATTERNS ) {
				pattern = pattern.replace(
					datePattern,
					'(' + datePattern + DATE_PATTERNS[ datePattern ] + ')',
				);
			}
			const capture = [];
			for ( var i = pattern.indexOf( '%' ); i >= 0; i = pattern.indexOf( '%' ) ) {
				capture.push( pattern[ i + 1 ] );
				pattern = pattern.replace( new RegExp( '\\%' + pattern[ i + 1 ], 'g' ), '' );
			}
			const matches = new RegExp( '^' + pattern, 'i' ).exec( UTF8ToString( buf ) );
			function initDate() {
				function fixup( value, min, max ) {
					return typeof value !== 'number' || isNaN( value )
						? min
						: value >= min
							? value <= max
								? value
								: max
							: min;
				}
				return {
					year: fixup( HEAP32[ ( tm + 20 ) >> 2 ] + 1900, 1970, 9999 ),
					month: fixup( HEAP32[ ( tm + 16 ) >> 2 ], 0, 11 ),
					day: fixup( HEAP32[ ( tm + 12 ) >> 2 ], 1, 31 ),
					hour: fixup( HEAP32[ ( tm + 8 ) >> 2 ], 0, 23 ),
					min: fixup( HEAP32[ ( tm + 4 ) >> 2 ], 0, 59 ),
					sec: fixup( HEAP32[ tm >> 2 ], 0, 59 ),
				};
			}
			if ( matches ) {
				const date = initDate();
				let value;
				const getMatch = function( symbol ) {
					const pos = capture.indexOf( symbol );
					if ( pos >= 0 ) {
						return matches[ pos + 1 ];
					}
				};
				if ( ( value = getMatch( 'S' ) ) ) {
					date.sec = jstoi_q( value );
				}
				if ( ( value = getMatch( 'M' ) ) ) {
					date.min = jstoi_q( value );
				}
				if ( ( value = getMatch( 'H' ) ) ) {
					date.hour = jstoi_q( value );
				} else if ( ( value = getMatch( 'I' ) ) ) {
					let hour = jstoi_q( value );
					if ( ( value = getMatch( 'p' ) ) ) {
						hour += value.toUpperCase()[ 0 ] === 'P' ? 12 : 0;
					}
					date.hour = hour;
				}
				if ( ( value = getMatch( 'Y' ) ) ) {
					date.year = jstoi_q( value );
				} else if ( ( value = getMatch( 'y' ) ) ) {
					let year = jstoi_q( value );
					if ( ( value = getMatch( 'C' ) ) ) {
						year += jstoi_q( value ) * 100;
					} else {
						year += year < 69 ? 2e3 : 1900;
					}
					date.year = year;
				}
				if ( ( value = getMatch( 'm' ) ) ) {
					date.month = jstoi_q( value ) - 1;
				} else if ( ( value = getMatch( 'b' ) ) ) {
					date.month = MONTH_NUMBERS[ value.substring( 0, 3 ).toUpperCase() ] || 0;
				}
				if ( ( value = getMatch( 'd' ) ) ) {
					date.day = jstoi_q( value );
				} else if ( ( value = getMatch( 'j' ) ) ) {
					const day = jstoi_q( value );
					const leapYear = __isLeapYear( date.year );
					for ( let month = 0; month < 12; ++month ) {
						const daysUntilMonth = __arraySum(
							leapYear ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR,
							month - 1,
						);
						if (
							day <=
              daysUntilMonth +
                ( leapYear ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR )[ month ]
						) {
							date.day = day - daysUntilMonth;
						}
					}
				} else if ( ( value = getMatch( 'a' ) ) ) {
					const weekDay = value.substring( 0, 3 ).toUpperCase();
					if ( ( value = getMatch( 'U' ) ) ) {
						var weekDayNumber = DAY_NUMBERS_SUN_FIRST[ weekDay ];
						var weekNumber = jstoi_q( value );
						var janFirst = new Date( date.year, 0, 1 );
						var endDate;
						if ( janFirst.getDay() === 0 ) {
							endDate = __addDays(
								janFirst,
								weekDayNumber + 7 * ( weekNumber - 1 ),
							);
						} else {
							endDate = __addDays(
								janFirst,
								7 - janFirst.getDay() + weekDayNumber + 7 * ( weekNumber - 1 ),
							);
						}
						date.day = endDate.getDate();
						date.month = endDate.getMonth();
					} else if ( ( value = getMatch( 'W' ) ) ) {
						var weekDayNumber = DAY_NUMBERS_MON_FIRST[ weekDay ];
						var weekNumber = jstoi_q( value );
						var janFirst = new Date( date.year, 0, 1 );
						var endDate;
						if ( janFirst.getDay() === 1 ) {
							endDate = __addDays(
								janFirst,
								weekDayNumber + 7 * ( weekNumber - 1 ),
							);
						} else {
							endDate = __addDays(
								janFirst,
								7 - janFirst.getDay() + 1 + weekDayNumber + 7 * ( weekNumber - 1 ),
							);
						}
						date.day = endDate.getDate();
						date.month = endDate.getMonth();
					}
				}
				const fullDate = new Date(
					date.year,
					date.month,
					date.day,
					date.hour,
					date.min,
					date.sec,
					0,
				);
				HEAP32[ tm >> 2 ] = fullDate.getSeconds();
				HEAP32[ ( tm + 4 ) >> 2 ] = fullDate.getMinutes();
				HEAP32[ ( tm + 8 ) >> 2 ] = fullDate.getHours();
				HEAP32[ ( tm + 12 ) >> 2 ] = fullDate.getDate();
				HEAP32[ ( tm + 16 ) >> 2 ] = fullDate.getMonth();
				HEAP32[ ( tm + 20 ) >> 2 ] = fullDate.getFullYear() - 1900;
				HEAP32[ ( tm + 24 ) >> 2 ] = fullDate.getDay();
				HEAP32[ ( tm + 28 ) >> 2 ] =
          __arraySum(
          	__isLeapYear( fullDate.getFullYear() )
          		? __MONTH_DAYS_LEAP
          		: __MONTH_DAYS_REGULAR,
          	fullDate.getMonth() - 1,
          ) +
          fullDate.getDate() -
          1;
				HEAP32[ ( tm + 32 ) >> 2 ] = 0;
				return buf + intArrayFromString( matches[ 0 ] ).length - 1;
			}
			return 0;
		}
		function _sysconf( name ) {
			switch ( name ) {
				case 30:
					return 16384;
				case 85:
					var maxHeapSize = 4 * 1024 * 1024 * 1024;
					return maxHeapSize / 16384;
				case 132:
				case 133:
				case 12:
				case 137:
				case 138:
				case 15:
				case 235:
				case 16:
				case 17:
				case 18:
				case 19:
				case 20:
				case 149:
				case 13:
				case 10:
				case 236:
				case 153:
				case 9:
				case 21:
				case 22:
				case 159:
				case 154:
				case 14:
				case 77:
				case 78:
				case 139:
				case 80:
				case 81:
				case 82:
				case 68:
				case 67:
				case 164:
				case 11:
				case 29:
				case 47:
				case 48:
				case 95:
				case 52:
				case 51:
				case 46:
				case 79:
					return 200809;
				case 27:
				case 246:
				case 127:
				case 128:
				case 23:
				case 24:
				case 160:
				case 161:
				case 181:
				case 182:
				case 242:
				case 183:
				case 184:
				case 243:
				case 244:
				case 245:
				case 165:
				case 178:
				case 179:
				case 49:
				case 50:
				case 168:
				case 169:
				case 175:
				case 170:
				case 171:
				case 172:
				case 97:
				case 76:
				case 32:
				case 173:
				case 35:
					return -1;
				case 176:
				case 177:
				case 7:
				case 155:
				case 8:
				case 157:
				case 125:
				case 126:
				case 92:
				case 93:
				case 129:
				case 130:
				case 131:
				case 94:
				case 91:
					return 1;
				case 74:
				case 60:
				case 69:
				case 70:
				case 4:
					return 1024;
				case 31:
				case 42:
				case 72:
					return 32;
				case 87:
				case 26:
				case 33:
					return 2147483647;
				case 34:
				case 1:
					return 47839;
				case 38:
				case 36:
					return 99;
				case 43:
				case 37:
					return 2048;
				case 0:
					return 2097152;
				case 3:
					return 65536;
				case 28:
					return 32768;
				case 44:
					return 32767;
				case 75:
					return 16384;
				case 39:
					return 1e3;
				case 89:
					return 700;
				case 71:
					return 256;
				case 40:
					return 255;
				case 2:
					return 100;
				case 180:
					return 64;
				case 25:
					return 20;
				case 5:
					return 16;
				case 6:
					return 6;
				case 73:
					return 4;
				case 84: {
					if ( typeof navigator === 'object' ) {
						return navigator.hardwareConcurrency || 1;
					}
					return 1;
				}
			}
			setErrNo( 28 );
			return -1;
		}
		function _time( ptr ) {
			const ret = ( Date.now() / 1e3 ) | 0;
			if ( ptr ) {
				HEAP32[ ptr >> 2 ] = ret;
			}
			return ret;
		}
		function _unsetenv( name ) {
			if ( name === 0 ) {
				setErrNo( 28 );
				return -1;
			}
			name = UTF8ToString( name );
			if ( name === '' || name.indexOf( '=' ) !== -1 ) {
				setErrNo( 28 );
				return -1;
			}
			if ( ENV.hasOwnProperty( name ) ) {
				delete ENV[ name ];
				___buildEnvironment( __get_environ() );
			}
			return 0;
		}
		function _utime( path, times ) {
			let time;
			if ( times ) {
				const offset = 4;
				time = HEAP32[ ( times + offset ) >> 2 ];
				time *= 1e3;
			} else {
				time = Date.now();
			}
			path = UTF8ToString( path );
			try {
				FS.utime( path, time, time );
				return 0;
			} catch ( e ) {
				FS.handleFSError( e );
				return -1;
			}
		}
		function _wait( stat_loc ) {
			setErrNo( 12 );
			return -1;
		}
		function _waitpid( a0 ) {
			return _wait( a0 );
		}
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
		function invoke_i( index ) {
			const sp = stackSave();
			try {
				return dynCall_i( index );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_ii( index, a1 ) {
			const sp = stackSave();
			try {
				return dynCall_ii( index, a1 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_iii( index, a1, a2 ) {
			const sp = stackSave();
			try {
				return dynCall_iii( index, a1, a2 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_iiii( index, a1, a2, a3 ) {
			const sp = stackSave();
			try {
				return dynCall_iiii( index, a1, a2, a3 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_iiiii( index, a1, a2, a3, a4 ) {
			const sp = stackSave();
			try {
				return dynCall_iiiii( index, a1, a2, a3, a4 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_iiiiii( index, a1, a2, a3, a4, a5 ) {
			const sp = stackSave();
			try {
				return dynCall_iiiiii( index, a1, a2, a3, a4, a5 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_iiiiiii( index, a1, a2, a3, a4, a5, a6 ) {
			const sp = stackSave();
			try {
				return dynCall_iiiiiii( index, a1, a2, a3, a4, a5, a6 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_iiiiiiiiii( index, a1, a2, a3, a4, a5, a6, a7, a8, a9 ) {
			const sp = stackSave();
			try {
				return dynCall_iiiiiiiiii( index, a1, a2, a3, a4, a5, a6, a7, a8, a9 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_v( index ) {
			const sp = stackSave();
			try {
				dynCall_v( index );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_vi( index, a1 ) {
			const sp = stackSave();
			try {
				dynCall_vi( index, a1 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_vii( index, a1, a2 ) {
			const sp = stackSave();
			try {
				dynCall_vii( index, a1, a2 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_viii( index, a1, a2, a3 ) {
			const sp = stackSave();
			try {
				dynCall_viii( index, a1, a2, a3 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		function invoke_viiii( index, a1, a2, a3, a4 ) {
			const sp = stackSave();
			try {
				dynCall_viiii( index, a1, a2, a3, a4 );
			} catch ( e ) {
				stackRestore( sp );
				if ( e !== e + 0 && e !== 'longjmp' ) {
					throw e;
				}
				_setThrew( 1, 0 );
			}
		}
		const asmGlobalArg = {};
		var asmLibraryArg = {
			I: ___assert_fail,
			vb: ___buildEnvironment,
			ub: ___clock_gettime,
			tb: ___map_file,
			sb: ___syscall10,
			r: ___syscall102,
			rb: ___syscall114,
			qb: ___syscall12,
			pb: ___syscall122,
			ob: ___syscall142,
			oa: ___syscall15,
			nb: ___syscall163,
			mb: ___syscall168,
			lb: ___syscall183,
			kb: ___syscall192,
			jb: ___syscall194,
			na: ___syscall195,
			ib: ___syscall196,
			hb: ___syscall197,
			gb: ___syscall198,
			u: ___syscall199,
			y: ___syscall20,
			D: ___syscall200,
			ma: ___syscall201,
			fb: ___syscall205,
			eb: ___syscall207,
			la: ___syscall212,
			db: ___syscall219,
			cb: ___syscall220,
			q: ___syscall221,
			bb: ___syscall268,
			ab: ___syscall3,
			$a: ___syscall33,
			_a: ___syscall34,
			Za: ___syscall38,
			Ya: ___syscall39,
			Xa: ___syscall40,
			Wa: ___syscall41,
			Va: ___syscall42,
			Y: ___syscall5,
			ka: ___syscall54,
			Ua: ___syscall60,
			Ta: ___syscall63,
			Sa: ___syscall77,
			Ra: ___syscall83,
			Qa: ___syscall85,
			Pa: ___syscall9,
			Oa: ___syscall91,
			Na: ___syscall94,
			H: ___wasi_fd_close,
			ja: ___wasi_fd_fdstat_get,
			Ma: ___wasi_fd_read,
			xb: ___wasi_fd_seek,
			La: ___wasi_fd_sync,
			ia: ___wasi_fd_write,
			G: __exit,
			__memory_base: 1024,
			__table_base: 0,
			ha: _abort,
			Ka: _asctime_r,
			Ja: _chroot,
			Ia: _clock_gettime,
			Ha: _difftime,
			A: _dlclose,
			t: _dlerror,
			F: _dlopen,
			w: _dlsym,
			C: _emscripten_get_heap_size,
			Fa: _emscripten_memcpy_big,
			B: _emscripten_resize_heap,
			Ea: _execl,
			Da: _execle,
			Ca: _execvp,
			E: _exit,
			ga: _flock,
			Ba: _fork,
			fa: _gai_strerror,
			za: _getaddrinfo,
			ya: _getdtablesize,
			n: _getenv,
			ea: _getgrnam,
			da: _gethostbyaddr,
			ca: _gethostbyname_r,
			xa: _getloadavg,
			wa: _getprotobyname,
			va: _getprotobynumber,
			ba: _getpwnam,
			Fb: _getpwuid,
			l: _gettimeofday,
			N: _gmtime_r,
			ua: _kill,
			wb: _llvm_bswap_i64,
			X: _llvm_log10_f64,
			Eb: _llvm_log2_f64,
			W: _llvm_stackrestore,
			aa: _llvm_stacksave,
			ta: _llvm_trap,
			M: _localtime_r,
			b: _longjmp,
			$: _mktime,
			V: _nanosleep,
			L: _popen,
			U: _pthread_create,
			m: _pthread_join,
			Db: _pthread_mutexattr_destroy,
			Cb: _pthread_mutexattr_init,
			Bb: _pthread_mutexattr_settype,
			z: _pthread_setcancelstate,
			T: _putenv,
			sa: _setTempRet0,
			K: _setitimer,
			k: _sigaction,
			S: _sigaddset,
			s: _sigdelset,
			J: _sigemptyset,
			Ab: _sigfillset,
			zb: _signal,
			R: _sigprocmask,
			_: _strftime,
			yb: _strptime,
			Q: _sysconf,
			e: _time,
			Z: _tzset,
			ra: _unsetenv,
			qa: _usleep,
			P: _utime,
			pa: _waitpid,
			h: abort,
			a: getTempRet0,
			O: invoke_i,
			f: invoke_ii,
			j: invoke_iii,
			g: invoke_iiii,
			x: invoke_iiiii,
			Ga: invoke_iiiiii,
			Aa: invoke_iiiiiii,
			Gb: invoke_iiiiiiiiii,
			i: invoke_v,
			d: invoke_vi,
			o: invoke_vii,
			v: invoke_viii,
			p: invoke_viiii,
			memory: wasmMemory,
			c: setTempRet0,
			table: wasmTable,
		};
		const asm = Module.asm( asmGlobalArg, asmLibraryArg, buffer );
		var ___emscripten_environ_constructor =
      ( Module.___emscripten_environ_constructor = function() {
      	return ( ___emscripten_environ_constructor =
          Module.___emscripten_environ_constructor =
            Module.asm.Hb ).apply( null, arguments );
      } );
		var ___errno_location = ( Module.___errno_location = function() {
			return ( ___errno_location = Module.___errno_location =
        Module.asm.Ib ).apply( null, arguments );
		} );
		var __get_daylight = ( Module.__get_daylight = function() {
			return ( __get_daylight = Module.__get_daylight = Module.asm.Jb ).apply(
				null,
				arguments,
			);
		} );
		var __get_environ = ( Module.__get_environ = function() {
			return ( __get_environ = Module.__get_environ = Module.asm.Kb ).apply(
				null,
				arguments,
			);
		} );
		var __get_timezone = ( Module.__get_timezone = function() {
			return ( __get_timezone = Module.__get_timezone = Module.asm.Lb ).apply(
				null,
				arguments,
			);
		} );
		var __get_tzname = ( Module.__get_tzname = function() {
			return ( __get_tzname = Module.__get_tzname = Module.asm.Mb ).apply(
				null,
				arguments,
			);
		} );
		var _free = ( Module._free = function() {
			return ( _free = Module._free = Module.asm.Nb ).apply( null, arguments );
		} );
		var _htonl = ( Module._htonl = function() {
			return ( _htonl = Module._htonl = Module.asm.Ob ).apply( null, arguments );
		} );
		var _htons = ( Module._htons = function() {
			return ( _htons = Module._htons = Module.asm.Pb ).apply( null, arguments );
		} );
		var _llvm_bswap_i32 = ( Module._llvm_bswap_i32 = function() {
			return ( _llvm_bswap_i32 = Module._llvm_bswap_i32 = Module.asm.Qb ).apply(
				null,
				arguments,
			);
		} );
		var _main = ( Module._main = function() {
			return ( _main = Module._main = Module.asm.Rb ).apply( null, arguments );
		} );
		var _malloc = ( Module._malloc = function() {
			return ( _malloc = Module._malloc = Module.asm.Sb ).apply( null, arguments );
		} );
		var _memalign = ( Module._memalign = function() {
			return ( _memalign = Module._memalign = Module.asm.Tb ).apply(
				null,
				arguments,
			);
		} );
		var _memcpy = ( Module._memcpy = function() {
			return ( _memcpy = Module._memcpy = Module.asm.Ub ).apply( null, arguments );
		} );
		var _memset = ( Module._memset = function() {
			return ( _memset = Module._memset = Module.asm.Vb ).apply( null, arguments );
		} );
		var _ntohs = ( Module._ntohs = function() {
			return ( _ntohs = Module._ntohs = Module.asm.Wb ).apply( null, arguments );
		} );
		var _php_embed_init = ( Module._php_embed_init = function() {
			return ( _php_embed_init = Module._php_embed_init = Module.asm.Xb ).apply(
				null,
				arguments,
			);
		} );
		var _php_embed_shutdown = ( Module._php_embed_shutdown = function() {
			return ( _php_embed_shutdown = Module._php_embed_shutdown =
        Module.asm.Yb ).apply( null, arguments );
		} );
		var _pib_destroy = ( Module._pib_destroy = function() {
			return ( _pib_destroy = Module._pib_destroy = Module.asm.Zb ).apply(
				null,
				arguments,
			);
		} );
		var _pib_exec = ( Module._pib_exec = function() {
			return ( _pib_exec = Module._pib_exec = Module.asm._b ).apply(
				null,
				arguments,
			);
		} );
		var _pib_init = ( Module._pib_init = function() {
			return ( _pib_init = Module._pib_init = Module.asm.$b ).apply(
				null,
				arguments,
			);
		} );
		var _pib_refresh = ( Module._pib_refresh = function() {
			return ( _pib_refresh = Module._pib_refresh = Module.asm.ac ).apply(
				null,
				arguments,
			);
		} );
		var _pib_run = ( Module._pib_run = function() {
			return ( _pib_run = Module._pib_run = Module.asm.bc ).apply(
				null,
				arguments,
			);
		} );
		var _setThrew = ( Module._setThrew = function() {
			return ( _setThrew = Module._setThrew = Module.asm.cc ).apply(
				null,
				arguments,
			);
		} );
		var _zend_eval_string = ( Module._zend_eval_string = function() {
			return ( _zend_eval_string = Module._zend_eval_string =
        Module.asm.dc ).apply( null, arguments );
		} );
		var stackAlloc = ( Module.stackAlloc = function() {
			return ( stackAlloc = Module.stackAlloc = Module.asm.rc ).apply(
				null,
				arguments,
			);
		} );
		var stackRestore = ( Module.stackRestore = function() {
			return ( stackRestore = Module.stackRestore = Module.asm.sc ).apply(
				null,
				arguments,
			);
		} );
		var stackSave = ( Module.stackSave = function() {
			return ( stackSave = Module.stackSave = Module.asm.tc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_i = ( Module.dynCall_i = function() {
			return ( dynCall_i = Module.dynCall_i = Module.asm.ec ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_ii = ( Module.dynCall_ii = function() {
			return ( dynCall_ii = Module.dynCall_ii = Module.asm.fc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_iii = ( Module.dynCall_iii = function() {
			return ( dynCall_iii = Module.dynCall_iii = Module.asm.gc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_iiii = ( Module.dynCall_iiii = function() {
			return ( dynCall_iiii = Module.dynCall_iiii = Module.asm.hc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_iiiii = ( Module.dynCall_iiiii = function() {
			return ( dynCall_iiiii = Module.dynCall_iiiii = Module.asm.ic ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_iiiiii = ( Module.dynCall_iiiiii = function() {
			return ( dynCall_iiiiii = Module.dynCall_iiiiii = Module.asm.jc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_iiiiiii = ( Module.dynCall_iiiiiii = function() {
			return ( dynCall_iiiiiii = Module.dynCall_iiiiiii = Module.asm.kc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_iiiiiiiiii = ( Module.dynCall_iiiiiiiiii = function() {
			return ( dynCall_iiiiiiiiii = Module.dynCall_iiiiiiiiii =
        Module.asm.lc ).apply( null, arguments );
		} );
		var dynCall_v = ( Module.dynCall_v = function() {
			return ( dynCall_v = Module.dynCall_v = Module.asm.mc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_vi = ( Module.dynCall_vi = function() {
			return ( dynCall_vi = Module.dynCall_vi = Module.asm.nc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_vii = ( Module.dynCall_vii = function() {
			return ( dynCall_vii = Module.dynCall_vii = Module.asm.oc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_viii = ( Module.dynCall_viii = function() {
			return ( dynCall_viii = Module.dynCall_viii = Module.asm.pc ).apply(
				null,
				arguments,
			);
		} );
		var dynCall_viiii = ( Module.dynCall_viiii = function() {
			return ( dynCall_viiii = Module.dynCall_viiii = Module.asm.qc ).apply(
				null,
				arguments,
			);
		} );
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
		function ExitStatus( status ) {
			this.name = 'ExitStatus';
			this.message = 'Program terminated with exit(' + status + ')';
			this.status = status;
		}
		dependenciesFulfilled = function runCaller() {
			if ( ! calledRun ) {
				dependenciesFulfilled = runCaller;
			}
		};
		Module.run = function(){};
		function exit( status, implicit ) {
			if ( implicit && noExitRuntime && status === 0 ) {
				return;
			}
			if ( noExitRuntime ) {
			} else {
				ABORT = true;
				EXITSTATUS = status;
				exitRuntime();
				if ( Module.onExit ) {
					Module.onExit( status );
				}
			}
			quit_( status, new ExitStatus( status ) );
		}
		noExitRuntime = true;

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
