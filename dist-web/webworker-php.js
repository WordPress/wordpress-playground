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

		Module.ccall = noop;
		Module.getMemory = noop;
		Module.UTF8ToString = noop;
		Module.lengthBytesUTF8 = noop;
		Module.addRunDependency = noop;
		Module.removeRunDependency = noop;
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
