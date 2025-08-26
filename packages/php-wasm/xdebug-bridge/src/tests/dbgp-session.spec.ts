import './mocker';
import { vi } from 'vitest';
import net from 'net';
import { DbgpSession } from '../lib/dbgp-session';

describe('DbgpSession', () => {
	let server: any;
	let socket: any;

	beforeEach(() => {
		socket = new net.Socket();
		server = new net.Server();

		vi.spyOn(net, 'createServer').mockImplementation(() => server);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('listens on specified port', () => {
		new DbgpSession(1234);

		expect(net.createServer).toHaveBeenCalled();
		expect(server.listen).toHaveBeenCalledWith(1234);
	});

	it('emits connected on first connection', () => {
		const session = new DbgpSession();

		const onConnected = vi.fn();
		session.on('connected', onConnected);
		server.onConnectionHandler(socket);

		expect(socket.setEncoding).toHaveBeenCalledWith('utf8');
		expect(onConnected).toHaveBeenCalled();
	});

	it('rejects second connection', () => {
		new DbgpSession();
		server.onConnectionHandler(socket);

		const secondSocket = new net.Socket();
		secondSocket.destroy = vi.fn();

		server.onConnectionHandler(secondSocket);
		expect(secondSocket.destroy).toHaveBeenCalled();
	});

	it('emits message when receiving valid length-prefixed XML data', () => {
		const session = new DbgpSession();
		server.onConnectionHandler(socket);

		const onMessage = vi.fn();
		session.on('message', onMessage);

		socket.emit('data', '25\x00<response>test</response>\x00');

		expect(onMessage).toHaveBeenCalledWith('<response>test</response>');
	});

	it('handles partial and multiple messages correctly', () => {
		const session = new DbgpSession();
		server.onConnectionHandler(socket);

		const onMessage = vi.fn();
		session.on('message', onMessage);

		socket.emit('data', '24\x00<respo');
		socket.emit('data', 'nse>foo</response>\x00');

		expect(onMessage).toHaveBeenCalledWith('<response>foo</response>');

		socket.emit(
			'data',
			'24\x00<response>bar</response>\x0024\x00<response>baz</response>\x00'
		);

		expect(onMessage).toHaveBeenCalledWith('<response>bar</response>');
		expect(onMessage).toHaveBeenCalledWith('<response>baz</response>');
	});

	it('sends command with null terminator', () => {
		const session = new DbgpSession();
		server.onConnectionHandler(socket);

		session.sendCommand('run -i 1');
		expect(socket.write).toHaveBeenCalledWith('run -i 1\x00');
	});

	it('emits close and reset socket on close', () => {
		const session = new DbgpSession();
		server.onConnectionHandler(socket);

		const onClose = vi.fn();
		session.on('close', onClose);

		socket.emit('close');
		expect(onClose).toHaveBeenCalled();
	});

	it('emits error events', () => {
		const session = new DbgpSession();
		server.onConnectionHandler(socket);

		const onError = vi.fn();
		session.on('error', onError);

		const err = new Error('Test');
		socket.emit('error', err);
		expect(onError).toHaveBeenCalledWith(err);
	});
});
