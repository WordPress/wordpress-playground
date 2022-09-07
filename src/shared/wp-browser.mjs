
export default class WPBrowser {
	constructor( wp, config = {} ) {
		this.wp = wp;
		this.cookies = {};
		this.config = {
			handleRedirects: false,
			maxRedirects: 4,
			...config,
		};
	}

	async request( request, redirects = 0 ) {
		const response = await this.wp.request( {
			...request,
			_COOKIE: this.cookies,
		} );

		if ( response.headers[ 'set-cookie' ] ) {
			this.setCookies( response.headers[ 'set-cookie' ] );
		}

		if ( this.config.handleRedirects && response.headers.location && redirects < this.config.maxRedirects ) {
			const parsedUrl = new URL( response.headers.location[ 0 ], this.wp.ABSOLUTE_URL );
			return this.request( {
				path: parsedUrl.pathname,
				method: 'GET',
				_GET: parsedUrl.search,
				headers: {},
			}, redirects + 1 );
		}

		return response;
	}

	setCookies( cookies ) {
		for ( const cookie of cookies ) {
			try {
				const value = cookie.split( '=' )[ 1 ].split( ';' )[ 0 ];
				const name = cookie.split( '=' )[ 0 ];
				this.cookies[ name ] = value;
			} catch ( e ) {
				console.error( e );
			}
		}
	}
}
