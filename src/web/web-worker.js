console.log( '[WebWorker] Spawned' );

const wasmTable = new WebAssembly.Table( {
	initial: 6743,
	maximum: 6743,
	element: 'anyfunc',
} );
const WASM_PAGE_SIZE = 65536;
const INITIAL_INITIAL_MEMORY = 2073741824;
const wasmMemory = new WebAssembly.Memory( {
	initial: INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
} );

const noop = function()	{};
const info = {
	env: {
		// System functions – they must be provided but don't have to be implemented to cause the crash.
		I: noop, vb: noop, ub: noop, tb: noop, sb: noop, r: noop, rb: noop, qb: noop, pb: noop, ob: noop, oa: noop, nb: noop, mb: noop, lb: noop, kb: noop, jb: noop, na: noop, ib: noop, hb: noop, gb: noop, u: noop, y: noop, D: noop, ma: noop, fb: noop, eb: noop, la: noop, db: noop, cb: noop, q: noop, bb: noop, ab: noop, $a: noop, _a: noop, Za: noop, Ya: noop, Xa: noop, Wa: noop, Va: noop, Y: noop, ka: noop, Ua: noop, Ta: noop, Sa: noop, Ra: noop, Qa: noop, Pa: noop, Oa: noop, Na: noop, H: noop, ja: noop, Ma: noop, xb: noop, La: noop, ia: noop, G: noop, ha: noop, Ka: noop, Ja: noop, Ia: noop, Ha: noop, A: noop, t: noop, F: noop, w: noop, C: noop, Fa: noop, B: noop, Ea: noop, Da: noop, Ca: noop, E: noop, ga: noop, Ba: noop, fa: noop, za: noop, ya: noop, n: noop, ea: noop, da: noop, ca: noop, xa: noop, wa: noop, va: noop, ba: noop, Fb: noop, l: noop, N: noop, ua: noop, wb: noop, X: noop, Eb: noop, W: noop, aa: noop, ta: noop, M: noop, b: noop, $: noop, V: noop, L: noop, U: noop, m: noop, Db: noop, Cb: noop, Bb: noop, z: noop, T: noop, sa: noop, K: noop, k: noop, S: noop, s: noop, J: noop, Ab: noop, zb: noop, R: noop, _: noop, yb: noop, Q: noop, e: noop, Z: noop, ra: noop, qa: noop, P: noop, pa: noop, h: noop, a: noop, O: noop, f: noop, j: noop, g: noop, x: noop, Ga: noop, Aa: noop, Gb: noop, i: noop, d: noop, o: noop, v: noop, p: noop, c: noop, __memory_base: 1024,
		__table_base: 0,
		memory: wasmMemory,
		table: wasmTable,
	},
	global: { NaN, Infinity },
	asm2wasm: {
		'f64-rem'() {},
	},
};
WebAssembly.instantiateStreaming(
	fetch( 'webworker-php.wasm' ),
	info,
);

console.log( 'Called instantiateStreaming', { info } );
