const liveServer = require('live-server');
const request = require('request');

liveServer.start({
	port: 8777,
	root: __dirname + '/dist-web',
	open: '/wordpress-browser.html',
	file: 'wordpress-browser.html',
	middleware: [
		(req, res, next) => {
			if (req.url.startsWith('/scope:')) {
				req.url = '/' + req.url.split('/').slice(2).join('/');
			} else if (req.url.startsWith('/plugin-proxy')) {
				const url = new URL(req.url, 'http://127.0.0.1:8777');
				const pluginName = url.searchParams.get('plugin').replace(/[^a-zA-Z0-9\.\-_]/, '');
				request(`https://downloads.wordpress.org/plugin/${pluginName}`).pipe(res);
				return;
			}
			next();
		},
	],
});

liveServer.start({
	port: 8778,
	root: __dirname + '/dist-web',
	open: false,
	middleware: [
		(req, res, next) => {
			res.setHeader('Origin-Agent-Cluster', '?1');
			next();
		},
	],
});
