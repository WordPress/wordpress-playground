import { removeURLScope } from '@php-wasm/scopes';
import { cloneRequest } from '@php-wasm/web-service-worker';

export type DesktopRelayMapping = {
	scope: string;
	relayBaseUrl: string;
	expiresAt: number;
};

const desktopRelayMappings: Record<string, DesktopRelayMapping> = {};

export function handleDesktopRelayMessage(data: unknown): boolean {
	if (typeof data !== 'object' || data === null || !('type' in data)) {
		return false;
	}

	if (data.type === 'desktop-relay-map') {
		const { scope, relayBaseUrl, ttl } = data as Record<string, unknown>;
		if (typeof scope !== 'string' || typeof relayBaseUrl !== 'string') {
			return true;
		}
		desktopRelayMappings[scope] = {
			scope,
			relayBaseUrl,
			expiresAt:
				Date.now() +
				(typeof ttl === 'number' && Number.isFinite(ttl)
					? ttl
					: 5 * 60 * 1000),
		};
		return true;
	}

	if (data.type === 'desktop-relay-clear') {
		const { scope } = data as Record<string, unknown>;
		if (typeof scope === 'string') {
			delete desktopRelayMappings[scope];
		}
		return true;
	}

	return false;
}

export function getDesktopRelayMapping(
	scope: string
): DesktopRelayMapping | undefined {
	const mapping = desktopRelayMappings[scope];
	if (!mapping) {
		return;
	}
	if (mapping.expiresAt <= Date.now()) {
		delete desktopRelayMappings[scope];
		return;
	}
	return mapping;
}

export async function handleDesktopRelayRequest(
	event: FetchEvent,
	mapping: DesktopRelayMapping
) {
	const relayUrl = getDesktopRelayUrl(event.request.url, mapping);
	const request = await cloneRequest(event.request, {
		url: relayUrl,
	});
	return fetch(request);
}

function getDesktopRelayUrl(
	scopedRequestUrl: string,
	mapping: DesktopRelayMapping
) {
	const unscopedUrl = removeURLScope(new URL(scopedRequestUrl));
	const relayUrl = new URL(mapping.relayBaseUrl, self.location.origin);
	const relayBasePath = relayUrl.pathname.replace(/\/$/, '');
	relayUrl.pathname =
		relayBasePath +
		(unscopedUrl.pathname === '/' ? '/' : unscopedUrl.pathname);
	relayUrl.search = unscopedUrl.search;
	relayUrl.hash = unscopedUrl.hash;
	return relayUrl;
}
