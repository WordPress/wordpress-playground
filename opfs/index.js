var Module = {
	preRun: [],
	postRun: [
		function () {
			setTimeout(() => {
				Module.ccall('create_file');
			}, 1000);
		},
	],
};

importScripts('opfs.js');
