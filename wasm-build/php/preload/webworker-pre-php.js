Module.preInit = function() {
	if ( Module.onPreInit ) {
		Module.onPreInit( FS, Module );
	}
};
