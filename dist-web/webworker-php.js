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
		var runtimeInitialized = false;
		let runDependencies = 0;
		let runDependencyWatcher = null;
		let dependenciesFulfilled = null;
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

		Module._usleep = noop;
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
