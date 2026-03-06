import type { IncomingMessage, ServerResponse } from 'http';

interface Room {
	offer: string | null;
	answer: string | null;
	createdAt: number;
}

const rooms = new Map<string, Room>();
const ROOM_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SDP_SIZE = 64 * 1024; // 64KB

function generateRoomCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

function cleanupExpiredRooms() {
	const now = Date.now();
	for (const [code, room] of rooms) {
		if (now - room.createdAt > ROOM_EXPIRY_MS) {
			rooms.delete(code);
		}
	}
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', (chunk: Buffer) => {
			body += chunk.toString();
			if (body.length > MAX_SDP_SIZE) {
				reject(new Error('Body too large'));
			}
		});
		req.on('end', () => resolve(body));
		req.on('error', reject);
	});
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	});
	res.end(JSON.stringify(data));
}

export const signalingMiddleware = async (
	req: IncomingMessage,
	res: ServerResponse,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	next: Function
) => {
	if (!req.url?.startsWith('/signaling.php')) {
		next();
		return;
	}

	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		jsonResponse(res, 204, '');
		return;
	}

	const query = new URL(req.url, 'http://example.com').searchParams;
	const action = query.get('action');

	if (action === 'create' && req.method === 'POST') {
		cleanupExpiredRooms();
		const roomCode = generateRoomCode();
		rooms.set(roomCode, {
			offer: null,
			answer: null,
			createdAt: Date.now(),
		});
		jsonResponse(res, 200, { room_code: roomCode });
		return;
	}

	const roomCode = query.get('room');
	if (!roomCode) {
		jsonResponse(res, 400, { error: 'Missing room parameter' });
		return;
	}

	const room = rooms.get(roomCode);
	if (!room) {
		jsonResponse(res, 404, { error: 'Room not found' });
		return;
	}

	if (action === 'offer' && req.method === 'POST') {
		const body = await readBody(req);
		const { sdp } = JSON.parse(body);
		if (!sdp || typeof sdp !== 'string') {
			jsonResponse(res, 400, { error: 'Missing sdp' });
			return;
		}
		room.offer = sdp;
		jsonResponse(res, 200, { ok: true });
		return;
	}

	if (action === 'answer' && req.method === 'POST') {
		const body = await readBody(req);
		const { sdp } = JSON.parse(body);
		if (!sdp || typeof sdp !== 'string') {
			jsonResponse(res, 400, { error: 'Missing sdp' });
			return;
		}
		room.answer = sdp;
		jsonResponse(res, 200, { ok: true });
		return;
	}

	if (action === 'poll' && req.method === 'GET') {
		const role = query.get('role');
		if (role === 'offerer') {
			jsonResponse(res, 200, { answer: room.answer });
		} else if (role === 'answerer') {
			jsonResponse(res, 200, { offer: room.offer });
		} else {
			jsonResponse(res, 400, { error: 'Invalid role' });
		}
		return;
	}

	jsonResponse(res, 400, { error: 'Invalid action' });
};
