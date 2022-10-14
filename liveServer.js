const liveServer = require('live-server');

liveServer.start({
	port: 8777,
	root: __dirname + '/dist-web',
	open: '/wordpress-browser.html',
	file: 'wordpress-browser.html',
	middleware: [
		(req, res, next) => {
			if (req.url.startsWith('/scope:')) {
				req.url = '/' + req.url.split('/').slice(2).join('/');
			}
			next();
		},
	],
});

liveServer.start({
	port: 8778,
	root: __dirname + '/dist-web',
	open: false
});
