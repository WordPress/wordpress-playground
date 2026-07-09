export interface ResolveAccessCodeResponse {
	sessionId: string;
}

type RelayEndpointAction = 'session' | 'code' | 'status' | 'signal' | 'close';

export function normalizeAccessCode(value: string): string | null {
	const digits = value.replace(/\D+/g, '');
	if (digits.length !== 6) {
		return null;
	}
	return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function formatAccessCode(value: string): string {
	const digits = value.replace(/\D+/g, '').slice(0, 6);
	if (digits.length <= 3) {
		return digits;
	}
	return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export async function resolveAccessCode(
	relayUrl: string,
	accessCode: string
): Promise<ResolveAccessCodeResponse> {
	const response = await fetch(
		buildRemoteAccessRelayEndpointUrl(relayUrl, 'code', { accessCode })
	);
	if (!response.ok) {
		throw new ResolveAccessCodeError(response);
	}
	return (await response.json()) as ResolveAccessCodeResponse;
}

export function buildRemoteAccessRelayEndpointUrl(
	relayUrl: string,
	action: RelayEndpointAction,
	params: Record<string, string | number | null | undefined> = {}
): string {
	const baseUrl = new URL(relayUrl);
	if (!baseUrl.pathname.endsWith('/')) {
		baseUrl.pathname = `${baseUrl.pathname}/`;
	}
	const url = new URL('relay.php', baseUrl);
	url.searchParams.set('action', action);
	for (const [name, value] of Object.entries(params)) {
		if (value !== null && value !== undefined) {
			url.searchParams.set(name, String(value));
		}
	}
	return url.toString();
}

export function buildRemoteAccessUrl(
	currentUrl: string,
	sessionId: string,
	shareParam = 'share'
): string {
	const viewerUrl = new URL(currentUrl, 'http://remote-access.local');
	viewerUrl.searchParams.set(shareParam, sessionId);
	return `${viewerUrl.pathname}${viewerUrl.search}`;
}

export class ResolveAccessCodeError extends Error {
	readonly response: Response;

	constructor(response: Response) {
		super(response.statusText || `HTTP ${response.status}`);
		this.name = 'ResolveAccessCodeError';
		this.response = response;
	}
}
