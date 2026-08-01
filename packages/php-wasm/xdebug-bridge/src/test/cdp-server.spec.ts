import './mocker';
import { vi } from 'vitest';
import { WebSocket } from 'ws';
import { CDPServer } from '../lib/cdp-server';

describe('CDPServer', () => {
	let server: any;
	let socket: any;

	beforeEach(() => {
		// @ts-ignore
		socket = new WebSocket();
		server = new CDPServer(9999);
	});

	afterEach(() => {
		server.removeAllListeners();
		vi.clearAllMocks();
	});

	it('emits clientConnected on new connection', () => {
		const onClientConnected = vi.fn();

		server.on('clientConnected', onClientConnected);
		server.wss.emit('connection', socket);

		expect(onClientConnected).toHaveBeenCalled();
	});

	it('only allows one client at a time', () => {
		// @ts-ignore
		const client = new WebSocket();
		const spy = vi.spyOn(client, 'close');

		server.wss.emit('connection', socket);
		server.wss.emit('connection', client);

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('emits message when a valid JSON message is received', () => {
		const msg = { id: 1, method: 'Debugger.enable' };
		const onMessage = vi.fn();

		server.connected = true;
		server.on('message', onMessage);
		server.wss.emit('connection', socket);
		socket.emit('message', JSON.stringify(msg));

		expect(onMessage).toHaveBeenCalledWith(msg);
	});

	it('ignores invalid JSON messages', () => {
		const onMessage = vi.fn();

		server.on('message', onMessage);
		server.wss.emit('connection', socket);
		socket.emit('message', '{ invalid json }');

		expect(onMessage).not.toHaveBeenCalled();
	});

	it('emits clientDisconnected when client closes', () => {
		const onDisconnect = vi.fn();

		server.on('clientDisconnected', onDisconnect);
		server.wss.emit('connection', socket);
		socket.emit('close');

		expect(onDisconnect).toHaveBeenCalled();
	});

	it('emits error on websocket error', () => {
		const error = new Error('Test error');
		const onError = vi.fn();

		server.on('error', onError);
		server.wss.emit('connection', socket);
		socket.emit('error', error);

		expect(onError).toHaveBeenCalledWith(error);
	});

	it('sends a message if client is connected and open', () => {
		const msg = { id: 1, result: 'ok' };

		server.wss.emit('connection', socket);
		server.sendMessage(msg);

		expect(socket.send).toHaveBeenCalledWith(JSON.stringify(msg));
	});

	it('does not send message if no client connected', () => {
		server.sendMessage({ hello: 'world' });

		expect(socket.send).not.toHaveBeenCalled();
	});

	it('does not send message if client is not OPEN', () => {
		socket.readyState = 0;

		server.wss.emit('connection', socket);
		server.sendMessage({ id: 1 });

		expect(socket.send).not.toHaveBeenCalled();
	});
});
