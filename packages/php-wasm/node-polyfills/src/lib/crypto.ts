if (typeof crypto === 'undefined') {
	import('node:crypto').then((module) => {
		global.crypto = module.webcrypto as Crypto;
	});
}
