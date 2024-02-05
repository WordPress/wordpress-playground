if (typeof crypto === 'undefined') {
	import('crypto').then((module) => {
		global.crypto = module as Crypto;
	});
}
