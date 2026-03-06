import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import {
	setupPlaygroundSync,
	SignalingClient,
	WebRTCTransport,
	loggerMiddleware,
} from '@wp-playground/sync';
import type { WebRTCTransportState, SyncMiddleware } from '@wp-playground/sync';
import { getRemoteUrl } from '../src/lib/config';

const SIGNALING_URL = new URL(
	'/signaling.php',
	window.location.origin
).toString();

export type DemoState = WebRTCTransportState | 'syncing' | 'ready';

/**
 * Create a signaling room and return the code immediately.
 * WordPress boot + WebRTC connection happen separately.
 */
export async function createRoom(
	signalingClient: SignalingClient
): Promise<string> {
	return signalingClient.createRoom();
}

/**
 * Boot WordPress, set up sync, then establish the WebRTC connection.
 *
 * For the answerer, the iframe stays hidden until the first sync
 * message is received and applied, then navigates to '/' to render
 * the synced content.  The caller receives 'ready' via onStateChange
 * when it's safe to show the iframe.
 */
export async function connectAndSync(
	iframe: HTMLIFrameElement,
	role: 'offerer' | 'answerer',
	roomCode: string,
	onStateChange: (state: DemoState) => void
): Promise<void> {
	const signalingClient = new SignalingClient({
		baseUrl: SIGNALING_URL,
	});

	const transport = new WebRTCTransport({
		signalingClient,
		role,
		roomCode,
		onStateChange,
	});

	// Each peer needs a distinct autoincrement offset so that new
	// rows created independently on each side never collide.
	const autoincrementOffset =
		role === 'offerer' ? 1_234_500_001 : 1_543_200_001;

	// Start the WebRTC connection in parallel with WordPress boot.
	// The transport queues messages until the DataChannel opens,
	// so it's safe to wire up sync before the connection completes.
	const connectPromise = transport.connect();

	const middlewares: SyncMiddleware[] = [loggerMiddleware(role)];

	// For the answerer, detect when the first sync message arrives.
	let resolveFirstSync: (() => void) | undefined;
	let firstSyncPromise: Promise<void> | undefined;
	if (role === 'answerer') {
		firstSyncPromise = new Promise<void>((resolve) => {
			resolveFirstSync = resolve;
		});
		let isFirst = true;
		middlewares.push({
			beforeSend: (e) => e,
			afterReceive: (e) => {
				if (isFirst) {
					isFirst = false;
					resolveFirstSync!();
				}
				return e;
			},
		});
	}

	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: getRemoteUrl().toString(),
		sqliteDriverVersion: 'v2.1.16',
	});

	await setupPlaygroundSync(playground, {
		autoincrementOffset,
		transport,
		middlewares,
	});

	await login(playground, { username: 'admin', password: 'password' });

	if (role === 'offerer') {
		await playground.goTo('/');
		onStateChange('ready');
	}

	await connectPromise;

	if (firstSyncPromise) {
		onStateChange('syncing');
		await firstSyncPromise;
		await playground.goTo('/');
		onStateChange('ready');
	}
}

export { SignalingClient };
