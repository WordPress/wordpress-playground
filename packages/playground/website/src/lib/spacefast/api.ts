import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import { extractSpacefastHandoffUrl } from './handoff';

const API = 'https://api.spacefast.com';

export type SpacefastConnection = {
	kind: 'team' | 'space';
	teamId?: string;
	spaceId?: string;
};

export type SpacefastSpace = {
	id: string;
	liveUrl: string | null;
	channels?: { live?: { versionId: string | null } };
};

export type PublishedFile = { path: string; data: Blob };

type Upload = {
	targets: {
		path: string;
		method: 'PUT' | 'POST';
		url: string;
		headers: Record<string, string>;
		body?: { kind: 'url'; url: string };
	}[];
};

/** A tab-scoped connection. Neither the handoff nor its key is persisted. */
export class SpacefastClient {
	private proxy: string;
	private token?: string;

	constructor(proxy: string) {
		this.proxy = proxy;
	}

	async connect(handoff: string): Promise<SpacefastConnection> {
		const url = extractSpacefastHandoffUrl(handoff);
		if (!url) {
			throw new Error(
				'Paste a Spacefast handoff URL or a prompt containing one.'
			);
		}
		const { data } = await this.request('/v1/auth/agent-handoffs/redeem', {
			method: 'POST',
			body: JSON.stringify({
				url,
				agentName: 'Playground prototype',
			}),
		});
		if (!data.apiKey?.secret) {
			throw new Error(
				'Spacefast did not return a connection credential.'
			);
		}
		this.token = data.apiKey.secret;
		return { kind: data.kind, teamId: data.teamId, spaceId: data.spaceId };
	}

	disconnect() {
		this.token = undefined;
	}

	async createSpace(teamId: string, title: string): Promise<SpacefastSpace> {
		const { data } = await this.request('/v1/spaces', {
			method: 'POST',
			body: JSON.stringify({ teamId, title, access: 'public' }),
		});
		return data;
	}

	async getSpace(id: string): Promise<SpacefastSpace> {
		return (await this.request(`/v1/spaces/${encodeURIComponent(id)}`))
			.data;
	}

	async publish(
		spaceId: string,
		files: PublishedFile[],
		options: { replace: boolean; deletePaths: string[] },
		onProgress: (message: string) => void
	) {
		onProgress('Preparing file manifest…');
		const manifest = [];
		for (const file of files) {
			const digest = await crypto.subtle.digest(
				'SHA-256',
				await file.data.arrayBuffer()
			);
			manifest.push({
				path: file.path,
				size: file.data.size,
				contentType: file.data.type || undefined,
				sha256: Array.from(new Uint8Array(digest), (n) =>
					n.toString(16).padStart(2, '0')
				).join(''),
			});
		}
		const receipt = (
			await this.request('/v1/publish', {
				method: 'POST',
				body: JSON.stringify({
					spaceId,
					files: manifest,
					publishMode: options.replace ? 'snapshot' : 'additive',
					deletePaths: options.deletePaths,
					source: {
						kind: 'api',
						client: 'playground-spacefast-prototype',
					},
				}),
			})
		).data;
		const byPath = new Map(files.map((file) => [file.path, file.data]));
		let upload: Upload | null = receipt.upload;
		let uploaded = 0;
		while (upload) {
			if (!upload.targets.length)
				throw new Error(
					'Spacefast returned no pending upload targets.'
				);
			for (const target of upload.targets) {
				onProgress(
					`Uploading ${++uploaded}/${files.length}: ${target.path}`
				);
				const body = target.body
					? JSON.stringify({ url: target.body.url })
					: byPath.get(target.path);
				if (body === undefined)
					throw new Error('Spacefast requested an undeclared file.');
				// The target carries its own upload authorization. Never attach the API key.
				const headers = new Headers(target.headers);
				if (headers.has('Authorization')) {
					headers.set(
						'X-Cors-Proxy-Allowed-Request-Headers',
						'authorization'
					);
				}
				const response = await fetchWithCorsProxy(
					new URL(target.url, API).href,
					{
						method: target.method,
						headers,
						body,
						credentials: 'omit',
						redirect: 'error',
					},
					this.proxy
				);
				await checkResponse(response);
			}
			if (!receipt.links?.refresh) break;
			upload = (
				await this.request(receipt.links.refresh, { method: 'POST' })
			).data.upload;
		}
		onProgress('Finalizing the Spacefast version…');
		if (receipt.links?.finalize) {
			await this.request(receipt.links.finalize, { method: 'POST' });
		}
		if (!receipt.version?.id)
			throw new Error('Spacefast did not return a version ID.');
		const versionUrl = `/v1/spaces/${encodeURIComponent(spaceId)}/versions/${encodeURIComponent(receipt.version.id)}`;
		for (let attempt = 0; attempt < 120; attempt++) {
			const { data: version } = await this.request(versionUrl);
			if (version.status === 'ready') {
				const space = await this.getSpace(spaceId);
				if (space.channels?.live?.versionId !== version.id) {
					throw new Error(
						`Version ${version.id} is ready but is not live. Check its promotion policy in Spacefast.`
					);
				}
				return { space, versionId: version.id };
			}
			if (['failed', 'canceled', 'expired'].includes(version.status)) {
				throw new Error(
					`Spacefast version ${version.id}: ${version.status}.`
				);
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
		throw new Error(
			`Version ${receipt.version.id} is still pending. Check Spacefast before publishing again.`
		);
	}

	private async request(path: string, init: RequestInit = {}) {
		const url = new URL(path, API);
		if (url.origin !== API)
			throw new Error(
				'Refusing to send the Spacefast credential to another origin.'
			);
		const headers = new Headers(init.headers);
		headers.set('Content-Type', 'application/json');
		if (init.method === 'POST')
			headers.set('Idempotency-Key', crypto.randomUUID());
		if (this.token) {
			headers.set('Authorization', `Bearer ${this.token}`);
			headers.set(
				'X-Cors-Proxy-Allowed-Request-Headers',
				'authorization'
			);
		}
		const response = await fetchWithCorsProxy(
			url.href,
			{
				...init,
				headers,
				credentials: 'omit',
				redirect: 'error',
				cache: 'no-store',
			},
			this.proxy
		);
		await checkResponse(response);
		return response.json();
	}
}

async function checkResponse(response: Response) {
	if (response.ok) return;
	const problem = await response.json().catch(() => null);
	throw new Error(
		[
			`Spacefast request failed (${response.status}).`,
			problem?.code,
			problem?.type,
			problem?.requestId ? `Request: ${problem.requestId}` : '',
		]
			.filter(Boolean)
			.join(' ')
	);
}
