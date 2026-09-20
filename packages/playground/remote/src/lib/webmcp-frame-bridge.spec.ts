// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebMCPFrameBridge } from './webmcp-frame-bridge';

// Contract: a response belongs to one WordPress document. Head announcements,
// load events, and asynchronous PHP responses arrive through independent paths.
describe('WordPress document request lifecycle', () => {
	afterEach(() => {
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('does not reject a request when its current document finishes loading', async () => {
		vi.useFakeTimers();
		const { bridge, frame, announce, respond, postMessage } = setup();
		announce('one');
		const result = bridge.listAbilities();
		const request = postMessage.mock.calls.at(-1)![0];
		expect(request.documentId).toBe('one');
		frame.dispatchEvent(new Event('load'));
		announce('one');
		respond(request.callId, {
			available: true,
			abilities: [],
			user: { id: 1, name: 'admin' },
		});
		await expect(result).resolves.toMatchObject({ available: true });
	});

	it('rejects pending execution when another document announces itself', async () => {
		const { bridge, announce } = setup();
		announce('one');
		const pending = bridge.executeAbility('test/write', false);
		const assertion = expect(pending).rejects.toThrow(
			'operation may have completed'
		);
		announce('two');
		await assertion;
	});

	it('rejects pending calls when navigation reaches a document without the bridge', async () => {
		vi.useFakeTimers();
		const { bridge, frame, announce } = setup();
		announce('one');
		const pending = bridge.executeAbility('test/write');
		const assertion = expect(pending).rejects.toThrow(
			'WordPress navigated'
		);
		frame.dispatchEvent(new Event('load'));
		vi.advanceTimersByTime(1000);
		await assertion;
	});
});

function setup() {
	const frame = document.createElement('iframe');
	document.body.append(frame);
	const postMessage = vi
		.spyOn(frame.contentWindow!, 'postMessage')
		.mockImplementation(() => {});
	const bridge = createWebMCPFrameBridge(frame);
	const send = (data: unknown) =>
		window.dispatchEvent(
			new MessageEvent('message', {
				source: frame.contentWindow,
				origin: window.location.origin,
				data,
			})
		);
	return {
		bridge,
		frame,
		postMessage,
		announce: (documentId: string) =>
			send({
				type: 'playground-webmcp-tools-changed',
				documentId,
				tools: [],
			}),
		respond: (callId: string, result: unknown) =>
			send({
				type: 'playground-webmcp-call-result',
				callId,
				resultJson: JSON.stringify(result),
			}),
	};
}
