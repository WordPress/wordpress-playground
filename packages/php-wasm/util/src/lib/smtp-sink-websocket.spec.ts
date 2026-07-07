import { describe, expect, it } from 'vitest';
import { SmtpSinkWebSocket } from './smtp-sink-websocket';

const decoder = new TextDecoder();

describe('SmtpSinkWebSocket', () => {
	it('emits open asynchronously and flushes sends buffered while connecting', async () => {
		const socket = new SmtpSinkWebSocket(
			'ws://localhost?port=25',
			() => {}
		);
		const messages: string[] = [];
		const open = new Promise<void>((resolve) => {
			socket.onopen = () => resolve();
		});

		socket.onmessage = ({ data }) => {
			messages.push(
				data instanceof Uint8Array ? decoder.decode(data) : data
			);
		};

		expect(socket.readyState).toBe(socket.CONNECTING);

		socket.send('NOOP\r\n');
		expect(socket.readyState).toBe(socket.CONNECTING);

		await open;
		expect(socket.readyState).toBe(socket.OPEN);
		await waitFor(() => messages.join('').includes('250 OK'));

		expect(messages.join('')).toMatch(/^220 /);

		const close = new Promise<void>((resolve) => {
			socket.onclose = () => resolve();
		});
		socket.close();
		await close;
	});
});

async function waitFor(predicate: () => boolean) {
	const deadline = Date.now() + 500;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	expect(predicate()).toBe(true);
}
