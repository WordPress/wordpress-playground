
const STR = 'string';
const NUM = 'number';

export default class PHPWrapper {
	_initPromise;
	call;

	stdout = [];
	stderr = [];

	async init( PhpBinary, args = {} ) {
		if (!this._initPromise) {
			this._initPromise = this._init(PhpBinary, args);
		}
		return this._initPromise;
	}

	async _init( PhpBinary, args = {} ) {
		const defaults = {
			onAbort( reason ) {
				console.error( 'WASM aborted: ' );
				console.error( reason );
			},
			print: ( ...chunks ) => {
				this.stdout.push( ...chunks );
			},
			printErr: ( ...chunks ) => {
				this.stderr.push( ...chunks );
			}
		};

		const PHPModule = Object.assign({}, defaults, args);
		await new PhpBinary(PHPModule);
		
		this.call = PHPModule.ccall;
		await this.call('pib_init', NUM, [STR], []);
		return PHPModule;
	}

	async run( code ) {
		if ( ! this.call ) {
			throw new Error( `Run init() first!` );
		}
		const exitCode = this.call( 'pib_run', NUM, [ STR ], [ `?>${ code }` ] );
		const response = {
			exitCode,
			stdout: this.stdout.join( '\n' ),
			stderr: this.stderr,
		};
		this.clear();
		return response;
	}

	async clear() {
		if ( ! this.call ) {
			throw new Error( `Run init() first!` );
		}
		this.call( 'pib_refresh', NUM, [], [] );
		this.stdout = [];
		this.stderr = [];
	}
	refresh = this.clear;
}
