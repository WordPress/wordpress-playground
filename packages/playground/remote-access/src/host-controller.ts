import {
	DirectTunnelHost,
	type TunnelHostMetrics,
	type TunnelHostStatus,
} from './remote-access-direct-tunnel';
import type { RemoteAccessHostClient } from './types';

export interface RemoteAccessHostStatus {
	isActive: boolean;
	status: TunnelHostStatus;
	sessionId: string | null;
	accessCode: string | null;
	pendingVerificationCode: string | null;
	metrics: TunnelHostMetrics | null;
}

export interface RemoteAccessHostControllerOptions {
	relayUrl: string;
	onError?: (error: Error) => void;
}

export class RemoteAccessHostController {
	private tunnelHost: DirectTunnelHost | null = null;
	private currentSessionId: string | null = null;
	private readonly statusListeners = new Set<
		(status: RemoteAccessHostStatus) => void
	>();
	private readonly options: RemoteAccessHostControllerOptions;

	constructor(options: RemoteAccessHostControllerOptions) {
		this.options = options;
	}

	getStatus(): RemoteAccessHostStatus {
		return {
			isActive: this.tunnelHost !== null,
			status: this.tunnelHost?.getStatus() ?? 'disconnected',
			sessionId: this.currentSessionId,
			accessCode: this.tunnelHost?.getAccessCode() ?? null,
			pendingVerificationCode:
				this.tunnelHost?.getPendingVerificationCode() ?? null,
			metrics: this.tunnelHost?.getMetrics() ?? null,
		};
	}

	subscribe(listener: (status: RemoteAccessHostStatus) => void): () => void {
		this.statusListeners.add(listener);
		return () => {
			this.statusListeners.delete(listener);
		};
	}

	async start(playgroundClient: RemoteAccessHostClient): Promise<void> {
		if (this.tunnelHost) {
			if (this.currentSessionId) {
				return;
			}
			throw new Error('Remote access is already starting.');
		}

		this.tunnelHost = new DirectTunnelHost(
			playgroundClient,
			this.options.relayUrl
		);
		this.tunnelHost.on('statusChange', () => this.notifyListeners());
		this.tunnelHost.on('metricsChange', () => this.notifyListeners());
		this.tunnelHost.on('error', (error) => {
			this.options.onError?.(error);
			this.notifyListeners();
		});

		try {
			await this.tunnelHost.startSharing();
			this.currentSessionId = this.tunnelHost.getSessionId();
			this.notifyListeners();
		} catch (error) {
			this.tunnelHost = null;
			this.currentSessionId = null;
			this.notifyListeners();
			throw error;
		}
	}

	async stop(): Promise<void> {
		if (!this.tunnelHost) {
			return;
		}
		await this.tunnelHost.stopSharing();
		this.tunnelHost = null;
		this.currentSessionId = null;
		this.notifyListeners();
	}

	approve(verificationCode: string): boolean {
		const approved =
			this.tunnelHost?.approveRemoteAccess(verificationCode) ?? false;
		this.notifyListeners();
		return approved;
	}

	private notifyListeners() {
		const status = this.getStatus();
		for (const listener of this.statusListeners) {
			listener(status);
		}
	}
}
