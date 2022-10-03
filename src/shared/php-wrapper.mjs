
const STR = 'string';
const NUM = 'number';

export default class PHPWrapper {
	_initPromise;
	call;

	stdout = [];
	stderr = [];

	async init( PhpBinary, args = {} ) {
		if ( this._initPromise ) {
			return this._initPromise;
		}

		this._initPromise = (
			new PhpBinary( {} )
				.then( ( { ccall } ) => {
					ccall( 'pib_init', NUM, [ STR ], [] );
					this.call = ccall;
				} )
		);
		return this._initPromise;
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
