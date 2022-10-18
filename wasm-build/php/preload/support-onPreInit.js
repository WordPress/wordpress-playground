Module.preInit = function() {
	if ( Module.onPreInit ) {
		Module.onPreInit( {
			Module: Module,
			FS: typeof FS !== 'undefined' ? FS : undefined,
			NODEFS: typeof NODEFS !== 'undefined' ? NODEFS : undefined
		});
	}
};
