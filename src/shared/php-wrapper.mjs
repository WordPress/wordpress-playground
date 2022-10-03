
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

}
