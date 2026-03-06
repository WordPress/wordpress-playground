import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignalingClient } from './signaling-client';

describe('SignalingClient', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function jsonResponse(data: unknown, status = 200) {
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			json: () => Promise.resolve(data),
		});
	}

	it('createRoom sends POST and returns room_code', async () => {
		fetchMock.mockReturnValue(jsonResponse({ room_code: 'ABC123' }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
		});
		const code = await client.createRoom();
		expect(code).toBe('ABC123');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.com/signaling.php?action=create',
			{ method: 'POST' }
		);
	});

	it('sendOffer sends POST with SDP body', async () => {
		fetchMock.mockReturnValue(jsonResponse({ ok: true }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
		});
		await client.sendOffer('ROOM1', 'v=0\r\n...');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.com/signaling.php?action=offer&room=ROOM1',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sdp: 'v=0\r\n...' }),
			}
		);
	});

	it('sendAnswer sends POST with SDP body', async () => {
		fetchMock.mockReturnValue(jsonResponse({ ok: true }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
		});
		await client.sendAnswer('ROOM1', 'v=0\r\nanswer...');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.com/signaling.php?action=answer&room=ROOM1',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sdp: 'v=0\r\nanswer...' }),
			}
		);
	});

	it('pollForOffer resolves when offer appears', async () => {
		fetchMock
			.mockReturnValueOnce(jsonResponse({ offer: null }))
			.mockReturnValueOnce(jsonResponse({ offer: 'sdp-offer-data' }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
			pollIntervalMs: 10,
		});
		const offer = await client.pollForOffer('ROOM1');
		expect(offer).toBe('sdp-offer-data');
		expect(fetchMock).toHaveBeenCalledTimes(2);
		// Verify URL includes role=answerer
		expect(fetchMock.mock.calls[0][0]).toContain('role=answerer');
	});

	it('pollForAnswer resolves when answer appears', async () => {
		fetchMock
			.mockReturnValueOnce(jsonResponse({ answer: null }))
			.mockReturnValueOnce(jsonResponse({ answer: 'sdp-answer-data' }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
			pollIntervalMs: 10,
		});
		const answer = await client.pollForAnswer('ROOM1');
		expect(answer).toBe('sdp-answer-data');
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0][0]).toContain('role=offerer');
	});

	it('pollForOffer rejects on AbortSignal', async () => {
		fetchMock.mockReturnValue(jsonResponse({ offer: null }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
			pollIntervalMs: 50,
		});
		const controller = new AbortController();
		const promise = client.pollForOffer('ROOM1', controller.signal);
		// Abort during the poll interval wait
		setTimeout(() => controller.abort(), 10);
		await expect(promise).rejects.toThrow();
	});

	it('throws on non-ok response for createRoom', async () => {
		fetchMock.mockReturnValue(jsonResponse({}, 500));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php',
		});
		await expect(client.createRoom()).rejects.toThrow(
			'Failed to create room: 500'
		);
	});

	it('strips trailing slash from baseUrl', async () => {
		fetchMock.mockReturnValue(jsonResponse({ room_code: 'X' }));
		const client = new SignalingClient({
			baseUrl: 'https://example.com/signaling.php/',
		});
		await client.createRoom();
		expect(fetchMock.mock.calls[0][0]).toBe(
			'https://example.com/signaling.php?action=create'
		);
	});
});
