export interface SignalingClientOptions {
	baseUrl: string;
	pollIntervalMs?: number;
}

export class SignalingClient {
	private baseUrl: string;
	private pollIntervalMs: number;

	constructor(options: SignalingClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/$/, '');
		this.pollIntervalMs = options.pollIntervalMs ?? 1500;
	}

	async createRoom(): Promise<string> {
		const response = await fetch(`${this.baseUrl}?action=create`, {
			method: 'POST',
		});
		if (!response.ok) {
			throw new Error(`Failed to create room: ${response.status}`);
		}
		const data = await response.json();
		return data.room_code;
	}

	async sendOffer(room: string, sdp: string): Promise<void> {
		const response = await fetch(
			`${this.baseUrl}?action=offer&room=${encodeURIComponent(room)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sdp }),
			}
		);
		if (!response.ok) {
			throw new Error(`Failed to send offer: ${response.status}`);
		}
	}

	async sendAnswer(room: string, sdp: string): Promise<void> {
		const response = await fetch(
			`${this.baseUrl}?action=answer&room=${encodeURIComponent(room)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sdp }),
			}
		);
		if (!response.ok) {
			throw new Error(`Failed to send answer: ${response.status}`);
		}
	}

	async pollForOffer(room: string, signal?: AbortSignal): Promise<string> {
		return this.poll(room, 'answerer', 'offer', signal);
	}

	async pollForAnswer(room: string, signal?: AbortSignal): Promise<string> {
		return this.poll(room, 'offerer', 'answer', signal);
	}

	private async poll(
		room: string,
		role: string,
		field: string,
		signal?: AbortSignal
	): Promise<string> {
		while (true) {
			signal?.throwIfAborted();

			const response = await fetch(
				`${this.baseUrl}?action=poll&room=${encodeURIComponent(room)}&role=${encodeURIComponent(role)}`,
				{ signal }
			);
			if (!response.ok) {
				throw new Error(`Poll failed: ${response.status}`);
			}
			const data = await response.json();
			if (data[field]) {
				return data[field];
			}

			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, this.pollIntervalMs);
				signal?.addEventListener(
					'abort',
					() => {
						clearTimeout(timer);
						reject(signal.reason);
					},
					{ once: true }
				);
			});
		}
	}
}
