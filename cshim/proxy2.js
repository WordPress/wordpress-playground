'use strict';

const dns = require('node:dns');
const util = require('node:util');
const lookup = util.promisify(dns.lookup);
const net = require('net'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	mime = require('mime'),
	Buffer = require('buffer').Buffer,
	WebSocketServer = require('ws').Server;

let webServer,
	wsServer,
	source_host,
	source_port,
	target_host,
	target_port,
	argv = null,
	onConnectedCallback = null,
	onDisconnectedCallback = null;

// Handle new WebSocket client
const newClient = async function (client, req) {
	const clientAddr = client._socket.remoteAddress;
	const log = function (msg) {
		console.log(' ' + clientAddr + ': ' + msg);
	};

	console.log(req ? req.url : client.upgradeReq.url);
	log('WebSocket connection from : ' + clientAddr + ' at URL ' + req.url);
	log(
		'Version ' +
			client.protocolVersion +
			', subprotocol: ' +
			client.protocol
	);

	const reqUrl = new URL(`ws://${source_host}:${source_port}` + req.url);

	const reqTargetPort = reqUrl.searchParams.get('port') || target_port;
	const reqTargetHost = reqUrl.searchParams.get('host') || target_host;
	let reqTargetIp;
	if (net.isIP(reqTargetHost) === 0) {
		log('resolving ' + reqTargetHost + '... ');
		const resolution = await lookup(reqTargetHost);
		reqTargetIp = resolution.address;
		log('resolved ' + reqTargetHost + ' -> ' + reqTargetIp);
	} else {
		reqTargetIp = reqTargetHost;
	}

	log('Opening a socket connection to ' + reqTargetIp + ':' + reqTargetPort);

	const target = net.createConnection(
		reqTargetPort,
		reqTargetIp,
		function () {
			log('connected to target');
			if (onConnectedCallback) {
				try {
					onConnectedCallback(client, target);
				} catch (e) {
					log('onConnectedCallback failed, cleaning up target');
					target.end();
				}
			}
		}
	);
	target.on('data', function (data) {
		log(`network -> PHP buffer: (${data.length} bytes)`);
		log(
			[...data/*.slice(0, 100)*/].map((x) => x.toString(16)).join(', ') +
				'...'
		);
		try {
			// client.send(data);
			client.send(data);
			// log('network -> PHP: ' + (data + '').substr(0, 40) + '...');
			// client.send(Buffer.concat([Buffer.from('\n'), data]));
		} catch (e) {
			log('Client closed, cleaning up target');
			target.end();
		}
	});
	target.on('end', function () {
		log('target disconnected');
		client.close();
	});
	target.on('error', function () {
		log('target connection error');
		target.end();
		client.close();
	});

	client.on('message', function (msg) {
		log(`PHP -> network buffer: (${msg.length} bytes)`);
		log(
			[...msg/*.slice(0, 100)*/].map((x) => x.toString(16)).join(', ') + '...'
		);
		target.write(msg);
	});
	client.on('close', function (code, reason) {
		if (onDisconnectedCallback) {
			try {
				onDisconnectedCallback(client, code, reason);
			} catch (e) {
				log('onDisconnectedCallback failed');
			}
		}

		log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
		target.end();
	});
	client.on('error', function (a) {
		log('WebSocket client error: ' + a);
		target.end();
	});
};

// Send an HTTP error response
const http_error = function (response, code, msg) {
	response.writeHead(code, { 'Content-Type': 'text/plain' });
	response.write(msg + '\n');
	response.end();
};

// Process an HTTP static file request
const http_request = function (request, response) {
	//    console.log("pathname: " + url.parse(req.url).pathname);
	//    res.writeHead(200, {'Content-Type': 'text/plain'});
	//    res.end('okay');

	if (!argv.web) {
		return http_error(response, 403, '403 Permission Denied');
	}

	let uri = url.parse(request.url).pathname,
		filename = path.join(argv.web, uri);

	fs.exists(filename, function (exists) {
		if (!exists) {
			return http_error(response, 404, '404 Not Found');
		}

		if (fs.statSync(filename).isDirectory()) {
			filename += '/index.html';
		}

		fs.readFile(filename, 'binary', function (err, file) {
			if (err) {
				return http_error(response, 500, err);
			}

			response.setHeader(
				'Content-type',
				mime.getType(path.parse(uri).ext)
			);
			response.writeHead(200);
			response.write(file, 'binary');
			response.end();
		});
	});
};

function initWsServer(_argv, callbacks = undefined) {
	argv = _argv;
	const source_arg = argv.source;
	const target_arg = argv.target;

	if (!callbacks) {
		console.log('no callbacks');
	} else {
		if (callbacks.onConnected) {
			onConnectedCallback = callbacks.onConnected;
			console.log('onConnectedCallback registered');
		}

		if (callbacks.onDisconnected) {
			onDisconnectedCallback = callbacks.onDisconnected;
			console.log('onDisconnectedCallback registered');
		}
	}

	// parse source and target arguments into parts
	try {
		let idx;
		idx = source_arg.indexOf(':');
		if (idx >= 0) {
			source_host = source_arg.slice(0, idx);
			source_port = parseInt(source_arg.slice(idx + 1), 10);
		} else {
			source_host = '';
			source_port = parseInt(source_arg, 10);
		}

		idx = target_arg.indexOf(':');
		if (idx < 0) {
			throw 'target must be host:port';
		}
		target_host = target_arg.slice(0, idx);
		target_port = parseInt(target_arg.slice(idx + 1), 10);

		if (isNaN(source_port) || isNaN(target_port)) {
			throw 'illegal port';
		}
	} catch (e) {
		console.error(
			'websockify.js [--web web_dir] [--cert cert.pem [--key key.pem]] [source_addr:]source_port target_addr:target_port'
		);
		process.exit(2);
	}

	console.log('WebSocket settings: ');
	console.log(
		'    - proxying from ' +
			source_host +
			':' +
			source_port +
			' to ' +
			target_host +
			':' +
			target_port
	);
	if (argv.web) {
		console.log('    - Web server active. Serving: ' + argv.web);
	}

	if (argv.cert) {
		argv.key = argv.key || argv.cert;
		const cert = fs.readFileSync(argv.cert),
			key = fs.readFileSync(argv.key);
		console.log(
			'    - Running in encrypted HTTPS (wss://) mode using: ' +
				argv.cert +
				', ' +
				argv.key
		);
		webServer = https.createServer({ cert, key }, http_request);
	} else {
		console.log('    - Running in unencrypted HTTP (ws://) mode');
		webServer = http.createServer(http_request);
	}
	webServer.listen(source_port, function () {
		wsServer = new WebSocketServer({ server: webServer });
		wsServer.on('connection', newClient);
	});
}

module.exports = initWsServer;
